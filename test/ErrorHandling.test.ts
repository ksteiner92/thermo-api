import { StatusCodes } from "http-status-codes";
import { describe, expect, it, vi } from "vitest";
import {
  ThermostatManagerError,
  ThermostatManagerErrorType,
} from "../src/ThermostatManager";
import { errorHandling } from "../src/api/ErrorHandling";
import { ValidateError } from "@tsoa/runtime";

type TestContext = {
  message: string;
  status: number;
};

async function runErrorMiddleware(error: unknown): Promise<TestContext> {
  const middleware = errorHandling();
  const ctx = {
    message: "",
    status: 0,
  } as TestContext;

  await middleware(ctx as never, async () => {
    throw error;
  });

  return ctx;
}

describe("errorHandling", () => {
  it("maps thermostat validation errors to 422", async () => {
    const ctx = await runErrorMiddleware(
      new ThermostatManagerError(
        ThermostatManagerErrorType.VALIDATION_ERROR,
        "invalid",
      ),
    );

    expect(ctx.status).toBe(StatusCodes.UNPROCESSABLE_ENTITY);
    expect(ctx.message).toBe("invalid");
  });

  it("maps non-validation thermostat errors to 500", async () => {
    const ctx = await runErrorMiddleware(
      new ThermostatManagerError(
        ThermostatManagerErrorType.DATA_ERROR,
        "bad data",
      ),
    );

    expect(ctx.status).toBe(StatusCodes.INTERNAL_SERVER_ERROR);
    expect(ctx.message).toBe("bad data");
  });

  it("maps ValidateError instances to 422", async () => {
    const ctx = await runErrorMiddleware(new ValidateError({}, "payload invalid"));

    expect(ctx.status).toBe(StatusCodes.UNPROCESSABLE_ENTITY);
    expect(ctx.message).toBe("payload invalid");
  });

  it("preserves explicit http status errors", async () => {
    const ctx = await runErrorMiddleware({ status: 409, message: "conflict" });

    expect(ctx.status).toBe(409);
    expect(ctx.message).toBe("conflict");
  });

  it("preserves the existing message when an http status error has no message", async () => {
    const middleware = errorHandling();
    const ctx = {
      message: "keep me",
      status: 0,
    };

    await middleware(ctx as never, async () => {
      throw { status: 404 };
    });

    expect(ctx.status).toBe(404);
    expect(ctx.message).toBe("keep me");
  });

  it("maps unknown exceptions to 500", async () => {
    const ctx = await runErrorMiddleware(new Error("boom"));

    expect(ctx.status).toBe(StatusCodes.INTERNAL_SERVER_ERROR);
    expect(ctx.message).toBe("Unhandled exception");
  });

  it("passes through a successful request", async () => {
    const middleware = errorHandling();
    const next = vi.fn();
    const ctx = { message: "", status: 0 };

    await middleware(ctx as never, next);

    expect(next).toHaveBeenCalledOnce();
    expect(ctx.status).toBe(0);
  });
});
