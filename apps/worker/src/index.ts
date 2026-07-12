import { getEnv } from "@honey/config";
import { prisma } from "@honey/db";
import {
  JsonConsoleOperationalEventSink,
  NoopOperationalEventSink,
  createOperationalEvent,
  type OperationalEventSink,
} from "@honey/observability";

const operationalEventSink: OperationalEventSink =
  getEnv().NODE_ENV === "development"
    ? new JsonConsoleOperationalEventSink()
    : new NoopOperationalEventSink();

export async function processPendingOutbox() {
  const events = await prisma.outboxEvent.findMany({
    where: {
      status: "PENDING",
      availableAt: {
        lte: new Date(),
      },
    },
    orderBy: {
      createdAt: "asc",
    },
    take: 10,
  });

  for (const event of events) {
    if (event.eventType === "STAFF_IN_APP_NOTIFICATION") {
      const payload = event.payloadJson as {
        recipientId: string;
        title: string;
        body: string;
        type: string;
      };

      await prisma.$transaction(async (tx) => {
        await tx.inAppNotification.upsert({
          where: {
            sourceEventId: event.id,
          },
          update: {},
          create: {
            organizationId: event.organizationId,
            recipientId: payload.recipientId,
            sourceEventId: event.id,
            title: payload.title,
            body: payload.body,
            type: payload.type,
          },
        });

        await tx.outboxEvent.update({
          where: { id: event.id },
          data: {
            status: "PROCESSED",
            processedAt: new Date(),
            attemptCount: {
              increment: 1,
            },
          },
        });
      });
    }
  }
}

async function emitWorkerOperationalEvent(input: {
  eventName: "serialization_retry";
  result: "RETRYING";
  reasonCode: "PRISMA_P2034";
  retryCount?: number;
}) {
  await operationalEventSink.emit(
    createOperationalEvent(input, {
      environment: getEnv().NODE_ENV,
    }),
  );
}

async function main() {
  const env = getEnv();

  if (process.env.NODE_ENV === "test") {
    return;
  }

  setInterval(() => {
    processPendingOutbox().catch((error) => {
      if (
        typeof error === "object" &&
        error &&
        "code" in error &&
        error.code === "P2034"
      ) {
        emitWorkerOperationalEvent({
          eventName: "serialization_retry",
          result: "RETRYING",
          reasonCode: "PRISMA_P2034",
        }).catch(() => {});
      }

      console.error(
        "worker_error",
        error instanceof Error ? error.message : "unknown",
      );
    });
  }, env.WORKER_POLL_MS);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
