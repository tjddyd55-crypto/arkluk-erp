import { HttpError } from "@/lib/http";
import { deleteFile, normalizeStorageKey } from "@/server/services/storage-service";

function productImagePrefix(supplierId: number): string {
  return `product-images/${supplierId}/`;
}

/**
 * R2/스토리지에 올린 본인 상품 이미지 키인지 (외부 URL·레거시 /uploads 제외).
 */
export function isSupplierOwnedProductImageKey(
  supplierId: number,
  storedPath: string | null | undefined,
): boolean {
  if (!storedPath?.trim()) {
    return false;
  }
  const p = storedPath.trim();
  if (/^https?:\/\//i.test(p)) {
    return false;
  }
  if (p.startsWith("/")) {
    return false;
  }
  const key = normalizeStorageKey(p);
  return key.startsWith(productImagePrefix(supplierId));
}

export async function deleteSupplierProductImageIfOwned(
  supplierId: number,
  storedPath: string | null | undefined,
): Promise<void> {
  if (!isSupplierOwnedProductImageKey(supplierId, storedPath)) {
    return;
  }
  await deleteFile(storedPath!);
}

/** API에서 명시 삭제 요청 시: 경로·권한 검증 후 삭제한다. */
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
  if (!key.startsWith("product-images/")) {
    throw new HttpError(400, "상품 이미지 스토리지 경로가 아닙니다.");
  }
  if (!key.startsWith(productImagePrefix(supplierId))) {
    throw new HttpError(403, "이 경로를 삭제할 권한이 없습니다.");
  }
  await deleteFile(p);
}
