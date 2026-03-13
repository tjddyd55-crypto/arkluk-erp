import { NextRequest } from "next/server";

import { requireAuth } from "@/lib/auth";
import { handleRouteError, HttpError, ok } from "@/lib/http";
import { assignmentSettingsSchema } from "@/lib/schemas";
import {
  getAssignmentSettings,
  updateAssignmentSettings,
} from "@/server/services/assignment-settings-service";

const ADMIN_ROLES = ["SUPER_ADMIN", "ADMIN"] as const;

export async function GET(request: NextRequest) {
  try {
    await requireAuth(request, [...ADMIN_ROLES]);
    const settings = await getAssignmentSettings();
    return ok(settings);
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const user = await requireAuth(request, [...ADMIN_ROLES]);
    const body = await request.json();
    const parsed = assignmentSettingsSchema.safeParse(body);
    if (!parsed.success) {
      throw new HttpError(400, "배정 설정 요청 값이 올바르지 않습니다.");
    }

    const updated = await updateAssignmentSettings(user.id, parsed.data);
    return ok(updated);
  } catch (error) {
    return handleRouteError(error);
  }
}
