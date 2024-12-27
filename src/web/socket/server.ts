import http from "http";
import {WebSocket, WebSocketServer} from "ws";
import {DeviceFactory} from "../../device/factory.js";
import {Logger} from "../../logger/logger.js";
import {parseCookie} from "../../utils/cookie.js";
import {WebClient} from "./client.js";

export const initWebSocketServer = (server: http.Server<any, any>) => {
    return new WebSocketServer({server, path: '/ws'}).on('connection', (socket, request) => {
        const timeout = setTimeout(() => {
            if(socket.readyState <= WebSocket.OPEN){
                socket.close();
            }
        }, 25 * 1000);
        let listener: any;
        socket.addEventListener('message', (event) => {
            let data = event.data as any;
            if(typeof data === 'object'){ // iot device request
                if(data[0] === 0x01){
                    try{
                        DeviceFactory.validateConnect(data[1], socket, data);
                        clearTimeout(timeout);
                        socket.removeListener('message', listener);
                        return;
                    }catch{}
                }
            }else{
                data = data.toString('utf-8');
                try{
                    const message = JSON.parse(data);
                    parseCookie(request.headers.cookie || '', message);
                    if(WebClient.connectNew(message, socket)){
                        clearTimeout(timeout);
                        socket.removeListener('message', listener);
                        return;
                    }
                }catch{}
            }
            socket.close(1002); // protocol error
            console.error(data);
            clearTimeout(timeout);
            Logger.error(`잘못된 웹소켓 접근입니다. 잘못된 데이터 형식입니다. (ip: ${request.socket.remoteAddress})`);
        });
        listener = socket.listeners('message')[0];
    });
}