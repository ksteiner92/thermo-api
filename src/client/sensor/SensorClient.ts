import { inject, injectable } from "tsyringe";
import { connect, type IClientOptions, type MqttClient } from "mqtt";
import { logger } from "../../Logging";
import { SensorError } from "./SensorError";
import type { Measurement } from "./SensorTypes";
import {
  picoMqttSensorPayloadSchema,
  type SensorSource,
  zigbeeMqttSensorPayloadSchema,
} from "./SensorPayload";

type MqttConnect = (brokerUrl: string, options: IClientOptions) => MqttClient;

export interface SensorClientOptions {
  readonly brokerUrl: string;
  readonly clientId: string;
  readonly password: string;
  readonly source: SensorSource;
  readonly staleMs: number;
  readonly topic: string;
  readonly username: string;
}

const DEFAULT_ZIGBEE_TOPIC = "zigbee2mqtt/0x7c3e82d71df90000";
const DEFAULT_PICO_TOPIC = "home/pico-dht22-1/state";

export function buildSensorClientOptions(
  env: NodeJS.ProcessEnv = process.env,
): SensorClientOptions {
  const source: SensorSource = env.MQTT_SENSOR_SOURCE === "pico"
    ? "pico"
    : "zigbee";
  return {
    brokerUrl: `mqtt://${env.MQTT_HOST ?? "mosquitto"}:${env.MQTT_PORT ?? "1883"}`,
    clientId: env.MQTT_CLIENT_ID ?? "thermo-api",
    password: env.MQTT_PASSWORD ?? "",
    source,
    staleMs: parseInt(env.MQTT_SENSOR_STALE_MS ?? "180000", 10),
    topic:
      env.MQTT_SENSOR_TOPIC ??
      (source === "zigbee" ? DEFAULT_ZIGBEE_TOPIC : DEFAULT_PICO_TOPIC),
    username: env.MQTT_USERNAME ?? "homeassistant",
  };
}

@injectable()
export class SensorClient {
  public static readonly DEFAULTS: SensorClientOptions = buildSensorClientOptions();
  private static readonly LOGGER = logger.child({
    clazz: SensorClient.name,
  });

  private readonly mqttClient: MqttClient;
  private latestMeasurement: Measurement | undefined;
  private lastMessageAt: number = 0;
  private initialized = false;
  private subscriptionRequested = false;

  public constructor(
    @inject("mqttSensorOptions")
    private readonly options: SensorClientOptions = SensorClient.DEFAULTS,
    @inject("mqttConnect")
    mqttConnect: MqttConnect = connect,
  ) {
    this.mqttClient = mqttConnect(this.options.brokerUrl, {
      clientId: this.options.clientId,
      password: this.options.password,
      reconnectPeriod: 5000,
      username: this.options.username,
    });
    this.registerHandlers();
  }

  public async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }
    this.initialized = true;
    this.subscribeToTopic();
  }

  public async getMeasurement(): Promise<Measurement> {
    if (!this.latestMeasurement || this.isStale()) {
      throw new SensorError("Could not get measurement");
    }
    return this.latestMeasurement;
  }

  private registerHandlers(): void {
    this.mqttClient.on("connect", () => {
      SensorClient.LOGGER.info(
        { brokerUrl: this.options.brokerUrl, topic: this.options.topic },
        "Connected to MQTT broker",
      );
      this.subscribeToTopic();
    });
    this.mqttClient.on("message", (topic: string, payload: Buffer) => {
      this.handleMessage(topic, payload);
    });
    this.mqttClient.on("reconnect", () => {
      SensorClient.LOGGER.warn("Reconnecting to MQTT broker");
    });
    this.mqttClient.on("error", (error: Error) => {
      SensorClient.LOGGER.error({ error }, "MQTT client error");
    });
  }

  private subscribeToTopic(): void {
    if (this.subscriptionRequested) {
      return;
    }
    this.subscriptionRequested = true;
    this.mqttClient.subscribe(this.options.topic, (error?: Error | null) => {
      if (error) {
        this.subscriptionRequested = false;
        SensorClient.LOGGER.error(
          { error, topic: this.options.topic },
          "Failed to subscribe to MQTT topic",
        );
        return;
      }
      SensorClient.LOGGER.info(
        { topic: this.options.topic },
        "Subscribed to MQTT topic",
      );
    });
  }

  private handleMessage(topic: string, payload: Buffer): void {
    if (topic !== this.options.topic) {
      return;
    }
    const messageLogger = SensorClient.LOGGER.child({ fn: "handleMessage" });
    try {
      const parsed = this.parsePayload(JSON.parse(payload.toString("utf8")));
      this.latestMeasurement = {
        humidity: parsed.humidity,
        temperature: parsed.temperature,
      };
      this.lastMessageAt = Date.now();
      messageLogger.info(
        { measurement: this.latestMeasurement, topic },
        "Received MQTT sensor measurement",
      );
    } catch (error) {
      messageLogger.warn({ error, topic }, "Ignoring invalid MQTT payload");
    }
  }

  private isStale(): boolean {
    return this.lastMessageAt <= Date.now() - this.options.staleMs;
  }

  private parsePayload(payload: unknown): Measurement {
    switch (this.options.source) {
      case "pico": {
        const parsed = picoMqttSensorPayloadSchema.parse(payload);
        return {
          humidity: parsed.humidity,
          temperature: parsed.temperature,
        };
      }
      case "zigbee": {
        const parsed = zigbeeMqttSensorPayloadSchema.parse(payload);
        return {
          humidity: parsed.humidity,
          temperature: parsed.temperature,
        };
      }
    }
  }
}
