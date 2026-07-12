export type OperationalEnvironment = "development" | "test" | "production";

type BaseOperationalEvent = {
  eventVersion: 1;
  occurredAt: string;
  environment: OperationalEnvironment;
  requestId?: string;
  correlationId?: string;
  resourceId?: string;
  durationMs?: number;
  retryCount?: number;
};

export type OperationalEvent =
  | (BaseOperationalEvent & {
      eventName: "mission_creation_attempted";
      result: "STARTED";
      reasonCode: "MISSION_CREATE";
    })
  | (BaseOperationalEvent & {
      eventName: "mission_creation_succeeded";
      result: "SUCCESS";
      reasonCode: "MISSION_CREATED";
    })
  | (BaseOperationalEvent & {
      eventName: "daily_cap_reached";
      result: "REJECTED";
      reasonCode: "DAILY_CAP_REACHED";
    })
  | (BaseOperationalEvent & {
      eventName: "serialization_retry";
      result: "RETRYING";
      reasonCode: "PRISMA_P2034";
    })
  | (BaseOperationalEvent & {
      eventName: "rule_evaluation_failed";
      result: "FAIL_CLOSED";
      reasonCode: "RULE_INVALID" | "RULE_TARGET_MISSING";
    })
  | (BaseOperationalEvent & {
      eventName: "question_version_approved";
      result: "SUCCESS";
      reasonCode: "QUESTION_VERSION_APPROVED";
    })
  | (BaseOperationalEvent & {
      eventName: "question_version_retired";
      result: "SUCCESS";
      reasonCode: "QUESTION_VERSION_RETIRED";
    })
  | (BaseOperationalEvent & {
      eventName: "mission_completed";
      result: "SUCCESS";
      reasonCode: "MISSION_COMPLETED";
    });

export type EmitOperationalEventInput = Omit<
  OperationalEvent,
  "eventVersion" | "occurredAt" | "environment"
>;

export interface OperationalEventSink {
  emit(event: OperationalEvent): void | Promise<void>;
}

export interface OperationalEventExporter {
  export(event: OperationalEvent): void | Promise<void>;
}

export class OperationalEventExporterSink implements OperationalEventSink {
  constructor(private readonly exporter: OperationalEventExporter) {}

  emit(event: OperationalEvent) {
    return this.exporter.export(event);
  }
}

export class InMemoryOperationalEventSink implements OperationalEventSink {
  readonly events: OperationalEvent[] = [];

  async emit(event: OperationalEvent) {
    this.events.push(event);
  }
}

export class NoopOperationalEventSink implements OperationalEventSink {
  async emit() {}
}

export class JsonConsoleOperationalEventSink implements OperationalEventSink {
  constructor(
    private readonly writer: Pick<Console, "info"> = console,
    private readonly prefix = "operational_event",
  ) {}

  async emit(event: OperationalEvent) {
    this.writer.info(
      JSON.stringify({
        message: this.prefix,
        event,
      }),
    );
  }
}

export function createOperationalEvent(
  input: EmitOperationalEventInput,
  options: {
    environment: OperationalEnvironment;
    now?: Date;
  },
): OperationalEvent {
  return {
    ...input,
    eventVersion: 1,
    occurredAt: (options.now ?? new Date()).toISOString(),
    environment: options.environment,
  } as OperationalEvent;
}
