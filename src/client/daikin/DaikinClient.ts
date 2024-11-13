import axios, { AxiosInstance } from "axios";
import axiosRetry from "axios-retry";
import { StatusCodes } from "http-status-codes";
import { inject, singleton } from "tsyringe";
import { DaikinError } from "./DaikinError";
import {
  AuthorizationResponse,
  Devices,
  Device,
  UpdateModeRequest,
  UpdateResponse,
  DeviceResponse,
} from "./DaikinTypes";
import { logger } from "../../Logging";

@singleton()
export class DaikinClient {
  private static readonly MAX_RETRIES: number = 3;
  private static readonly BASE_URL: string =
    "https://integrator-api.daikinskyport.com";
  private readonly axiosInstance: AxiosInstance;
  private authData: AuthorizationResponse | undefined = undefined;

  public constructor(
    @inject("integratorToken") private readonly integratorToken: string,
    @inject("apiKey") private readonly apiKey: string,
    @inject("email") private readonly email: string,
  ) {
    this.axiosInstance = axios.create({
      baseURL: DaikinClient.BASE_URL,
      withCredentials: false,
    });
    this.axiosInstance.interceptors.request.use(async (request) => {
      request.headers.Accept = "*/*";
      request.headers["Content-Type"] = "application/json";
      request.headers["x-api-key"] = this.apiKey;
      if (this.authData) {
        request.headers.Authorization = `${this.authData.tokenType} ${this.authData.accessToken}`;
      }
      return request;
    });
    this.axiosInstance.interceptors.response.use(undefined, async (error) => {
      const originalRequest = error.config;
      logger.warn({ error }, "Error response");
      if (error?.response?.status === StatusCodes.UNAUTHORIZED) {
        logger.warn("Unauthorized");
        await this.auth();
        if (this.authData) {
          this.axiosInstance.defaults.headers.common["Authorization"] =
            `${this.authData.tokenType} ${this.authData.accessToken}`;
        }
        return this.axiosInstance(originalRequest);
      } else {
        throw error;
      }
    });
    axiosRetry(this.axiosInstance, {
      retries: DaikinClient.MAX_RETRIES,
      retryDelay: axiosRetry.exponentialDelay,
    });
  }

  private async auth(): Promise<void> {
    logger.info("Authenticating");
    const authRes = await this.axiosInstance.post<AuthorizationResponse>(
      "/v1/token",
      {
        email: this.email,
        integratorToken: this.integratorToken,
      },
    );
    if (authRes.status === StatusCodes.OK) {
      this.authData = authRes.data;
    }
  }

  public async getDevices(): Promise<Devices[]> {
    const res = await this.axiosInstance.get<Devices[]>("/v1/devices");
    if (res.status !== StatusCodes.OK) {
      throw new DaikinError("Failed to get devices");
    } else {
      return res.data;
    }
  }

  public async getDevice(deviceId: string): Promise<Device> {
    const res = await this.axiosInstance.get<DeviceResponse>(
      `/v1/devices/${deviceId}`,
    );
    if (res.status !== StatusCodes.OK) {
      throw new DaikinError("Failed to get device");
    } else {
      return {
        id: deviceId,
        ...res.data,
      };
    }
  }

  public async updateMode(
    deviceId: string,
    updateModeRequest: UpdateModeRequest,
  ): Promise<UpdateResponse> {
    const res = await this.axiosInstance.put<UpdateResponse>(
      `/v1/devices/${deviceId}/msp`,
      updateModeRequest,
    );
    if (res.status !== StatusCodes.OK) {
      throw new DaikinError("Failed to update mode");
    } else {
      return res.data;
    }
  }
}
