import 'dotenv/config';
import {join} from 'path';
import {createInterface} from "readline";
import {Logger} from './logger/logger.js';
import {initAllRoutes} from "./app/app.js";
import {DeviceFactory} from "./device/factory.js";
import {__dirname} from "./utils/utils.js";
import {WebPush} from "./web/notify/web_push.js";
import {initWebSocketServer} from "./web/socket/server.js";
import {PrismaClient} from "@prisma/client";
import {Scheduler} from "./schedule/scheduler.js";
import {DeviceManager} from "./device/manager";
import express, {Express} from "express";
import {WebSocket} from "ws";

class IoTServer{
    readonly express: Express = express();
    readonly prisma: PrismaClient = new PrismaClient();
    readonly scheduler: Scheduler = new Scheduler();
    readonly deviceManager: DeviceManager = new DeviceManager();

    async start(){
        initAllRoutes();
        await WebPush.init();
        this.express.get(/.*/, (_, res) => res.sendFile(join(__dirname, './public/index.html')));

        const port = process.env.PORT || 8080;
        const server = this.express.listen(port, () => Logger.info('IoT 백엔드 서버가 켜졌습니다. 포트: ' + port));
        const webSocket = initWebSocketServer(server);

        await DeviceFactory.init()

        const quitApp = async (): Promise<void> => {
            Logger.info(`IoT 서버가 종료됩니다.`);
            const closePromises = this.deviceManager.getAll().map(device => new Promise<void>((resolve) => {
                const socket = device.socket;
                if(socket && socket.readyState < WebSocket.CLOSING){
                    socket.on('close', () => resolve());
                    socket.close();
                }else{
                    resolve();
                }
            }));
            await Promise.all(closePromises);
            webSocket.close();
            process.exit(0);
        }
        process.on('SIGINT', () => quitApp());
        process.on('SIGQUIT', () => quitApp());
        process.on('SIGTERM', () => quitApp());

        await this.scheduler.init();

        const readline = createInterface({input: process.stdin});
        readline.on('line', msg => {
            if(msg.includes('stop')){
                quitApp();
                return;
            }else if(msg.includes('notify')){
                WebPush.broadcast('Test');
            }
            //const args = msg.split(" ");
        });
    }
}

export const iotServer = new IoTServer();
iotServer.start().then()
