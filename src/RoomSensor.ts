import { inject } from "tsyringe";
import { SensorClient } from "./client/sensor/SensorClient";
import { Measurement } from "./client/sensor/SensorTypes";
import { Sensor } from "./Sensor";

export class RoomSensor extends Sensor {
  public constructor(
    @inject("SensorClient") private readonly sensorClient: SensorClient,
  ) {
    super(
      "ThermostatSensor",
      parseInt(process.env.SENSOR_POLL_INTERVAL_MS ?? ""),
      parseInt(process.env.ERROR_AFTER_NUM_SENSOR_POLL_FAILURES ?? ""),
    );
  }

  public async poll(): Promise<Measurement> {
    return this.sensorClient.getMeasurement();
  }
}
