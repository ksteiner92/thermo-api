import path from "path";
import fs from "fs";
import { singleton, inject } from "tsyringe";
import WebSocket, { WebSocketServer } from "ws";
import { z } from "zod";
import { DaikinClient } from "./client/daikin/DaikinClient";
import {
  Device,
  Devices,
  EquipmentStatus,
  Mode,
  UpdateModeRequest,
} from "./client/daikin/DaikinTypes";
import { container } from "tsyringe";
import { logger } from "./Logging";
import {
  ThermostatInfo,
  ThermostatStatus,
  UpdateSetpoints,
} from "./api/model/ThermostatInfo";
import { SensorClient } from "./client/sensor/SensorClient";
import { Measurement } from "./client/sensor/SensorTypes";

export enum ThermostatManagerErrorType {
  INIT_ERROR,
  THERMOSTAT_UPDATE_ERROR,
  THERMOSTAT_INFO_ERROR,
  DATA_ERROR,
  VALIDATION_ERROR,
}

export class ThermostatManagerError extends Error {
  public readonly type: ThermostatManagerErrorType;
  public readonly message: string;

  public constructor(type: ThermostatManagerErrorType, message: string) {
    super();
    this.type = type;
    this.message = message;
  }
}

const thermostatStateSchema = z.object({
  coolSetpoint: z.number().default(parseFloat(process.env.COOL_SETPOINT ?? "")),
  heatSetpoint: z.number().default(parseFloat(process.env.HEAT_SETPOINT ?? "")),
});
type ThermostatState = z.infer<typeof thermostatStateSchema>;

@singleton()
export class ThermostatManager {
  private static readonly LOGGER = logger.child({
    clazz: ThermostatManager.name,
  });
  private static readonly STATE_FILE: string = "thermostat-state.json";
  private readonly maxThermostatUpdateFrequencyMs: number = parseInt(
    process.env.MAX_THERMOSTAT_UPDATE_FREQUENCY_MS ?? "",
  );
  private readonly maxDeviceStalenessMs: number = parseInt(
    process.env.MAX_DEVICE_STALENESS_MS ?? "",
  );
  private readonly thermostatAdjustmentIncrement: number = parseFloat(
    process.env.THERMOSTAT_ADJUSTMENT_INCREMENT ?? "",
  );
  private readonly errorAfterNumSensorPollFailures: number = parseInt(
    process.env.ERROR_AFTER_NUM_SENSOR_POLL_FAILURES ?? "",
  );
  private readonly wss: WebSocketServer;
  private readonly stateFilePath: string;
  private deviceId: string | undefined;
  private device: Device | undefined;
  private lastDeviceUpdateTimestamp: number = 0;
  private lastSensorPollTimestamp: number = 0;
  private lastThermostatUpdateTimestamp: number = 0;
  private lastMeasurement: Measurement | undefined;
  private initialDevice: Device | undefined;
  private running: boolean = true;
  private state: ThermostatState;
  private sensorPollFailureCount: number = 0;
  private updateThermostatTaskId: NodeJS.Timeout | undefined;
  private temperatureControllerTaskId: NodeJS.Timeout | undefined;
  private webSocketUpdateTaskId: NodeJS.Timeout | undefined;
  private pollSensorTaskId: NodeJS.Timeout | undefined;

  public constructor(
    @inject("DaikinClient") private readonly daikinClient: DaikinClient,
    @inject("SensorClient") private readonly sensorClient: SensorClient,
  ) {
    const dataDir: string | undefined = process.env.DATA_DIR;
    if (!dataDir) {
      throw new ThermostatManagerError(
        ThermostatManagerErrorType.DATA_ERROR,
        "Unable to determine data directory",
      );
    }
    if (!fs.existsSync(dataDir)) {
      try {
        if (!fs.mkdirSync(dataDir, { recursive: true })) {
          throw new ThermostatManagerError(
            ThermostatManagerErrorType.INIT_ERROR,
            "Unable to create data directory",
          );
        }
      } catch (error) {
        ThermostatManager.LOGGER.error(
          { error },
          "Unable to create data directory",
        );
        throw new ThermostatManagerError(
          ThermostatManagerErrorType.INIT_ERROR,
          "Unable to create data directory",
        );
      }
    }
    this.stateFilePath = path.join(dataDir, ThermostatManager.STATE_FILE);
    if (fs.existsSync(this.stateFilePath)) {
      const stateData: unknown = JSON.parse(
        fs.readFileSync(this.stateFilePath, { encoding: "utf8", flag: "r" }),
      );
      ThermostatManager.LOGGER.info({ stateData }, "Parsing state data");
      this.state = thermostatStateSchema.parse(stateData);
    } else {
      this.state = thermostatStateSchema.parse({});
    }
    this.wss = new WebSocketServer({
      port: parseInt(process.env.WS_PORT ?? ""),
    });
    this.wss.on("connection", (ws: WebSocket): void => {
      ThermostatManager.LOGGER.info({ ws }, "New client connected");
      ws.on("close", () => {
        ThermostatManager.LOGGER.info({ ws }, "Client disconnected");
      });
    });
  }

