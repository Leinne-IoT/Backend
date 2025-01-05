import {Device} from "./device.js";
import {JSONData} from '../utils/utils.js';
import {Logger} from '../logger/logger.js';
import {WebSocket} from 'ws';
import {WebClient} from "../web/socket/client.js";
import {iotServer} from "../server";

export class RemoteBot extends Device{
    static readonly MODEL_ID: number = 0x03;
    static readonly MODEL_NAME: string = '리모트 봇';

    static get humidityAverage(): number{
        const list = iotServer.deviceManager.getAllByType(RemoteBot);
        if(list.length < 1){
            return 0;
        }
        let length = 0;
        let humidity = 0;
        for(const remote of list){
            if(remote.humidity != null){
                ++length;
                humidity += remote.humidity;
            }
        }
        return humidity / length;
    }

    static get temperatureAverage(): number{
        const list = iotServer.deviceManager.getAllByType(RemoteBot);
        if(list.length < 1){
            return 0;
        }
        let length = 0;
        let temperature = 0;
        for(const remote of list){
            if(remote.temperature != null){
                ++length;
                temperature += remote.temperature;
            }
        }
        return temperature / length;
    }

    constructor(id: string, name: string, _: any = null, extra: JSONData = {}){
        delete extra['humidity'];
        delete extra['temperature'];
        super(id, name, null, extra);
    }

    get modelId(): number{
        return RemoteBot.MODEL_ID;
    }

    get modelName(): string{
        return RemoteBot.MODEL_NAME;
    }

    get socket(): WebSocket | undefined{
        return super.socket;
    }

    set socket(socket: WebSocket){
        super.socket = socket;
        socket.on('message', (data: Buffer) => {
            if(data[0] !== 0x04){
                return;
            }
            let temperature = data[3];
            if(data[4] & 0x80){
                temperature = -1 - temperature;
            }
            temperature += (data[4] & 0x0f) * 0.1;
            const humidity = data[1] + data[2] * 0.1;
            if(!this.setSensorData(humidity, temperature)){
                Logger.error('온/습도 정보가 잘못되었습니다. 리모트 봇의 상태를 확인해주세요.');
                return;
            }
        });
        socket.on('close', () => {
            delete this.extra['humidity'];
            delete this.extra['temperature'];
            this.synchronize('extra')
        });
    }

    get humidity(): number | undefined{
        return this.extra.humidity;
    }

    get temperature(): number | undefined{
        return this.extra.temperature;
    }

    private setSensorData(humidity: number, temperature: number): boolean{
        if(humidity < 0.1 && temperature < 0.1){ // 온도/습도는 소수점 첫재짜리까지 측정됨
            return false;
        }
        this.extra.humidity = humidity;
        this.extra.temperature = temperature;
        WebClient.broadcast({device: this});
        this.synchronize('extra')
        iotServer.prisma.sensorHistory.create({
            data: {
                deviceId: this.id,
                humidity,
                temperature
            }
        }).then();
        return true;
    }

    toJSON(): JSONData{
        const data = super.toJSON();
        data.humidity = this.extra.humidity;
        data.temperature = this.extra.temperature;
        return data;
    }
}