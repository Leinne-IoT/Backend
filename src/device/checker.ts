import {Device} from "./device.js";
import {JSONData, lshift} from '../utils/utils.js';
import {Logger} from '../logger/logger.js';
import {WebSocket} from 'ws';
import {isDate} from "../utils/date.js";
import {WebClient} from "../web/socket/client.js";
import {WebPush} from "../web/notify/webpush.js";
import {prisma} from "../server.js";

export class Checker extends Device{
    static readonly MODEL_ID: number = 0x01;
    static readonly MODEL_NAME: string = '체커';

    private static readonly checkerList: {[id: string]: Checker} = {}

    static get(id: string): Checker | undefined{
        return this.checkerList[id];
    }

    static getAll(): Checker[]{
        return Object.values(this.checkerList);
    }

    static connectDevice(socket: WebSocket, data: Buffer): Checker{
        const id = data.toString('utf-8', 3).replace(/\0/g, '').trim();
        Device.assertValidDeviceId(id);

        const battery = (data[2] & 0b1111) * 10;
        const device = (() => {
            if(!this.list[id]){
                const newChecker = this.create(id, id, battery);
                prisma.device.create({
                    data: {
                        id,
                        name: id,
                        model: this.MODEL_ID,
                        battery: battery,
                        extra: newChecker.extra
                    }
                })
                return newChecker;
            }
            return this.list[id] as Checker;
        })();
        device.socket = socket;
        device.battery = battery;
        device.setOpenState(!!((data[2] >> 4) & 0b1111));
        return device;
    }

    static create(id: string, name: string, battery: number | null = 100, extra: JSONData = {}): Checker{
        let date: any = extra.recordDate;
        if(date == null){
            date = new Date(0);
        }else if(!(date instanceof Date)){
            date = new Date(date);
        }
        extra.recordDate = isDate(date) ? date : new Date(0);
        extra.open ??= true;

        const checker = new Checker(id, name, battery, extra);
        if(id){
            Checker.checkerList[id] = checker;
        }
        return checker;
    }

    get modelId(): number{
        return Checker.MODEL_ID;
    }

    get modelName(): string{
        return Checker.MODEL_NAME;
    }

    get open(): boolean{
        return this.extra.open;
    }

    get recordDate(): Date{
        return this.extra.recordDate;
    }

    set socket(socket: WebSocket){
        super.socket = socket;
        socket.on('message', (data: Buffer) => {
            if(data[0] === 0x02){
                this.battery = (data[1] & 0b1111) * 10;
                const date = new Date();
                let realTime = date.getTime();
                for(let byte = 0; byte < 4; ++byte){
                    realTime -= lshift(data[2 + byte], 8 * (3 - byte));
                }
                date.setTime(realTime);
                this.setOpenState(!!((data[1] >> 4) & 0b1111), date);
            }
        });
    }

    private setOpenState(value: boolean, date?: Date){
        if(this.extra.open == value){
            return;
        }

        date ??= new Date();
        this.extra.open = value;
        this.extra.recordDate = date;
        this.synchronize('extra')
        this.lastUpdate = date.getTime();

        WebClient.broadcastDevice(this);
        const hour = date.getHours();
        const minute = date.getMinutes();
        const prefixText = hour >= 12 ? '오후' : '오전';
        WebPush.broadcast(
            `${this.name}이(가) ${value ? "열림" : "닫힘"}`,
            `${value ? "열린" : "닫힌"} 시각: ${prefixText} ${hour % 12 || 12}:${minute > 9 ? minute : '0' + minute}, 배터리: ${this._battery}%`,
            value ? "door_open.png" : "door_close.png"
        ).then();
        prisma.checkerHistory.create({
            data: {
                deviceId: this.id,
                open: value,
                battery: this._battery,
                recordDate: date
            }
        }).then()
        Logger.info(`${this.name}(id: ${this.id})이(가) ${value ? "열림" : "닫힘"}`);
    }

    toJSON(): JSONData{
        const data = super.toJSON();
        data.open = this.open;
        data.recordDate = this.recordDate;
        return data;
    }
}