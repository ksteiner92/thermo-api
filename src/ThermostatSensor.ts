import { inject } from "tsyringe";
import { DaikinClient } from "./client/daikin/DaikinClient";
import { Device } from "./client/daikin/DaikinTypes";
import { Measurement } from "./client/sensor/SensorTypes";
import { Sensor } from "./Sensor";

export class ThermostatSensor extends Sensor {
  private deviceId: string | undefined;
  private device: Device | undefined;

  public constructor(
    @inject("DaikinClient") private readonly daikinClient: DaikinClient,
  ) {
    super(
      "ThermostatSensor",
      parseInt(process.env.MAX_THERMOSTAT_UPDATE_FREQUENCY_MS ?? ""),
    );
  }

  public async poll(): Promise<Measurement> {
    const logger = this.logger_.child({
      fn: "poll",
      device: this.device,
    });
    try {
      logger.info("Updating thermostat");
      this.device = await this.daikinClient.getDevice(this.deviceId ?? "");
      logger.info({ device: this.device }, "Thermostat polled");
      return {
        temperature: this.device.tempIndoor,
        humidity: this.device.humIndoor,
      };
    } catch (error) {
      logger.error("Error polling thermostat");
      throw error;
    }
  }
}
