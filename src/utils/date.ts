type DateType = string | number | Date;

export const dateToString = (date: DateType, includeTime: boolean = false): string => {
    date = typeof date !== 'object' ? new Date(date || 0) : date;
    let output = `${date.getFullYear()}-`;
    output += [
        date.getMonth() + 1,
        date.getDate()
    ].map(v => (v + '').padStart(2, '0')).join('-')
    if(includeTime){
        output += ` ${timeToString(date)}`;
    }
    return output;
}

export const timeToString = (date: DateType): string => {
    date = typeof date !== 'object' ? new Date(date || 0) : date;
    return [
        date.getHours(),
        date.getMinutes(),
        date.getSeconds()
    ].map(v => (v + '').padStart(2, '0')).join(':')
}

export const isDate = (data: any): boolean => {
    return data instanceof Date && !isNaN(data.getTime());
}