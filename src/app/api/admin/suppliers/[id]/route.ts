import { NextRequest } from "next/server";
import { Role, SupplierStatus } from "@prisma/client";

import { requireAuth } from "@/lib/auth";
import { handleRouteError, HttpError, ok } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { supplierUpdateSchema } from "@/lib/schemas";
import { hashPassword } from "@/lib/security";
import { createAuditLog } from "@/server/services/audit-log";

const ADMIN_ROLES = ["SUPER_ADMIN", "KOREA_SUPPLY_ADMIN", "ADMIN"] as const;

function resolveSupplierStatus(
  inputStatus?: "PENDING" | "ACTIVE" | "INACTIVE" | "SUSPENDED",
  inputIsActive?: boolean,
) {
  if (inputStatus === "PENDING") {
    return SupplierStatus.PENDING;
  }
  if (inputStatus === "ACTIVE") {
    return SupplierStatus.ACTIVE;
  }
  if (inputStatus === "INACTIVE") {
    return SupplierStatus.INACTIVE;
  }
  if (inputStatus === "SUSPENDED") {
    return SupplierStatus.SUSPENDED;
  }
  if (inputIsActive === undefined) {
    return undefined;
  }
  return inputIsActive ? SupplierStatus.ACTIVE : SupplierStatus.INACTIVE;
}

function isActiveByStatus(status?: SupplierStatus) {
  if (!status) {
    return undefined;
  }
  return status === SupplierStatus.ACTIVE;
}

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
    const parsed = supplierUpdateSchema.safeParse(body);
    if (!parsed.success) {
      throw new HttpError(400, "공급사 수정 값이 올바르지 않습니다.");
    }

    const before = await prisma.supplier.findUnique({ where: { id: supplierId } });
    if (!before) {
      throw new HttpError(404, "공급사를 찾을 수 없습니다.");
    }

    const resolvedStatus = resolveSupplierStatus(parsed.data.status, parsed.data.isActive);

    const updated = await prisma.supplier.update({
      where: { id: supplierId },
      data: {
        company_name: parsed.data.companyName,
        country_code: parsed.data.countryCode?.toUpperCase(),
        business_number: parsed.data.businessNumber,
        representative_name: parsed.data.representativeName,
        contact_name: parsed.data.contactName,
        contact_email: parsed.data.contactEmail?.toLowerCase(),
        contact_phone: parsed.data.contactPhone,
        address: parsed.data.address,
        status: resolvedStatus,
        supplier_code: parsed.data.supplierCode,
        supplier_name: parsed.data.supplierName ?? parsed.data.companyName,
        order_email: parsed.data.orderEmail?.toLowerCase(),
        cc_email: parsed.data.ccEmail,
        invoice_sender_email: parsed.data.invoiceSenderEmail
          ? parsed.data.invoiceSenderEmail.toLowerCase()
          : parsed.data.invoiceSenderEmail,
        is_active: isActiveByStatus(resolvedStatus),
        allow_supplier_product_edit: parsed.data.allowSupplierProductEdit,
      },
    });

    if (parsed.data.newPassword && parsed.data.newPassword.trim() !== "") {
      const passwordHash = await hashPassword(parsed.data.newPassword);
      await prisma.user.updateMany({
        where: {
          supplier_id: supplierId,
          role: Role.SUPPLIER,
        },
        data: { password_hash: passwordHash },
      });
    }

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
