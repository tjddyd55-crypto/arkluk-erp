import { randomUUID } from "crypto";
import path from "path";
import { NextRequest } from "next/server";

import { env } from "@/lib/env";
import { requireAuth } from "@/lib/auth";
import { handleRouteError, HttpError, ok } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import {
  assertProductImageMimeMatchesExt,
  PRODUCT_IMAGE_CONTENT_TYPE_BY_EXT,
  SUPPLIER_PRODUCT_IMAGE_EXT_SET,
  SUPPLIER_PRODUCT_IMAGE_MAX_BYTES,
} from "@/server/storage/storage-upload-policy";
import { getFileUrl, saveSupplierProductImage } from "@/server/services/storage-service";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request, ["SUPPLIER"]);
    const supplierId = user.supplierId;
    if (!supplierId) {
      throw new HttpError(403, "공급사 계정만 이미지를 업로드할 수 있습니다.");
    }

    const formData = await request.formData();
    const productIdRaw = formData.get("productId");
    const productId = Number(typeof productIdRaw === "string" ? productIdRaw.trim() : NaN);
    if (!Number.isInteger(productId) || productId <= 0) {
      throw new HttpError(
        400,
        "유효한 상품 ID(productId)가 필요합니다. 상품을 먼저 임시저장한 뒤 이미지를 업로드해 주세요.",
      );
    }

    const product = await prisma.product.findFirst({
      where: { id: productId, supplier_id: supplierId },
      select: { id: true },
    });
    if (!product) {
      throw new HttpError(404, "상품을 찾을 수 없거나 권한이 없습니다.");
    }

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

    const fileName = `${Date.now()}-${randomUUID()}.${ext}`;
    const imageBuffer = Buffer.from(await image.arrayBuffer());

    let key: string;
    try {
      key = await saveSupplierProductImage(imageBuffer, productId, fileName, contentType);
    } catch (err) {
      const message = err instanceof Error ? err.message : "이미지를 저장할 수 없습니다.";
      throw new HttpError(400, message);
    }

    const url = getFileUrl(key);
    if (!env.R2_PUBLIC_URL?.trim() || !/^https?:\/\//i.test(url)) {
      throw new HttpError(
        500,
        "R2_PUBLIC_URL 환경변수가 없어 공개 URL을 만들 수 없습니다. 배포 환경에 R2 공개 도메인을 설정해 주세요.",
      );
    }

    return ok({
      key,
      url,
      path: url,
      previewUrl: url,
      size: image.size,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
