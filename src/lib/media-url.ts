/**
 * R2/CDN 공개 베이스(NEXT_PUBLIC_R2_PUBLIC_URL)와 DB 객체 키를 합쳐 브라우저용 URL을 만든다.
 * `/supplier/...`처럼 앱 서버로 향하는 잘못된 접두사는 제거한다.
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

  const base = (process.env.NEXT_PUBLIC_R2_PUBLIC_URL ?? "").trim().replace(/\/+$/, "");
  if (!base) {
    if (typeof window !== "undefined") {
      console.warn("NEXT_PUBLIC_R2_PUBLIC_URL not set");
    }
    return raw;
  }
  return `${base}/${key}`;
}
