export interface Devices {
  readonly locationName: string;
  readonly devices: {
    readonly id: string;
    readonly name: string;
    readonly model: string;
    readonly firmwareVersion: string;
  }[];
}

export enum EquipmentStatus {
  COOL = 1,
  OVER_COOL = 2,
  HEAT = 3,
  FAN = 4,
  IDLE = 5,
}

export enum Mode {
  OFF = 0,
  HEAT = 1,
  COOL = 2,
  AUTO = 3,
  EMERGENCY_HEAT = 4,
}

export enum ModeLimit {
  NONE = 0,
  ALL = 1,
  HEAT_ONLY = 2,
  COOL_ONLY = 3,
}

export enum FanStatus {
  AUTO = 0,
  ON = 1,
}

export enum FanCirculation {
  OFF = 0,
  ALWAYS_ON = 1,
  ON_SCHEDULE = 2,
}

export enum FanSpeed {
  LOW = 0,
  MEDIUM = 1,
  HIGH = 2,
}

export enum ModeEmAvailability {
  NOT_AVAILABLE = 0,
  AVAILABLE = 1,
}

export interface DeviceResponse {
  readonly equipmentStatus: EquipmentStatus;
  readonly mode: Mode;
  readonly modeLimit: ModeLimit;
  readonly modeEmHeatAvailable: ModeEmAvailability;
  readonly fan: FanStatus;
  readonly fanCirculate: FanCirculation;
  readonly fanCirculateSpeed: FanSpeed;
  readonly heatSetpoint: number;
  readonly coolSetpoint: number;
  readonly setpointDelta: number;
  readonly setpointMinimum: number;
  readonly setpointMaximum: number;
  readonly tempIndoor: number;
  readonly humIndoor: number;
  readonly tempOutdoor: number;
  readonly humOutdoor: number;
  readonly scheduleEnabled: boolean;
  readonly geofencingEnabled: boolean;
}

export interface Device extends DeviceResponse {
  readonly id: string;
}

export interface AuthorizationResponse {
  readonly accessTokenExpiresIn: number;
  readonly accessToken: string;
  readonly tokenType: string;
}

export interface UpdateModeRequest {
  readonly mode: Mode;
  readonly heatSetpoint: number;
  readonly coolSetpoint: number;
}

export interface UpdateResponse {
  readonly message: string;
}
