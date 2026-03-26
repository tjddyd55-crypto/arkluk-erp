import { HttpError } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import {
  ARKLUX_PLATFORM_PREFIX,
  deleteFile,
  resolveR2ObjectKey,
} from "@/server/services/storage-service";

function legacyProductImagePrefix(supplierId: number): string {
  return `product-images/${supplierId}/`;
}

function trySafeCompanyCodeSegment(companyCode: string | null | undefined): string | null {
  const s = companyCode?.trim() ?? "";
  if (!s || !/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(s)) {
    return null;
  }
  return s;
}

async function getSupplierCompanyCode(supplierId: number): Promise<string | null> {
  const row = await prisma.supplier.findUnique({
    where: { id: supplierId },
    select: { company_code: true },
  });
  return trySafeCompanyCodeSegment(row?.company_code);
}

function matchProductImageKey(key: string): number | null {
  const m = /^products\/(\d+)\/images\//.exec(key);
  if (!m) {
    return null;
  }
  return Number(m[1]);
}

async function isOwnedProductImageKey(supplierId: number, key: string): Promise<boolean> {
  const productId = matchProductImageKey(key);
  if (productId !== null) {
    const row = await prisma.product.findFirst({
      where: { id: productId, supplier_id: supplierId },
      select: { id: true },
    });
    return Boolean(row);
  }
  if (key.startsWith(legacyProductImagePrefix(supplierId))) {
    return true;
  }
  const companyCode = await getSupplierCompanyCode(supplierId);
  if (!companyCode) {
    return false;
  }
  return key.startsWith(`${ARKLUX_PLATFORM_PREFIX}/${companyCode}/`);
}

/**
 * 레거시 product-images/{supplierId}/, arklux/{company_code}/, products/{id}/images/ 소유 여부.
 * DB에 R2 공개 URL이 저장된 경우에도 동일하게 판별한다.
 */
export async function isSupplierOwnedProductImagePath(
  supplierId: number,
  storedPath: string | null | undefined,
): Promise<boolean> {
  if (!storedPath?.trim()) {
    return false;
  }
  const key = resolveR2ObjectKey(storedPath);
  if (!key) {
    return false;
  }
  return isOwnedProductImageKey(supplierId, key);
}

export async function deleteSupplierProductImageIfOwned(
  supplierId: number,
  storedPath: string | null | undefined,
): Promise<void> {
  if (!(await isSupplierOwnedProductImagePath(supplierId, storedPath))) {
    return;
  }
  await deleteFile(storedPath!);
}

/** API에서 명시 삭제: products/{id}/images/, 레거시 product-images/{supplierId}/, arklux/{company_code}/ */
export async function deleteSupplierProductImageByPathForApi(
  supplierId: number,
  pathInput: string,
): Promise<void> {
  const p = pathInput.trim();
  if (!p) {
    throw new HttpError(400, "path가 필요합니다.");
  }
  const key = resolveR2ObjectKey(p);
  if (!key) {
    throw new HttpError(400, "유효하지 않은 경로입니다.");
  }

  const owned = await isOwnedProductImageKey(supplierId, key);
  if (!owned) {
    if (key.startsWith("product-images/")) {
      throw new HttpError(403, "이 경로를 삭제할 권한이 없습니다.");
    }
    if (key.startsWith(`${ARKLUX_PLATFORM_PREFIX}/`)) {
      throw new HttpError(403, "이 경로를 삭제할 권한이 없습니다.");
    }
    if (matchProductImageKey(key) !== null) {
      throw new HttpError(403, "이 경로를 삭제할 권한이 없습니다.");
    }
    throw new HttpError(400, "상품 이미지 스토리지 경로가 아닙니다.");
  }

  await deleteFile(p);
}
