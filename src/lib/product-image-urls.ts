/** API/Prisma `Json` 필드에서 문자열 URL 배열만 안전하게 추출한다. */
export function parseProductImageUrlsJson(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((x): x is string => typeof x === "string" && x.trim().length > 0).map((s) => s.trim());
}

/** `image_url`과 `image_urls`를 합쳐 중복 없는 갤러리 목록(순서 유지). */
export function mergeProductImageGallery(imageUrl: string | null | undefined, imageUrls: unknown): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const push = (u: string) => {
    const t = u.trim();
    if (!t || seen.has(t)) {
      return;
    }
    seen.add(t);
    out.push(t);
  };
  for (const u of parseProductImageUrlsJson(imageUrls)) {
    push(u);
  }
  if (imageUrl?.trim()) {
    push(imageUrl);
  }
  return out;
}

export function isUrlInProductGallery(
  imageUrl: string | null | undefined,
  imageUrls: unknown,
  candidate: string,
): boolean {
  const c = candidate.trim();
  if (!c) {
    return false;
  }
  return mergeProductImageGallery(imageUrl, imageUrls).includes(c);
}
