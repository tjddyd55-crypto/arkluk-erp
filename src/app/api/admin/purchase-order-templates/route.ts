import { NextRequest } from "next/server";

import { requireAuth } from "@/lib/auth";
import { handleRouteError, HttpError, ok } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { purchaseOrderTemplateUpsertSchema } from "@/lib/schemas";
import { toNumber } from "@/lib/utils";
import { createAuditLog } from "@/server/services/audit-log";

const ADMIN_ROLES = ["SUPER_ADMIN", "ADMIN"] as const;

export async function GET(request: NextRequest) {
  try {
    await requireAuth(request, [...ADMIN_ROLES]);
    const supplierId = toNumber(request.nextUrl.searchParams.get("supplierId"));

    const templates = await prisma.purchaseOrderTemplate.findMany({
      where: {
        ...(supplierId ? { supplier_id: supplierId } : {}),
      },
      include: {
        supplier: true,
      },
      orderBy: [{ is_default: "desc" }, { supplier_id: "asc" }, { updated_at: "desc" }],
    });
    return ok(templates);
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request, [...ADMIN_ROLES]);
    const body = await request.json();
    const parsed = purchaseOrderTemplateUpsertSchema.safeParse(body);
    if (!parsed.success) {
      throw new HttpError(400, "발주서 템플릿 요청 값이 올바르지 않습니다.");
    }

    const created = await prisma.purchaseOrderTemplate.create({
      data: {
        supplier_id: parsed.data.supplierId ?? null,
        template_name: parsed.data.templateName,
        title_ko: parsed.data.titleKo,
        title_en: parsed.data.titleEn,
        buyer_name: parsed.data.buyerName ?? null,
        footer_note: parsed.data.footerNote ?? null,
        is_default: parsed.data.isDefault ?? false,
        is_active: parsed.data.isActive ?? true,
      },
    });

    if (created.is_default) {
      await prisma.purchaseOrderTemplate.updateMany({
        where: {
          id: { not: created.id },
          is_default: true,
        },
        data: {
          is_default: false,
        },
      });
    }

    await createAuditLog({
      actorId: user.id,
      actionType: "CREATE_PURCHASE_ORDER_TEMPLATE",
      targetType: "PURCHASE_ORDER_TEMPLATE",
      targetId: created.id,
      afterData: parsed.data,
    });

    return ok(created, { status: 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}
