import {Device} from "./device";
import {WebSocket} from "ws";
import {JSONData} from "../utils/utils";

export class DeviceManager{
    private list: Record<string, Device> = {};

    exists(id: string): boolean{
        return !!this.list[id];
    }

    add(device: Device){
        if(this.exists(device.id)){
            throw new Error('');
        }
        this.list[device.id] = device;
    }

    get(data: string | WebSocket): Device | undefined{
        if(typeof data === 'string'){
            return this.list[data];
        }
        for(const id in this.list){
            const device = this.list[id];
            if(device.socket === data){
                return device;
            }
        }
    }

    getAll(): Device[]{
        return Object.values(this.list);
    }

    getAllByType<T extends Device>(type: new(...args: any[]) => T): T[]{
        return Object.values(this.list).filter(v => v instanceof type) as T[];
    }
}