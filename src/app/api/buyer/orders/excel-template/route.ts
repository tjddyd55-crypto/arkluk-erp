import { NextRequest } from "next/server";

import { requireAuth } from "@/lib/auth";
import { handleRouteError, HttpError } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { toNumber } from "@/lib/utils";
import { buildOrderTemplateBySupplier } from "@/server/services/excel-service";

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request, ["BUYER"]);
    if (!user.countryId) {
      throw new HttpError(400, "BUYER에는 countryId가 필요합니다.");
    }
    const country = await prisma.country.findUnique({
      where: { id: user.countryId },
      select: { country_code: true },
    });
    if (!country) {
      throw new HttpError(400, "국가 정보를 찾을 수 없습니다.");
    }
    const supplierId = toNumber(request.nextUrl.searchParams.get("supplierId"));
    if (!supplierId) {
      throw new HttpError(400, "supplierId가 필요합니다.");
    }

    const buffer = await buildOrderTemplateBySupplier(supplierId, country.country_code);
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
