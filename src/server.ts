import 'dotenv/config';
import {join} from 'path';
import {createInterface} from "readline";
import {Logger} from './logger/logger.js';
import {createApp} from "./app/app.js";
import {DeviceFactory} from "./device/factory.js";
import {__dirname} from "./utils/utils.js";
import {WebPush} from "./web/notify/webpush.js";
import {initWebSocketServer} from "./web/socket/server.js";
import {PrismaClient} from "@prisma/client";
import {Device} from "./device/device.js";
import {Scheduler} from "./schedule/scheduler.js";

export const prisma = new PrismaClient();
export const scheduler = new Scheduler();

(async () => {
    const app = createApp();
    await WebPush.init();
    app.get(/.*/, (_, res) => res.sendFile(join(__dirname, './public/index.html')));

    const port = process.env.PORT || 8080;
    const server = app.listen(port, () => Logger.info('IoT 백엔드 서버가 켜졌습니다. 포트: ' + port));
    const webSocket = initWebSocketServer(server);

    await DeviceFactory.init()

    const quitApp = async (): Promise<void> => {
        Logger.info(`IoT 서버가 종료됩니다.`);
        for(const device of Device.getAll()){
            device.socket?.close();
        }
        webSocket.close();
        await WebPush.saveData();
        process.exit(0);
    }
    process.on('SIGINT', () => quitApp());
    process.on('SIGQUIT', () => quitApp());
    process.on('SIGTERM', () => quitApp());

    await scheduler.init();

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
})();