  public static getInstance(): ThermostatManager {
    return container.resolve("ThermostatManager");
  }

  public async start(): Promise<void> {
    const logger = ThermostatManager.LOGGER.child({ fn: "start" });
    try {
      const devices: Devices[] = await this.daikinClient.getDevices();
      logger.info("Starting ThermostatManager");
      this.deviceId = devices?.at(0)?.devices[0].id;
      if (!this.deviceId) {
        throw new ThermostatManagerError(
          ThermostatManagerErrorType.INIT_ERROR,
          "Could not find device",
        );
      }
      if (!this.lastMeasurement) {
        await this.pollSensor();
      }
      if (!this.device) {
        await this.updateThermostat();
      }
      await this.controlTemperature();
      this.initialDevice = this.device;
      this.sensorPollFailureCount = 0;
      this.running = true;
      this.schedulePollSensor();
      this.scheduleUpdateThermostat();
      this.scheduleTemperatureController();
      this.scheduleWebSocketUpdate();
    } catch (error) {
      logger.error({ error }, "Initialization error");
      if (error instanceof ThermostatManagerError) {
        throw error;
      } else {
        throw new ThermostatManagerError(
          ThermostatManagerErrorType.INIT_ERROR,
          "Could not initialize",
        );
      }
    }
  }

  public stop(): void {
    this.running = false;
  }

  public async getThermostatInfo(): Promise<ThermostatInfo> {
    if (!this.device) {
      this.device = await this.daikinClient.getDevice(this.deviceId ?? "");
    }
    if (this.device) {
      return {
        sensorTemperature: this.lastMeasurement!.temperature,
        sensorHumidity: this.lastMeasurement!.humidity,
        status: this.getThermostatStatus(),
        thermostatCoolSetpoint: this.device.coolSetpoint,
        thermostatHeatSetpoint: this.device.heatSetpoint,
        coolSetpoint: this.state.coolSetpoint,
        heatSetpoint: this.state.heatSetpoint,
        highestTemperature: this.device.setpointMaximum,
        lowestTemperature: this.device.setpointMinimum,
        deviceUpdatedLast: new Date(this.lastDeviceUpdateTimestamp),
        thermostatUpdatedLast: new Date(this.lastThermostatUpdateTimestamp),
        sensorPolledLast: new Date(this.lastSensorPollTimestamp),
      };
    } else {
      throw new ThermostatManagerError(
        ThermostatManagerErrorType.THERMOSTAT_INFO_ERROR,
        "Could not get thermostat info",
      );
    }
  }

  public updateSetpoints(setpoints: UpdateSetpoints): void {
    if (!this.device) {
      throw new ThermostatManagerError(
        ThermostatManagerErrorType.VALIDATION_ERROR,
        "Thermostat manager not ready",
      );
    }
    if (
      setpoints.coolSetpoint > this.device.setpointMaximum ||
      setpoints.coolSetpoint < this.device.setpointMinimum
    ) {
      throw new ThermostatManagerError(
        ThermostatManagerErrorType.VALIDATION_ERROR,
        "Cool setpoint out of bounds",
      );
    }
    if (
      setpoints.heatSetpoint < this.device.setpointMinimum ||
      setpoints.heatSetpoint > this.device.setpointMaximum
    ) {
      throw new ThermostatManagerError(
        ThermostatManagerErrorType.VALIDATION_ERROR,
        "Heat setpoint out of bounds",
      );
    }
    if (setpoints.coolSetpoint < setpoints.heatSetpoint) {
      throw new ThermostatManagerError(
        ThermostatManagerErrorType.VALIDATION_ERROR,
        "Cool setpoint cannot be smaller than heat setpoint",
      );
    }
    if (
      Math.abs(setpoints.coolSetpoint - setpoints.heatSetpoint) <
      this.device.setpointDelta
    ) {
      throw new ThermostatManagerError(
        ThermostatManagerErrorType.VALIDATION_ERROR,
        "Difference between cool and heat setpoint too small",
      );
    }
    this.state.coolSetpoint = setpoints.coolSetpoint;
    this.state.heatSetpoint = setpoints.heatSetpoint;
    fs.writeFileSync(this.stateFilePath, JSON.stringify(this.state), {
      encoding: "utf8",
      flag: "w",
    });
  }

