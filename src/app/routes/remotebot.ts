import {Express} from "express";
import {RemoteBot} from "../../device/remotebot.js";
import {JSONData} from "../../utils/utils.js";
import {prisma} from "../../server.js";

export const initRemoteBotRoutes = (app: Express) => {
    app.post('/api/remote', (req, res) => {
        res.sendStatus(200);
        /*const type = (() => {
            switch(req.body.type){
                case 'a/c':
                    return 0x01;
            }
            return 0x00;
        })();
        const protocol = (() => {
            if(type !== 0x01){
                return null;
            }
            switch(('' + req.body.actype).toLowerCase()){
                case 'coolix':
                    return '';
            }
            return null;
        })();*/
        const power = req.body.power;
        const data = [
            0x01, // 0x01: a/c
            req.body.protocol || 0x0f, // a/c protocol `decode_type_t` 참고
            +power, // power on/off
        ];
        if(power){
            data.push(req.body.mode); // 운전 모드, `stdAc::opmode_t` 참고
            data.push(req.body.temperature); // 온도
            data.push(req.body.speed); // 풍속, `stdAc::fanspeed_t` 참고
        }
        for(const device of RemoteBot.getAll()){
            device.socket?.send(data);
        }
    });
    app.post('/data/sensor', async (req, res) => {
        const jsonData: JSONData = {
            humidity: RemoteBot.humidityAverage,
            temperature: RemoteBot.temperatureAverage,
        };
        if(req.query.history){
            jsonData.hourSensorHistory = await prisma.$queryRaw`
              SELECT 
                DATE_FORMAT(FROM_UNIXTIME(FLOOR(UNIX_TIMESTAMP(h.record_date) / 300) * 300), '%H:%i') AS time,
                AVG(temperature) AS temperature,
                AVG(humidity) AS humidity
              FROM sensor_history h
              WHERE record_date >= NOW() - INTERVAL 55 MINUTE
              GROUP BY time
              ORDER BY h.record_date
            `;
            jsonData.dailySensorHistory = await prisma.$queryRaw`
              SELECT 
                DATE_FORMAT(FROM_UNIXTIME(FLOOR(UNIX_TIMESTAMP(h.record_date) / 3600) * 3600), '%H:%i') AS time,
                AVG(temperature) AS temperature,
                AVG(humidity) AS humidity
              FROM sensor_history h
              WHERE record_date >= NOW() - INTERVAL 23 HOUR
              GROUP BY time
              ORDER BY h.record_date
            `;

            jsonData.weeklySensorHistory = await prisma.$queryRaw`
              SELECT 
                SUBSTR('일월화수목금토', DAYOFWEEK(h.record_date), 1) AS time,
                AVG(temperature) AS temperature,
                AVG(humidity) AS humidity
              FROM sensor_history h
              WHERE record_date >= NOW() - INTERVAL 6 DAY
              GROUP BY time
              ORDER BY h.record_date;
            `;
        }
        res.status(200).json(jsonData);
    });
}