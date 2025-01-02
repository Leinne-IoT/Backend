import {Device} from "./device.js";
import {Checker} from "./checker.js";
import {SwitchBot} from "./switch_bot.js";
import {RemoteBot} from "./remote_bot.js";
import {JSONData} from "../utils/utils";
import {iotServer} from "../server";

export interface InitData{
    modelId: number;
    deviceId: string;
    battery: number | null;
    extra: JSONData;
}

export class DeviceFactory{
    static async init(): Promise<void>{
        const deviceList = await iotServer.prisma.device.findMany();
        for(const device of deviceList){
            try{
                const deviceObject = this.create(device.model, device.id, device.name, device.battery, device.extra as JSONData);
                iotServer.deviceManager.add(deviceObject);
            }catch(error: any){
                console.error(error);
            }
        }
    }

    static create(model: number, id: string, name: string, battery: number | null, extra: JSONData, createData: boolean = false): Device{
        let DeviceClass;
        switch(model){
            case Checker.MODEL_ID:
                DeviceClass = Checker;
                name = name || Checker.MODEL_NAME;
                break;
            case SwitchBot.MODEL_ID:
                DeviceClass = SwitchBot;
                name = name || SwitchBot.MODEL_NAME;
                break;
            case RemoteBot.MODEL_ID:
                DeviceClass = RemoteBot;
                name = name || RemoteBot.MODEL_NAME;
                break;
            default:
                throw new Error('Invalid device model id')
        }
        const object = new DeviceClass(id, name, battery, extra);
        if(createData){
            object.synchronize();
            iotServer.deviceManager.add(object);
        }
        return object;
    }

    static convertDeviceInitData(data: Buffer): InitData{
        const modelId = +data[1];
        let deviceId: string = '';
        let battery: number | null = null;
        let extra: JSONData = {};
        if(data[0] === 0x01){ // init protocol id
            switch(modelId){
                case Checker.MODEL_ID:
                    deviceId = data.toString('utf-8', 3).replace(/\0/g, '').trim();
                    battery = (data[2] & 0b1111) * 10;
                    extra = {
                        open: ((data[2] >> 4) & 0b1111) > 0,
                    };
                    break;
                case SwitchBot.MODEL_ID:
                    deviceId = data.toString('utf-8', 3).trim().replace(/\0/g, '').trim();
                    battery = (data[2] & 0b1111) * 10;
                    extra = {
                        switch: [((data[2] >> 6) & 0b11) > 0, ((data[2] >> 4) & 0b11) > 0],
                    }
                    break;
                case RemoteBot.MODEL_ID:
                    deviceId = data.toString('utf-8', 2).trim().replace(/\0/g, '').trim();
                    break;
                default:
                    throw new Error('Invalid device model id');
            }
            Device.assertValidDeviceId(deviceId);
        }
        return {modelId, deviceId, battery, extra};
    }
}