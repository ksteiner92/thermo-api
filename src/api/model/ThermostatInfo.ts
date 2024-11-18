export interface ThermostatInfo {
  readonly targetTemperature: number;
  readonly temperatureUncertainty: number;
  readonly lowestTemperature: number;
  readonly highestTemperature: number;
}

export interface UpdateTemperature {
  readonly temperature: number;
}
