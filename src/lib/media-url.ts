/**
 * DB에 저장된 객체 경로(또는 레거시 /uploads/...)를 브라우저용 절대 URL로 만든다.
 * R2 공개 URL은 NEXT_PUBLIC_R2_PUBLIC_URL(또는 R2와 동일 베이스)로 빌드 시 주입한다.
 */
export function resolvePublicMediaUrl(storedPath: string | null | undefined): string {
  if (!storedPath?.trim()) {
    return "";
  }
  const p = storedPath.trim();
  if (/^https?:\/\//i.test(p)) {
    return p;
  }
  if (p.startsWith("/")) {
    return p;
  }
  const base = (process.env.NEXT_PUBLIC_R2_PUBLIC_URL ?? "").trim().replace(/\/+$/, "");
  if (!base) {
    return "";
  }
  return `${base}/${p.replace(/^\/+/, "")}`;
}
