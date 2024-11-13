import * as axios from "axios";
import { StatusCodes } from "http-status-codes";
import axiosRetry from "axios-retry";
import { inject, injectable } from "tsyringe";
import { Measurement } from "./SensorTypes";
import { SensorError } from "./SensorError";
import { logger } from "../../Logging";

@injectable()
export class SensorClient {
  public static readonly BASE_URL: string = "http://192.168.0.4";
  private static readonly MAX_RETRIES: number = 3;
  private static readonly LOGGER = logger.child({
    clazz: SensorClient.name,
  });

  public constructor(
    @inject("sensorAxios") private readonly axiosInstance: axios.AxiosInstance,
  ) {
    axiosRetry(this.axiosInstance, {
      retries: SensorClient.MAX_RETRIES,
      retryDelay: axiosRetry.exponentialDelay,
    });
  }

  public async getMeasurement(): Promise<Measurement> {
    const logger = SensorClient.LOGGER.child({ fn: "getMeasurement" });
    const sensorResponse = await this.axiosInstance.get<Measurement>("/temp");
    if (sensorResponse.status !== StatusCodes.OK) {
      logger.error("Sensor response was error");
      throw new SensorError("Could not get measurement");
    } else {
      return sensorResponse.data;
    }
  }
}
