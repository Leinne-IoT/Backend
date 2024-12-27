import express from "express";
import {initCheckerRoutes} from "./routes/checker.js";
import {initSwitchBotRoutes} from "./routes/switchbot.js";
import {initLoginRoutes} from "./routes/login.js";
import {initLoginMiddleware} from "./middleware/login.js";
import {initCommonMiddleware} from "./middleware/common.js";
import {initRemoteBotRoutes} from "./routes/remotebot.js";
import {initWebPushRoutes} from "./routes/webpush.js";
import {initWakeOnLanRoutes} from "./routes/wake_on_lan.js";

export const createApp = () => {
    const app = express();

    initCommonMiddleware(app);
    initLoginMiddleware(app);

    initLoginRoutes(app);
    initCheckerRoutes(app);
    initSwitchBotRoutes(app);
    initRemoteBotRoutes(app);
    initWakeOnLanRoutes(app);
    initWebPushRoutes(app);
    return app;
}