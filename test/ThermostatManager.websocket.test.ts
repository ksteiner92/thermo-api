import fs from "fs";
import path from "path";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { ThermostatManager } from "../src/ThermostatManager";
import { EquipmentStatus, Mode } from "../src/client/daikin/DaikinTypes";

type MockWsModule = {
  __mockServers: Array<{
    clients: Set<unknown>;
    connect: () => {
      send: ReturnType<typeof vi.fn>;
    };
  }>;
};

describe("ThermostatManager websocket updates", () => {
  let dataDir: string;

  beforeEach(async () => {
    vi.useRealTimers();
    dataDir = path.join(
      "/tmp",
      `thermo-ws-test-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    );
    process.env.DATA_DIR = dataDir;
    const ws = (await import("ws")) as unknown as MockWsModule;
    ws.__mockServers.length = 0;
  });

  afterEach(() => {
    vi.useRealTimers();
    fs.rmSync(dataDir, { force: true, recursive: true });
  });

  function createManager(): ThermostatManager {
    return new ThermostatManager(
      {
        getDevice: vi.fn(),
        getDevices: vi.fn(),
        updateMode: vi.fn(),
      } as never,
      {
        getMeasurement: vi.fn(),
      } as never,
    );
  }

  function seedManager(manager: ThermostatManager): void {
    (manager as never as { deviceId: string }).deviceId = "device-1";
    (manager as never as { lastMeasurement: { humidity: number; temperature: number } }).lastMeasurement =
      {
        humidity: 41,
        temperature: 22.5,
      };
    (manager as never as { lastDeviceUpdateTimestamp: number }).lastDeviceUpdateTimestamp =
      1;
    (manager as never as { lastSensorPollTimestamp: number }).lastSensorPollTimestamp =
      1;
    (manager as never as { lastThermostatUpdateTimestamp: number }).lastThermostatUpdateTimestamp =
      1;
    (manager as never as {
      device: {
        coolSetpoint: number;
        equipmentStatus: EquipmentStatus;
        heatSetpoint: number;
        id: string;
        setpointDelta: number;
        setpointMaximum: number;
        setpointMinimum: number;
        tempIndoor: number;
      };
    }).device = {
      coolSetpoint: 24,
      equipmentStatus: EquipmentStatus.IDLE,
      heatSetpoint: 20,
      id: "device-1",
      setpointDelta: 2,
      setpointMaximum: 30,
      setpointMinimum: 16,
      tempIndoor: 22,
      mode: Mode.AUTO,
    } as never;
  }

  it("sends a thermostat snapshot when a websocket client connects", async () => {
    const manager = createManager();
    seedManager(manager);
    const ws = (await import("ws")) as unknown as MockWsModule;
    const server = ws.__mockServers[0];

    const client = server.connect();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(client.send).toHaveBeenCalledOnce();
    expect(JSON.parse(client.send.mock.calls[0][0])).toMatchObject({
      type: "thermostat_snapshot",
      payload: {
        coolSetpoint: 25,
        heatSetpoint: 19,
        sensorHumidity: 41,
        sensorTemperature: 22.5,
        status: "IDLE",
      },
    });
  });

  it("broadcasts scheduled thermostat snapshots to connected clients", async () => {
    vi.useFakeTimers();
    const manager = createManager();
    seedManager(manager);
    const ws = (await import("ws")) as unknown as MockWsModule;
    const server = ws.__mockServers[0];
    const client = server.connect();
    client.send.mockClear();

    (manager as never as { scheduleWebSocketUpdate: () => void }).scheduleWebSocketUpdate();
    await vi.advanceTimersByTimeAsync(100);

    expect(client.send).toHaveBeenCalled();
    expect(JSON.parse(client.send.mock.calls[0][0]).type).toBe(
      "thermostat_snapshot",
    );

    clearInterval(
      (manager as never as { webSocketUpdateTaskId: NodeJS.Timeout }).webSocketUpdateTaskId,
    );
  });
});
