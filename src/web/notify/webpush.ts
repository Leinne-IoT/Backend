import webPush, {PushSubscription} from "web-push";
import {Express} from "express";
import {readFile, writeFile} from "fs/promises";
import {isObject} from "../../utils/utils.js";

export class WebPush{
    private static readonly subscriptions: {[endpoint: string]: PushSubscription} = {};

    static async init(app: Express): Promise<void>{
        const email = process.env.WEB_PUSH_EMAIL;
        const publicKey = process.env.WEB_PUSH_PUBLIC_KEY;
        const privateKey = process.env.WEB_PUSH_PRIVATE_KEY;
        if(!publicKey || !privateKey){
            throw new Error('Failed to enable web push. Public/private key does not exist.');
        }
        webPush.setVapidDetails(`mailto:${email}`, publicKey, privateKey);

        // TODO: 구독 정보를 json -> DB 전환
        try{
            const fileData = await readFile('./resources/subscriptions.json', 'utf8');
            if(fileData){
                let removed = false;
                const jsonData = JSON.parse(fileData);
                for(const index in jsonData){
                    removed = !this.subscribe(jsonData[index] || {}) || removed;
                }
                if(removed){
                    this.saveData();
                }
            }
        }catch{}
    }

    static subscribe(data: PushSubscription): boolean{
        if(
            !isObject(data.keys) ||
            data.endpoint == null ||
            this.subscriptions[data.endpoint]
        ){
            return false;
        }
        this.subscriptions[data.endpoint] = data;
        return true;
    };

    static unsubscribe(endpoint: string): void{
        delete this.subscriptions[endpoint];
    }

    static saveData(): Promise<void>{
        return writeFile('./resources/subscriptions.json', JSON.stringify(this.subscriptions), 'utf8');
    }

    static async broadcast(title: string, message: string = '', icon: string = ''){
        const data = JSON.stringify({title, message, icon});
        for(const endpoint in this.subscriptions){
            try{
                await webPush.sendNotification(this.subscriptions[endpoint], data);
            }catch(e: any){
                const body = e.body ? `${e.body}`.trim() : '';
                if(body.includes('expired') || body.includes('unsubscribed')){
                    this.unsubscribe(endpoint);
                }
            }
        }
    }
}