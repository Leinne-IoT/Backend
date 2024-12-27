import {Express} from "express";
import {Logger} from "../../logger/logger.js";
import {isNumeric, isObject, JSONData} from "../../utils/utils.js";
import {SwitchBot} from "../../device/switchbot.js";
import {Device} from "../../device/device.js";
import {prisma} from "../../server.js";

export const initSwitchBotRoutes = (app: Express) => {
    // 스위치 정보
    app.post('/switch_bot', (_, res) => {
        res.status(200).json(SwitchBot.getAll());
    });

    /*const query =
        `SELECT device as id, name, channel, state, battery, record_date ` +
        `FROM switch_bot_history ` +
        `JOIN device ON switch_bot_history.device = device.id ` +
        where +
        `ORDER BY record_date DESC ` +
        `LIMIT ?`;*/
    app.get('/switch_bot/history', async (req, res) => {
        let {page = 1, size = 10} = req.query;
        if(!isNumeric(page) || !isNumeric(size)){
            return res.status(400).json({
                "error": "Invalid parameter",
                "message": "'page' and 'size' must be positive integers."
            });
        }

        page = +page;
        size = Math.max(10, +size);
        if(page <= 0 || size <= 0){
            return res.status(400).json({
                "error": "Invalid parameter",
                "message": "'page' and 'size' must be greater than 0."
            })
        }

        let where = {};
        if(req.query.device_id != null){
            const deviceId = req.query.device_id + '';
            if(Device.exists(deviceId)){
                where = {deviceId}
            }else{
                res.status(400).json({
                    error: 'Invalid device Id',
                    message: `Unregistered device id. (value: ${req.body.id})`
                });
                return;
            }
        }
        const switchBotHistoryData = (await prisma.switchBotHistory.findMany({
            where,
            take: size, // 가져올 개수
            skip: (page - 1) * size, // 무시할 개수
            select: {
                device: true,
                channel: true,
                state: true,
                battery: true,
                recordDate: true,
            },
            orderBy: {
                recordDate: 'desc',
            },
        })).map((data) => {
            const extra: any = data.device.extra || {};
            return {
                id: data.device.id,
                name: data.device.name,
                channelName: extra?.switchName?.[data.channel],
                state: data.state,
                battery: data.battery,
                recordDate: data.recordDate
            }
        });
        res.status(200).json({
            data: switchBotHistoryData,
            totalPages: Math.ceil(await prisma.switchBotHistory.count() / size)
        });
    });

    // 스위치 API 호출
    app.post('/api/switch', (req, res) => {
        const device = SwitchBot.get(req.body.id);
        if(!device){
            Logger.error(`등록되지 않은 기기에 대한 요청을 받았습니다. (id: ${req.body.id})`);
            res.status(400).json({
                error: 'Invalid device id',
                message: `Unregistered device id. (id: ${req.body.id})`
            })
            return;
        }

        const stateObject = req.body.state;
        if(isObject(stateObject)){
            for(const channel in stateObject){
                if(!isNumeric(channel)){
                    return res.status(400).json({
                        error: 'Incorrect Data Format',
                        message: `The body data format is incorrect.`
                    });
                }
            }

            for(const channel in stateObject){
                device.setState(+channel, stateObject[channel] != false);
            }
            res.sendStatus(200);
        }else{
            res.status(400).json({
                error: 'Incorrect data format',
                message: `The body data format is incorrect.`
            });
        }
    });
}