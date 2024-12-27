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
    app.post('/notify/subscribe', (req, res) => {
        if(!WebPush.subscribe(isObject(req.body) ? req.body : {})){
            return res.status(400).json({error: 'Invalid subscription data'});
        }
        Logger.info('웹푸시 구독 요청을 승인 완료 했습니다.');
        res.status(201).json({message: 'Subscription successful'});
    });
}