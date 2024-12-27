import {fileURLToPath} from "url";
import {dirname, join} from "path";
import {existsSync} from "node:fs";

export const __filename = fileURLToPath(import.meta.url);
export const __dirname = (() => {
    let currentDir = dirname(__filename);

    while(true){
        const nodeModulesPath = join(currentDir, 'node_modules');
        if(existsSync(nodeModulesPath)){
            return currentDir;
        }

        // 상위 디렉토리로 이동
        const parentDir = dirname(currentDir);
        if(parentDir === currentDir){ // 루트 디렉토리에 도달한 경우 오류 발생
            throw new Error('node_modules directory not found. Ensure you are running the script in a valid project structure.');
        }
        currentDir = parentDir;
    }
})();

export interface JSONData{
    [key: string | number]: any;
}

export const isObject = (data: any): boolean => {
    return !!data && typeof data === 'object';
}

export const isArray = (data: any): boolean => {
    return isObject(data) && data.constructor === Array;
}

export const isNumeric = (data: any): boolean => {
    if(typeof data !== 'number'){
        data = parseInt(data);
    }
    return !isNaN(data) && isFinite(data);
}

export const randomHex = (length: number): string => {
    const chars = '0123456789abcdef';
    let result = '';
    for(let i = 0; i < length; ++i){
        result += chars[Math.floor(Math.random() * 15)];
    }
    return result;
}

export const lshift = (num: number, bit: number): number => {
    return num * Math.pow(2, bit);
}

export const sleep = (millis: number): Promise<void> => {
    return new Promise(resolve => setTimeout(resolve, millis));
}