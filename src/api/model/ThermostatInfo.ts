export enum ThermostatStatus {
  OFF = "OFF",
  COOL = "COOL",
  HEAT = "HEAT",
  IDLE = "IDLE",
  ERROR = "ERROR",
  STOPPED = "STOPPED",
}

export interface ThermostatInfo {
  readonly sensorTemperature: number;
  readonly sensorHumidity: number;
  readonly coolSetpoint: number;
  readonly heatSetpoint: number;
  readonly status: ThermostatStatus;
  readonly thermostatHeatSetpoint: number;
  readonly thermostatCoolSetpoint: number;
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
