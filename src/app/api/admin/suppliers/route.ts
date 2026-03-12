import { NextRequest } from "next/server";

import { requireAuth } from "@/lib/auth";
import { handleRouteError, HttpError, ok } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { supplierUpsertSchema } from "@/lib/schemas";
import { createAuditLog } from "@/server/services/audit-log";

const ADMIN_ROLES = ["SUPER_ADMIN", "ADMIN"] as const;

export async function GET(request: NextRequest) {
  try {
    await requireAuth(request, [...ADMIN_ROLES]);

    const suppliers = await prisma.supplier.findMany({
      include: {
        invoice_senders: {
          where: { is_active: true },
          orderBy: [{ sender_email: "asc" }],
        },
      },
      orderBy: [{ supplier_name: "asc" }],
    });
    return ok(suppliers);
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request, [...ADMIN_ROLES]);
    const body = await request.json();
    const parsed = supplierUpsertSchema.safeParse(body);
    if (!parsed.success) {
      throw new HttpError(400, "공급사 요청 값이 올바르지 않습니다.");
    }

    const created = await prisma.supplier.create({
      data: {
        supplier_code: parsed.data.supplierCode ?? null,
        supplier_name: parsed.data.supplierName,
        order_email: parsed.data.orderEmail,
        cc_email: parsed.data.ccEmail ?? null,
        invoice_sender_email: parsed.data.invoiceSenderEmail ?? null,
        allow_supplier_product_edit: parsed.data.allowSupplierProductEdit ?? false,
        is_active: parsed.data.isActive ?? true,
        ...(parsed.data.invoiceSenderEmail
          ? {
              invoice_senders: {
                create: {
                  sender_email: parsed.data.invoiceSenderEmail.toLowerCase(),
                  is_active: true,
                },
              },
            }
          : {}),
      },
    });

    await createAuditLog({
      actorId: user.id,
      actionType: "CREATE_SUPPLIER",
      targetType: "SUPPLIER",
      targetId: created.id,
      afterData: parsed.data,
    });

    return ok(created, { status: 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}
