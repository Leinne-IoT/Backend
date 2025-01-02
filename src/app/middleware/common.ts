import express from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import {join} from "path";
import {__dirname} from "../../utils/utils.js";
import {iotServer} from "../../server";

export const initCommonMiddleware = () => {
    const app = iotServer.express;
    app.use(express.json());
    app.use(cookieParser());
    app.use(cors({
        origin: process.env.CORS_ORIGIN?.split(',') || [],
        credentials: true,
    }))
    app.use(express.urlencoded({extended: false}));
    app.use(express.static(join(__dirname, './public/')));
}