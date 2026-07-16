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
    })
  | (BaseOperationalEvent & {
      eventName: "notification_claim_batch";
      result: "SUCCESS";
      reasonCode: "CLAIMED";
    })
  | (BaseOperationalEvent & {
      eventName: "notification_claim_empty";
      result: "SUCCESS";
      reasonCode: "NO_READY_INTENTS";
    })
  | (BaseOperationalEvent & {
      eventName: "notification_lease_recovered";
      result: "SUCCESS";
      reasonCode: "EXPIRED_LEASE_RECLAIMED";
    })
  | (BaseOperationalEvent & {
      eventName: "notification_lease_renewed";
      result: "SUCCESS";
      reasonCode: "LEASE_EXTENDED";
    })
  | (BaseOperationalEvent & {
      eventName: "notification_lease_lost";
      result: "REJECTED";
      reasonCode: "LEASE_LOST";
    })
  | (BaseOperationalEvent & {
      eventName: "notification_delivery_attempted";
      result: "STARTED";
      reasonCode: "DISPATCH_STARTED";
    })
  | (BaseOperationalEvent & {
      eventName: "notification_delivery_result";
      result:
        | "SUCCESS"
        | "SIMULATED"
        | "SUPPRESSED"
        | "RETRYING"
        | "FAILED"
        | "AMBIGUOUS";
      reasonCode:
        | "DELIVERED"
        | "SIMULATED"
        | "SUPPRESSED"
        | "RETRYABLE_FAILURE"
        | "PERMANENT_FAILURE"
        | "INVALID_SUBSCRIPTION"
        | "AMBIGUOUS";
    })
  | (BaseOperationalEvent & {
      eventName: "notification_retry_scheduled";
      result: "RETRYING";
      reasonCode:
        | "provider_timeout"
        | "provider_rate_limited"
        | "provider_unavailable";
    })
  | (BaseOperationalEvent & {
      eventName: "notification_attempts_exhausted";
      result: "FAILED";
      reasonCode: "attempts_exhausted";
    })
  | (BaseOperationalEvent & {
      eventName: "notification_ambiguous";
      result: "AMBIGUOUS";
      reasonCode: "ambiguous_provider_outcome";
    })
  | (BaseOperationalEvent & {
      eventName: "push_subscription_invalidated";
      result: "SUCCESS";
      reasonCode: "invalid_subscription";
    })
  | (BaseOperationalEvent & {
      eventName: "notification_preference_enabled";
      result: "SUCCESS";
      reasonCode: "PREFERENCE_ENABLED";
    })
  | (BaseOperationalEvent & {
      eventName: "notification_preference_disabled";
      result: "SUCCESS";
      reasonCode: "PREFERENCE_DISABLED";
    })
  | (BaseOperationalEvent & {
      eventName: "notification_permission_requested";
      result: "STARTED";
      reasonCode: "PERMISSION_REQUESTED";
    })
  | (BaseOperationalEvent & {
      eventName: "notification_permission_granted";
      result: "SUCCESS";
      reasonCode: "PERMISSION_GRANTED";
    })
  | (BaseOperationalEvent & {
      eventName: "notification_permission_denied";
      result: "REJECTED";
      reasonCode: "PERMISSION_DENIED";
    })
  | (BaseOperationalEvent & {
      eventName: "push_subscription_created";
      result: "SUCCESS";
      reasonCode: "SUBSCRIPTION_CREATED";
    })
  | (BaseOperationalEvent & {
      eventName: "push_subscription_reused";
      result: "SUCCESS";
      reasonCode: "SUBSCRIPTION_REUSED";
    })
  | (BaseOperationalEvent & {
      eventName: "reminder_scheduler_batch_started";
      result: "STARTED";
      reasonCode: "BATCH_STARTED";
    })
  | (BaseOperationalEvent & {
      eventName: "reminder_scheduler_batch_completed";
      result: "SUCCESS";
      reasonCode: "BATCH_COMPLETED";
    })
  | (BaseOperationalEvent & {
      eventName: "reminder_occurrence_created";
      result: "SUCCESS";
      reasonCode: "OCCURRENCE_CREATED";
    })
  | (BaseOperationalEvent & {
      eventName: "reminder_occurrence_conflict";
      result: "SUCCESS";
      reasonCode: "DUPLICATE_OCCURRENCE";
    })
  | (BaseOperationalEvent & {
      eventName: "reminder_occurrence_suppressed";
      result: "SUPPRESSED";
      reasonCode:
        | "preference_disabled"
        | "no_active_subscription"
        | "mission_completed"
        | "daily_cap_exhausted"
        | "no_eligible_questions"
        | "quiet_hours"
        | "account_restricted"
        | "occurrence_expired"
        | "time_zone_changed"
        | "duplicate_occurrence";
    })
  | (BaseOperationalEvent & {
      eventName: "reminder_occurrence_expired";
      result: "EXPIRED";
      reasonCode: "occurrence_expired";
    })
  | (BaseOperationalEvent & {
      eventName: "reminder_intent_created";
      result: "SUCCESS";
      reasonCode: "INTENT_CREATED";
    })
  | (BaseOperationalEvent & {
      eventName: "reminder_dispatch_suppressed";
      result: "SUPPRESSED";
      reasonCode:
        | "preference_disabled"
        | "no_active_subscription"
        | "mission_completed"
        | "daily_cap_exhausted"
        | "no_eligible_questions"
        | "quiet_hours"
        | "account_restricted"
        | "occurrence_expired"
        | "time_zone_changed";
    })
  | (BaseOperationalEvent & {
      eventName: "worker_shutdown_started";
      result: "STARTED";
      reasonCode: "SHUTDOWN_SIGNAL";
    })
  | (BaseOperationalEvent & {
      eventName: "worker_shutdown_completed";
      result: "SUCCESS";
      reasonCode: "SHUTDOWN_COMPLETE";
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
