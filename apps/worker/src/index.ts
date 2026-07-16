export { processPendingOutbox } from "./notifications";
export { processReminderSchedulerBatch } from "./reminder-scheduler";
import { createWorkerRuntime } from "./notifications";
import { createReminderSchedulerRuntime } from "./reminder-scheduler";

async function main() {
  if (process.env.VITEST) {
    return;
  }

  const runtime = createWorkerRuntime();
  const schedulerRuntime = createReminderSchedulerRuntime();
  runtime.start();
  schedulerRuntime.start();

  const shutdown = () => {
    Promise.all([runtime.shutdown(), schedulerRuntime.shutdown()]).finally(
      () => {
        process.exit(0);
      },
    );
  };

  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
