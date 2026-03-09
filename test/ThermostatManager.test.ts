import fs from "fs";
import os from "os";
import path from "path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { container } from "tsyringe";
import { registerTypes } from "../src/ioc/Register";
import { iocContainer } from "../src/ioc/tsyringeTsoaIocContainer";
import {
  ThermostatManager,
  ThermostatManagerError,
  ThermostatManagerErrorType,
} from "../src/ThermostatManager";
import {
  EquipmentStatus,
  Mode,
  type Device,
  type DeviceResponse,
  type Devices,
  type UpdateModeRequest,
} from "../src/client/daikin/DaikinTypes";
import { ThermostatStatus } from "../src/api/model/ThermostatInfo";
import { DaikinError } from "../src/client/daikin/DaikinError";
import { SensorError } from "../src/client/sensor/SensorError";

function createTempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "thermo-api-"));
}

function createDevice(overrides: Partial<Device> = {}): Device {
  const base: DeviceResponse = {
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
  };

  return {
    id: "device-1",
    ...base,
    ...overrides,
  };
}

function createDevices(id = "device-1"): Devices[] {
  return [
    {
      devices: [
        {
          firmwareVersion: "1.0",
          id,
          model: "model",
          name: "Living Room",
        },
      ],
      locationName: "Home",
    },
  ];
}

function createManager(options: {
  daikinClient?: Record<string, unknown>;
  sensorClient?: Record<string, unknown>;
  dataDir?: string;
} = {}) {
  const dataDir = options.dataDir ?? createTempDir();
  process.env.DATA_DIR = dataDir;
  const daikinClient = {
    getDevice: vi.fn().mockResolvedValue(createDevice()),
    getDevices: vi.fn().mockResolvedValue(createDevices()),
    updateMode: vi.fn().mockResolvedValue({ message: "ok" }),
    ...options.daikinClient,
  };
  const sensorClient = {
    getMeasurement: vi.fn().mockResolvedValue({
      humidity: 40,
      temperature: 22,
    }),
    ...options.sensorClient,
  };
  const manager = new ThermostatManager(daikinClient as never, sensorClient as never);

  return {
    daikinClient,
    dataDir,
    manager,
    sensorClient,
  };
}

