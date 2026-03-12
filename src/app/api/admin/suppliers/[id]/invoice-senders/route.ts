import { NextRequest } from "next/server";

import { requireAuth } from "@/lib/auth";
import { handleRouteError, HttpError, ok } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { supplierInvoiceSendersSchema } from "@/lib/schemas";
import { createAuditLog } from "@/server/services/audit-log";

const ADMIN_ROLES = ["SUPER_ADMIN", "ADMIN"] as const;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireAuth(request, [...ADMIN_ROLES]);
    const { id } = await params;
    const supplierId = Number(id);
    if (Number.isNaN(supplierId)) {
      throw new HttpError(400, "유효하지 않은 공급사 ID입니다.");
    }

    const senders = await prisma.supplierInvoiceSender.findMany({
      where: { supplier_id: supplierId },
      orderBy: [{ is_active: "desc" }, { sender_email: "asc" }],
    });
    return ok(senders);
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function PUT(
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
    const parsed = supplierInvoiceSendersSchema.safeParse(body);
    if (!parsed.success) {
      throw new HttpError(400, "발신 메일 목록 요청 형식이 올바르지 않습니다.");
    }

    const normalized = [...new Set(parsed.data.senderEmails.map((email) => email.toLowerCase()))];

    const supplier = await prisma.supplier.findUnique({
      where: { id: supplierId },
      select: { id: true },
    });
    if (!supplier) {
      throw new HttpError(404, "공급사를 찾을 수 없습니다.");
    }

    for (const email of normalized) {
      const usedByOther = await prisma.supplierInvoiceSender.findFirst({
        where: {
          sender_email: email,
          supplier_id: { not: supplierId },
          is_active: true,
        },
      });
      if (usedByOther) {
        throw new HttpError(400, `다른 공급사에 이미 등록된 발신 이메일입니다. (${email})`);
      }
    }

    const updated = await prisma.$transaction(async (tx) => {
      await tx.supplierInvoiceSender.updateMany({
        where: { supplier_id: supplierId },
        data: { is_active: false },
      });

      const activeRows = [];
      for (const email of normalized) {
        const existing = await tx.supplierInvoiceSender.findUnique({
          where: { sender_email: email },
        });
        if (existing) {
          const row = await tx.supplierInvoiceSender.update({
            where: { id: existing.id },
            data: {
              supplier_id: supplierId,
              is_active: true,
            },
          });
          activeRows.push(row);
        } else {
          const row = await tx.supplierInvoiceSender.create({
            data: {
              supplier_id: supplierId,
              sender_email: email,
              is_active: true,
            },
          });
          activeRows.push(row);
        }
      }

      await tx.supplier.update({
        where: { id: supplierId },
        data: {
          invoice_sender_email: normalized[0] ?? null,
        },
      });

      await createAuditLog(
        {
          actorId: user.id,
          actionType: "UPDATE_SUPPLIER_INVOICE_SENDERS",
          targetType: "SUPPLIER",
          targetId: supplierId,
          afterData: { senderEmails: normalized },
        },
        tx,
      );

      return activeRows;
    });

    return ok(updated);
  } catch (error) {
    return handleRouteError(error);
  }
}
