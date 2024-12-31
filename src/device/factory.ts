import {WebSocket} from "ws";
import {Logger} from "../logger/logger.js";
import {Device} from "./device.js";
import {Checker} from "./checker.js";
import {SwitchBot} from "./switchbot.js";
import {RemoteBot} from "./remotebot.js";
import {prisma} from "../server.js";

export class DeviceFactory{
    protected static readonly modelList: Record<string, typeof Device> = {};

    static register<T extends typeof Device>(value: T): void{
        if(this.modelList[value.MODEL_ID]){
            throw new Error(`해당 번호(id: ${value.MODEL_ID})는 이미 등록되어있습니다`);
        }
        this.modelList[value.MODEL_ID] = value;
    }

    static async init(): Promise<void>{
        this.register(Checker);
        this.register(SwitchBot);
        this.register(RemoteBot);

        const deviceList = await prisma.device.findMany();
        for(const device of deviceList){
            try{
                this.create(device.model, device.id, device.name, device.battery, device.extra);
            }catch(error: any){
                console.error(error);
            }
        }
    }

    static create(model: number, ...args: any[]): Device{
        const DeviceClass = this.modelList[model];
        if(!DeviceClass){
            throw new Error(`Device type '${model}' is not registered.`);
        }
        return DeviceClass.create(...args);
    }

    static validateConnect(typeId: number, socket: WebSocket, data: Buffer): void{
        const DeviceClass = this.modelList[typeId];
        if(typeof DeviceClass !== 'function'){
            return;
        }
        const device = DeviceClass.connectDevice(socket, data);
        socket.send(device.id);
        socket.on('close', () => device.socket === socket && Logger.info(`${device.modelName}(id: ${device.id})의 연결이 해제되었습니다.`));
    }
}