describe("ThermostatManager", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    process.env.DATA_DIR = "/tmp/thermo-tests";
  });

  it("requires DATA_DIR", () => {
    const previous = process.env.DATA_DIR;
    delete process.env.DATA_DIR;

    expect(() => new ThermostatManager({} as never, {} as never)).toThrowError(
      new ThermostatManagerError(
        ThermostatManagerErrorType.DATA_ERROR,
        "Unable to determine data directory",
      ),
    );

    process.env.DATA_DIR = previous;
  });

  it("creates the data directory when missing", () => {
    const dataDir = path.join(createTempDir(), "nested");
    process.env.DATA_DIR = dataDir;

    new ThermostatManager({} as never, {} as never);

    expect(fs.existsSync(dataDir)).toBe(true);
  });

  it("throws if the data directory cannot be created", () => {
    const existsSpy = vi
      .spyOn(fs, "existsSync")
      .mockReturnValue(false);
    const mkdirSpy = vi.spyOn(fs, "mkdirSync").mockImplementation(() => {
      throw new Error("mkdir failed");
    });
    process.env.DATA_DIR = "/tmp/missing";

    expect(() => new ThermostatManager({} as never, {} as never)).toThrowError(
      new ThermostatManagerError(
        ThermostatManagerErrorType.INIT_ERROR,
        "Unable to create data directory",
      ),
    );

    existsSpy.mockRestore();
    mkdirSpy.mockRestore();
  });

  it("throws if mkdirSync reports failure", () => {
    const existsSpy = vi.spyOn(fs, "existsSync").mockReturnValue(false);
    const mkdirSpy = vi.spyOn(fs, "mkdirSync").mockReturnValue("" as never);
    process.env.DATA_DIR = "/tmp/missing";

    expect(() => new ThermostatManager({} as never, {} as never)).toThrowError(
      new ThermostatManagerError(
        ThermostatManagerErrorType.INIT_ERROR,
        "Unable to create data directory",
      ),
    );

    existsSpy.mockRestore();
    mkdirSpy.mockRestore();
  });

  it("loads persisted state from disk", async () => {
    const dataDir = createTempDir();
    fs.writeFileSync(
      path.join(dataDir, "thermostat-state.json"),
      JSON.stringify({ coolSetpoint: 27, heatSetpoint: 18 }),
    );
    const { manager } = createManager({ dataDir });
    (manager as never as { device: Device }).device = createDevice();
    (manager as never as { deviceId: string }).deviceId = "device-1";
    (manager as never as { lastMeasurement: { humidity: number; temperature: number } }).lastMeasurement = {
      humidity: 40,
      temperature: 22,
    };

    const info = await manager.getThermostatInfo();

    expect(info.coolSetpoint).toBe(27);
    expect(info.heatSetpoint).toBe(18);
  });

  it("resolves the singleton instance from the container", () => {
    const { manager } = createManager();
    container.registerInstance("ThermostatManager", manager as never);

    expect(ThermostatManager.getInstance()).toBe(manager);
    expect(iocContainer.get("ThermostatManager")).toBe(manager);
  });

  it("starts successfully and schedules background tasks", async () => {
    const { manager, daikinClient, sensorClient } = createManager();
    const controlSpy = vi
      .spyOn(manager as never, "controlTemperature")
      .mockResolvedValue(undefined);
    const pollSpy = vi.spyOn(manager as never, "pollSensor");

    await manager.start();

    expect(daikinClient.getDevices).toHaveBeenCalledOnce();
    expect(daikinClient.getDevice).toHaveBeenCalledOnce();
    expect(sensorClient.getMeasurement).toHaveBeenCalledOnce();
    expect(pollSpy).toHaveBeenCalledOnce();
    expect(controlSpy).toHaveBeenCalledOnce();
    expect((manager as never as { initialDevice: Device }).initialDevice).toEqual(
      (manager as never as { device: Device }).device,
    );
  });

  it("fails start when no device is available", async () => {
    const { manager } = createManager({
      daikinClient: { getDevices: vi.fn().mockResolvedValue([]) },
    });

    await expect(manager.start()).rejects.toEqual(
      new ThermostatManagerError(
        ThermostatManagerErrorType.INIT_ERROR,
        "Could not find device",
      ),
    );
  });

  it("passes through thermostat manager errors during start", async () => {
    const error = new ThermostatManagerError(
      ThermostatManagerErrorType.INIT_ERROR,
      "broken",
    );
    const { manager } = createManager({
      daikinClient: { getDevices: vi.fn().mockRejectedValue(error) },
    });

    await expect(manager.start()).rejects.toBe(error);
  });

  it("wraps unknown startup errors", async () => {
    const { manager } = createManager({
      daikinClient: { getDevices: vi.fn().mockRejectedValue(new Error("boom")) },
    });

    await expect(manager.start()).rejects.toEqual(
      new ThermostatManagerError(
        ThermostatManagerErrorType.INIT_ERROR,
        "Could not initialize",
      ),
    );
  });

  it("returns thermostat info with loaded device data", async () => {
    const { manager, daikinClient } = createManager();
    (manager as never as { deviceId: string }).deviceId = "device-1";
    (manager as never as { lastMeasurement: { humidity: number; temperature: number } }).lastMeasurement = {
      humidity: 40,
      temperature: 22,
    };
    vi.setSystemTime(new Date("2026-03-09T00:00:00.000Z"));

    const info = await manager.getThermostatInfo();

    expect(daikinClient.getDevice).toHaveBeenCalledWith("device-1");
    expect(info.status).toBe(ThermostatStatus.IDLE);
    expect(info.lowestTemperature).toBe(16);
  });

  it("throws when thermostat info cannot be loaded", async () => {
    const { manager, daikinClient } = createManager({
      daikinClient: { getDevice: vi.fn().mockResolvedValue(undefined) },
    });
    (manager as never as { deviceId: string }).deviceId = "device-1";
    (manager as never as { lastMeasurement: { humidity: number; temperature: number } }).lastMeasurement = {
      humidity: 40,
      temperature: 22,
    };
    (manager as never as { device: Device | undefined }).device = undefined;
    daikinClient.getDevice.mockResolvedValue(undefined);

    await expect(manager.getThermostatInfo()).rejects.toEqual(
      new ThermostatManagerError(
        ThermostatManagerErrorType.THERMOSTAT_INFO_ERROR,
        "Could not get thermostat info",
      ),
    );
  });

  it("validates setpoint updates", () => {
    const { manager } = createManager();

    expect(() =>
      manager.updateSetpoints({ coolSetpoint: 25, heatSetpoint: 20 }),
    ).toThrowError(
      new ThermostatManagerError(
        ThermostatManagerErrorType.VALIDATION_ERROR,
        "Thermostat manager not ready",
      ),
    );

    (manager as never as { device: Device }).device = createDevice();

    expect(() =>
      manager.updateSetpoints({ coolSetpoint: 31, heatSetpoint: 20 }),
    ).toThrowError("Cool setpoint out of bounds");
    expect(() =>
      manager.updateSetpoints({ coolSetpoint: 15, heatSetpoint: 20 }),
    ).toThrowError("Cool setpoint out of bounds");
    expect(() =>
      manager.updateSetpoints({ coolSetpoint: 25, heatSetpoint: 15 }),
    ).toThrowError("Heat setpoint out of bounds");
    expect(() =>
      manager.updateSetpoints({ coolSetpoint: 25, heatSetpoint: 31 }),
    ).toThrowError("Heat setpoint out of bounds");
    expect(() =>
      manager.updateSetpoints({ coolSetpoint: 20, heatSetpoint: 21 }),
    ).toThrowError("Cool setpoint cannot be smaller than heat setpoint");
  });

  it("persists valid setpoint updates", () => {
    const { dataDir, manager } = createManager();
    (manager as never as { device: Device }).device = createDevice();
    (manager as never as { deviceId: string }).deviceId = "device-1";
    (manager as never as { lastMeasurement: { humidity: number; temperature: number } }).lastMeasurement = {
      humidity: 40,
      temperature: 22,
    };

    manager.updateSetpoints({ coolSetpoint: 26, heatSetpoint: 20 });

    expect(
      JSON.parse(
        fs.readFileSync(path.join(dataDir, "thermostat-state.json"), "utf8"),
      ),
    ).toEqual({
      coolSetpoint: 26,
      heatSetpoint: 20,
    });
  });

  it("updates the thermostat and rethrows fetch failures", async () => {
    const error = new Error("fetch failed");
    const { manager } = createManager({
      daikinClient: { getDevice: vi.fn().mockRejectedValue(error) },
    });
    (manager as never as { deviceId: string }).deviceId = "device-1";

    await expect(
      (manager as never as { updateThermostat: () => Promise<void> }).updateThermostat(),
    ).rejects.toBe(error);
  });

  it("updates the thermostat and broadcasts a websocket snapshot", async () => {
    const { manager } = createManager();
    const broadcastSpy = vi
      .spyOn(manager as never, "broadcastSnapshot")
      .mockResolvedValue(undefined);
    (manager as never as { deviceId: string }).deviceId = "device-1";

    await (manager as never as { updateThermostat: () => Promise<void> }).updateThermostat();

    expect(broadcastSpy).toHaveBeenCalledOnce();
  });

  it("detects stale and fresh devices", () => {
    const { manager } = createManager();

    expect(
      (manager as never as { isDeviceStale: () => boolean }).isDeviceStale(),
    ).toBe(false);

    (manager as never as { lastDeviceUpdateTimestamp: number }).lastDeviceUpdateTimestamp =
      Date.now() - 2000;

    expect(
      (manager as never as { isDeviceStale: () => boolean }).isDeviceStale(),
    ).toBe(true);
  });

  it("updates cooling mode when needed", async () => {
    const { manager } = createManager();
    const updateModeSpy = vi
      .spyOn(manager as never, "updateMode")
      .mockResolvedValue(undefined);

    await (manager as never as { cool: (device: Device, temperature: number) => Promise<void> }).cool(
      createDevice({
        coolSetpoint: 24,
        equipmentStatus: EquipmentStatus.IDLE,
        tempIndoor: 22,
      }),
      27,
    );

    expect(updateModeSpy).toHaveBeenCalledWith("device-1", {
      coolSetpoint: 21.5,
      heatSetpoint: 19.5,
      mode: Mode.COOL,
    });
  });

  it("clamps cooling mode and skips redundant updates", async () => {
    const { manager } = createManager();
    const updateModeSpy = vi
      .spyOn(manager as never, "updateMode")
      .mockResolvedValue(undefined);

    await (manager as never as { cool: (device: Device, temperature: number) => Promise<void> }).cool(
      createDevice({
        coolSetpoint: 16,
        equipmentStatus: EquipmentStatus.COOL,
        setpointMinimum: 16,
        tempIndoor: 16,
      }),
      27,
    );

    expect(updateModeSpy).not.toHaveBeenCalled();
  });

  it("clamps cooling mode to the minimum setpoint", async () => {
    const { manager } = createManager();
    const updateModeSpy = vi
      .spyOn(manager as never, "updateMode")
      .mockResolvedValue(undefined);

    await (manager as never as { cool: (device: Device, temperature: number) => Promise<void> }).cool(
      createDevice({
        coolSetpoint: 18,
        equipmentStatus: EquipmentStatus.IDLE,
        setpointMinimum: 18,
        tempIndoor: 18,
      }),
      27,
    );

    expect(updateModeSpy).not.toHaveBeenCalled();
  });

  it("updates heating mode when needed", async () => {
    const { manager } = createManager();
    const updateModeSpy = vi
      .spyOn(manager as never, "updateMode")
      .mockResolvedValue(undefined);

    await (manager as never as { heat: (device: Device, temperature: number) => Promise<void> }).heat(
      createDevice({
        equipmentStatus: EquipmentStatus.IDLE,
        heatSetpoint: 20,
        tempIndoor: 22,
      }),
      18,
    );

    expect(updateModeSpy).toHaveBeenCalledWith("device-1", {
      coolSetpoint: 24.5,
      heatSetpoint: 22.5,
      mode: Mode.HEAT,
    });
  });

  it("clamps heating mode and skips redundant updates", async () => {
    const { manager } = createManager();
    const updateModeSpy = vi
      .spyOn(manager as never, "updateMode")
      .mockResolvedValue(undefined);

    await (manager as never as { heat: (device: Device, temperature: number) => Promise<void> }).heat(
      createDevice({
        equipmentStatus: EquipmentStatus.HEAT,
        heatSetpoint: 30,
        setpointMaximum: 30,
        tempIndoor: 30,
      }),
      18,
    );

    expect(updateModeSpy).not.toHaveBeenCalled();
  });

  it("clamps heating mode to the maximum setpoint", async () => {
    const { manager } = createManager();
    const updateModeSpy = vi
      .spyOn(manager as never, "updateMode")
      .mockResolvedValue(undefined);

    await (manager as never as { heat: (device: Device, temperature: number) => Promise<void> }).heat(
      createDevice({
        equipmentStatus: EquipmentStatus.IDLE,
        setpointMaximum: 30,
        tempIndoor: 30,
      }),
      18,
    );

    expect(updateModeSpy).toHaveBeenCalledWith("device-1", {
      coolSetpoint: 32,
      heatSetpoint: 30,
      mode: Mode.HEAT,
    });
  });

  it("moves idle cooling equipment back toward neutral", async () => {
    const { manager } = createManager();
    const updateModeSpy = vi
      .spyOn(manager as never, "updateMode")
      .mockResolvedValue(undefined);

    await (manager as never as { idle: (device: Device, temperature: number) => Promise<void> }).idle(
      createDevice({
        coolSetpoint: 24,
        equipmentStatus: EquipmentStatus.COOL,
        tempIndoor: 22,
      }),
      22,
    );

    expect(updateModeSpy).toHaveBeenCalledWith("device-1", {
      coolSetpoint: 22.5,
      heatSetpoint: 20.5,
      mode: Mode.COOL,
    });
  });

  it("moves idle heating equipment back toward neutral", async () => {
    const { manager } = createManager();
    const updateModeSpy = vi
      .spyOn(manager as never, "updateMode")
      .mockResolvedValue(undefined);

    await (manager as never as { idle: (device: Device, temperature: number) => Promise<void> }).idle(
      createDevice({
        equipmentStatus: EquipmentStatus.HEAT,
        heatSetpoint: 20,
        tempIndoor: 22,
      }),
      22,
    );

    expect(updateModeSpy).toHaveBeenCalledWith("device-1", {
      coolSetpoint: 23.5,
      heatSetpoint: 21.5,
      mode: Mode.HEAT,
    });
  });

  it("handles idle no-op branches", async () => {
    const { manager } = createManager();
    const updateModeSpy = vi
      .spyOn(manager as never, "updateMode")
      .mockResolvedValue(undefined);

    await (manager as never as { idle: (device: Device, temperature: number) => Promise<void> }).idle(
      createDevice({ equipmentStatus: EquipmentStatus.IDLE }),
      22,
    );
    await (manager as never as { idle: (device: Device, temperature: number) => Promise<void> }).idle(
      createDevice({
        equipmentStatus: EquipmentStatus.COOL,
        coolSetpoint: 22.5,
        setpointMaximum: 22.5,
        tempIndoor: 22,
      }),
      22,
    );
    await (manager as never as { idle: (device: Device, temperature: number) => Promise<void> }).idle(
      createDevice({
        equipmentStatus: EquipmentStatus.HEAT,
        heatSetpoint: 21.5,
        setpointMinimum: 21.5,
        tempIndoor: 22,
      }),
      22,
    );
    await (manager as never as { idle: (device: Device, temperature: number) => Promise<void> }).idle(
      createDevice({ equipmentStatus: 999 as EquipmentStatus }),
      22,
    );

    expect(updateModeSpy).not.toHaveBeenCalled();
  });

  it("clamps idle transitions at both setpoint boundaries", async () => {
    const { manager } = createManager();
    const updateModeSpy = vi
      .spyOn(manager as never, "updateMode")
      .mockResolvedValue(undefined);

    await (manager as never as { idle: (device: Device, temperature: number) => Promise<void> }).idle(
      createDevice({
        equipmentStatus: EquipmentStatus.COOL,
        setpointMaximum: 22,
        tempIndoor: 22,
      }),
      22,
    );
    await (manager as never as { idle: (device: Device, temperature: number) => Promise<void> }).idle(
      createDevice({
        equipmentStatus: EquipmentStatus.HEAT,
        setpointMinimum: 21,
        tempIndoor: 21,
      }),
      22,
    );

    expect(updateModeSpy).toHaveBeenNthCalledWith(1, "device-1", {
      coolSetpoint: 22,
      heatSetpoint: 20,
      mode: Mode.COOL,
    });
    expect(updateModeSpy).toHaveBeenNthCalledWith(2, "device-1", {
      coolSetpoint: 23,
      heatSetpoint: 21,
      mode: Mode.HEAT,
    });
  });

  it("maps thermostat runtime status values", () => {
    const { manager } = createManager();

    (manager as never as { running: boolean }).running = false;
    (manager as never as { sensorPollFailureCount: number }).sensorPollFailureCount = 2;
    expect(
      (manager as never as { getThermostatStatus: () => ThermostatStatus }).getThermostatStatus(),
    ).toBe(ThermostatStatus.ERROR);

    (manager as never as { sensorPollFailureCount: number }).sensorPollFailureCount = 0;
    expect(
      (manager as never as { getThermostatStatus: () => ThermostatStatus }).getThermostatStatus(),
    ).toBe(ThermostatStatus.STOPPED);

    (manager as never as { running: boolean }).running = true;
    (manager as never as { device: Device | undefined }).device = undefined;
    expect(
      (manager as never as { getThermostatStatus: () => ThermostatStatus }).getThermostatStatus(),
    ).toBe(ThermostatStatus.OFF);

    (manager as never as { device: Device }).device = createDevice({
      equipmentStatus: EquipmentStatus.COOL,
    });
    expect(
      (manager as never as { getThermostatStatus: () => ThermostatStatus }).getThermostatStatus(),
    ).toBe(ThermostatStatus.COOL);

    (manager as never as { device: Device }).device = createDevice({
      equipmentStatus: EquipmentStatus.IDLE,
    });
    expect(
      (manager as never as { getThermostatStatus: () => ThermostatStatus }).getThermostatStatus(),
    ).toBe(ThermostatStatus.IDLE);

    (manager as never as { device: Device }).device = createDevice({
      equipmentStatus: EquipmentStatus.HEAT,
    });
    expect(
      (manager as never as { getThermostatStatus: () => ThermostatStatus }).getThermostatStatus(),
    ).toBe(ThermostatStatus.HEAT);

    (manager as never as { device: Device }).device = createDevice({
      equipmentStatus: 999 as EquipmentStatus,
    });
    expect(
      (manager as never as { getThermostatStatus: () => ThermostatStatus }).getThermostatStatus(),
    ).toBe(ThermostatStatus.OFF);
  });

  it("throttles thermostat mode updates and swallows update failures", async () => {
    const { manager, daikinClient } = createManager();
    const update: UpdateModeRequest = {
      coolSetpoint: 24,
      heatSetpoint: 20,
      mode: Mode.AUTO,
    };

    await (manager as never as {
      updateMode: (deviceId: string, updateModeRequest: UpdateModeRequest) => Promise<void>;
    }).updateMode("device-1", update);
    expect(daikinClient.updateMode).toHaveBeenCalledOnce();

    await (manager as never as {
      updateMode: (deviceId: string, updateModeRequest: UpdateModeRequest) => Promise<void>;
    }).updateMode("device-1", update);
    expect(daikinClient.updateMode).toHaveBeenCalledOnce();

    (manager as never as { lastThermostatUpdateTimestamp: number }).lastThermostatUpdateTimestamp =
      Date.now() - 1000;
    daikinClient.updateMode.mockRejectedValue(new Error("update failed"));
    await (manager as never as {
      updateMode: (deviceId: string, updateModeRequest: UpdateModeRequest) => Promise<void>;
    }).updateMode("device-1", update);
    expect(daikinClient.updateMode).toHaveBeenCalledTimes(2);
  });

  it("polls the sensor, recovers after previous failures, and stops after repeated errors", async () => {
    const { manager, sensorClient } = createManager();
    const startSpy = vi.spyOn(manager, "start").mockResolvedValue(undefined);
    const stopSpy = vi.spyOn(manager, "stop");

    (manager as never as { sensorPollFailureCount: number }).sensorPollFailureCount = 2;
    await (manager as never as { pollSensor: () => Promise<void> }).pollSensor();
    expect(startSpy).toHaveBeenCalledOnce();

    sensorClient.getMeasurement.mockRejectedValue(new Error("sensor failed"));
    (manager as never as { sensorPollFailureCount: number }).sensorPollFailureCount = 1;
    await (manager as never as { pollSensor: () => Promise<void> }).pollSensor();

    expect(stopSpy).toHaveBeenCalled();
  });

  it("routes control decisions to cool, heat, idle, and error logging", async () => {
    const { manager } = createManager();
    (manager as never as { device: Device }).device = createDevice();
    (manager as never as { deviceId: string }).deviceId = "device-1";
    (manager as never as { state: { coolSetpoint: number; heatSetpoint: number } }).state = {
      coolSetpoint: 25,
      heatSetpoint: 19,
    };
    const coolSpy = vi.spyOn(manager as never, "cool").mockResolvedValue(undefined);
    const heatSpy = vi.spyOn(manager as never, "heat").mockResolvedValue(undefined);
    const idleSpy = vi.spyOn(manager as never, "idle").mockResolvedValue(undefined);

    (manager as never as { lastMeasurement: { humidity: number; temperature: number } }).lastMeasurement = {
      humidity: 40,
      temperature: 26,
    };
    await (manager as never as { controlTemperature: () => Promise<void> }).controlTemperature();
    (manager as never as { lastMeasurement: { humidity: number; temperature: number } }).lastMeasurement = {
      humidity: 40,
      temperature: 18,
    };
    await (manager as never as { controlTemperature: () => Promise<void> }).controlTemperature();
    (manager as never as { lastMeasurement: { humidity: number; temperature: number } }).lastMeasurement = {
      humidity: 40,
      temperature: 22,
    };
    await (manager as never as { controlTemperature: () => Promise<void> }).controlTemperature();

    expect(coolSpy).toHaveBeenCalledOnce();
    expect(heatSpy).toHaveBeenCalledOnce();
    expect(idleSpy).toHaveBeenCalledOnce();

    (manager as never as { lastMeasurement: { humidity: number; temperature: number } | undefined }).lastMeasurement =
      undefined;
    await (manager as never as { controlTemperature: () => Promise<void> }).controlTemperature();

    coolSpy.mockRejectedValueOnce(new Error("cool failed"));
    (manager as never as { lastMeasurement: { humidity: number; temperature: number } }).lastMeasurement = {
      humidity: 40,
      temperature: 26,
    };
    await (manager as never as { controlTemperature: () => Promise<void> }).controlTemperature();
  });

  it("schedules recurring tasks only once and runs their callbacks", async () => {
    const { manager } = createManager();
    (manager as never as { device: Device }).device = createDevice();
    (manager as never as { deviceId: string }).deviceId = "device-1";
    const clients = new Set([{ id: "client-1" }]);
    (manager as never as { wss: { clients: Set<unknown> } }).wss.clients = clients;
    const pollSpy = vi.spyOn(manager as never, "pollSensor").mockResolvedValue(undefined);
    const updateSpy = vi.spyOn(manager as never, "updateThermostat").mockResolvedValue(undefined);
    const controlSpy = vi.spyOn(manager as never, "controlTemperature").mockResolvedValue(undefined);
    const setIntervalSpy = vi.spyOn(global, "setInterval");

    (manager as never as { schedulePollSensor: () => void }).schedulePollSensor();
    (manager as never as { schedulePollSensor: () => void }).schedulePollSensor();
    (manager as never as { scheduleWebSocketUpdate: () => void }).scheduleWebSocketUpdate();
    (manager as never as { scheduleUpdateThermostat: () => void }).scheduleUpdateThermostat();
    (manager as never as { scheduleTemperatureController: () => void }).scheduleTemperatureController();

    await vi.advanceTimersByTimeAsync(100);

    expect(setIntervalSpy).toHaveBeenCalledTimes(4);
    expect(pollSpy).toHaveBeenCalled();
    expect(updateSpy).toHaveBeenCalled();
    expect(controlSpy).toHaveBeenCalled();
  });

  it("handles task callback error branches and temperature controller shutdown", async () => {
    const { manager } = createManager();
    const clearIntervalSpy = vi.spyOn(global, "clearInterval");
    (manager as never as { device: Device }).device = createDevice();
    (manager as never as { deviceId: string }).deviceId = "device-1";
    (manager as never as { running: boolean }).running = true;

    vi.spyOn(manager as never, "pollSensor").mockRejectedValue(new Error("poll failed"));
    vi.spyOn(manager as never, "updateThermostat").mockRejectedValue(
      new Error("update failed"),
    );
    vi.spyOn(manager as never, "controlTemperature").mockImplementation(() => {
      throw new Error("control failed");
    });
    (manager as never as { wss: { clients: { forEach: (callback: () => void) => void } } }).wss.clients = {
      forEach: () => {
        throw new Error("ws failed");
      },
    };

    (manager as never as { schedulePollSensor: () => void }).schedulePollSensor();
    (manager as never as { scheduleWebSocketUpdate: () => void }).scheduleWebSocketUpdate();
    (manager as never as { scheduleUpdateThermostat: () => void }).scheduleUpdateThermostat();
    (manager as never as { scheduleTemperatureController: () => void }).scheduleTemperatureController();

    await vi.advanceTimersByTimeAsync(100);
    (manager as never as { running: boolean }).running = false;
    await vi.advanceTimersByTimeAsync(100);

    expect(clearIntervalSpy).toHaveBeenCalled();
  });

  it("handles missing device state in the temperature controller interval", async () => {
    const { manager } = createManager();
    const clearIntervalSpy = vi.spyOn(global, "clearInterval");

    (manager as never as { running: boolean }).running = true;
    (manager as never as { scheduleTemperatureController: () => void }).scheduleTemperatureController();
    await vi.advanceTimersByTimeAsync(100);
    (manager as never as { running: boolean }).running = false;
    await vi.advanceTimersByTimeAsync(100);

    expect(clearIntervalSpy).toHaveBeenCalled();
  });

  it("builds and sends websocket snapshots", async () => {
    const { manager } = createManager();
    (manager as never as { device: Device }).device = createDevice();
    (manager as never as { deviceId: string }).deviceId = "device-1";
    (manager as never as { lastMeasurement: { humidity: number; temperature: number } }).lastMeasurement = {
      humidity: 40,
      temperature: 22,
    };
    const ws = {
      readyState: 1,
      send: vi.fn(),
    };

    await (manager as never as {
      sendSnapshotToClient: (socket: { readyState: number; send: (payload: string) => void }) => Promise<void>;
    }).sendSnapshotToClient(ws);

    expect(JSON.parse(ws.send.mock.calls[0][0])).toEqual({
      payload: await manager.getThermostatInfo(),
      type: "thermostat_snapshot",
    });
  });

  it("skips closed websocket clients and handles send failures", async () => {
    const { manager } = createManager();
    (manager as never as { device: Device }).device = createDevice();
    (manager as never as { deviceId: string }).deviceId = "device-1";
    (manager as never as { lastMeasurement: { humidity: number; temperature: number } }).lastMeasurement = {
      humidity: 40,
      temperature: 22,
    };
    const closedClient = {
      readyState: 3,
      send: vi.fn(),
    };
    const brokenClient = {
      readyState: 1,
      send: vi.fn(() => {
        throw new Error("send failed");
      }),
    };
    (manager as never as { wss: { clients: Set<unknown> } }).wss.clients = new Set([
      closedClient,
      brokenClient,
    ]);

    await (manager as never as { broadcastSnapshot: () => Promise<void> }).broadcastSnapshot();
    await (manager as never as {
      sendSnapshotToClient: (socket: { readyState: number; send: (payload: string) => void }) => Promise<void>;
    }).sendSnapshotToClient({
      readyState: 3,
      send: vi.fn(),
    });
    await (manager as never as {
      sendSnapshotToClient: (socket: { readyState: number; send: () => void }) => Promise<void>;
    }).sendSnapshotToClient({
      readyState: 1,
      send: () => {
        throw new Error("send failed");
      },
    });
  });

  it("handles snapshot build failures", async () => {
    const { manager } = createManager();

    await (manager as never as { broadcastSnapshot: () => Promise<void> }).broadcastSnapshot();
  });

  it("registers IoC types", () => {
    registerTypes();

    expect(container.resolve("SensorClient")).toBeTruthy();
    expect(container.resolve("DaikinClient")).toBeTruthy();
  });

  it("registers IoC types with env fallbacks and ignores duplicate registration", async () => {
    vi.resetModules();
    const previousToken = process.env.DAIKIN_INTEGRATOR_TOKEN;
    const previousApiKey = process.env.DAIKIN_API_KEY;
    const previousEmail = process.env.DAIKIN_EMAIL;
    delete process.env.DAIKIN_INTEGRATOR_TOKEN;
    delete process.env.DAIKIN_API_KEY;
    delete process.env.DAIKIN_EMAIL;
    const module = await import("../src/ioc/Register");

    module.registerTypes();
    module.registerTypes();

    process.env.DAIKIN_INTEGRATOR_TOKEN = previousToken;
    process.env.DAIKIN_API_KEY = previousApiKey;
    process.env.DAIKIN_EMAIL = previousEmail;
  });

  it("covers exported error classes", () => {
    expect(new DaikinError("bad daikin").message).toBe("bad daikin");
    expect(new SensorError("bad sensor").message).toBe("bad sensor");
  });
});
