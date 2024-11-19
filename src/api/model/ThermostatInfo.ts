export enum ThermostatStatus {
  OFF = "OFF",
  COOL = "COOL",
  HEAT = "HEAT",
  IDLE = "IDLE",
  STOPPED = "STOPPED",
}

export interface ThermostatInfo {
  readonly sensorTemperature: number;
  readonly sensorHumidity: number;
  readonly targetTemperature: number;
  readonly temperatureUncertainty: number;
  readonly status: ThermostatStatus;
  readonly lowestTemperature: number;
  readonly highestTemperature: number;
}

export interface UpdateTemperature {
  readonly temperature: number;
}
