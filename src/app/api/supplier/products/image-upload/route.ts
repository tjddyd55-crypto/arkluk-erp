import path from "path";
import { NextRequest } from "next/server";

import { requireAuth } from "@/lib/auth";
import { handleRouteError, HttpError, ok } from "@/lib/http";
import {
  assertProductImageMimeMatchesExt,
  PRODUCT_IMAGE_CONTENT_TYPE_BY_EXT,
  SUPPLIER_PRODUCT_IMAGE_EXT_SET,
  SUPPLIER_PRODUCT_IMAGE_MAX_BYTES,
} from "@/server/storage/storage-upload-policy";
import { getFileUrl, saveFile } from "@/server/services/storage-service";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request, ["SUPPLIER"]);
    const supplierId = user.supplierId;
    if (!supplierId) {
      throw new HttpError(403, "공급사 계정만 이미지를 업로드할 수 있습니다.");
    }

    const formData = await request.formData();
    const image = formData.get("image");
    if (!(image instanceof File)) {
      throw new HttpError(400, "이미지 파일이 필요합니다.");
    }
    if (image.size <= 0 || image.size > SUPPLIER_PRODUCT_IMAGE_MAX_BYTES) {
      throw new HttpError(
        400,
        `이미지 크기는 1바이트 이상, ${Math.floor(SUPPLIER_PRODUCT_IMAGE_MAX_BYTES / (1024 * 1024))}MB 이하여야 합니다.`,
      );
    }

    const ext = path.extname(image.name).replace(".", "").toLowerCase();
    if (!SUPPLIER_PRODUCT_IMAGE_EXT_SET.has(ext)) {
      throw new HttpError(400, "지원하지 않는 이미지 형식입니다. (jpg/jpeg/png/webp)");
    }

    assertProductImageMimeMatchesExt(ext, image.type ?? "");

    const contentType = PRODUCT_IMAGE_CONTENT_TYPE_BY_EXT[ext];
    if (!contentType) {
      throw new HttpError(400, "지원하지 않는 이미지 형식입니다.");
    }

    const objectPath = `product-images/${supplierId}/${Date.now()}.${ext}`;
    const imageBuffer = Buffer.from(await image.arrayBuffer());
    const pathStored = await saveFile(imageBuffer, objectPath, contentType);

    return ok({
      path: pathStored,
      previewUrl: getFileUrl(pathStored),
      size: image.size,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
