import { container } from "tsyringe";
import { connect } from "mqtt";
import { DaikinClient } from "../client/daikin/DaikinClient";
import { ThermostatManager } from "../ThermostatManager";
import {
  buildSensorClientOptions,
  SensorClient,
} from "../client/sensor/SensorClient";

let registered = false;

export function registerTypes(): void {
  if (registered) {
    return;
  }
  container.registerSingleton("DaikinClient", DaikinClient);
  container.registerSingleton("ThermostatManager", ThermostatManager);
  container.registerSingleton("SensorClient", SensorClient);
  container.registerInstance(
    "integratorToken",
    process.env.DAIKIN_INTEGRATOR_TOKEN ?? "",
  );
  container.registerInstance("apiKey", process.env.DAIKIN_API_KEY ?? "");
  container.registerInstance("email", process.env.DAIKIN_EMAIL ?? "");
  const mqttSensorOptions = buildSensorClientOptions();
  container.registerInstance("mqttSensorOptions", mqttSensorOptions);
  container.registerInstance("mqttConnect", connect);
  registered = true;
}
