import path from "path";
import { fileURLToPath } from "url";
import "reflect-metadata";
import { bodyParser } from "@koa/bodyparser";
import Router from "@koa/router";
import cors from "@koa/cors";
import Koa from "koa";
import KoaPino from "koa-pino-logger";
import type { Server } from "node:http";
import "dotenv/config";
import { RegisterRoutes } from "./api/routes";
import { ThermostatManager } from "./ThermostatManager";
import { registerTypes } from "./ioc/Register";
import { logger } from "./Logging";
import { errorHandling } from "./api/ErrorHandling";

export function createApp(): Koa {
  registerTypes();

  const app = new Koa();
  const router = new Router();
  RegisterRoutes(router);
  app.use(KoaPino());
  app.use(cors());
  app.use(bodyParser());
  app.use(errorHandling());
  app.use(router.routes());

  return app;
}

export function startServer(app: Koa = createApp()): Server {
  return app.listen(process.env.SERVER_PORT, () => {
    logger.info(
      `🚀 Server is running on port http://localhost:${process.env.SERVER_PORT}/`,
    );
    const thermostatManager = ThermostatManager.getInstance();
    thermostatManager.start().catch((error: unknown) => {
      logger.error({ error }, "Failed to start thermostat manager");
    });
  });
}

const entrypoint = process.argv[1];
const currentFile = fileURLToPath(import.meta.url);

export function shouldStartServer(
  currentEntrypoint: string | undefined = entrypoint,
  appFile: string = currentFile,
): boolean {
  return Boolean(currentEntrypoint && path.resolve(currentEntrypoint) === appFile);
}

/* c8 ignore start */
if (shouldStartServer()) {
  startServer();
}
/* c8 ignore stop */
