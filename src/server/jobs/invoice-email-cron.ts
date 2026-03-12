import "dotenv/config";

import { syncInvoiceEmails } from "@/server/services/email-invoice-service";

const INTERVAL_MS = 5 * 60 * 1000;

async function runOnce() {
  try {
    const result = await syncInvoiceEmails({ limit: 100 });
    console.log(
      `[invoice-cron] fetched=${result.fetched} created=${result.created} linked=${result.linkedOrder} skipped=${result.skippedDuplicate}`,
    );
  } catch (error) {
    console.error("[invoice-cron] failed", error);
  }
}

async function bootstrap() {
  await runOnce();
  setInterval(() => {
    runOnce();
  }, INTERVAL_MS);
}

bootstrap().catch((error) => {
  console.error("[invoice-cron] bootstrap failed", error);
  process.exit(1);
});
