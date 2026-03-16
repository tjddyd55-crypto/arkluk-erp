import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
import { NextRequest } from "next/server";

import { requireAuth } from "@/lib/auth";
import { handleRouteError, HttpError, ok } from "@/lib/http";

const ALLOWED_EXTENSIONS = new Set(["jpg", "jpeg", "png", "webp"]);
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    await requireAuth(request, ["SUPPLIER"]);
    const formData = await request.formData();
    const image = formData.get("image");
    if (!(image instanceof File)) {
      throw new HttpError(400, "이미지 파일이 필요합니다.");
    }
    if (image.size <= 0 || image.size > MAX_FILE_SIZE) {
      throw new HttpError(400, "이미지 크기는 1바이트 이상, 5MB 이하여야 합니다.");
    }

    const ext = path.extname(image.name).replace(".", "").toLowerCase();
    if (!ALLOWED_EXTENSIONS.has(ext)) {
      throw new HttpError(400, "지원하지 않는 이미지 형식입니다. (jpg/jpeg/png/webp)");
    }

    const dir = path.join(process.cwd(), "public", "uploads", "product-images");
    await mkdir(dir, { recursive: true });
    const fileName = `product_${Date.now()}_${randomUUID()}.${ext}`;
    const absolutePath = path.join(dir, fileName);
    const imageBuffer = Buffer.from(await image.arrayBuffer());
    await writeFile(absolutePath, imageBuffer);

    return ok({
      imageUrl: `/uploads/product-images/${fileName}`,
      fileName,
      size: image.size,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
