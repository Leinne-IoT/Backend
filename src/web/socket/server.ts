import http from "http";
import {WebSocket, WebSocketServer} from "ws";
import {DeviceFactory} from "../../device/factory.js";
import {Logger} from "../../logger/logger.js";
import {parseCookie} from "../../utils/cookie.js";
import {WebClient} from "./client.js";
import {iotServer} from "../../server";

export const initWebSocketServer = (httpServer: http.Server<any, any>) => {
    return new WebSocketServer({server: httpServer, path: '/ws'}).on('connection', (socket, request) => {
        const timeout = setTimeout(() => {
            if(socket.readyState <= WebSocket.OPEN){
                socket.close();
            }
        }, 25 * 1000);
        let listener: any;
        socket.addEventListener('message', (event) => {
            let data = event.data as any;
            if(typeof data === 'object'){ // iot device request
                try{
                    const {modelId, deviceId, battery, extra} = DeviceFactory.convertDeviceInitData(data);
                    socket.send(deviceId); // ok sign

                    let device = iotServer.deviceManager.get(deviceId);
                    if(!device){
                        device = DeviceFactory.create(modelId, deviceId, '', battery, extra, true);
                    }
                    device.reconnect(socket, battery, extra);
                    clearTimeout(timeout);
                    socket.removeListener('message', listener);
                    return;
                }catch(error: any){
                    console.error(error);
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
            Logger.error(`잘못된 웹소켓 접근입니다. 데이터 형식이 잘못되었습니다. (ip: ${request.socket.remoteAddress})`);
        });
        listener = socket.listeners('message')[0];
    });
}