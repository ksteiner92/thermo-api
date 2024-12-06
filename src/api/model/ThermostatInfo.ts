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
  readonly coolSetpoint: number;
  readonly heatSetpoint: number;
  readonly status: ThermostatStatus;
  readonly lowestTemperature: number;
  readonly highestTemperature: number;
}

export interface UpdateSetpoints {
  /**
   * @isDouble
   */
  readonly coolSetpoint: number;
  /**
   * @isDouble
   */
  readonly heatSetpoint: number;
}
