import { getEnv } from "@honey/config";
import {
  createOperationalEvent,
  InMemoryOperationalEventSink,
  JsonConsoleOperationalEventSink,
  NoopOperationalEventSink,
  type EmitOperationalEventInput,
  type OperationalEventSink,
} from "@honey/observability";

export { InMemoryOperationalEventSink };

let operationalEventSink: OperationalEventSink =
  getEnv().NODE_ENV === "development"
    ? new JsonConsoleOperationalEventSink()
    : new NoopOperationalEventSink();

export function getOperationalEventSink() {
  return operationalEventSink;
}

export function setOperationalEventSink(sink: OperationalEventSink) {
  operationalEventSink = sink;
}

export function resetOperationalEventSink() {
  operationalEventSink =
    getEnv().NODE_ENV === "development"
      ? new JsonConsoleOperationalEventSink()
      : new NoopOperationalEventSink();
}

export async function emitOperationalEvent(event: EmitOperationalEventInput) {
  await operationalEventSink.emit(
    createOperationalEvent(event, {
      environment: getEnv().NODE_ENV,
    }),
  );
}
