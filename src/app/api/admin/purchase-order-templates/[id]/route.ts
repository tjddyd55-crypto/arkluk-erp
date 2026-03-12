import { NextRequest } from "next/server";

import { requireAuth } from "@/lib/auth";
import { handleRouteError, HttpError, ok } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { purchaseOrderTemplateUpsertSchema } from "@/lib/schemas";
import { createAuditLog } from "@/server/services/audit-log";

const ADMIN_ROLES = ["SUPER_ADMIN", "ADMIN"] as const;

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireAuth(request, [...ADMIN_ROLES]);
    const { id } = await params;
    const templateId = Number(id);
    if (Number.isNaN(templateId)) {
      throw new HttpError(400, "유효하지 않은 템플릿 ID입니다.");
    }

    const body = await request.json();
    const parsed = purchaseOrderTemplateUpsertSchema.partial().safeParse(body);
    if (!parsed.success) {
      throw new HttpError(400, "발주서 템플릿 수정 값이 올바르지 않습니다.");
    }

    const before = await prisma.purchaseOrderTemplate.findUnique({
      where: { id: templateId },
    });
    if (!before) {
      throw new HttpError(404, "템플릿을 찾을 수 없습니다.");
    }

    const updated = await prisma.purchaseOrderTemplate.update({
      where: { id: templateId },
      data: {
        supplier_id: parsed.data.supplierId,
        template_name: parsed.data.templateName,
        title_ko: parsed.data.titleKo,
        title_en: parsed.data.titleEn,
        buyer_name: parsed.data.buyerName,
        footer_note: parsed.data.footerNote,
        is_default: parsed.data.isDefault,
        is_active: parsed.data.isActive,
      },
    });

    if (updated.is_default) {
      await prisma.purchaseOrderTemplate.updateMany({
        where: {
          id: { not: updated.id },
          is_default: true,
        },
        data: { is_default: false },
      });
    }

    await createAuditLog({
      actorId: user.id,
      actionType: "UPDATE_PURCHASE_ORDER_TEMPLATE",
      targetType: "PURCHASE_ORDER_TEMPLATE",
      targetId: templateId,
      beforeData: before,
      afterData: updated,
    });

    return ok(updated);
  } catch (error) {
    return handleRouteError(error);
  }
}
