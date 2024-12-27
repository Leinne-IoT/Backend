import {Job, scheduleJob} from 'node-schedule';
import {PrismaClient} from '@prisma/client';
import {SwitchBot} from '../device/switchbot.js';
import {Logger} from '../logger/logger.js';
import {isArray, isNumeric, isObject} from "../utils/utils.js";
import {Device} from "../device/device.js";
import {RemoteBot} from "../device/remotebot.js";
import {Holiday} from "../utils/holiday.js";

const prisma = new PrismaClient();

type RecurrenceType = 'ONCE' | 'WEEKLY'

interface ScheduleArgs{
    deviceId: string;
    [key: string]: any;
}

interface Schedule{
    id: number;
    enable: boolean;
    category: string;
    args: ScheduleArgs;
    actionTime: Date;
    excludeHoliday: boolean;
    recurrenceType: RecurrenceType;
    recurrenceDays: number[];
}

export class Scheduler{
    private readonly jobs: Record<number, Job> = {}; // 실행 중인 작업 관리
    private readonly schedules: Record<number, Schedule> = {}; // 모든 스케줄 관리

    // 스케줄 데이터 검증
    private validateScheduleData(scheduleData: Schedule): void{
        scheduleData.id = +scheduleData.id;
        if(!isNumeric(scheduleData.id) || scheduleData.id < 1){
            throw new Error('schedule id가 올바른 숫자가 아닙니다.');
        }

        const args = scheduleData.args as ScheduleArgs;
        if(!isObject(args) || !args.deviceId){
            throw new Error('args가 object가 아니거나 deviceId가 포함되어있지 않습니다.');
        }

        const actionTime = scheduleData.actionTime;
        if(isNaN(actionTime.getTime())){
            throw new Error('actionTime이 유효한 날짜가 아닙니다.');
        }

        const recurrenceType = scheduleData.recurrenceType;
        if(recurrenceType !== 'ONCE' && recurrenceType !== 'WEEKLY'){
            throw new Error("recurrenceType은 ('ONCE', 'WEEKLY')중 하나여야 합니다.");
        }

        let recurrenceDays = scheduleData.recurrenceDays as number[];
        if(!isArray(recurrenceDays)){
            throw new Error('recurrenceDays가 배열이 아닙니다.');
        }
        recurrenceDays = [...new Set(recurrenceDays)];
        if(!recurrenceDays.every(day => day >= 0 && day <= 6)){
            throw new Error('recurrenceDays는 배열이어야하며 0~6 사이의 숫자로 구성돼야합니다.');
        }
    }

    async init(){
        const allSchedules = await prisma.schedule.findMany();
        for(const schedule of allSchedules){
            const result: Schedule = {
                id: schedule.id,
                enable: schedule.enable,
                category: schedule.category,
                args: schedule.args as ScheduleArgs,
                actionTime: schedule.actionTime,
                excludeHoliday: schedule.excludeHoliday,
                recurrenceType: schedule.recurrenceType as RecurrenceType,
                recurrenceDays: schedule.recurrenceDays as number[]
            }
            try{
                this.validateScheduleData(result);
                this.schedules[result.id] = result;
            }catch(error){
                console.log(error);
                Logger.error(`스케줄러를 등록하는 도중 오류가 발생했습니다. (id: ${result.id}`);
            }
        }

        for(const id in this.schedules){
            const scheduleData = this.schedules[id];
            if(scheduleData.enable){ // 활성화된 스케줄만 Job으로 등록
                this.registerJob(scheduleData);
            }
        }
    }

    // 스케줄 추가
    async add(scheduleData: Schedule){
        this.validateScheduleData(scheduleData);
        const result = await prisma.schedule.create({
            data: {
                category: scheduleData.category,
                args: scheduleData.args,
                actionTime: scheduleData.actionTime,
                recurrenceType: scheduleData.recurrenceType,
                recurrenceDays: scheduleData.recurrenceDays,
                enable: scheduleData.enable
            },
        });
        const newSchedule = {...scheduleData, id: result.id};
        this.schedules[result.id] = newSchedule; // 스케줄 배열에 추가

        if(scheduleData.enable){
            this.registerJob(newSchedule);
        }
    }

    getAll(): Schedule[]{
        return Object.values(this.schedules);
    }

    async turnOn(id: number){
        if(this.schedules[id].enable){
            return;
        }

        this.registerJob(this.schedules[id]);
        await prisma.schedule.update({
            where: {id},
            data: {
                enable: this.schedules[id].enable = true
            },
        })
    }

    async turnOff(id: number){
        if(!this.schedules[id].enable){
            return;
        }
        this.jobs[id]?.cancel(); // Job 취소
        delete this.jobs[id]; // Job에서 제거
        await prisma.schedule.update({
            where: {id},
            data: {
                enable: this.schedules[id].enable = false
            },
        });
    }

    // Job 시작
    private registerJob(scheduleData: Schedule){
        if(this.jobs[scheduleData.id]){
            return;
        }

        let job: Job;
        switch(scheduleData.recurrenceType){
            case 'ONCE':
                job = scheduleJob(scheduleData.actionTime, async () => {
                    try{
                        await this.executeAction(scheduleData);
                        await prisma.schedule.update({
                            where: {id: scheduleData.id},
                            data: {enable: false}, // 한 번 실행 후 비활성화
                        });
                        await this.turnOff(scheduleData.id);
                    }catch(error){
                        console.error(error);
                        Logger.error(`스케줄 실행 중 오류가 발생했습니다.`);
                        await this.turnOff(scheduleData.id);
                    }
                });
                break;
            case 'WEEKLY':
                job = scheduleJob({
                    hour: scheduleData.actionTime.getHours(),
                    minute: scheduleData.actionTime.getMinutes(),
                    dayOfWeek: scheduleData.recurrenceDays
                }, async () => {
                    try{
                        await this.executeAction(scheduleData);
                    }catch(error){
                        console.error(error);
                        Logger.error(`스케줄 실행 중 오류가 발생했습니다.`);
                        await this.turnOff(scheduleData.id);
                    }
                });
                break;
            default:
                throw new Error('지원되지 않는 반복 유형입니다.');
        }
        this.jobs[scheduleData.id] = job;
    }

    // 작업 실행
    private async executeAction(scheduleData: Schedule){
        if(scheduleData.excludeHoliday && await Holiday.isHoliday(new Date())){
            return;
        }

        switch(scheduleData.category){
            case 'switch':{
                const {deviceId, channel, state} = scheduleData.args;
                if(!Device.isValidDeviceId(deviceId) || channel == null || state == null){
                    Logger.error(`필수 인자가 누락되었습니다. {id: ${deviceId}, channel: ${channel}, state: ${state}}`);
                    return;
                }

                const switchBot = SwitchBot.get(deviceId);
                if(!switchBot){
                    Logger.error(`기기 id 값이 잘못되었습니다. [id: ${deviceId}]`);
                    return;
                }
                switchBot.setState(channel, state);
                break;
            }
            case 'remote':{
                const {deviceId} = scheduleData.args;
                const remoteBot = RemoteBot.get(deviceId);
                if(!remoteBot){
                    Logger.error(`기기 id 값이 잘못되었습니다. [id: ${deviceId}]`);
                }
                break;
            }
            default:
                throw new Error(`Unknown action: ${scheduleData.category}`);
        }
    }
}
