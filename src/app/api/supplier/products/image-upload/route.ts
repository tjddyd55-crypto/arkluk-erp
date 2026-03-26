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
import {
  getFileUrl,
  saveSupplierProductImage,
  saveSupplierProductTempImage,
} from "@/server/services/storage-service";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  let supplierId: number | null = null;
  let productIdForLog: number | null = null;
  let fileNameForLog: string | null = null;

  try {
    const user = await requireAuth(request, ["SUPPLIER"]);
    supplierId = user.supplierId;
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

    const fileName = `${Date.now()}-${randomUUID()}.${ext}`;
    fileNameForLog = fileName;
    const imageBuffer = Buffer.from(await image.arrayBuffer());

    const productIdRaw = formData.get("productId");
    const productId = Number(typeof productIdRaw === "string" ? productIdRaw.trim() : NaN);
    const hasProductId = Number.isInteger(productId) && productId > 0;
    productIdForLog = hasProductId ? productId : null;

    let key: string;
    let temp = false;

    if (hasProductId) {
      const product = await prisma.product.findFirst({
        where: { id: productId, supplier_id: supplierId },
        select: { id: true },
      });
      if (!product) {
        throw new HttpError(404, "상품을 찾을 수 없거나 권한이 없습니다.");
      }
      try {
        key = await saveSupplierProductImage(imageBuffer, productId, fileName, contentType);
      } catch (err) {
        console.error("[supplier/products/image-upload] R2 저장 실패", {
          productId,
          fileName,
          supplierId,
          error: err instanceof Error ? err.message : String(err),
          stack: err instanceof Error ? err.stack : undefined,
        });
        const message = err instanceof Error ? err.message : "이미지를 저장할 수 없습니다.";
        throw new HttpError(400, message);
      }
    } else {
      const draftIdRaw = formData.get("draftId");
      const draftId = typeof draftIdRaw === "string" ? draftIdRaw.trim() : "";
      if (!draftId) {
        throw new HttpError(
          400,
          "상품 미생성 시 draftId(UUID)가 필요합니다. 등록 화면에서 발급한 값을 함께 보내 주세요.",
        );
      }
      temp = true;
      try {
        key = await saveSupplierProductTempImage(imageBuffer, supplierId, draftId, fileName, contentType);
      } catch (err) {
        console.error("[supplier/products/image-upload] 임시 R2 저장 실패", {
          draftId,
          fileName,
          supplierId,
          error: err instanceof Error ? err.message : String(err),
          stack: err instanceof Error ? err.stack : undefined,
        });
        const message = err instanceof Error ? err.message : "이미지를 저장할 수 없습니다.";
        throw new HttpError(400, message);
      }
    }

    const url = getFileUrl(key);
    const publicBase = (env.R2_PUBLIC_URL ?? env.NEXT_PUBLIC_R2_PUBLIC_URL ?? "").trim();
    if (!publicBase || !/^https?:\/\//i.test(url)) {
      throw new HttpError(
        500,
        "R2 공개 도메인이 설정되지 않았습니다. R2_PUBLIC_URL과 NEXT_PUBLIC_R2_PUBLIC_URL을 동일한 베이스(예: https://pub-xxxx.r2.dev)로 설정해 주세요.",
      );
    }

    return ok({
      key,
      url,
      temp,
      size: image.size,
    });
  } catch (error) {
    if (!(error instanceof HttpError)) {
      console.error("[supplier/products/image-upload] 처리 예외", {
        productId: productIdForLog,
        fileName: fileNameForLog,
        supplierId,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
    }
    return handleRouteError(error);
  }
}
