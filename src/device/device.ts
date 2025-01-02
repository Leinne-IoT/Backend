import {WebSocket} from "ws";
import {JSONData} from "../utils/utils.js";
import {Logger} from "../logger/logger.js";
import {Device as DeviceModel} from '@prisma/client';
// import {WebClient} from "../web/socket/client";
import {iotServer} from "../server";
import {WebClient} from "../web/socket/client";

export abstract class Device{
    static readonly MODEL_ID: number = 0x00;
    static readonly MODEL_NAME: string = '';

    static isValidDeviceId(id: string): boolean{
        return id.length > 5 && id.match(/^[a-zA-Z]{5}_\d{4}$/) !== null;
    }

    static assertValidDeviceId(id: string){
        if(!this.isValidDeviceId(id)){
            throw new Error("The device id is incorrect. The id format should be [a-zA-Z]{5}-[0-9]{4}.");
        }
    }

    protected _socket?: WebSocket;

    private _lastUpdate: number = -1;

    protected constructor(
        public readonly id: string,
        private _name: string,
        protected _battery: number | null,
        protected readonly extra: JSONData = {},
    ){
        Device.assertValidDeviceId(id);
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
        return !!this._socket && this._socket.readyState <= WebSocket.OPEN && Date.now() - this._lastUpdate < 15000;
    }

    get name(): string{
        return this._name;
    }

    set name(value: string){
        this._name = value;
        this.synchronize('name');
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
            this.synchronize('battery');
        }
    }

    get socket(): WebSocket | undefined{
        return this._socket;
    }

    protected set socket(socket: WebSocket){
        this._socket = socket;
    }

    reconnect(socket: WebSocket, battery: number | null, extra: JSONData): boolean{
        if(socket === this.socket){
            return false;
        }

        const before = this.socket;
        this.socket = socket;
        if(before && before.readyState <= WebSocket.OPEN){
            before.close();
        }
        this.socket = socket;
        this.battery = battery;

        this.lastUpdate = Date.now();
        WebClient.broadcast({device: this});
        Logger.info(`${this.modelName}(${this.name})이(가) 연결되었습니다.`);
        socket.on('ping', () => this.lastUpdate = Date.now());
        socket.on('close', () => {
            this.synchronize();
            WebClient.broadcast({device: this});
            Logger.info(`${this.modelName}(${this.name})의 연결이 종료되었습니다.`);
        });
        return true;
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
        iotServer.prisma.device.upsert({
            where:{id: this.id},
            update: data,
            create: {
                id: this.id,
                name: this._name,
                model: this.modelId,
                battery: this._battery,
                extra: this.extra
            }
        }).then()
    }

    toJSON(): JSONData{
        return {
            id: this.id,
            name: this._name,
            model: this.modelId,
            battery: this._battery,
            connected: this.connected,
        }
    }
}