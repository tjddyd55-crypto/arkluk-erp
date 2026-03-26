/**
 * R2/CDN 공개 베이스와 DB 객체 키를 합쳐 브라우저용 URL을 만든다.
 * 클라이언트 번들: NEXT_PUBLIC_R2_PUBLIC_URL 권장(레거시 상대 키 보정용; 신규는 DB에 전체 URL 저장).
 * 이미 `https?://` 전체 URL이면 그대로 둔다.
 * `/supplier/...` 같은 잘못된 접두사는 제거한다.
 * 정적 placeholder는 `/images/...`, `/icons/...`만 같은 출처로 둔다.
 */
export function resolvePublicMediaUrl(path?: string | null): string {
  if (!path?.trim()) {
    return "";
  }
  const raw = path.trim();

  if (/^https?:\/\//i.test(raw)) {
    return raw;
  }

  if (raw.startsWith("/images/") || raw.startsWith("/icons/")) {
    return raw;
  }

  let key = raw.replace(/\\/g, "/");
  key = key.replace(/^\/+/, "");
  if (key.startsWith("supplier/")) {
    key = key.slice("supplier/".length);
  }
  if (key.startsWith("uploads/")) {
    key = key.slice("uploads/".length);
  }

  const base = (process.env.NEXT_PUBLIC_R2_PUBLIC_URL ?? process.env.R2_PUBLIC_URL ?? "")
    .trim()
    .replace(/\/+$/, "");
  if (!base) {
    if (typeof window !== "undefined") {
      console.warn("NEXT_PUBLIC_R2_PUBLIC_URL not set");
    }
    return raw;
  }
  return `${base}/${key}`;
}
