import { NextRequest } from "next/server";

import { handleRouteError, ok } from "@/lib/http";
import { saveFile } from "@/server/services/storage-service";

export const runtime = "nodejs";

/**
 * R2 업로드 스모크 테스트. 프로덕션에서는 비활성화한다.
 */
export async function POST(request: NextRequest) {
  try {
    if (process.env.NODE_ENV === "production" && process.env.ENABLE_STORAGE_TEST !== "true") {
      return new Response(null, { status: 404 });
    }

    const buffer = Buffer.from("hello r2");
    await saveFile(buffer, "test/hello.txt", "text/plain; charset=utf-8");

    return ok({ ok: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
