import { NextRequest } from "next/server";

import { requireAuth } from "@/lib/auth";
import { handleRouteError, HttpError, ok } from "@/lib/http";
import { supplierProductFormSaveSchema } from "@/lib/schemas";
import { createAuditLog } from "@/server/services/audit-log";
import {
  getSupplierActiveProductForm,
  hardDeleteSupplierProductField,
  saveSupplierProductForm,
} from "@/server/services/supplier-product-form-service";

const ADMIN_ROLES = ["SUPER_ADMIN", "KOREA_SUPPLY_ADMIN", "ADMIN"] as const;

async function parseSupplierId(params: Promise<{ id: string }>) {
  const { id } = await params;
  const supplierId = Number(id);
  if (Number.isNaN(supplierId)) {
    throw new HttpError(400, "유효하지 않은 공급사 ID입니다.");
  }
  return supplierId;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireAuth(request, [...ADMIN_ROLES]);
    const supplierId = await parseSupplierId(params);
    const form = await getSupplierActiveProductForm(supplierId, user.id);
    return ok(form);
  } catch (error) {
    return handleRouteError(error);
  }
}

async function upsertForm(
  request: NextRequest,
  params: Promise<{ id: string }>,
) {
  const user = await requireAuth(request, [...ADMIN_ROLES]);
  const supplierId = await parseSupplierId(params);
  const parsed = supplierProductFormSaveSchema.safeParse(await request.json());
  if (!parsed.success) {
    throw new HttpError(400, "폼 저장 요청 값이 올바르지 않습니다.");
  }

  const saved = await saveSupplierProductForm({
    supplierId,
    actorId: user.id,
    name: parsed.data.name,
    isActive: parsed.data.isActive,
    fields: parsed.data.fields,
  });

  await createAuditLog({
    actorId: user.id,
    actionType: "UPDATE_SUPPLIER_PRODUCT_FORM",
    targetType: "SUPPLIER",
    targetId: supplierId,
    afterData: {
      formId: saved.id,
      fieldCount: saved.fields.length,
    },
  });

  return ok(saved);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    return await upsertForm(request, params);
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    return await upsertForm(request, params);
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireAuth(request, [...ADMIN_ROLES]);
    const supplierId = await parseSupplierId(params);
    const body = (await request.json().catch(() => ({}))) as { fieldId?: number };
    const fieldId = Number(body.fieldId);
    if (Number.isNaN(fieldId)) {
      throw new HttpError(400, "삭제할 fieldId가 필요합니다.");
    }

    await hardDeleteSupplierProductField({
      supplierId,
      fieldId,
    });

    await createAuditLog({
      actorId: user.id,
      actionType: "DELETE_SUPPLIER_PRODUCT_FIELD",
      targetType: "SUPPLIER",
      targetId: supplierId,
      afterData: { fieldId },
    });

    return ok({ deleted: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
