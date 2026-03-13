import "dotenv/config";

import { resolveAssignmentAutomationActorId } from "@/server/services/assignment-settings-service";
import { runTimeoutAutoAssignmentSweep } from "@/server/services/order-service";

const INTERVAL_MS = 5 * 60 * 1000;

async function runOnce() {
  try {
    const actorId = await resolveAssignmentAutomationActorId();
    const result = await runTimeoutAutoAssignmentSweep(actorId);
    console.log(
      `[assignment-cron] scanned=${result.scannedOrders} assignedOrders=${result.assignedOrders} assignedItems=${result.assignedItems} skipped=${result.skipped ?? "NONE"}`,
    );
  } catch (error) {
    console.error("[assignment-cron] failed", error);
  }
}

async function bootstrap() {
  await runOnce();
  setInterval(() => {
    runOnce();
  }, INTERVAL_MS);
}

bootstrap().catch((error) => {
  console.error("[assignment-cron] bootstrap failed", error);
  process.exit(1);
});
