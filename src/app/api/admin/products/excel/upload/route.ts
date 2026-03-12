import { NextRequest } from "next/server";

import { requireAuth } from "@/lib/auth";
import { handleRouteError, HttpError, ok } from "@/lib/http";
import { upsertProductsFromExcel } from "@/server/services/excel-service";

const ADMIN_ROLES = ["SUPER_ADMIN", "ADMIN"] as const;

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request, [...ADMIN_ROLES]);
    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      throw new HttpError(400, "엑셀 파일이 필요합니다.");
    }
    if (!file.name.toLowerCase().match(/\.(xlsx|xls)$/)) {
      throw new HttpError(400, "엑셀 파일만 업로드할 수 있습니다.");
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const result = await upsertProductsFromExcel(user.id, buffer);
    return ok(result);
  } catch (error) {
    return handleRouteError(error);
  }
}