  private async updateThermostat(): Promise<void> {
    const logger = ThermostatManager.LOGGER.child({
      fn: "updateThermostat",
      measurement: this.lastMeasurement,
      state: this.state,
      device: this.device,
    });
    try {
      logger.info("Updating thermostat");
      this.device = await this.daikinClient.getDevice(this.deviceId ?? "");
      logger.info({ device: this.device }, "Thermostat updated");
      this.lastDeviceUpdateTimestamp = Date.now();
    } catch (error) {
      logger.error("Error updating thermostat");
      throw error;
    }
  }

  private isDeviceStale(): boolean {
    return this.lastDeviceUpdateTimestamp === 0
      ? false
      : this.lastDeviceUpdateTimestamp <=
          Date.now() - this.maxDeviceStalenessMs;
  }

  private async cool(device: Device, temperature: number): Promise<void> {
    const logger = ThermostatManager.LOGGER.child({
      fn: "cool",
      temperature,
      device: device,
    });
    if (
      device.equipmentStatus !== EquipmentStatus.COOL ||
      this.isDeviceStale()
    ) {
      logger.info("Setting thermostat to cooling");
      let thermostatSetPoint: number =
        device.tempIndoor - this.thermostatAdjustmentIncrement;
      if (thermostatSetPoint < device.setpointMinimum) {
        logger.warn(
          {
            thermostatSetPoint,
            setpointBoundary: device.setpointMinimum,
          },
          "Desired thermostat set point out of range. Using set point boundary",
        );
        thermostatSetPoint = device.setpointMinimum;
      }
      const thermostatUpdate: UpdateModeRequest = {
        mode: Mode.COOL,
        coolSetpoint: thermostatSetPoint,
        // Make sure we fulfill the setpoint delta
        heatSetpoint: thermostatSetPoint - device.setpointDelta,
      };
      if (thermostatUpdate.coolSetpoint !== device.coolSetpoint) {
        await this.updateMode(device.id, thermostatUpdate);
      } else {
        logger.info({ thermostatUpdate }, "Thermostat already updated");
      }
    } else {
      logger.info("Thermostat already in cooling mode");
    }
  }

  private async heat(device: Device, temperature: number): Promise<void> {
    const logger = ThermostatManager.LOGGER.child({
      fn: "heat",
      temperature,
      device: device,
    });
    if (
      device.equipmentStatus !== EquipmentStatus.HEAT ||
      this.isDeviceStale()
    ) {
      logger.info("Setting thermostat to heating");
      let thermostatSetPoint: number =
        device.tempIndoor + this.thermostatAdjustmentIncrement;
      if (thermostatSetPoint > device.setpointMaximum) {
        logger.warn(
          {
            thermostatSetPoint,
            setpointBoundary: device.setpointMaximum,
          },
          "Desired thermostat set point out of range. Using set point boundary",
        );
        thermostatSetPoint = device.setpointMaximum;
      }
      const thermostatUpdate: UpdateModeRequest = {
        mode: Mode.HEAT,
        heatSetpoint: thermostatSetPoint,
        coolSetpoint: thermostatSetPoint + device.setpointDelta,
      };
      if (thermostatUpdate.heatSetpoint !== device.heatSetpoint) {
        await this.updateMode(device.id, thermostatUpdate);
      } else {
        logger.info({ thermostatUpdate }, "Thermostat already updated");
      }
    } else {
      logger.info("Thermostat already in heating mode");
    }
  }

