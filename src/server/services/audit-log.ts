import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";

type CreateAuditLogInput = {
  actorId: number;
  actionType: string;
  targetType: string;
  targetId: number;
  beforeData?: unknown;
  afterData?: unknown;
};

function normalizeJson(
  value: unknown,
): Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (value === null) {
    return Prisma.JsonNull;
  }
  const parsed = JSON.parse(JSON.stringify(value)) as Prisma.JsonValue;
  return parsed === null ? Prisma.JsonNull : (parsed as Prisma.InputJsonValue);
}

export async function createAuditLog(
  input: CreateAuditLogInput,
  tx: Prisma.TransactionClient | typeof prisma = prisma,
) {
  await tx.auditLog.create({
    data: {
      actor_id: input.actorId,
      action_type: input.actionType,
      target_type: input.targetType,
      target_id: input.targetId,
      before_data: normalizeJson(input.beforeData),
      after_data: normalizeJson(input.afterData),
    },
  });
}
