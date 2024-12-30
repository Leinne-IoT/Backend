import {Express} from "express";
import {isObject} from "../../utils/utils.js";
import {Logger} from "../../logger/logger.js";
import {WebPush} from "../../web/notify/webpush.js";

export const initWebPushRoutes = (app: Express) => {
    const publicKey = process.env.WEB_PUSH_PUBLIC_KEY;
    const privateKey = process.env.WEB_PUSH_PRIVATE_KEY;
    if(!publicKey || !privateKey){
        throw new Error('Failed to enable web push. Public/private key does not exist.');
    }

    app.get('/notify/test', (req, res) => {
        WebPush.broadcast('TEST', '테스트입니다').then();
        res.sendStatus(200);
    });
    app.get('/notify/get-key', (_, res) => res.send(publicKey));
    app.post('/notify/subscribe', async (req, res) => {
        const pushData = isObject(req.body) ? req.body : {};
        if(!await WebPush.subscribe(pushData)){
            res.status(400).json({
                error: 'Invalid subscription data',
                message: ''
            });
        }else{
            res.sendStatus(200);
        }
    });
}