  private async idle(device: Device, temperature: number): Promise<void> {
    const logger = ThermostatManager.LOGGER.child({
      fn: "idle",
      temperature,
      device: device,
    });
    if (
      device.equipmentStatus !== EquipmentStatus.IDLE ||
      this.isDeviceStale()
    ) {
      logger.info("Setting thermostat to idle");
      if (device.equipmentStatus === EquipmentStatus.COOL) {
        logger.info("Device is in cooling mode");
        let thermostatSetPoint: number =
          device.tempIndoor + this.thermostatAdjustmentIncrement;
        if (thermostatSetPoint > device.setpointMaximum) {
          logger.warn(
            {
              thermostatSetPoint,
              setpointBoundary: device.setpointMaximum,
            },
            "Desired thermostat set point out of range. Using set point boundary",
          );
          thermostatSetPoint = device.setpointMaximum;
        }
        const thermostatUpdate: UpdateModeRequest = {
          mode: Mode.COOL,
          coolSetpoint: thermostatSetPoint,
          heatSetpoint: thermostatSetPoint - device.setpointDelta,
        };
        if (thermostatUpdate.coolSetpoint !== device.coolSetpoint) {
          await this.updateMode(device.id, thermostatUpdate);
        } else {
          logger.info({ thermostatUpdate }, "Thermostat already updated");
        }
      } else if (device.equipmentStatus === EquipmentStatus.HEAT) {
        logger.info("Device is in heating mode");
        let thermostatSetPoint: number =
          device.tempIndoor - this.thermostatAdjustmentIncrement;
        if (thermostatSetPoint < device.setpointMinimum) {
          logger.warn(
            {
              thermostatSetPoint,
              setpointBoundary: device.setpointMinimum,
            },
            "Desired thermostat set point out of range. Using set point boundary",
          );
          thermostatSetPoint = device.setpointMinimum;
        }
        const thermostatUpdate: UpdateModeRequest = {
          mode: Mode.HEAT,
          heatSetpoint: thermostatSetPoint,
          coolSetpoint: thermostatSetPoint + device.setpointDelta,
        };
        if (thermostatUpdate.heatSetpoint !== device.heatSetpoint) {
          await this.updateMode(device.id, thermostatUpdate);
        } else {
          logger.info({ thermostatUpdate }, "Thermostat already updated");
        }
      } else {
        logger.warn("Cannot handle device equipment status");
      }
    } else {
      logger.info("Thermostat already in idle mode");
    }
  }

  private getThermostatStatus(): ThermostatStatus {
    if (
      !this.running &&
      this.sensorPollFailureCount >= this.errorAfterNumSensorPollFailures
    ) {
      return ThermostatStatus.ERROR;
    }
    if (!this.running) {
      return ThermostatStatus.STOPPED;
    }
    if (!this.device?.equipmentStatus) {
      return ThermostatStatus.OFF;
    }
    switch (this.device.equipmentStatus) {
      case EquipmentStatus.COOL:
        return ThermostatStatus.COOL;
      case EquipmentStatus.IDLE:
        return ThermostatStatus.IDLE;
      case EquipmentStatus.HEAT:
        return ThermostatStatus.HEAT;
    }
    return ThermostatStatus.OFF;
  }

  private async updateMode(
    deviceId: string,
    thermostatUpdate: UpdateModeRequest,
  ): Promise<void> {
    const logger = ThermostatManager.LOGGER.child({
      fn: "updateMode",
      deviceId,
      thermostatUpdate,
      lastThermostatUpdate: this.lastThermostatUpdateTimestamp,
      maxThermostatUpdateFrequency: this.maxThermostatUpdateFrequencyMs,
      now: Date.now(),
    });
    logger.info("Checkin if can update thermostat mode");
    if (
      this.lastThermostatUpdateTimestamp <=
      Date.now() - this.maxThermostatUpdateFrequencyMs
    ) {
      try {
        logger.info({ thermostatUpdate }, "Updating thermostat mode");
        await this.daikinClient.updateMode(deviceId, thermostatUpdate);
        this.lastThermostatUpdateTimestamp = Date.now();
      } catch (error) {
        logger.error({ error }, "Unable to update thermostat");
      }
    }
  }

