import express, {Express} from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import {join} from "path";
import {__dirname} from "../../utils/utils.js";

export const initCommonMiddleware = (app: Express) => {
    app.use(express.json());
    app.use(cookieParser());
    app.use(cors({
        origin: process.env.CORS_ORIGIN?.split(',') || [],
        credentials: true,
    }))
    app.use(express.urlencoded({extended: false}));
    app.use(express.static(join(__dirname, './public/')));
}