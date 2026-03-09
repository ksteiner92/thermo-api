import "reflect-metadata";
import { vi } from "vitest";

process.env.DAIKIN_INTEGRATOR_TOKEN = "integrator-token";
process.env.DAIKIN_API_KEY = "api-key";
process.env.DAIKIN_EMAIL = "user@example.com";
process.env.SERVER_PORT = "3001";
process.env.WS_PORT = "3002";
process.env.WS_UPDATE_INTERVAL_MS = "100";
process.env.UPDATE_THERMOSTAT_INTERVAL_MS = "100";
process.env.TEMPERATURE_CONTROLLER_INTERVAL_MS = "100";
process.env.MAX_THERMOSTAT_UPDATE_FREQUENCY_MS = "100";
process.env.SENSOR_POLL_INTERVAL_MS = "100";
process.env.ERROR_AFTER_NUM_SENSOR_POLL_FAILURES = "2";
process.env.MAX_DEVICE_STALENESS_MS = "1000";
process.env.HEAT_SETPOINT = "19";
process.env.COOL_SETPOINT = "25";
process.env.THERMOSTAT_ADJUSTMENT_INCREMENT = "0.5";
process.env.DATA_DIR = "/tmp/thermo-tests";

vi.mock("ws", () => {
  class MockWebSocket {
    public static readonly OPEN = 1;
    public readyState = MockWebSocket.OPEN;
    public readonly send = vi.fn();
    private readonly handlers = new Map<string, () => void>();

    public on(event: string, handler: () => void): void {
      this.handlers.set(event, handler);
    }

    public close(): void {
      this.handlers.get("close")?.();
    }
  }

  class MockWebSocketServer {
    public static readonly instances: MockWebSocketServer[] = [];
    public clients = new Set();
    private readonly handlers = new Map<string, (ws: MockWebSocket) => void>();

    public constructor() {
      MockWebSocketServer.instances.push(this);
    }

    public on(event: string, handler: (ws: MockWebSocket) => void): void {
      this.handlers.set(event, handler);
    }

    public connect(ws: MockWebSocket = new MockWebSocket()): MockWebSocket {
      this.clients.add(ws);
      this.handlers.get("connection")?.(ws);
      return ws;
    }
  }

  return {
    __mockServers: MockWebSocketServer.instances,
    WebSocketServer: MockWebSocketServer,
    default: MockWebSocket,
  };
});
