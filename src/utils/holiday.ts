import {prisma} from "../server.js";
import KoreanLunarCalendar from "korean-lunar-calendar";

export class Holiday{
    private static currentYear: number = -1;
    private static calendar: Set<number>[] = Array.from({length: 12}, () => new Set<number>()); // 휴일 배열, [월: [...일]]

    private static async makeCalendar(): Promise<void>{
        const currentYear = new Date().getFullYear();
        if(this.currentYear === currentYear){
            return;
        }
        this.currentYear = currentYear;
        this.calendar = Array.from({length: 12}, () => new Set<number>());

        const processedHolidays = [];
        const holidays = await prisma.holiday.findMany();
        for(const holiday of holidays){
            let year = currentYear;
            let month = holiday.month;
            let day = holiday.day;

            if(holiday.lunar){
                const lunarCalendar = new KoreanLunarCalendar();
                lunarCalendar.setLunarDate(currentYear, holiday.month + 1, holiday.day, false);
                const solar = lunarCalendar.getSolarCalendar();
                year = solar.year;
                month = solar.month - 1;
                day = solar.day;
            }
            if(year === currentYear){
                processedHolidays.push({
                    name: holiday.name,
                    year,
                    month,
                    day,
                    range: holiday.range
                })
            }
        }
        processedHolidays.sort((a, b) => a.month === b.month ? a.day - b.day : a.month - b.month);

        for(const holiday of processedHolidays){
            const startDate = new Date(holiday.year, holiday.month, holiday.day);
            startDate.setDate(startDate.getDate() - holiday.range);
            startDate.setHours(0, 0, 0, 0);

            const endDate = new Date(holiday.year, holiday.month, holiday.day);
            endDate.setDate(endDate.getDate() + holiday.range);
            endDate.setHours(0, 0, 0, 0);

            const checkHoliday = new Date(startDate); // 시작일부터 종료일까지 while 돌기위해 사용
            while(checkHoliday <= endDate){
                const month = checkHoliday.getMonth();
                const day = checkHoliday.getDate();
                if(checkHoliday.getDay() === 0 || this.calendar[month].has(day)){ // 휴일 혹은 일요일이 겹치는 경우 1일 추가
                    endDate.setDate(endDate.getDate() + 1);
                }else{
                    this.calendar[month].add(day);
                }
                checkHoliday.setDate(checkHoliday.getDate() + 1);
            }
        }
    }

    static async isHoliday(date: Date): Promise<boolean>{
        await this.makeCalendar(); // 필요 시 캘린더 갱신
        return this.calendar[date.getMonth()].has(date.getDate()) || date.getDay() === 0;
    }
}