  private async pollSensor(): Promise<void> {
    const logger = ThermostatManager.LOGGER.child({
      fn: "updateThermostat",
      measurement: this.lastMeasurement,
      state: this.state,
      device: this.device,
    });
    try {
      this.lastMeasurement = await this.sensorClient.getMeasurement();
      this.lastSensorPollTimestamp = Date.now();
      logger.info(
        {
          measurement: this.lastMeasurement,
          state: this.state,
          device: this.device,
        },
        "Received temperature",
      );
      if (this.sensorPollFailureCount >= this.errorAfterNumSensorPollFailures) {
        await this.start();
      }
    } catch (error) {
      logger.info(
        {
          measurement: this.lastMeasurement,
          state: this.state,
          device: this.device,
          error,
        },
        "Error while polling sensor",
      );
      this.sensorPollFailureCount += 1;
    } finally {
      if (this.sensorPollFailureCount >= this.errorAfterNumSensorPollFailures) {
        this.stop();
      }
    }
  }

  private async controlTemperature(): Promise<void> {
    const logCtx = {
      fn: "controlTemperature",
    };
    try {
      const logger = ThermostatManager.LOGGER.child({
        ...logCtx,
        measurement: this.lastMeasurement,
        state: this.state,
        device: this.device,
      });
      logger.info("Received temperature");
      if (
        !this.device ||
        !this.deviceId ||
        !this.state ||
        !this.lastMeasurement
      ) {
        logger.error("Not fully initialized");
        return;
      }
      if (this.lastMeasurement.temperature > this.state.coolSetpoint) {
        return this.cool(this.device, this.lastMeasurement.temperature);
      } else if (this.lastMeasurement.temperature < this.state.heatSetpoint) {
        return this.heat(this.device, this.lastMeasurement.temperature);
      } else {
        return this.idle(this.device, this.lastMeasurement.temperature);
      }
    } catch (error) {
      logger.error({ error }, "Error while controlling temperature");
    }
  }

  private schedulePollSensor(): void {
    if (!this.pollSensorTaskId) {
      const logger = ThermostatManager.LOGGER.child({
        fn: "schedulePollSensor",
      });
      logger.info("Scheduling task");
      this.pollSensorTaskId = setInterval(
        async (): Promise<void> => {
          try {
            this.pollSensor();
          } catch (error) {
            logger.error({ error }, "Exception during polling sensor");
          }
        },
        parseInt(process.env.SENSOR_POLL_INTERVAL_MS ?? ""),
      );
    }
  }

  private scheduleWebSocketUpdate(): void {
    if (!this.webSocketUpdateTaskId) {
      const logger = ThermostatManager.LOGGER.child({
        fn: "scheduleWebSocketUpdate",
      });
      logger.info("Scheduling task");
      this.webSocketUpdateTaskId = setInterval(
        async (): Promise<void> => {
          try {
            this.wss.clients.forEach((client: WebSocket.WebSocket): void => {
              logger.info({ client }, "Updating client");
              //client.send(data)
            });
          } catch (error) {
            logger.error({ error }, "Exception websocket update");
          }
        },
        parseInt(process.env.WS_UPDATE_INTERVAL_MS ?? ""),
      );
    }
  }

  private scheduleUpdateThermostat(): void {
    if (!this.updateThermostatTaskId) {
      const logger = ThermostatManager.LOGGER.child({
        fn: "scheduleUpdateThermostat",
      });
      logger.info("Scheduling task");
      this.updateThermostatTaskId = setInterval(
        async (): Promise<void> => {
          try {
            await this.updateThermostat();
          } catch (error) {
            logger.error({ error }, "Exception during updating thermostat");
          }
        },
        parseInt(process.env.UPDATE_THERMOSTAT_INTERVAL_MS ?? ""),
      );
    }
  }

  private scheduleTemperatureController(): void {
    if (!this.temperatureControllerTaskId) {
      const logger = ThermostatManager.LOGGER.child({
        fn: "scheduleTemperatureController",
      });
      logger.info("Scheduling task");
      this.temperatureControllerTaskId = setInterval(
        async (): Promise<void> => {
          try {
            if (!this.device || !this.deviceId || !this.state) {
              logger.error("Device is undefined");
              return;
            }
            logger.info(
              {
                measurement: this.lastMeasurement,
                state: this.state,
                device: this.device,
              },
              "Received temperature",
            );
            if (this.running) {
              this.controlTemperature();
            }
          } catch (error) {
            logger.error({ error }, "Exception during temperature contoller");
          } finally {
            if (!this.running) {
              clearInterval(this.temperatureControllerTaskId);
              this.temperatureControllerTaskId = undefined;
            }
          }
        },
        parseInt(process.env.TEMPERATURE_CONTROLLER_INTERVAL_MS ?? ""),
      );
    }
  }
}
