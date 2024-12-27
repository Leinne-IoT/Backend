import {Express} from "express";
import {isNumeric, JSONData} from "../../utils/utils.js";
import {Device} from "../../device/device.js";
import {Checker} from "../../device/checker.js";
import {prisma} from "../../server.js";

export const initCheckerRoutes = (app: Express) => {
    app.post('/checker', (_, res) => {
        res.status(200).json(Checker.getAll());
    });

    app.get('/checker/history', async (req, res) => {
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
        const checkerHistoryData = (await prisma.checkerHistory.findMany({
            where,
            take: size, // 가져올 개수
            skip: (page - 1) * size, // 무시할 개수
            select: {
                device: true,
                open: true,
                battery: true,
                recordDate: true,
            },
            orderBy: {
                recordDate: 'desc',
            },
        })).map((data: any) => {
            data.id = data.device.id;
            data.name = data.device.name;
            return data;
        });
        res.status(200).json({
            data: checkerHistoryData,
            totalPages: Math.ceil(await prisma.checkerHistory.count() / size)
        });
    });
}