import jwt from "jsonwebtoken";
import {Express, Response} from "express";
import {Logger} from "../../logger/logger.js";
import bcrypt from "bcrypt";
import {JWT_REFRESH_SECRET_KEY, JWT_SECRET_KEY} from "../routes/login.js";
import {User} from "@prisma/client";

export const initLoginMiddleware = (app: Express) => {
    app.use((req, res, next) => {
        const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
        Logger.debug(`<${req.method} 접근> IP: ${ip}, 주소: ${req.path}`);
        if(['/', '/logout'].includes(req.path) || req.path.includes('login/') || req.path.includes('token/')){
            return next();
        }
        const accessToken = req.cookies.accessToken;
        if(!accessToken){
            res.sendStatus(400); // bad request, 토큰이 없다면 접근 불가능
        }else if(verifyWithRefresh(res, accessToken, req.cookies.refreshToken)){
            next();
        }else if(req.method !== 'GET'){
            res.sendStatus(401);
        }else{
            res.redirect('/');
        }
    });
}

export function verifyToken(token: string | undefined, secretKey: string): User | undefined{
    if(!token){
        return;
    }
    try{
        return (jwt.verify(token, secretKey) as any)?.user;
    }catch{}
}

export function verifyWithRefresh(res: Response, accessToken: string, refreshToken?: string): User | undefined{
    let user = verifyToken(accessToken, JWT_SECRET_KEY);
    if(!user && accessToken){
        Logger.debug(`계정 취득 실패, access: ${accessToken ? '있음' : '없음'}, refresh: ${refreshToken ? '있음' : '없음'}`);
    }
    if(!user && (user = verifyToken(refreshToken, JWT_REFRESH_SECRET_KEY))){
        Logger.debug('액세스 토큰 만료, 리프레시 토큰으로 재발급 성공');
        generateToken(res, user);
    }
    return user;
}

export function generateToken(res: Response, user: User): void{
    res.cookie(
        'accessToken',
        jwt.sign({user}, JWT_SECRET_KEY, {expiresIn: '30m'}),
        {httpOnly: true}
    );
    res.cookie(
        'refreshToken',
        jwt.sign({user}, JWT_REFRESH_SECRET_KEY, {expiresIn: '7d'}),
        {httpOnly: true}
    );
}

export async function hashPassword(password: string): Promise<string>{
    return await bcrypt.hash(password, 10);
}

export async function comparePassword(password: string, hashedPassword: string): Promise<boolean>{
    return await bcrypt.compare(password, hashedPassword);
}