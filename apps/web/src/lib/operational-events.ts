import {
  createOperationalEvent,
  InMemoryOperationalEventSink,
  JsonConsoleOperationalEventSink,
  NoopOperationalEventSink,
  type EmitOperationalEventInput,
  type OperationalEventSink,
} from "@honey/observability";

export { InMemoryOperationalEventSink };

function getNodeEnv() {
  switch (process.env.NODE_ENV) {
    case "production":
    case "test":
    case "development":
      return process.env.NODE_ENV;
    default:
      return "development";
  }
}

let operationalEventSink: OperationalEventSink =
  getNodeEnv() === "development"
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
    getNodeEnv() === "development"
      ? new JsonConsoleOperationalEventSink()
      : new NoopOperationalEventSink();
}

export async function emitOperationalEvent(event: EmitOperationalEventInput) {
  await operationalEventSink.emit(
    createOperationalEvent(event, {
      environment: getNodeEnv(),
    }),
  );
}
