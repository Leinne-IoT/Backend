import {WebSocket} from 'ws';
import {Checker} from '../../device/checker.js';
import {Device} from '../../device/device.js';
import {SwitchBot} from '../../device/switchbot.js';
import {JSONData} from '../../utils/utils.js'
import {RemoteBot} from '../../device/remotebot.js';
import {JWT_REFRESH_SECRET_KEY, JWT_SECRET_KEY} from '../../app/routes/login.js';
import {verifyToken} from "../../app/middleware/login.js";

export class WebClient{
    static readonly list: WebClient[] = [];

    static connectNew(message: JSONData, socket: WebSocket): boolean{
        if(message.method !== 'JOIN_CLIENT'){
            return false;
        }

        if(
            !verifyToken(message.accessToken, JWT_SECRET_KEY) &&
            !verifyToken(message.refreshToken, JWT_REFRESH_SECRET_KEY)
        ){
            socket.close(1003, '발급받은 토큰이 없거나 만료되었습니다.'); // 1003: Unsupported Data
            return true;
        }

        new WebClient(socket);
        socket.send(JSON.stringify({
            humidity: RemoteBot.humidityAverage,
            temperature: RemoteBot.temperatureAverage,
            checkerList: Checker.getAll(),
            switchBotList: SwitchBot.getAll(),
        }));
        return true;
    }

    static broadcastDeviceStatus(device: Device): void{
        const output = JSON.stringify({
            device: {
                id: device.id,
                model: device.modelId,
                connected: device.connected
            }
        });
        for(const client of WebClient.list){
            client.socket.send(output);
        }
    }

    static broadcastChecker(checker: Checker): void{
        const output = JSON.stringify({checker});
        for(const client of WebClient.list){
            if(client.checker){
                client.socket.send(output);
            }
        }
    }

    static broadcastSwitchBot(switchBot: SwitchBot): void{
        const output = JSON.stringify({switchBot});
        for(const client of WebClient.list){
            if(client.switchBot){
                client.socket.send(output);
            }
        }
    }

    static broadcastTemperature(humidity: number, temperature: number): void{
        const output = JSON.stringify({humidity, temperature});
        for(const client of WebClient.list){
            if(client.temperature){
                client.socket.send(output);
            }
        }
    }

    public checker: boolean = true;
    public switchBot: boolean = true;
    public temperature: boolean = true;

    private constructor(
        private readonly socket: WebSocket
    ){
        WebClient.list.push(this);
        socket.addEventListener('close', () => {
            const index = WebClient.list.indexOf(this);
            index >= 0 && WebClient.list.splice(index, 1);
        })
    }
}