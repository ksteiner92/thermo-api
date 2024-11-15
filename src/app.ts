import "reflect-metadata";
import Koa from "koa";
import Router from "@koa/router";
import cors from "@koa/cors";
import "dotenv/config";
import { RegisterRoutes } from "./api/routes";
import { ThermostatManager } from "./ThermostatManager";
import { registerTypes } from "./ioc/Register";
import { logger } from "./Logging";
import KoaPino from "koa-pino-logger";

registerTypes();

const app = new Koa();
const router = new Router();
RegisterRoutes(router);
app.use(KoaPino());
app.use(cors());
app.use(router.routes());
app.listen(process.env.SERVER_PORT, () => {
  logger.info(
    `🚀 Server is running on port http://localhost:${process.env.SERVER_PORT}/`,
  );
  const thermostatManager = ThermostatManager.getInstance();
  thermostatManager.start();
});
