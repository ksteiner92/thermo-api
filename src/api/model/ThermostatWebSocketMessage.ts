import type { ThermostatInfo } from "./ThermostatInfo";

export interface ThermostatSnapshotMessage {
  readonly type: "thermostat_snapshot";
  readonly payload: ThermostatInfo;
}
