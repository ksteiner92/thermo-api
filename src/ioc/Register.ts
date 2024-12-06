import axios from "axios";
import { container } from "tsyringe";
import { DaikinClient } from "../client/daikin/DaikinClient";
import { ThermostatManager } from "../ThermostatManager";
import { SensorClient } from "../client/sensor/SensorClient";

export function registerTypes(): void {
  container.registerSingleton("DaikinClient", DaikinClient);
  container.registerSingleton("ThermostatManager", ThermostatManager);
  container.register("SensorClient", { useClass: SensorClient });
  container.registerInstance(
    "integratorToken",
    process.env.DAIKIN_INTEGRATOR_TOKEN ?? "",
  );
  container.registerInstance("apiKey", process.env.DAIKIN_API_KEY ?? "");
  container.registerInstance("email", process.env.DAIKIN_EMAIL ?? "");
  container.registerInstance(
    "sensorAxios",
    axios.create({
      baseURL: SensorClient.BASE_URL,
      timeout: 20000,
    }),
  );
}
