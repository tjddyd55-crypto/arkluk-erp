import { NextRequest } from "next/server";
import { z } from "zod";

import { requireAuth } from "@/lib/auth";
import { handleRouteError, HttpError, ok } from "@/lib/http";
import { deleteSupplierProductImageByPathForApi } from "@/server/services/supplier-product-image-storage";

const bodySchema = z.object({
  path: z.string().min(1).max(512),
});

export const runtime = "nodejs";

/** 본인 `product-images/{supplierId}/...` 객체만 삭제한다. */
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request, ["SUPPLIER"]);
    const supplierId = user.supplierId;
    if (!supplierId) {
      throw new HttpError(403, "공급사 계정만 이미지를 삭제할 수 있습니다.");
    }

    const json = await request.json();
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      throw new HttpError(400, "path가 필요합니다.");
    }

    await deleteSupplierProductImageByPathForApi(supplierId, parsed.data.path);

    return ok({ deleted: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
