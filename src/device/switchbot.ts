import {Device} from "./device.js";
import {isArray, JSONData} from '../utils/utils.js';
import {WebSocket} from 'ws';
import {WebClient} from "../web/socket/client.js";
import {prisma} from "../server.js";

export class SwitchBot extends Device{
    static readonly MODEL_ID: number = 0x02;
    static readonly MODEL_NAME: string = '스위치 봇';

    static readonly CHANNEL_UP: number = 0;
    static readonly CHANNEL_DOWN: number = 1;

    private static readonly switchBotList: {[id: string]: SwitchBot} = {}

    static get(id: string): SwitchBot | undefined{
        return this.switchBotList[id];
    }

    static exists(id: string): boolean{
        return !!this.switchBotList[id];
    }

    static getAll(): SwitchBot[]{
        return Object.values(this.switchBotList);
    }

    static connectDevice(socket: WebSocket, data: Buffer): SwitchBot{
        const id = data.toString('utf-8', 3).trim().replace(/\0/g, '');
        Device.assertValidDeviceId(id);

        const battery = (data[2] & 0b1111) * 10;
        const device = (() => {
            if(!Device.list[id]){
                prisma.device.create({
                    data: {
                        id,
                        name: id,
                        model: this.MODEL_ID,
                        battery: battery
                    }
                })
                return SwitchBot.create(id, id, battery);
            }else if(!SwitchBot.exists(id)){
                throw new Error('invalid device id');
            }
            return this.switchBotList[id];
        })();
        device.socket = socket;
        device.battery = battery;
        const up = !!((data[2] >> 6) & 0b11);
        if(device.isOn(SwitchBot.CHANNEL_UP) !== up){
            device.syncDevice(SwitchBot.CHANNEL_UP);
        }
        const down = !!((data[2] >> 6) & 0b11);
        if(device.isOn(SwitchBot.CHANNEL_DOWN) !== down){
            device.syncDevice(SwitchBot.CHANNEL_DOWN);
        }
        WebClient.broadcastDeviceStatus(device);
        return device;
    }

    static create(id: string, name: string, battery: number | null = 100, extra: JSONData = {}): SwitchBot{
        if(!isArray(extra.switch)){
            extra.switch = [false, false];
        }
        if(!isArray(extra.switchName)){
            extra.switchName = ['상단', '하단'];
        }
        const switchBot = new SwitchBot(id, name, battery, extra);
        if(id){
            SwitchBot.switchBotList[id] = switchBot;
        }
        return switchBot;
    }

    get modelId(): number{
        return SwitchBot.MODEL_ID;
    }

    get modelName(): string{
        return SwitchBot.MODEL_NAME;
    }

    set socket(socket: WebSocket){
        super.socket = socket;
        socket.on('message', (data: Buffer) => {
            if(data[0] === 0x03){
                this.battery = (data[1] & 0b1111) * 10;
                this.setState((data[1] >> 6) & 0b11, !!((data[1] >> 4) & 0b11), false);
            }
        });
    }

    get lastUpdate(): number{
        return super.lastUpdate;
    }

    set lastUpdate(value: number){
        const connected = this.connected;
        super.lastUpdate = value;
        if(connected !== this.connected){
            WebClient.broadcastDeviceStatus(this);
        }
    }

    isOn(channel: number = SwitchBot.CHANNEL_UP): boolean{
        return this.extra.switch[channel] || false;
    }

    setState(channel: number, value: boolean, needSync: boolean = true){
        if(this.isOn(channel) == value){
            return;
        }
        this.lastUpdate = Date.now();
        this.extra.switch[channel] = value;
        this.synchronize('extra')
        prisma.switchBotHistory.create({
            data: {
                deviceId: this.id,
                channel,
                state: value,
                recordDate: new Date()
            }
        }).then()

        WebClient.broadcastSwitchBot(this);
        if(needSync){
            this.syncDevice(channel);
        }
    }

    syncDevice(channel?: number): void{
        if(!this._socket || (this._socket?.readyState || 3) > WebSocket.OPEN){
            return;
        }
        if(typeof channel === 'number'){
            this._socket.send([(channel << 4) | +this.isOn(channel)]);
        }else{
            this._socket.send([(SwitchBot.CHANNEL_UP << 4) | +this.isOn(SwitchBot.CHANNEL_UP)]);
            this._socket.send([(SwitchBot.CHANNEL_DOWN << 4) | +this.isOn(SwitchBot.CHANNEL_DOWN)]);
        }
    }

    toJSON(): JSONData{
        const data = super.toJSON();
        data.switch = this.extra.switch;
        data.switchName = this.extra.switchName;
        return data;
    }
}