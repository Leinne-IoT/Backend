import {WebSocket} from 'ws';
import {JSONData} from '../../utils/utils.js'
import {JWT_REFRESH_SECRET_KEY, JWT_SECRET_KEY} from '../../app/routes/login.js';
import {verifyToken} from "../../app/middleware/login.js";
import {iotServer} from "../../server";

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

        const client = new WebClient(socket);
        this.list.push(client);
        socket.addEventListener('close', () => {
            const index = WebClient.list.indexOf(client);
            if(index >= 0){
                WebClient.list.splice(index, 1);
            }
        })
        socket.send(JSON.stringify(iotServer.deviceManager.getWebInitData()));
        return true;
    }

    static broadcast(jsonData: any): void{
        const output = JSON.stringify(jsonData);
        for(const client of WebClient.list){
            client.socket.send(output);
        }
    }

    private constructor(private readonly socket: WebSocket){}
}