import jwt from "jsonwebtoken";
import {Response} from "express";
import {Logger} from "../../logger/logger.js";
import bcrypt from "bcrypt";
import {JWT_REFRESH_SECRET_KEY, JWT_SECRET_KEY} from "../routes/login.js";
import {User} from "@prisma/client";
import {iotServer} from "../../server";

export const initLoginMiddleware = () => {
    const app = iotServer.express;
    app.use((req, res, next) => {
        const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
        Logger.debug(`<${req.method} 요청> IP: ${ip}, path: ${req.path}`);

        /** 공격 의심 경로 확인 */
        const suspiciousPaths = [
            '/cgi-bin/',     // CGI 경로
            '/admin/',       // 관리 페이지
            '/config/',      // 설정 페이지
            '/shell/',       // 쉘 접근
            '/phpmyadmin/',  // DB 관리 페이지
            '/wp-login.php', // 워드프레스 로그인
            '/manager/',     // 관리 도구 접근
        ];
        if(suspiciousPaths.some(path => req.path.includes(path))){
            console.log(`[헤더] `, req.headers);
            console.log(`[쿼리] `, req.query);
        }

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
    if(!user && (user = verifyToken(refreshToken, JWT_REFRESH_SECRET_KEY))){
        generateToken(res, user);
    }
    if(user?.password){
        user['password'] = '';
    }
    return user;
}

export function generateToken(res: Response, user: User): void{
    user['password'] = '';
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