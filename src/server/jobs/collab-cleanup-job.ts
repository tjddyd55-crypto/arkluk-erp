/**
 * 협업 프로젝트: 오래된 UPLOADING 실패 처리 + DELETED R2 purge
 * cron: 예) 0 * * * * — tsx src/server/jobs/collab-cleanup-job.ts
 */
import { failStaleCollabUploads, purgeCollabDeletedStorageObjects } from "@/server/services/collaboration/collab-project-service";

const STALE_MS = 60 * 60 * 1000;

async function main() {
  const failed = await failStaleCollabUploads(STALE_MS);
  const purged = await purgeCollabDeletedStorageObjects(100);
  console.info(`[collab-cleanup] staleFailed=${failed} purged=${purged}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
