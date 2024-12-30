import {exec} from "node:child_process";

export interface WakeOnLanPC{
    id: number;
    name: string;
    address: string;
    connected: boolean;
}

// ARP 테이블에서 활성화된 장치를 가져오기
export async function getActiveDevices(): Promise<Set<string>>{
    return new Promise((resolve, reject) => {
        exec("arp -a", (error, stdout) => {
            if(error){
                reject(error);
                return;
            }
            const lines = stdout.split("\n");
            const activeDevices = new Set<string>();
            lines.forEach((line) => {
                const parts = line.trim().split(/\s+/);
                if(parts.length >= 2){
                    const mac = parts[1].toLowerCase().replaceAll('-', ':');
                    activeDevices.add(mac);
                }
            });
            resolve(activeDevices);
        });
    });
}