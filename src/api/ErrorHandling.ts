import Koa from "koa";
import {
  ThermostatManagerError,
  ThermostatManagerErrorType,
} from "../ThermostatManager";
import { StatusCodes } from "http-status-codes";

export function errorHandling(): Koa.Middleware<
  Koa.DefaultState,
  Koa.DefaultContext,
  void
> {
  return async (ctx: Koa.Context, next: Koa.Next): Promise<void> => {
    try {
      await next();
    } catch (error) {
      if (error instanceof ThermostatManagerError) {
        ctx.status = StatusCodes.INTERNAL_SERVER_ERROR;
        ctx.message = error.message;
        if (error.type === ThermostatManagerErrorType.VALIDATION_ERROR) {
          ctx.status = StatusCodes.UNPROCESSABLE_ENTITY;
        }
      } else {
        throw error;
      }
    }
  };
}
