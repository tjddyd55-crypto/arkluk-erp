import { NextRequest } from "next/server";

import { requireAuth } from "@/lib/auth";
import { handleRouteError, HttpError, ok } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { supplierUpsertSchema } from "@/lib/schemas";
import { createAuditLog } from "@/server/services/audit-log";

const ADMIN_ROLES = ["SUPER_ADMIN", "ADMIN"] as const;

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireAuth(request, [...ADMIN_ROLES]);
    const { id } = await params;
    const supplierId = Number(id);
    if (Number.isNaN(supplierId)) {
      throw new HttpError(400, "유효하지 않은 공급사 ID입니다.");
    }

    const body = await request.json();
    const parsed = supplierUpsertSchema.partial().safeParse(body);
    if (!parsed.success) {
      throw new HttpError(400, "공급사 수정 값이 올바르지 않습니다.");
    }

    const before = await prisma.supplier.findUnique({ where: { id: supplierId } });
    if (!before) {
      throw new HttpError(404, "공급사를 찾을 수 없습니다.");
    }

    const updated = await prisma.supplier.update({
      where: { id: supplierId },
      data: {
        supplier_code: parsed.data.supplierCode,
        supplier_name: parsed.data.supplierName,
        order_email: parsed.data.orderEmail,
        cc_email: parsed.data.ccEmail,
        invoice_sender_email: parsed.data.invoiceSenderEmail
          ? parsed.data.invoiceSenderEmail.toLowerCase()
          : parsed.data.invoiceSenderEmail,
        is_active: parsed.data.isActive,
        allow_supplier_product_edit: parsed.data.allowSupplierProductEdit,
      },
    });

    if (parsed.data.invoiceSenderEmail !== undefined) {
      const senderEmail = parsed.data.invoiceSenderEmail?.toLowerCase();
      if (senderEmail) {
        const existingSender = await prisma.supplierInvoiceSender.findFirst({
          where: {
            supplier_id: supplierId,
            sender_email: senderEmail,
          },
        });
        if (existingSender) {
          await prisma.supplierInvoiceSender.update({
            where: { id: existingSender.id },
            data: { is_active: true },
          });
        } else {
          await prisma.supplierInvoiceSender.create({
            data: {
              supplier_id: supplierId,
              sender_email: senderEmail,
              is_active: true,
            },
          });
        }
      }
    }

    await createAuditLog({
      actorId: user.id,
      actionType: "UPDATE_SUPPLIER",
      targetType: "SUPPLIER",
      targetId: supplierId,
      beforeData: before,
      afterData: updated,
    });

    return ok(updated);
  } catch (error) {
    return handleRouteError(error);
  }
}
