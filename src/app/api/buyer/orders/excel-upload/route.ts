import { NextRequest } from "next/server";

import { requireAuth } from "@/lib/auth";
import { handleRouteError, HttpError, ok } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { parseBuyerOrderExcel } from "@/server/services/excel-service";
import { createOrder } from "@/server/services/order-service";

export async function POST(request: NextRequest) {
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
    const formData = await request.formData();
    const supplierIdRaw = formData.get("supplierId");
    const commitRaw = formData.get("commit");
    const file = formData.get("file");
    if (!(file instanceof File)) {
      throw new HttpError(400, "엑셀 파일이 필요합니다.");
    }
    if (!file.name.toLowerCase().match(/\.(xlsx|xls)$/)) {
      throw new HttpError(400, "엑셀 파일만 업로드할 수 있습니다.");
    }

    const supplierId = Number(supplierIdRaw);
    if (!supplierId || Number.isNaN(supplierId)) {
      throw new HttpError(400, "유효한 supplierId가 필요합니다.");
    }

    const parsed = await parseBuyerOrderExcel(
      supplierId,
      country.country_code,
      Buffer.from(await file.arrayBuffer()),
    );
    const commit = String(commitRaw ?? "false").toLowerCase() === "true";

    if (!commit) {
      return ok({
        preview: parsed.validItems,
        errors: parsed.errors,
      });
    }

    if (parsed.validItems.length === 0) {
      throw new HttpError(400, "주문 가능한 유효 행이 없습니다.");
    }

    const order = await createOrder({
      buyerId: user.id,
      items: parsed.validItems,
      memo: "엑셀 업로드 주문",
    });

    return ok({
      order,
      errors: parsed.errors,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
