import { NextRequest } from "next/server";

import { requireAuth } from "@/lib/auth";
import { handleRouteError, HttpError, ok } from "@/lib/http";
import { markAsRead } from "@/server/services/notification-service";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ recipientId: string }> },
) {
  try {
    const user = await requireAuth(request);
    const { recipientId } = await params;
    const parsedRecipientId = Number(recipientId);
    if (Number.isNaN(parsedRecipientId)) {
      throw new HttpError(400, "유효하지 않은 알림 ID입니다.");
    }

    const updated = await markAsRead(parsedRecipientId, user.id);
    return ok(updated);
  } catch (error) {
    return handleRouteError(error);
  }
}
