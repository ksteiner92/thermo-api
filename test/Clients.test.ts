import { EventEmitter } from "node:events";
import axios from "axios";
import { StatusCodes } from "http-status-codes";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DaikinClient } from "../src/client/daikin/DaikinClient";
import { DaikinError } from "../src/client/daikin/DaikinError";
import {
  EquipmentStatus,
  Mode,
  type AuthorizationResponse,
  type DeviceResponse,
  type Devices,
} from "../src/client/daikin/DaikinTypes";
import {
  buildSensorClientOptions,
  SensorClient,
  type SensorClientOptions,
} from "../src/client/sensor/SensorClient";
import { SensorError } from "../src/client/sensor/SensorError";

vi.mock("axios-retry", () => ({
  default: vi.fn(),
}));

describe("DaikinClient", () => {
  const get = vi.fn();
  const put = vi.fn();
  const post = vi.fn();
  const useRequest = vi.fn();
  const useResponse = vi.fn();
  const create = vi.spyOn(axios, "create");

  beforeEach(() => {
    get.mockReset();
    put.mockReset();
    post.mockReset();
    useRequest.mockReset();
    useResponse.mockReset();
    create.mockReset();
    create.mockReturnValue({
      defaults: { headers: { common: {} } },
      get,
      interceptors: {
        request: { use: useRequest },
        response: { use: useResponse },
      },
      post,
      put,
    } as never);
  });

  it("configures request and response interceptors", () => {
    new DaikinClient("integrator", "api-key", "user@example.com");

    expect(create).toHaveBeenCalledWith({
      baseURL: "https://integrator-api.daikinskyport.com",
      withCredentials: false,
    });
    expect(useRequest).toHaveBeenCalledOnce();
    expect(useResponse).toHaveBeenCalledOnce();
  });

  it("adds auth headers in the request interceptor", async () => {
    new DaikinClient("integrator", "api-key", "user@example.com");
    const requestInterceptor = useRequest.mock.calls[0][0] as (
      config: Record<string, unknown>,
    ) => Promise<Record<string, unknown>>;

    const request = await requestInterceptor({ headers: {} });

    expect(request.headers).toMatchObject({
      Accept: "*/*",
      "Content-Type": "application/json",
      "x-api-key": "api-key",
    });
  });

  it("adds the authorization header after authentication", async () => {
    const instance = {
      defaults: { headers: { common: {} as Record<string, string> } },
      get,
      interceptors: {
        request: { use: useRequest },
        response: { use: useResponse },
      },
      post,
      put,
    } as never;
    const retryCall = vi.fn().mockResolvedValue({ ok: true });
    create.mockReturnValue(Object.assign(retryCall, instance));
    post.mockResolvedValue({
      data: {
        accessToken: "token",
        accessTokenExpiresIn: 300,
        tokenType: "Bearer",
      },
      status: StatusCodes.OK,
    });
    new DaikinClient("integrator", "api-key", "user@example.com");
    const responseInterceptor = useResponse.mock.calls[0][1] as (
      error: Record<string, unknown>,
    ) => Promise<unknown>;
    const requestInterceptor = useRequest.mock.calls[0][0] as (
      config: Record<string, { Authorization?: string }>,
    ) => Promise<Record<string, { Authorization?: string }>>;

    await responseInterceptor({
      config: { url: "/v1/devices" },
      response: { status: StatusCodes.UNAUTHORIZED },
    });
    const request = await requestInterceptor({ headers: {} });

    expect(request.headers.Authorization).toBe("Bearer token");
  });

  it("retries unauthorized responses after authenticating", async () => {
    const instance = {
      defaults: { headers: { common: {} as Record<string, string> } },
      get,
      interceptors: {
        request: { use: useRequest },
        response: { use: useResponse },
      },
      post,
      put,
    } as never;
    const retryCall = vi.fn().mockResolvedValue({ ok: true });
    create.mockReturnValue(Object.assign(retryCall, instance));
    const authData: AuthorizationResponse = {
      accessToken: "token",
      accessTokenExpiresIn: 300,
      tokenType: "Bearer",
    };
    post.mockResolvedValue({ data: authData, status: StatusCodes.OK });

    new DaikinClient("integrator", "api-key", "user@example.com");
    const responseInterceptor = useResponse.mock.calls[0][1] as (
      error: Record<string, unknown>,
    ) => Promise<unknown>;

    const result = await responseInterceptor({
      config: { url: "/v1/devices" },
      response: { status: StatusCodes.UNAUTHORIZED },
    });

    expect(post).toHaveBeenCalledWith("/v1/token", {
      email: "user@example.com",
      integratorToken: "integrator",
    });
    expect(instance.defaults.headers.common.Authorization).toBe("Bearer token");
    expect(retryCall).toHaveBeenCalledWith({ url: "/v1/devices" });
    expect(result).toEqual({ ok: true });
  });

  it("rethrows non-unauthorized responses from the response interceptor", async () => {
    new DaikinClient("integrator", "api-key", "user@example.com");
    const responseInterceptor = useResponse.mock.calls[0][1] as (
      error: Record<string, unknown>,
    ) => Promise<unknown>;
    const error = {
      config: { url: "/v1/devices" },
      response: { status: StatusCodes.BAD_REQUEST },
    };

    await expect(responseInterceptor(error)).rejects.toBe(error);
  });

  it("returns devices on success", async () => {
    const client = new DaikinClient("integrator", "api-key", "user@example.com");
    const devices: Devices[] = [
      {
        devices: [
          {
            firmwareVersion: "1",
            id: "device-1",
            model: "model",
            name: "Living Room",
          },
        ],
        locationName: "Home",
      },
    ];
    get.mockResolvedValue({ data: devices, status: StatusCodes.OK });

    await expect(client.getDevices()).resolves.toEqual(devices);
  });

  it("throws when getDevices receives a non-200 response", async () => {
    const client = new DaikinClient("integrator", "api-key", "user@example.com");
    get.mockResolvedValue({ status: StatusCodes.CREATED });

    await expect(client.getDevices()).rejects.toEqual(
      new DaikinError("Failed to get devices"),
    );
  });

  it("returns a specific device on success", async () => {
    const client = new DaikinClient("integrator", "api-key", "user@example.com");
    const deviceResponse: DeviceResponse = {
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
    get.mockResolvedValue({ data: deviceResponse, status: StatusCodes.OK });

    await expect(client.getDevice("device-1")).resolves.toEqual({
      id: "device-1",
      ...deviceResponse,
    });
  });

  it("throws when getDevice receives a non-200 response", async () => {
    const client = new DaikinClient("integrator", "api-key", "user@example.com");
    get.mockResolvedValue({ status: StatusCodes.ACCEPTED });

    await expect(client.getDevice("device-1")).rejects.toEqual(
      new DaikinError("Failed to get device"),
    );
  });

  it("updates mode on success", async () => {
    const client = new DaikinClient("integrator", "api-key", "user@example.com");
    put.mockResolvedValue({
      data: { message: "updated" },
      status: StatusCodes.OK,
    });

    await expect(
      client.updateMode("device-1", {
        coolSetpoint: 25,
        heatSetpoint: 20,
        mode: Mode.COOL,
      }),
    ).resolves.toEqual({ message: "updated" });
  });

  it("throws when updateMode receives a non-200 response", async () => {
    const client = new DaikinClient("integrator", "api-key", "user@example.com");
    put.mockResolvedValue({ status: StatusCodes.CREATED });

    await expect(
      client.updateMode("device-1", {
        coolSetpoint: 25,
        heatSetpoint: 20,
        mode: Mode.COOL,
      }),
    ).rejects.toEqual(new DaikinError("Failed to update mode"));
  });
});

class FakeMqttClient extends EventEmitter {
  public readonly subscribe = vi.fn(
    (_topic: string, callback?: (error?: Error | null) => void) => {
      callback?.(this.subscribeError);
    },
  );
  public subscribeError: Error | null = null;
}

describe("SensorClient", () => {
  const zigbeeOptions: SensorClientOptions = {
    brokerUrl: "mqtt://broker:1883",
    clientId: "thermo-api-test",
    password: "secret",
    source: "zigbee",
    staleMs: 180000,
    topic: "zigbee2mqtt/0x7c3e82d71df90000",
    username: "homeassistant",
  };
  const picoOptions: SensorClientOptions = {
    ...zigbeeOptions,
    source: "pico",
    topic: "home/pico-dht22-1/state",
  };

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-15T12:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("builds Zigbee defaults from environment", () => {
    expect(
      buildSensorClientOptions({
        MQTT_CLIENT_ID: "thermo-api-test",
        MQTT_PASSWORD: "secret",
        MQTT_USERNAME: "homeassistant",
      }),
    ).toEqual({
      brokerUrl: "mqtt://mosquitto:1883",
      clientId: "thermo-api-test",
      password: "secret",
      source: "zigbee",
      staleMs: 180000,
      topic: "zigbee2mqtt/0x7c3e82d71df90000",
      username: "homeassistant",
    });
  });

  it("builds Pico overrides from environment", () => {
    expect(
      buildSensorClientOptions({
        MQTT_CLIENT_ID: "thermo-api-test",
        MQTT_HOST: "openproject.local",
        MQTT_PASSWORD: "secret",
        MQTT_PORT: "1884",
        MQTT_SENSOR_SOURCE: "pico",
        MQTT_USERNAME: "homeassistant",
      }),
    ).toEqual({
      brokerUrl: "mqtt://openproject.local:1884",
      clientId: "thermo-api-test",
      password: "secret",
      source: "pico",
      staleMs: 180000,
      topic: "home/pico-dht22-1/state",
      username: "homeassistant",
    });
  });

  it("connects with the configured MQTT options and subscribes once", async () => {
    const mqttClient = new FakeMqttClient();
    const mqttConnect = vi.fn().mockReturnValue(mqttClient);
    const client = new SensorClient(zigbeeOptions, mqttConnect);

    await client.initialize();
    await client.initialize();

    expect(mqttConnect).toHaveBeenCalledWith(zigbeeOptions.brokerUrl, {
      clientId: zigbeeOptions.clientId,
      password: zigbeeOptions.password,
      reconnectPeriod: 5000,
      username: zigbeeOptions.username,
    });
    expect(mqttClient.subscribe).toHaveBeenCalledOnce();
    expect(mqttClient.subscribe).toHaveBeenCalledWith(
      zigbeeOptions.topic,
      expect.any(Function),
    );
  });

  it("returns the latest valid Zigbee MQTT measurement", async () => {
    const mqttClient = new FakeMqttClient();
    const client = new SensorClient(
      zigbeeOptions,
      vi.fn().mockReturnValue(mqttClient),
    );

    mqttClient.emit(
      "message",
      zigbeeOptions.topic,
      Buffer.from(
        JSON.stringify({
          battery: 95,
          humidity: 40,
          linkquality: 120,
          temperature: 22,
        }),
      ),
    );

    await expect(client.getMeasurement()).resolves.toEqual({
      humidity: 40,
      temperature: 22,
    });
  });

  it("throws when no MQTT measurement has been received yet", async () => {
    const mqttClient = new FakeMqttClient();
    const client = new SensorClient(
      zigbeeOptions,
      vi.fn().mockReturnValue(mqttClient),
    );

    await expect(client.getMeasurement()).rejects.toEqual(
      new SensorError("Could not get measurement"),
    );
  });

  it("returns the latest valid Pico MQTT measurement", async () => {
    const mqttClient = new FakeMqttClient();
    const client = new SensorClient(picoOptions, vi.fn().mockReturnValue(mqttClient));

    mqttClient.emit(
      "message",
      picoOptions.topic,
      Buffer.from(
        JSON.stringify({ humidity: 45, temperature: 21, timestamp: 123 }),
      ),
    );

    await expect(client.getMeasurement()).resolves.toEqual({
      humidity: 45,
      temperature: 21,
    });
  });

  it("ignores malformed MQTT payloads and unrelated topics", async () => {
    const mqttClient = new FakeMqttClient();
    const client = new SensorClient(
      zigbeeOptions,
      vi.fn().mockReturnValue(mqttClient),
    );

    mqttClient.emit(
      "message",
      "home/other-topic",
      Buffer.from(JSON.stringify({ humidity: 10, temperature: 10 })),
    );
    mqttClient.emit("message", zigbeeOptions.topic, Buffer.from("{bad json"));
    mqttClient.emit(
      "message",
      zigbeeOptions.topic,
      Buffer.from(JSON.stringify({ humidity: "bad", temperature: 22 })),
    );

    await expect(client.getMeasurement()).rejects.toEqual(
      new SensorError("Could not get measurement"),
    );
  });

  it("treats cached MQTT data as stale after the configured timeout", async () => {
    const mqttClient = new FakeMqttClient();
    const client = new SensorClient(
      zigbeeOptions,
      vi.fn().mockReturnValue(mqttClient),
    );

    mqttClient.emit(
      "message",
      zigbeeOptions.topic,
      Buffer.from(JSON.stringify({ humidity: 40, temperature: 22 })),
    );
    vi.advanceTimersByTime(zigbeeOptions.staleMs + 1);

    await expect(client.getMeasurement()).rejects.toEqual(
      new SensorError("Could not get measurement"),
    );
  });

  it("resubscribes after an initial subscribe failure and reconnect event", async () => {
    const mqttClient = new FakeMqttClient();
    mqttClient.subscribeError = new Error("subscribe failed");
    const client = new SensorClient(
      zigbeeOptions,
      vi.fn().mockReturnValue(mqttClient),
    );

    await client.initialize();
    mqttClient.subscribeError = null;
    mqttClient.emit("connect");

    expect(mqttClient.subscribe).toHaveBeenCalledTimes(2);
  });
});
