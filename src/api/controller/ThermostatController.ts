import { Body, Controller, Get, Put, Route } from "@tsoa/runtime";
import { inject, injectable } from "tsyringe";
import { ThermostatManager } from "../../ThermostatManager";
import { SensorClient } from "../../client/sensor/SensorClient";
import type {
  ThermostatInfo,
  UpdateTemperature,
} from "../model/ThermostatInfo";
import { Measurement } from "../../client/sensor/SensorTypes";

@injectable()
@Route("/v1/thermostat")
export class ThermostatController extends Controller {
  public constructor(
    @inject("SensorClient") private readonly sensorClient: SensorClient,
    @inject("ThermostatManager") private thermostatManager: ThermostatManager,
  ) {
    super();
  }

  @Put("/temperature")
  public async updateTemperature(@Body() update: UpdateTemperature) {
    this.thermostatManager.updateTargetTemperature(update.temperature);
  }

  @Get("/info")
  public async getInfo(): Promise<ThermostatInfo> {
    return this.thermostatManager.getThermostatInfo();
  }

  @Get("/")
  public async getMeasurement(): Promise<Measurement> {
    return this.sensorClient.getMeasurement();
  }
}
