import {initCheckerRoutes} from "./routes/checker.js";
import {initSwitchBotRoutes} from "./routes/switch_bot.js";
import {initLoginRoutes} from "./routes/login.js";
import {initLoginMiddleware} from "./middleware/login.js";
import {initCommonMiddleware} from "./middleware/common.js";
import {initRemoteBotRoutes} from "./routes/remote_bot.js";
import {initWebPushRoutes} from "./routes/web_push.js";
import {initWakeOnLanRoutes} from "./routes/wake_on_lan.js";

export const initAllRoutes = () => {
    initCommonMiddleware();
    initLoginMiddleware();

    initLoginRoutes();
    initCheckerRoutes();
    initSwitchBotRoutes();
    initRemoteBotRoutes();
    initWakeOnLanRoutes();
    initWebPushRoutes();
}