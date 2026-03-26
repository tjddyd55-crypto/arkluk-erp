import { createAuditLog } from "@/server/services/audit-log";

export async function logCollabAudit(input: {
  actorId: number;
  actionType: string;
  targetType: string;
  targetId: number;
  beforeData?: unknown;
  afterData?: unknown;
}): Promise<void> {
  await createAuditLog({
    actorId: input.actorId,
    actionType: input.actionType,
    targetType: input.targetType,
    targetId: input.targetId,
    beforeData: input.beforeData,
    afterData: input.afterData,
  });
}
