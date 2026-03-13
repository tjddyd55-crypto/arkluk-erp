import { NextRequest } from "next/server";
import { Role } from "@prisma/client";

import { requireAuth } from "@/lib/auth";
import { createCountryOrderDraftSchema } from "@/lib/schemas";
import { handleRouteError, HttpError, ok } from "@/lib/http";
import { createCountryOrderDraft } from "@/server/services/order-service";

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request, ["BUYER"]);
    if (user.role !== Role.COUNTRY_ADMIN) {
      throw new HttpError(403, "COUNTRY_ADMIN만 국가 주문 초안을 생성할 수 있습니다.");
    }

    const parsed = createCountryOrderDraftSchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) {
      throw new HttpError(400, "주문 초안 요청 형식이 올바르지 않습니다.");
    }

    const order = await createCountryOrderDraft({
      actorId: user.id,
      projectId: parsed.data.projectId,
      memo: parsed.data.memo,
    });
    return ok(order, { status: 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}
