import { Body, Controller, Get, Put, Route } from "@tsoa/runtime";
import { inject, injectable } from "tsyringe";
import { ThermostatManager } from "../../ThermostatManager";
import type { ThermostatInfo, UpdateSetpoints } from "../model/ThermostatInfo";

@injectable()
@Route("/v1/thermostat")
export class ThermostatController extends Controller {
  public constructor(
    @inject("ThermostatManager") private thermostatManager: ThermostatManager,
  ) {
    super();
  }

  @Put("/setpoints")
  public async updateSetpoints(
    @Body() update: UpdateSetpoints,
  ): Promise<ThermostatInfo | void> {
    this.thermostatManager.updateSetpoints(update);
    return this.thermostatManager.getThermostatInfo();
  }

  @Get("/info")
  public async getInfo(): Promise<ThermostatInfo> {
    return this.thermostatManager.getThermostatInfo();
  }

  @Put("/enable")
  public async enable(): Promise<void> {
    return this.thermostatManager.start();
  }

  @Put("/disable")
  public async disable(): Promise<void> {
    return this.thermostatManager.stop();
  }
}
