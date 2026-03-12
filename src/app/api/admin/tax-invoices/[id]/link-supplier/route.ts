import { NextRequest } from "next/server";

import { requireAuth } from "@/lib/auth";
import { handleRouteError, HttpError, ok } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { createAuditLog } from "@/server/services/audit-log";

const ADMIN_ROLES = ["SUPER_ADMIN", "ADMIN"] as const;

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireAuth(request, [...ADMIN_ROLES]);
    const { id } = await params;
    const invoiceId = Number(id);
    if (Number.isNaN(invoiceId)) {
      throw new HttpError(400, "유효하지 않은 세금계산서 ID입니다.");
    }

    const body = (await request.json()) as { supplierId?: number | null };
    const supplierId = body.supplierId ?? null;

    if (supplierId !== null) {
      const supplier = await prisma.supplier.findUnique({
        where: { id: supplierId },
        select: { id: true },
      });
      if (!supplier) {
        throw new HttpError(404, "공급사를 찾을 수 없습니다.");
      }
    }

    const before = await prisma.taxInvoice.findUnique({
      where: { id: invoiceId },
      select: { id: true, supplier_id: true, email_inbox_id: true },
    });
    if (!before) {
      throw new HttpError(404, "세금계산서를 찾을 수 없습니다.");
    }

    const updated = await prisma.$transaction(async (tx) => {
      const invoice = await tx.taxInvoice.update({
        where: { id: invoiceId },
        data: {
          supplier_id: supplierId,
        },
      });

      await tx.emailInbox.update({
        where: { id: before.email_inbox_id },
        data: {
          supplier_id: supplierId,
        },
      });

      await createAuditLog(
        {
          actorId: user.id,
          actionType: "LINK_TAX_INVOICE_SUPPLIER",
          targetType: "TAX_INVOICE",
          targetId: invoiceId,
          beforeData: before,
          afterData: { supplierId },
        },
        tx,
      );

      return invoice;
    });

    return ok(updated);
  } catch (error) {
    return handleRouteError(error);
  }
}
