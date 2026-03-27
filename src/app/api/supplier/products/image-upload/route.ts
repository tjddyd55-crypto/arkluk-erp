import { randomUUID } from "crypto";
import path from "path";
import { NextRequest } from "next/server";

import { requireAuth } from "@/lib/auth";
import { handleRouteError, HttpError, ok } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import {
  assertProductImageMimeMatchesExt,
  PRODUCT_IMAGE_CONTENT_TYPE_BY_EXT,
  SUPPLIER_PRODUCT_IMAGE_EXT_SET,
  SUPPLIER_PRODUCT_IMAGE_MAX_BYTES,
} from "@/server/storage/storage-upload-policy";
import { mergeProductImageGallery } from "@/lib/product-image-urls";
import {
  buildSupplierProductImagePublicUrl,
  saveSupplierProductImage,
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

    const fileField = formData.get("file");
    if (!(fileField instanceof File)) {
      throw new HttpError(400, "file(이미지 파일)이 필요합니다.");
    }

    if (fileField.size <= 0 || fileField.size > SUPPLIER_PRODUCT_IMAGE_MAX_BYTES) {
      throw new HttpError(
        400,
        `이미지 크기는 1바이트 이상, ${Math.floor(SUPPLIER_PRODUCT_IMAGE_MAX_BYTES / (1024 * 1024))}MB 이하여야 합니다.`,
      );
    }

    const ext = path.extname(fileField.name).replace(".", "").toLowerCase();
    if (!SUPPLIER_PRODUCT_IMAGE_EXT_SET.has(ext)) {
      throw new HttpError(400, "지원하지 않는 이미지 형식입니다. (jpg/jpeg/png/webp)");
    }

    assertProductImageMimeMatchesExt(ext, fileField.type ?? "");

    const contentType = PRODUCT_IMAGE_CONTENT_TYPE_BY_EXT[ext];
    if (!contentType) {
      throw new HttpError(400, "지원하지 않는 이미지 형식입니다.");
    }

    const fileName = `${Date.now()}-${randomUUID()}.${ext}`;
    fileNameForLog = fileName;
    const imageBuffer = Buffer.from(await fileField.arrayBuffer());

    const productIdRaw = formData.get("productId");
    const productId = Number(typeof productIdRaw === "string" ? productIdRaw.trim() : NaN);
    if (!Number.isInteger(productId) || productId <= 0) {
      throw new HttpError(400, "생성된 상품의 productId가 필요합니다. 먼저 상품을 저장한 뒤 이미지를 올려 주세요.");
    }
    productIdForLog = productId;

    const product = await prisma.product.findFirst({
      where: { id: productId, supplier_id: supplierId },
      select: { id: true, image_url: true, image_urls: true },
    });
    if (!product) {
      throw new HttpError(404, "상품을 찾을 수 없거나 권한이 없습니다.");
    }

    let key: string;
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

    const url = buildSupplierProductImagePublicUrl(key);

    const gallery = mergeProductImageGallery(product.image_url, product.image_urls);
    if (!gallery.includes(url)) {
      gallery.push(url);
    }
    const primary = product.image_url?.trim() ? product.image_url : url;

    const updated = await prisma.product.update({
      where: { id: productId },
      data: {
        image_url: primary,
        image_urls: gallery,
      },
    });

    return ok({
      key,
      url,
      size: fileField.size,
      product: updated,
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
