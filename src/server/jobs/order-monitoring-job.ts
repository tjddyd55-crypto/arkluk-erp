import "dotenv/config";

import { runOrderMonitoringSweep } from "@/server/services/order-monitoring-service";

const INTERVAL_MS = 5 * 60 * 1000;

async function runOnce() {
  try {
    const result = await runOrderMonitoringSweep();
    console.log(
      `[order-monitoring] delayedOrders=${result.delayedOrdersDetected} notifiedOrders=${result.delayedOrdersNotified} delayedShipments=${result.delayedShipmentsDetected} notifiedShipments=${result.delayedShipmentsNotified} skipped=${result.skipped ?? "NONE"}`,
    );
  } catch (error) {
    console.error("[order-monitoring] failed", error);
  }
}

async function bootstrap() {
  await runOnce();
  setInterval(() => {
    runOnce();
  }, INTERVAL_MS);
}

bootstrap().catch((error) => {
  console.error("[order-monitoring] bootstrap failed", error);
  process.exit(1);
});
