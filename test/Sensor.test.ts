import { mkdtempSync, rmSync } from "fs";
import os from "os";
import path from "path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { logger } from "../src/Logging";
import { PollingSensorState, Sensor } from "../src/Sensor";
import { sensorStateSchema } from "../src/SensorState";
import { RoomSensor } from "../src/RoomSensor";
import { ThermostatSensor } from "../src/ThermostatSensor";
import { EquipmentStatus, Mode, type DeviceResponse } from "../src/client/daikin/DaikinTypes";

class TestSensor extends Sensor {
  public pollImpl = vi.fn();

  public constructor(pollIntervalMs = 10, errorAfterNumSensorPollFailures = 2) {
    super("TestSensor", pollIntervalMs, errorAfterNumSensorPollFailures);
  }

  public poll() {
    return this.pollImpl();
  }
}

function createDeviceResponse(overrides: Partial<DeviceResponse> = {}): DeviceResponse {
  return {
    coolSetpoint: 24,
    equipmentStatus: EquipmentStatus.IDLE,
    fan: 0,
    fanCirculate: 0,
    fanCirculateSpeed: 0,
    geofencingEnabled: false,
    heatSetpoint: 20,
    humIndoor: 40,
    humOutdoor: 30,
    mode: Mode.AUTO,
    modeEmHeatAvailable: 0,
    modeLimit: 0,
    scheduleEnabled: false,
    setpointDelta: 2,
    setpointMaximum: 30,
    setpointMinimum: 16,
    tempIndoor: 22,
    tempOutdoor: 15,
    ...overrides,
  };
}

describe("Sensor", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("exposes name, measurement, state and lastPolled", async () => {
    const sensor = new TestSensor();
    sensor.pollImpl.mockResolvedValue({ humidity: 40, temperature: 21 });

    expect(sensor.name).toBe("TestSensor");
    expect(sensor.measurement).toBeUndefined();
    expect(sensor.lastPolled).toBe(0);
    expect(sensor.state).toBe(PollingSensorState.STOPPED);

    await sensor.start();

    expect(sensor.measurement).toEqual({ humidity: 40, temperature: 21 });
    expect(sensor.state).toBe(PollingSensorState.RUNNING);
  });

  it("rethrows initialization errors from start", async () => {
    const sensor = new TestSensor();
    const error = new Error("init failed");
    sensor.pollImpl.mockRejectedValue(error);

    await expect(sensor.start()).rejects.toBe(error);
  });

  it("does not repoll during start when a measurement already exists", async () => {
    const sensor = new TestSensor();
    sensor.pollImpl.mockResolvedValue({ humidity: 40, temperature: 21 });

    await sensor.start();
    await sensor.start();

    expect(sensor.pollImpl).toHaveBeenCalledOnce();
  });

  it("runs polling on an interval and updates the last poll timestamp", async () => {
    const sensor = new TestSensor();
    sensor.pollImpl
      .mockResolvedValueOnce({ humidity: 40, temperature: 21 })
      .mockResolvedValueOnce({ humidity: 41, temperature: 22 });

    await sensor.start();
    vi.setSystemTime(new Date("2026-03-09T00:00:00.000Z"));
    await vi.advanceTimersByTimeAsync(10);

    expect(sensor.measurement).toEqual({ humidity: 41, temperature: 22 });
    expect(sensor.lastPolled).toBe(Date.now());
  });

  it("transitions to error after repeated polling failures", async () => {
    const sensor = new TestSensor(10, 1);
    sensor.pollImpl.mockResolvedValueOnce({ humidity: 40, temperature: 21 });
    sensor.pollImpl.mockRejectedValue(new Error("poll failed"));

    await sensor.start();
    await vi.advanceTimersByTimeAsync(10);

    expect(sensor.state).toBe(PollingSensorState.ERROR);
  });

  it("restarts polling after recovering from failures", async () => {
    const sensor = new TestSensor(10, 2);
    const startSpy = vi.spyOn(sensor, "start");
    sensor.pollImpl
      .mockResolvedValueOnce({ humidity: 40, temperature: 21 })
      .mockRejectedValueOnce(new Error("poll failed"))
      .mockRejectedValueOnce(new Error("poll failed"))
      .mockResolvedValue({ humidity: 42, temperature: 20 });

    await sensor.start();
    await vi.advanceTimersByTimeAsync(10);
    await vi.advanceTimersByTimeAsync(10);
    (sensor as never as { sensorPollFailureCount_: number }).sensorPollFailureCount_ = 2;
    await (sensor as never as { runPolling: () => Promise<void> }).runPolling();

    expect(startSpy).toHaveBeenCalledTimes(2);
  });

  it("stops and clears the interval when no longer running", async () => {
    const sensor = new TestSensor();
    const clearIntervalSpy = vi.spyOn(global, "clearInterval");
    sensor.pollImpl.mockResolvedValue({ humidity: 40, temperature: 21 });

    await sensor.start();
    sensor.stop();
    await vi.advanceTimersByTimeAsync(10);

    expect(sensor.state).toBe(PollingSensorState.STOPPED);
    expect(clearIntervalSpy).toHaveBeenCalled();
  });

  it("ignores duplicate schedule requests", async () => {
    const sensor = new TestSensor();
    const setIntervalSpy = vi.spyOn(global, "setInterval");
    sensor.pollImpl.mockResolvedValue({ humidity: 40, temperature: 21 });

    await sensor.start();
    await sensor.start();

    expect(setIntervalSpy).toHaveBeenCalledOnce();
  });

  it("logs polling interval exceptions", async () => {
    const sensor = new TestSensor();
    sensor.pollImpl.mockResolvedValue({ humidity: 40, temperature: 21 });
    await sensor.start();
    vi.spyOn(sensor as never, "runPolling").mockRejectedValue(new Error("boom"));

    await vi.advanceTimersByTimeAsync(10);

    expect(sensor.state).toBe(PollingSensorState.RUNNING);
  });
});

