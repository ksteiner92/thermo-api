import { Logger } from "pino";
import { Measurement } from "./client/sensor/SensorTypes";
import { logger } from "./Logging";
import { SensorState } from "./SensorState";

export enum PollingSensorState {
  RUNNING = "RUNNING",
  STOPPED = "STOPPED",
  ERROR = "ERROR",
}

export abstract class Sensor {
  protected readonly logger_: Logger<never, boolean>;
  protected lastMeasurement_: Measurement | undefined;
  private state_: SensorState | undefined;
  private lastPolled_: number = 0;
  private sensorPollFailureCount_: number = 0;
  private pollingSensorTaskId_: NodeJS.Timeout | undefined;
  private running_: boolean = false;

  constructor(
    private readonly name_: string,
    private readonly pollIntervalMs_: number,
    private readonly errorAfterNumSensorPollFailures_: number = -1,
  ) {
    this.logger_ = logger.child({
      name: name_,
    });
  }

  public get measurement(): Measurement | undefined {
    return this.lastMeasurement_;
  }

  public get name(): string {
    return this.name_;
  }

  public get state(): PollingSensorState {
    if (this.running_) {
      return PollingSensorState.RUNNING;
    } else if (
      this.errorAfterNumSensorPollFailures_ > 0 &&
      this.sensorPollFailureCount_ >= this.errorAfterNumSensorPollFailures_
    ) {
      return PollingSensorState.ERROR;
    } else {
      return PollingSensorState.STOPPED;
    }
  }

  public async start(): Promise<void> {
    try {
      this.logger_.info("Starting polling sensor");
      if (!this.lastMeasurement_) {
        this.lastMeasurement_ = await this.poll();
      }
      this.sensorPollFailureCount_ = 0;
      this.running_ = true;
      this.schedulePoll();
    } catch (error) {
      this.logger_.error({ error }, "Initialization error");
      throw error;
    }
  }

  public stop(): void {
    this.running_ = false;
  }

  public get lastPolled(): number {
    return this.lastPolled_;
  }

  public abstract poll(): Promise<Measurement>;

  private async runPolling(): Promise<void> {
    const logger = this.logger_.child({
      fn: "runPolling",
      measurement: this.lastMeasurement_,
      state: this.state_,
    });
    try {
      this.lastMeasurement_ = await this.poll();
      this.lastPolled_ = Date.now();
      logger.info(
        {
          measurement: this.lastMeasurement_,
          state: this.state_,
        },
        "Received measurement",
      );
      if (
        this.sensorPollFailureCount_ >= this.errorAfterNumSensorPollFailures_
      ) {
        this.sensorPollFailureCount_ = 0;
        if (this.errorAfterNumSensorPollFailures_ > 0) {
          await this.start();
        }
      }
    } catch (error) {
      logger.info(
        {
          measurement: this.lastMeasurement_,
          state: this.state_,
          error,
        },
        "Error while polling sensor",
      );
      this.sensorPollFailureCount_ += 1;
    } finally {
      if (
        this.errorAfterNumSensorPollFailures_ > 0 &&
        this.sensorPollFailureCount_ >= this.errorAfterNumSensorPollFailures_
      ) {
        this.stop();
      }
    }
  }

  private schedulePoll(): void {
    if (!this.pollingSensorTaskId_) {
      const logger = this.logger_.child({
        fn: "schedulePollSensor",
      });
      logger.info("Scheduling polling sensor task");
      this.pollingSensorTaskId_ = setInterval(async (): Promise<void> => {
        try {
          if (this.running_) {
            await this.runPolling();
          }
        } catch (error) {
          logger.error({ error }, "Exception during polling sensor");
        } finally {
          if (!this.running_) {
            clearInterval(this.pollingSensorTaskId_);
            this.pollingSensorTaskId_ = undefined;
          }
        }
      }, this.pollIntervalMs_);
    }
  }
}
