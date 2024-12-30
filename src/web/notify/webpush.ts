import webPush, {PushSubscription, WebPushError} from "web-push";
import {PrismaClient} from "@prisma/client";
import {isObject} from "../../utils/utils.js";
import {Logger} from "../../logger/logger";

const prisma = new PrismaClient();

export class WebPush{
    private static readonly subscriptions: {[endpoint: string]: PushSubscription} = {};

    static async init(): Promise<void>{
        const email = process.env.WEB_PUSH_EMAIL;
        const publicKey = process.env.WEB_PUSH_PUBLIC_KEY;
        const privateKey = process.env.WEB_PUSH_PRIVATE_KEY;

        if(!email || !publicKey || !privateKey){
            throw new Error('Failed to enable web push. Public/private key or email does not exist.');
        }
        webPush.setVapidDetails(`mailto:${email}`, publicKey, privateKey);

        const dbSubscriptions = await prisma.webPush.findMany();
        dbSubscriptions.forEach(sub => {
            const subData = sub.data as any;
            if(this.validateData(subData)){
                this.subscriptions[sub.endpoint] = subData;
            }
        });
    }

    static validateData(data: any): boolean{
        if(!isObject(data.keys)){
            return false;
        }
        if(data.endpoint == null || !isObject(data.keys)){
            return false;
        }
        return data.keys.p256dh && data.keys.auth;
    }

    static isSubscribed(endpoint: string): boolean{
        return !!this.subscriptions[endpoint];
    }

    static async subscribe(data: Record<string, any>): Promise<boolean>{
        if(!this.validateData(data)){
            return false;
        }

        try{
            await prisma.webPush.upsert({
                where: {endpoint: data.endpoint},
                update: {data: data},
                create: {
                    endpoint: data.endpoint,
                    data: data
                }
            });
            this.subscriptions[data.endpoint] = data as any;
            return true;
        }catch(error){
            console.error(error);
            Logger.error('웹 푸시 구독 도중 오류가 발생했습니다.')
            return false;
        }
    }

    static async unsubscribe(endpoint: string): Promise<void>{
        try{
            await prisma.webPush.delete({where: {endpoint}});
            delete this.subscriptions[endpoint];
        }catch(error){
            console.error('Failed to remove subscription from database:', error);
        }
    }

    static async broadcast(title: string, message: string = '', icon: string = ''){
        const data = JSON.stringify({title, message, icon});
        for(const endpoint in this.subscriptions){
            const subscription = this.subscriptions[endpoint];
            webPush.sendNotification(subscription, data).catch(async (e: WebPushError) => {
                const statusCode = e.statusCode;
                if(statusCode === 410 || statusCode === 404){
                    await this.unsubscribe(endpoint);
                }else{
                    Logger.error(`Failed to send notification to ${endpoint}: ${e.message}`);
                }
            })
        }
    }
}
