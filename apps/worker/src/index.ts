import { getEnv } from "@honey/config";
import { prisma } from "@honey/db";

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

async function main() {
  const env = getEnv();

  if (process.env.NODE_ENV === "test") {
    return;
  }

  setInterval(() => {
    processPendingOutbox().catch((error) => {
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
