import chalk from "chalk";
import {dateToString} from "../utils/date.js";
import {existsSync, mkdirSync, appendFile} from "fs";
import {__dirname} from "../utils/utils";
import {join} from "path";

export class Logger{
    public static ensureLogDir(){
        const dirPath = join(__dirname, 'logs')
        if(!existsSync(dirPath)){
            mkdirSync(dirPath);
        }
    }

    private static getLogFilePath(){
        return join(__dirname, 'logs', `${dateToString(new Date(), false)}.log`);
    }

    private static print(message?: string){
        console.log(chalk.cyan.bold(`[${dateToString(new Date(), true)}] `) + message);
        appendFile(this.getLogFilePath(), `[${dateToString(new Date(), true)}] ${message}`, () => {});
    }

    private static log(lvl: string, color?: any): (message?: string) => void{
        return (message) => {
            this.print((color ? color(`[${lvl}] `) : `[${lvl}] `) + message);
        };
    }

    static loadData(context: string, path: string): void{
        Logger.info(`${chalk.yellowBright.bold(context)}(${chalk.cyan.bold(path)})을(를) 불러왔습니다.`);
    }

    static saveData(context: string, path: string): void{
        Logger.info(`${chalk.yellowBright.bold(context)}(${chalk.cyan.bold(path)})이(가) 저장되었습니다.`);
    }

    public static readonly info: (message?: string) => void = this.log('INFO');
    public static readonly error: (message?: string) => void = this.log('ERROR', chalk.redBright);
    public static readonly warn: (message?: string) => void = this.log('WARN', chalk.yellowBright);
    static debug(message?: string){
        this.print(chalk.gray(`[DEBUG] ${message}`));
    }
}