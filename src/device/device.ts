import {WebSocket} from "ws";
import {JSONData} from "../utils/utils.js";
import {Logger} from "../logger/logger.js";
import {Device as DeviceModel} from '@prisma/client';
import {prisma} from "../server.js";

export abstract class Device{
    static readonly MODEL_ID: number = 0x00;
    static readonly MODEL_NAME: string = '';

    protected static readonly list: {[id: string]: Device} = {};

    static isValidDeviceId(id: string): boolean{
        return id.length > 5 && id.match(/^[a-zA-Z]{5}_\d{4}$/) !== null;
    }

    static assertValidDeviceId(id: string){
        if(!this.isValidDeviceId(id)){
            throw new Error("The device id is incorrect. The id format should be [a-zA-Z]{5}-[0-9]{4}.");
        }
    }

    static getAll(): Device[]{
        return Object.values(this.list);
    }

    static exists(id: string): boolean{
        return !!this.list[id];
    }

    static get(data: string | WebSocket): Device | undefined{
        if(typeof data === 'string'){
            return this.list[data];
        }
        for(const id in this.list){
            const device = this.list[id];
            if(device.socket === data){
                return device;
            }
        }
    }

    static connectDevice(...args: any[]): Device{
        throw new Error("connectDevice() must be implemented in subclasses");
    }

    static create(...args: any[]): Device{
        throw new Error("create() must be implemented in subclasses");
    }

    public readonly id: string;
    protected _socket?: WebSocket;
    private _lastUpdate: number = -1;

    protected constructor(
        id: string,
        private _name: string,
        protected _battery: number | null,
        protected readonly extra: JSONData = {},
    ){
        Device.assertValidDeviceId(id);
        if(Device.list[id]){
            throw new Error(`An error occurred while creating the device. The device (id: ${id}) is already registered.`)
        }
        this.id = id;
        Device.list[this.id] = this;
    }

    abstract get modelId(): number;
    abstract get modelName(): string;

    get lastUpdate(): number{
        return this._lastUpdate;
    }

    set lastUpdate(value: number){
        this._lastUpdate = value;
    }

    get connected(): boolean{
        return (this._socket?.readyState || 3) <= WebSocket.OPEN && Date.now() - this._lastUpdate < 15000;
    }

    get name(): string{
        return this._name;
    }

    set name(value: string){
        this._name = value;
        prisma.device.update({
            where: {
                id: this.id
            },
            data: {
                name: this.name,
            }
        });
    }

    get battery(): number | null{
        return this._battery;
    }

    set battery(battery: number | null){
        //Logger.warn(`${this.modelName}(id: ${this.id})의 배터리 상태를 확인할 수 없었습니다.`);
        battery = battery && Math.floor(battery);
        if(battery == null || battery < 0 || battery > 100){
            battery = null;
        }
        if(this._battery !== battery){
            this._battery = battery;
            prisma.device.update({
                where: {
                    id: this.id
                },
                data: {
                    battery: this._battery,
                }
            });
        }
    }

    get socket(): WebSocket | undefined{
        return this._socket;
    }

    set socket(socket: WebSocket){
        if(socket === this._socket){
            return;
        }

        const before = this._socket;
        this._socket = socket;
        if(before && before.readyState <= WebSocket.OPEN){
            before.close();
        }

        const now = Date.now();
        const reconnect = now - this.lastUpdate < 20000;
        this.lastUpdate = now;
        Logger.info(`${this.modelName}(${this.name})이(가) ${reconnect ? '다시 ' : ''}연결되었습니다.`);
        socket.on('ping', () => this.lastUpdate = Date.now());
        socket.on('close', () => this.synchronize())
        /*const types = socket.eventNames();
        console.log(`------------ ${this.modelName}의 리스너 ------------`);
        for(const type of types){
            const listeners = socket.listeners(type);
            console.log(`[Listener] ${type.toString()} START --------\n`);
            listeners.forEach((listener, index) => {
                console.log(`    ${index + 1}. ${listener.toString()}`);
            });
            console.log(`\n[Listener] ${type.toString()} FINISH --------`);
        }
        console.log(`-----------------------------\n\n`);*/
    }

    synchronize(...columns: (keyof DeviceModel)[]){
        if(columns.length < 1){
            columns = ['name', 'battery', 'extra'];
        }
        const data: JSONData = {}
        columns.forEach((column) => {
            switch(column){
                case 'name':
                    data.name = this._name;
                    break;
                case 'battery':
                    data.battery = this._battery;
                    break;
                case 'extra':
                    data.extra = this.extra;
                    break;
            }
        });
        prisma.device.update({where:{id: this.id}, data}).then()
    }

    toJSON(): JSONData{
        return {
            id: this.id,
            name: this._name,
            type: this.modelId,
            battery: this._battery,
            connected: this.connected,
        }
    }
}