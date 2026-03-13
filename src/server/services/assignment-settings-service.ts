import { Prisma, Role } from "@prisma/client";

import { HttpError } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { assignmentSettingsSchema } from "@/lib/schemas";
import { createAuditLog } from "@/server/services/audit-log";

const ASSIGNMENT_SETTINGS_KEY = "ORDER_ASSIGNMENT";

export type AssignmentModeKey = "MANUAL" | "AUTO_PRODUCT" | "AUTO_TIMEOUT";

export type AssignmentSettings = {
  modes: {
    manual: boolean;
    autoProduct: boolean;
    autoTimeout: boolean;
  };
  timeoutHours: number;
  notifications: {
    email: boolean;
    slack: boolean;
    sms: boolean;
    webhook: boolean;
  };
  webhookUrl: string | null;
  automationActorUserId: number | null;
};

const DEFAULT_SETTINGS: AssignmentSettings = {
  modes: {
    manual: true,
    autoProduct: true,
    autoTimeout: true,
  },
  timeoutHours: 24,
  notifications: {
    email: true,
    slack: false,
    sms: false,
    webhook: false,
  },
  webhookUrl: null,
  automationActorUserId: null,
};

function normalizeSettings(value: unknown): AssignmentSettings {
  const parsed = assignmentSettingsSchema.safeParse(value);
  if (!parsed.success) {
    return DEFAULT_SETTINGS;
  }

  return {
    modes: parsed.data.modes,
    timeoutHours: parsed.data.timeoutHours,
    notifications: parsed.data.notifications,
    webhookUrl: parsed.data.webhookUrl ?? null,
    automationActorUserId: parsed.data.automationActorUserId ?? null,
  };
}

export async function getAssignmentSettings(
  tx: Prisma.TransactionClient | typeof prisma = prisma,
) {
  const row = await tx.systemSetting.findUnique({
    where: { setting_key: ASSIGNMENT_SETTINGS_KEY },
    select: { value_json: true },
  });
  if (!row) {
    return DEFAULT_SETTINGS;
  }
  return normalizeSettings(row.value_json);
}

export async function updateAssignmentSettings(actorId: number, input: unknown) {
  const next = normalizeSettings(input);
  const before = await getAssignmentSettings();

  const updated = await prisma.$transaction(async (tx) => {
    const saved = await tx.systemSetting.upsert({
      where: { setting_key: ASSIGNMENT_SETTINGS_KEY },
      update: {
        value_json: next as unknown as Prisma.InputJsonValue,
        updated_by: actorId,
      },
      create: {
        setting_key: ASSIGNMENT_SETTINGS_KEY,
        value_json: next as unknown as Prisma.InputJsonValue,
        updated_by: actorId,
      },
    });

    await createAuditLog(
      {
        actorId,
        actionType: "UPDATE_ASSIGNMENT_SETTINGS",
        targetType: "SYSTEM_SETTING",
        targetId: saved.id,
        beforeData: before,
        afterData: next,
      },
      tx,
    );

    return saved;
  });

  return {
    id: updated.id,
    ...next,
  };
}

export async function assertAssignmentModeEnabled(mode: AssignmentModeKey) {
  const settings = await getAssignmentSettings();
  const enabled =
    mode === "MANUAL"
      ? settings.modes.manual
      : mode === "AUTO_PRODUCT"
        ? settings.modes.autoProduct
        : settings.modes.autoTimeout;

  if (!enabled) {
    throw new HttpError(403, `${mode} 배정 모드는 시스템 설정에서 비활성화되어 있습니다.`);
  }

  return settings;
}

export async function resolveAssignmentAutomationActorId() {
  const settings = await getAssignmentSettings();
  if (settings.automationActorUserId) {
    const actor = await prisma.user.findUnique({
      where: { id: settings.automationActorUserId },
      select: { id: true, is_active: true },
    });
    if (actor?.is_active) {
      return actor.id;
    }
  }

  const fallback = await prisma.user.findFirst({
    where: {
      is_active: true,
      role: {
        in: [Role.SUPER_ADMIN, Role.KOREA_SUPPLY_ADMIN, Role.ADMIN],
      },
    },
    select: { id: true },
    orderBy: [{ role: "asc" }, { id: "asc" }],
  });

  if (!fallback) {
    throw new HttpError(400, "자동 배정을 실행할 활성 관리자 계정을 찾을 수 없습니다.");
  }
  return fallback.id;
}
