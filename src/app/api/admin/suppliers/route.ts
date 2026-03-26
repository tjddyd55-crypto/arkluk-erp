import { NextRequest } from "next/server";
import { ProductCategory, Role, SupplierStatus } from "@prisma/client";

import { requireAuth } from "@/lib/auth";
import { handleRouteError, HttpError, ok } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { supplierCreateSchema } from "@/lib/schemas";
import { hashPassword } from "@/lib/security";
import { createAuditLog } from "@/server/services/audit-log";
import { generateUniqueSupplierCompanyCode } from "@/server/services/supplier-company-code";
import { ensureSupplierActiveProductForm } from "@/server/services/supplier-product-form-service";

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

function normalizeLoginId(raw: string) {
  return raw.trim().toLowerCase();
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
        users: {
          where: { role: Role.SUPPLIER, is_active: true },
          select: { login_id: true, id: true },
          take: 5,
          orderBy: { id: "asc" },
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
    const parsed = supplierCreateSchema.safeParse(body);
    if (!parsed.success) {
      throw new HttpError(400, "공급사 요청 값이 올바르지 않습니다.");
    }

    const loginId = normalizeLoginId(parsed.data.loginId);
    const existingLogin = await prisma.user.findUnique({
      where: { login_id: loginId },
      select: { id: true },
    });
    if (existingLogin) {
      throw new HttpError(409, "이미 사용 중인 로그인 아이디입니다.");
    }

    const status = resolveSupplierStatus(parsed.data.status, parsed.data.isActive);
    const companyName = parsed.data.companyName;
    const contactEmail = parsed.data.contactEmail.toLowerCase();
    const orderEmail = (parsed.data.orderEmail ?? parsed.data.contactEmail).toLowerCase();
    const displayName =
      parsed.data.contactName?.trim() || parsed.data.companyName.trim();

    const passwordHash = await hashPassword(parsed.data.password);

    const result = await prisma.$transaction(async (tx) => {
      const companyCode = await generateUniqueSupplierCompanyCode(tx);

      const created = await tx.supplier.create({
        data: {
          company_name: companyName,
          company_code: companyCode,
          country_code: parsed.data.countryCode.toUpperCase(),
          productCategory: parsed.data.productCategory ?? ProductCategory.CONSTRUCTION,
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

      await tx.user.create({
        data: {
          login_id: loginId,
          password_hash: passwordHash,
          name: displayName,
          email: loginId.includes("@") ? loginId : contactEmail,
          role: Role.SUPPLIER,
          supplier_id: created.id,
          is_active: true,
        },
      });

      await ensureSupplierActiveProductForm(created.id, user.id, tx);

      return created;
    });

    await createAuditLog({
      actorId: user.id,
      actionType: "CREATE_SUPPLIER",
      targetType: "SUPPLIER",
      targetId: result.id,
      afterData: {
        companyName: parsed.data.companyName,
        loginId,
        companyCode: result.company_code,
      },
    });

    return ok(
      {
        ...result,
        supplierLoginId: loginId,
      },
      { status: 201 },
    );
  } catch (error) {
    return handleRouteError(error);
  }
}
