import { ProjectFileType } from "@prisma/client";

import { HttpError } from "@/lib/http";

/** 공급사 상품 이미지 */
export const SUPPLIER_PRODUCT_IMAGE_MAX_BYTES = 5 * 1024 * 1024;

const PRODUCT_IMAGE_EXTS = ["jpg", "jpeg", "png", "webp"] as const;
export const SUPPLIER_PRODUCT_IMAGE_EXT_SET = new Set<string>(PRODUCT_IMAGE_EXTS);

/** 확장자(소문자, 점 없음) → PutObject Content-Type */
export const PRODUCT_IMAGE_CONTENT_TYPE_BY_EXT: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

/** 관리자 프로젝트 첨부 */
export const ADMIN_PROJECT_FILE_MAX_BYTES = 20 * 1024 * 1024;

export type ProjectUploadSpec = {
  fileType: ProjectFileType;
  contentType: string;
};

/** 확장자(소문자, 점 없음) → DB 타입 + R2 Content-Type */
export const PROJECT_UPLOAD_BY_EXT: Record<string, ProjectUploadSpec> = {
  pdf: { fileType: ProjectFileType.PDF, contentType: "application/pdf" },
  dwg: { fileType: ProjectFileType.DWG, contentType: "application/acad" },
  zip: { fileType: ProjectFileType.ZIP, contentType: "application/zip" },
  png: { fileType: ProjectFileType.PNG, contentType: "image/png" },
  jpg: { fileType: ProjectFileType.JPG, contentType: "image/jpeg" },
  jpeg: { fileType: ProjectFileType.JPEG, contentType: "image/jpeg" },
};

export const PROJECT_UPLOAD_EXT_SET = new Set(Object.keys(PROJECT_UPLOAD_BY_EXT));

function stripMimeParams(mime: string): string {
  return mime.trim().toLowerCase().split(";")[0]?.trim() ?? "";
}

/**
 * 브라우저가 보낸 Content-Type이 확장자와 호환되는지 검사한다.
 * 빈 문자열은 일부 클라이언트에서 허용한다.
 */
export function assertProductImageMimeMatchesExt(extLower: string, fileMimeType: string): void {
  const expected = PRODUCT_IMAGE_CONTENT_TYPE_BY_EXT[extLower];
  if (!expected) {
    throw new HttpError(400, "지원하지 않는 이미지 확장자입니다.");
  }
  const m = stripMimeParams(fileMimeType);
  if (!m) {
    return;
  }
  if (m === expected) {
    return;
  }
  if ((extLower === "jpg" || extLower === "jpeg") && (m === "image/jpg" || m === "image/pjpeg")) {
    return;
  }
  throw new HttpError(400, "이미지 MIME 타입이 파일 형식과 일치하지 않습니다.");
}

/**
 * 프로젝트 파일: 확장자별로 저장 Content-Type은 정책表만 사용한다.
 * PDF는 클라이언트가 application/pdf가 아닌 타입을내면 거부한다.
 */
export function assertProjectUploadMimeMatchesExt(
  extLower: string,
  fileMimeType: string,
  spec: ProjectUploadSpec,
): void {
  const m = stripMimeParams(fileMimeType);
  if (spec.fileType === ProjectFileType.PDF) {
    if (m && m !== "application/pdf") {
      throw new HttpError(400, "PDF 업로드는 application/pdf MIME만 허용됩니다.");
    }
    return;
  }
  if (!m) {
    return;
  }
  if (m === spec.contentType) {
    return;
  }
  if (m === "application/octet-stream") {
    return;
  }
  if (
    spec.fileType === ProjectFileType.DWG &&
    (m === "image/vnd.dwg" || m === "application/x-dwg")
  ) {
    return;
  }
  throw new HttpError(400, "파일 MIME 타입이 확장자와 일치하지 않습니다.");
}
