import { HttpError } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import {
  ARKLUX_PLATFORM_PREFIX,
  deleteFile,
  normalizeStorageKey,
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

/**
 * 레거시 product-images/{supplierId}/ 또는 신규 arklux/{company_code}/ 소유 키인지.
 */
export async function isSupplierOwnedProductImagePath(
  supplierId: number,
  storedPath: string | null | undefined,
): Promise<boolean> {
  if (!storedPath?.trim()) {
    return false;
  }
  const p = storedPath.trim();
  if (/^https?:\/\//i.test(p) || p.startsWith("/")) {
    return false;
  }
  const key = normalizeStorageKey(p);
  if (key.startsWith(legacyProductImagePrefix(supplierId))) {
    return true;
  }
  const companyCode = await getSupplierCompanyCode(supplierId);
  if (!companyCode) {
    return false;
  }
  return key.startsWith(`${ARKLUX_PLATFORM_PREFIX}/${companyCode}/`);
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

/** API에서 명시 삭제: 레거시 product-images/{supplierId}/ 또는 arklux/{company_code}/ 만 허용. */
export async function deleteSupplierProductImageByPathForApi(
  supplierId: number,
  pathInput: string,
): Promise<void> {
  const p = pathInput.trim();
  if (!p) {
    throw new HttpError(400, "path가 필요합니다.");
  }
  if (/^https?:\/\//i.test(p) || p.startsWith("/")) {
    throw new HttpError(400, "스토리지 객체 경로만 삭제할 수 있습니다.");
  }
  const key = normalizeStorageKey(p);

  if (key.startsWith(legacyProductImagePrefix(supplierId))) {
    await deleteFile(p);
    return;
  }

  if (key.startsWith(`${ARKLUX_PLATFORM_PREFIX}/`)) {
    const companyCode = await getSupplierCompanyCode(supplierId);
    if (!companyCode) {
      throw new HttpError(
        400,
        "공급사 회사 코드(company_code)가 없어 arklux 경로를 삭제할 수 없습니다.",
      );
    }
    if (key.startsWith(`${ARKLUX_PLATFORM_PREFIX}/${companyCode}/`)) {
      await deleteFile(p);
      return;
    }
    throw new HttpError(403, "이 경로를 삭제할 권한이 없습니다.");
  }

  if (key.startsWith("product-images/")) {
    throw new HttpError(403, "이 경로를 삭제할 권한이 없습니다.");
  }

  throw new HttpError(400, "상품 이미지 스토리지 경로가 아닙니다. (arklux/{company_code}/... 또는 레거시 경로)");
}
