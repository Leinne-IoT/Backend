import {Express} from 'express';
import {comparePassword, generateToken, hashPassword, verifyToken, verifyWithRefresh} from "../middleware/login.js";
import {prisma} from "../../server.js";

export const JWT_SECRET_KEY = process.env.JWT_SECRET_KEY!;
export const JWT_REFRESH_SECRET_KEY = process.env.JWT_REFRESH_SECRET_KEY!;

export const initLoginRoutes = (app: Express) => {
    app.post('/token/verify', async (req, res) => {
        const accessToken = req.cookies.accessToken;
        if(accessToken){
            const user = verifyWithRefresh(res, accessToken, req.cookies.refreshToken);
            if(user){
                return res.json(user);
            }
            return res.sendStatus(401);
        }
        res.sendStatus(400);
    });
    app.post('/token/refresh', async (req, res) => {
        const refreshToken = req.cookies.refreshToken;
        if(refreshToken){
            const user = verifyToken(refreshToken, JWT_REFRESH_SECRET_KEY);
            if(user){
                generateToken(res, user);
                return res.json(user);
            }
            return res.sendStatus(401);
        }
        res.sendStatus(400);
    });
    app.post('/login/account', async (req, res) => {
        const {username, password} = req.body;
        const user = await prisma.user.findUnique({
            where: {username}
        })
        if(!user || !(await comparePassword(password, user.password))){
            return res.status(401).json({error: '사용자명 혹은 비밀번호가 잘못되었습니다.'});
        }else{
            generateToken(res, user);
            return res.json(user);
        }
    });
    app.all('/logout', async (_, res) => {
        res.clearCookie('accessToken');
        res.clearCookie('refreshToken');
        res.redirect('/');
    });
    app.get('/hash', async (req, res) => {
        const password: string = req.query.value + '';
        res.send(await hashPassword(password));
    });
}