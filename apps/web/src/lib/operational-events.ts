import { getEnv } from "@honey/config";

type BaseOperationalEvent = {
  eventVersion: 1;
  occurredAt: string;
  environment: "development" | "test" | "production";
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

export interface OperationalEventSink {
  emit(event: OperationalEvent): void | Promise<void>;
}

class ConsoleOperationalEventSink implements OperationalEventSink {
  async emit(event: OperationalEvent) {
    if (getEnv().NODE_ENV === "production" || getEnv().NODE_ENV === "test") {
      return;
    }

    console.info("operational_event", JSON.stringify(event));
  }
}

let operationalEventSink: OperationalEventSink =
  new ConsoleOperationalEventSink();

export function getOperationalEventSink() {
  return operationalEventSink;
}

export function setOperationalEventSink(sink: OperationalEventSink) {
  operationalEventSink = sink;
}

export function resetOperationalEventSink() {
  operationalEventSink = new ConsoleOperationalEventSink();
}

export async function emitOperationalEvent(
  event: Omit<OperationalEvent, "eventVersion" | "occurredAt" | "environment">,
) {
  await operationalEventSink.emit({
    ...event,
    eventVersion: 1,
    occurredAt: new Date().toISOString(),
    environment: getEnv().NODE_ENV,
  } as OperationalEvent);
}

export class InMemoryOperationalEventSink implements OperationalEventSink {
  readonly events: OperationalEvent[] = [];

  async emit(event: OperationalEvent) {
    this.events.push(event);
  }
}
