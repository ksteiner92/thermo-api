import { Controller, Get, Route } from "@tsoa/runtime";
import { inject, injectable } from "tsyringe";
import { SensorClient } from "../../client/sensor/SensorClient";
import { Measurement } from "../../client/sensor/SensorTypes";

@injectable()
@Route("/v1/sensor")
export class SensorController extends Controller {
  public constructor(
    @inject("SensorClient") private readonly sensorClient: SensorClient,
  ) {
    super();
  }

  @Get("/")
  public async getMeasurement(): Promise<Measurement> {
    return this.sensorClient.getMeasurement();
  }
}