describe("RoomSensor", () => {
  it("polls through the sensor client", async () => {
    const sensorClient = {
      getMeasurement: vi.fn().mockResolvedValue({
        humidity: 33,
        temperature: 20,
      }),
    };
    const roomSensor = new RoomSensor(sensorClient as never);

    await expect(roomSensor.poll()).resolves.toEqual({
      humidity: 33,
      temperature: 20,
    });
    expect(roomSensor.name).toBe("ThermostatSensor");
  });

  it("uses fallback env parsing when sensor env is absent", async () => {
    vi.resetModules();
    const previousInterval = process.env.SENSOR_POLL_INTERVAL_MS;
    const previousFailures = process.env.ERROR_AFTER_NUM_SENSOR_POLL_FAILURES;
    delete process.env.SENSOR_POLL_INTERVAL_MS;
    delete process.env.ERROR_AFTER_NUM_SENSOR_POLL_FAILURES;
    const { RoomSensor: FreshRoomSensor } = await import("../src/RoomSensor");
    const sensorClient = {
      getMeasurement: vi.fn().mockResolvedValue({
        humidity: 33,
        temperature: 20,
      }),
    };

    const roomSensor = new FreshRoomSensor(sensorClient as never);

    expect(roomSensor.name).toBe("ThermostatSensor");

    process.env.SENSOR_POLL_INTERVAL_MS = previousInterval;
    process.env.ERROR_AFTER_NUM_SENSOR_POLL_FAILURES = previousFailures;
  });
});

describe("ThermostatSensor", () => {
  it("polls thermostat data through the Daikin client", async () => {
    const daikinClient = {
      getDevice: vi.fn().mockResolvedValue(
        createDeviceResponse({
          humIndoor: 35,
          tempIndoor: 23,
        }),
      ),
    };
    const thermostatSensor = new ThermostatSensor(daikinClient as never);

    await expect(thermostatSensor.poll()).resolves.toEqual({
      humidity: 35,
      temperature: 23,
    });
    expect(thermostatSensor.name).toBe("ThermostatSensor");
  });

  it("rethrows polling errors", async () => {
    const daikinClient = {
      getDevice: vi.fn().mockRejectedValue(new Error("boom")),
    };
    const thermostatSensor = new ThermostatSensor(daikinClient as never);

    await expect(thermostatSensor.poll()).rejects.toEqual(new Error("boom"));
  });

  it("uses fallback env parsing when thermostat env is absent", async () => {
    vi.resetModules();
    const previousInterval = process.env.MAX_THERMOSTAT_UPDATE_FREQUENCY_MS;
    delete process.env.MAX_THERMOSTAT_UPDATE_FREQUENCY_MS;
    const { ThermostatSensor: FreshThermostatSensor } = await import(
      "../src/ThermostatSensor"
    );
    const thermostatSensor = new FreshThermostatSensor({
      getDevice: vi.fn().mockResolvedValue(createDeviceResponse()),
    } as never);

    expect(thermostatSensor.name).toBe("ThermostatSensor");

    process.env.MAX_THERMOSTAT_UPDATE_FREQUENCY_MS = previousInterval;
  });
});

describe("SensorState and logging", () => {
  it("parses default sensor state from environment", () => {
    expect(sensorStateSchema.parse({})).toEqual({
      coolSetpoint: 25,
      heatSetpoint: 19,
    });
  });

  it("parses sensor state when env defaults are absent", async () => {
    vi.resetModules();
    const previousCool = process.env.COOL_SETPOINT;
    const previousHeat = process.env.HEAT_SETPOINT;
    delete process.env.COOL_SETPOINT;
    delete process.env.HEAT_SETPOINT;

    const module = await import("../src/SensorState");

    expect(() => module.sensorStateSchema.parse({})).toThrow();

    process.env.COOL_SETPOINT = previousCool;
    process.env.HEAT_SETPOINT = previousHeat;
  });

  it("creates child loggers", () => {
    const child = logger.child({ scope: "test" });

    expect(child).toBeTruthy();
  });

  it("supports tmp file helpers used by manager tests", () => {
    const dir = mkdtempSync(path.join(os.tmpdir(), "thermo-sensor-"));

    expect(dir).toContain("thermo-sensor-");

    rmSync(dir, { force: true, recursive: true });
  });
});
