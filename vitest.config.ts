import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    coverage: {
      provider: "v8",
      all: true,
      include: ["src/**/*.ts"],
      exclude: [
        "src/api/routes.ts",
        "src/api/model/ThermostatWebSocketMessage.ts",
        "src/client/sensor/SensorTypes.ts",
      ],
      thresholds: {
        statements: 100,
        branches: 100,
        functions: 100,
        lines: 100,
      },
    },
    environment: "node",
    setupFiles: ["./test/setup.ts"],
  },
});
