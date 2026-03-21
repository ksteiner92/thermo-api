import { z } from "zod";

export type SensorSource = "pico" | "zigbee";

export const picoMqttSensorPayloadSchema = z.object({
  humidity: z.number(),
  temperature: z.number(),
  timestamp: z.number().int(),
});

export const zigbeeMqttSensorPayloadSchema = z
  .object({
    humidity: z.number(),
    temperature: z.number(),
  })
  .passthrough();
