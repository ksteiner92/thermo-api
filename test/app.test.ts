import Koa from "koa";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { container } from "tsyringe";
import { createApp, shouldStartServer, startServer } from "../src/app";
import { SensorController } from "../src/api/controller/SensorController";
import { ThermostatController } from "../src/api/controller/ThermostatController";
import {
  ThermostatStatus,
  type ThermostatInfo,
} from "../src/api/model/ThermostatInfo";

describe("controllers and app", () => {
  const thermostatInfo: ThermostatInfo = {
    coolSetpoint: 25,
    deviceUpdatedLast: "now",
    heatSetpoint: 19,
    highestTemperature: 30,
    lowestTemperature: 16,
    sensorHumidity: 40,
    sensorPolledLast: "now",
    sensorTemperature: 22,
    status: ThermostatStatus.IDLE,
    thermostatCoolSetpoint: 24,
    thermostatHeatSetpoint: 20,
    thermostatUpdatedLast: "now",
  };
  const thermostatManager = {
    getThermostatInfo: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
    updateSetpoints: vi.fn(),
  };
  const sensorClient = {
    getMeasurement: vi.fn(),
    initialize: vi.fn(),
  };

  beforeEach(() => {
    thermostatManager.getThermostatInfo.mockReset();
    thermostatManager.start.mockReset();
    thermostatManager.stop.mockReset();
    thermostatManager.updateSetpoints.mockReset();
    sensorClient.getMeasurement.mockReset();
    sensorClient.initialize.mockReset();

    thermostatManager.start.mockResolvedValue(undefined);
    thermostatManager.getThermostatInfo.mockResolvedValue(thermostatInfo);
    sensorClient.getMeasurement.mockResolvedValue({
      humidity: 41,
      temperature: 21,
    });
    sensorClient.initialize.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("delegates thermostat info requests", async () => {
    const controller = new ThermostatController(thermostatManager as never);

    await expect(controller.getInfo()).resolves.toEqual(thermostatInfo);
  });

  it("updates setpoints and returns thermostat info", async () => {
    const controller = new ThermostatController(thermostatManager as never);

    await expect(
      controller.updateSetpoints({ coolSetpoint: 26, heatSetpoint: 20 }),
    ).resolves.toEqual(thermostatInfo);
    expect(thermostatManager.updateSetpoints).toHaveBeenCalledWith({
      coolSetpoint: 26,
      heatSetpoint: 20,
    });
  });

  it("enables and disables the thermostat manager", async () => {
    const controller = new ThermostatController(thermostatManager as never);

    await expect(controller.enable()).resolves.toEqual(thermostatInfo);
    await expect(controller.disable()).resolves.toEqual(thermostatInfo);
    expect(thermostatManager.start).toHaveBeenCalledOnce();
    expect(thermostatManager.stop).toHaveBeenCalledOnce();
  });

  it("delegates sensor reads", async () => {
    const controller = new SensorController(sensorClient as never);

    await expect(controller.getMeasurement()).resolves.toEqual({
      humidity: 41,
      temperature: 21,
    });
  });

  it("creates a configured koa app", () => {
    const app = createApp();

    expect(app).toBeInstanceOf(Koa);
    expect(app.middleware).toHaveLength(5);
    expect(shouldStartServer(undefined, "/tmp/app.ts")).toBe(false);
    expect(shouldStartServer("/tmp/app.ts", "/tmp/app.ts")).toBe(true);
  });

  it("starts the http server and triggers thermostat startup", async () => {
    const app = createApp();
    const fakeServer = {
      close: vi.fn(),
    };
    const listenSpy = vi.spyOn(app, "listen").mockImplementation(((
      _port: string | undefined,
      callback?: () => void,
    ) => {
      callback?.();
      return fakeServer as never;
    }) as typeof app.listen);
    container.registerInstance("SensorClient", sensorClient as never);
    container.registerInstance("ThermostatManager", thermostatManager as never);

    const server = startServer(app);

    await Promise.resolve();

    expect(listenSpy).toHaveBeenCalledWith(process.env.SERVER_PORT, expect.any(Function));
    expect(server).toBe(fakeServer);
    expect(sensorClient.initialize).toHaveBeenCalledOnce();
    expect(thermostatManager.start).toHaveBeenCalledOnce();
  });

  it("logs sensor client startup failures instead of rejecting the listen callback", async () => {
    const error = new Error("sensor startup failed");
    sensorClient.initialize.mockRejectedValue(error);
    const app = createApp();
    vi.spyOn(app, "listen").mockImplementation(((
      _port: string | undefined,
      callback?: () => void,
    ) => {
      callback?.();
      return { close: vi.fn() } as never;
    }) as typeof app.listen);
    container.registerInstance("SensorClient", sensorClient as never);
    container.registerInstance("ThermostatManager", thermostatManager as never);
    const logging = await import("../src/Logging");
    const loggerSpy = vi
      .spyOn(logging.logger, "error")
      .mockImplementation(() => logging.logger as never);

    startServer(app);
    await Promise.resolve();

    expect(loggerSpy).toHaveBeenCalledWith(
      { error },
      "Failed to initialize sensor client",
    );
  });

  it("logs startup failures instead of rejecting the listen callback", async () => {
    const error = new Error("startup failed");
    thermostatManager.start.mockRejectedValue(error);
    const app = createApp();
    vi.spyOn(app, "listen").mockImplementation(((
      _port: string | undefined,
      callback?: () => void,
    ) => {
      callback?.();
      return { close: vi.fn() } as never;
    }) as typeof app.listen);
    container.registerInstance("SensorClient", sensorClient as never);
    container.registerInstance("ThermostatManager", thermostatManager as never);
    const logging = await import("../src/Logging");
    const loggerSpy = vi
      .spyOn(logging.logger, "error")
      .mockImplementation(() => logging.logger as never);

    startServer(app);
    await Promise.resolve();

    expect(loggerSpy).toHaveBeenCalledWith(
      { error },
      "Failed to start thermostat manager",
    );
  });
});
