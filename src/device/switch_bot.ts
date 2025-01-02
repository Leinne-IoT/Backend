import {Device} from "./device.js";
import {isArray, JSONData} from '../utils/utils.js';
import {WebSocket} from 'ws';
import {WebClient} from "../web/socket/client.js";
import {iotServer} from "../server";

export class SwitchBot extends Device{
    static readonly MODEL_ID: number = 0x02;
    static readonly MODEL_NAME: string = '스위치 봇';

    static readonly CHANNEL_UP: number = 0;
    static readonly CHANNEL_DOWN: number = 1;

    constructor(id: string, name: string, battery: number | null, extra: JSONData = {}){
        if(!isArray(extra.switch)){
            extra.switch = [false, false];
        }
        if(!isArray(extra.switchName)){
            extra.switchName = ['상단', '하단'];
        }
        super(id, name, battery, extra);
    }

    reconnect(socket: WebSocket, battery: number | null, extra: JSONData): boolean{
        if(super.reconnect(socket, battery, extra)){
            for(const channel in extra.switch){
                if(this.isOn(+channel) !== extra.switch[channel]){
                    this.syncDevice(+channel);
                }
            }
            socket.on('message', (data: Buffer) => {
                if(data[0] === 0x03){
                    this.battery = (data[1] & 0b1111) * 10;
                    this.setState((data[1] >> 6) & 0b11, !!((data[1] >> 4) & 0b11), false);
                }
            });
            return true;
        }
        return false;
    }

    get modelId(): number{
        return SwitchBot.MODEL_ID;
    }

    get modelName(): string{
        return SwitchBot.MODEL_NAME;
    }

    get lastUpdate(): number{
        return super.lastUpdate;
    }

    set lastUpdate(value: number){
        const connected = this.connected;
        super.lastUpdate = value;
        if(connected !== this.connected){
            WebClient.broadcast({device: this});
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
        iotServer.prisma.switchBotHistory.create({
            data: {
                deviceId: this.id,
                channel,
                state: value,
                recordDate: new Date()
            }
        }).then()

        WebClient.broadcast({device: this});
        if(needSync){
            this.syncDevice(channel);
        }
    }

    syncDevice(): void;
    syncDevice(channel: number): void;

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