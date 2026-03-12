import { NextRequest } from "next/server";

import { requireAuth } from "@/lib/auth";
import { handleRouteError, HttpError } from "@/lib/http";
import { toNumber } from "@/lib/utils";
import { buildOrderTemplateBySupplier } from "@/server/services/excel-service";

export async function GET(request: NextRequest) {
  try {
    await requireAuth(request, ["BUYER"]);
    const supplierId = toNumber(request.nextUrl.searchParams.get("supplierId"));
    if (!supplierId) {
      throw new HttpError(400, "supplierId가 필요합니다.");
    }

    const buffer = await buildOrderTemplateBySupplier(supplierId);
    return new Response(buffer, {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="supplier-${supplierId}-order-template.xlsx"`,
      },
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
