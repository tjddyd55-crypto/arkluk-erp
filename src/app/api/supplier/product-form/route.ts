import { NextRequest } from "next/server";

import { requireAuth } from "@/lib/auth";
import { handleRouteError, HttpError, ok } from "@/lib/http";
import { getSupplierActiveProductForm } from "@/server/services/supplier-product-form-service";

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request, ["SUPPLIER"]);
    const supplierId = user.supplierId;
    if (!supplierId) {
      throw new HttpError(400, "공급사 계정 정보가 올바르지 않습니다.");
    }

    const form = await getSupplierActiveProductForm(supplierId, user.id);
    return ok({
      id: form.id,
      supplierId: form.supplier_id,
      name: form.name,
      fields: form.fields
        .filter((field) => field.is_enabled)
        .sort((a, b) => a.sort_order - b.sort_order || a.id - b.id)
        .map((field) => ({
          id: field.id,
          fieldKey: field.field_key,
          label: field.field_label,
          type: field.field_type,
          required: field.is_required,
          placeholder: field.placeholder_text,
          helpText: field.help_text,
          sortOrder: field.sort_order,
          validation: field.validation_json,
        })),
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
