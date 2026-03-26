/**
 * 레거시/기타 미디어용. 상품 이미지는 DB `image_url`에 절대 URL이 저장되므로
 * 클라이언트에서 가공 없이 그대로 사용한다.
 */
export function resolvePublicMediaUrl(path?: string | null): string {
  return path?.trim() ?? "";
}
