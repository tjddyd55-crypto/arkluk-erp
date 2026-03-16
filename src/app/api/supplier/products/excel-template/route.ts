import { NextRequest } from "next/server";

import { requireAuth } from "@/lib/auth";
import { handleRouteError, HttpError } from "@/lib/http";
import { getSupplierActiveProductForm } from "@/server/services/supplier-product-form-service";
import { buildSupplierProductExcelTemplate } from "@/server/services/supplier-product-excel-service";

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request, ["SUPPLIER"]);
    const supplierId = user.supplierId;
    if (!supplierId) {
      throw new HttpError(400, "공급사 계정 정보가 올바르지 않습니다.");
    }

    const form = await getSupplierActiveProductForm(supplierId, user.id);
    const labels = form.fields
      .filter((field) => field.is_enabled)
      .sort((a, b) => a.sort_order - b.sort_order || a.id - b.id)
      .map((field) => field.field_label);

    const fileBuffer = buildSupplierProductExcelTemplate({ labels });

    return new Response(fileBuffer, {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": 'attachment; filename="supplier-product-template.xlsx"',
      },
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
