import { z } from "zod";

export const sensorStateSchema = z.object({
  coolSetpoint: z.number().default(parseFloat(process.env.COOL_SETPOINT ?? "")),
  heatSetpoint: z.number().default(parseFloat(process.env.HEAT_SETPOINT ?? "")),
});
export type SensorState = z.infer<typeof sensorStateSchema>;
