export interface ThermostatInfo {
  readonly targetTemperature: number;
  readonly lowestTemperature: number;
  readonly highestTemperature: number;
  readonly delta: number;
}

export interface UpdateTemperature {
  readonly temperature: number;
}
