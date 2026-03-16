import { NextRequest } from "next/server";

import { requireAuth } from "@/lib/auth";
import { handleRouteError, HttpError, ok } from "@/lib/http";
import {
  supplierProductFieldRequestCreateSchema,
} from "@/lib/schemas";
import { prisma } from "@/lib/prisma";
import { createAuditLog } from "@/server/services/audit-log";

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request, ["SUPPLIER"]);
    const supplierId = user.supplierId;
    if (!supplierId) {
      throw new HttpError(400, "공급사 계정 정보가 올바르지 않습니다.");
    }

    const rows = await prisma.supplierProductFieldRequest.findMany({
      where: { supplier_id: supplierId },
      orderBy: [{ created_at: "desc" }],
    });
    return ok(rows);
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request, ["SUPPLIER"]);
    const supplierId = user.supplierId;
    if (!supplierId) {
      throw new HttpError(400, "공급사 계정 정보가 올바르지 않습니다.");
    }

    const parsed = supplierProductFieldRequestCreateSchema.safeParse(await request.json());
    if (!parsed.success) {
      throw new HttpError(400, "필드 요청 값이 올바르지 않습니다.");
    }

    const created = await prisma.supplierProductFieldRequest.create({
      data: {
        supplier_id: supplierId,
        request_title: parsed.data.requestTitle,
        requested_field_label: parsed.data.requestedFieldLabel,
        requested_field_type: parsed.data.requestedFieldType,
        request_reason: parsed.data.requestReason,
      },
    });

    await createAuditLog({
      actorId: user.id,
      actionType: "SUPPLIER_CREATE_PRODUCT_FIELD_REQUEST",
      targetType: "SUPPLIER",
      targetId: supplierId,
      afterData: {
        requestId: created.id,
        requestedFieldLabel: created.requested_field_label,
      },
    });

    return ok(created, { status: 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}
