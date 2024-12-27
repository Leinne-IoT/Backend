import {JSONData} from "./utils.js";

export const parseCookie = (cookie: string, result: JSONData): void => {
    cookie.split(/; */).forEach(value => {
        const split = value.split('=');
        if(split.length > 1){
            result[split[0]] = split[1];
        }
    });
}