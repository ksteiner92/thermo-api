import Koa from "koa";
import {
  ThermostatManagerError,
  ThermostatManagerErrorType,
} from "../ThermostatManager";
import { StatusCodes } from "http-status-codes";
import { ValidateError } from "@tsoa/runtime";

type HttpError = {
  message?: string;
  status?: number;
};

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
      } else if (error instanceof ValidateError) {
        ctx.status = StatusCodes.UNPROCESSABLE_ENTITY;
        ctx.message = error.message;
      } else if (hasHttpStatus(error)) {
        ctx.status = error.status;
        ctx.message = error.message ?? ctx.message;
      } else {
        ctx.status = StatusCodes.INTERNAL_SERVER_ERROR;
        ctx.message = "Unhandled exception";
      }
    }
  };
}

function hasHttpStatus(error: unknown): error is HttpError & { status: number } {
  return (
    typeof error === "object" &&
    error !== null &&
    "status" in error &&
    typeof error.status === "number"
  );
}
