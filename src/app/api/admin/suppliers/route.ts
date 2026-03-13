import { NextRequest } from "next/server";
import { SupplierStatus } from "@prisma/client";

import { requireAuth } from "@/lib/auth";
import { handleRouteError, HttpError, ok } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { supplierUpsertSchema } from "@/lib/schemas";
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
    return SupplierStatus.PENDING;
  }
  return inputIsActive ? SupplierStatus.ACTIVE : SupplierStatus.INACTIVE;
}

function isActiveByStatus(status: SupplierStatus) {
  return status === SupplierStatus.ACTIVE;
}

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
      orderBy: [{ company_name: "asc" }],
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

    const status = resolveSupplierStatus(parsed.data.status, parsed.data.isActive);
    const companyName = parsed.data.companyName;
    const contactEmail = parsed.data.contactEmail.toLowerCase();
    const orderEmail = (parsed.data.orderEmail ?? parsed.data.contactEmail).toLowerCase();

    const created = await prisma.supplier.create({
      data: {
        company_name: companyName,
        company_code: parsed.data.companyCode,
        country_code: parsed.data.countryCode.toUpperCase(),
        business_number: parsed.data.businessNumber ?? null,
        representative_name: parsed.data.representativeName ?? null,
        contact_name: parsed.data.contactName ?? null,
        contact_email: contactEmail,
        contact_phone: parsed.data.contactPhone ?? null,
        address: parsed.data.address ?? null,
        status,
        supplier_code: parsed.data.supplierCode ?? null,
        supplier_name: parsed.data.supplierName ?? companyName,
        order_email: orderEmail,
        cc_email: parsed.data.ccEmail ?? null,
        invoice_sender_email: parsed.data.invoiceSenderEmail ?? null,
        allow_supplier_product_edit: parsed.data.allowSupplierProductEdit ?? false,
        is_active: isActiveByStatus(status),
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
