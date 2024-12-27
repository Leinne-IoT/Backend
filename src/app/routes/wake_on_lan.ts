import {Express} from "express";
import {getActiveDevices} from "../../utils/wol.js";
import {isArray, isObject} from "../../utils/utils.js";
import wol from "wake_on_lan";
import {prisma} from "../../server.js";
import {Logger} from "../../logger/logger.js";

export const initWakeOnLanRoutes = (app: Express) => {
    app.post('/data/wol', async (_, res) => {
        const wolList = await prisma.wakeOnLan.findMany();
        const activeDevices = await getActiveDevices();

        const results = wolList.map(({id, name, address}) => {
            const connected = activeDevices.has(address.toLowerCase());
            return {id, name, address, connected};
        });
        res.json(results);
    });
    app.all('/api/wol', (req, res) => {
        switch(req.method){
            case 'POST':{
                if(!isObject(req.body) || typeof req.body.address !== 'string'){
                    return res.sendStatus(403);
                }
                wol.wake(req.body.address, {address: '192.168.45.255'}, (error: any) => {
                    if(error){
                        console.error(error);
                        Logger.error('WOL 시도중 오류가 발생했습니다.')
                        res.sendStatus(400);
                    }else{
                        res.sendStatus(200);
                    }
                });
                break;
            }
            case 'PUT':{
                if(!isObject(req.body)){
                    return res.sendStatus(403);
                }
                const {name, address} = req.body;
                if(!name || !address){
                    return res.sendStatus(403);
                }
                prisma.wakeOnLan.create({
                    data: {name, address}
                })
                    .then((result) => res.json({...req.body, id: result.id}))
                    .catch((error) => {
                        console.error(error);
                        res.status(400).json({});
                    });
                break;
            }
            case 'DELETE':{
                if(!isObject(req.body)){
                    return res.sendStatus(403);
                }

                const idList: number[] = req.body.idList;
                if(!isArray(idList)){
                    return res.sendStatus(400);
                }

                prisma.wakeOnLan.deleteMany({
                    where: {
                        id: {in: idList}
                    }
                })
                    .then(() => res.sendStatus(200))
                    .catch(() => res.sendStatus(400));
                break;
            }
            default:
                return res.sendStatus(400);
        }
    })
}