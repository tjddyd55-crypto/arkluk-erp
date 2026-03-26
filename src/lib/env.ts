import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(32),
  IMAP_HOST: z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    z.string().optional(),
  ),
  IMAP_USER: z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    z.string().optional(),
  ),
  IMAP_PASSWORD: z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    z.string().optional(),
  ),
  IMAP_PORT: z.preprocess((value) => {
    if (value === undefined || value === null || value === "") {
      return undefined;
    }
    return Number(value);
  }, z.number().int().positive().optional()),
  IMAP_SECURE: z.preprocess((value) => {
    if (value === undefined || value === null || value === "") {
      return undefined;
    }
    return String(value).toLowerCase() === "true";
  }, z.boolean().optional()),
  TAX_INVOICE_INBOX_EMAIL: z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    z.email().optional(),
  ),
  SMTP_HOST: z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    z.string().optional(),
  ),
  SMTP_PORT: z.preprocess((value) => {
    if (value === undefined || value === null || value === "") {
      return undefined;
    }
    return Number(value);
  }, z.number().int().positive().optional()),
  SMTP_USER: z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    z.string().optional(),
  ),
  SMTP_PASSWORD: z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    z.string().optional(),
  ),
  SMTP_SECURE: z.preprocess((value) => {
    if (value === undefined || value === null || value === "") {
      return undefined;
    }
    return String(value).toLowerCase() === "true";
  }, z.boolean().optional()),
  SMTP_FROM_EMAIL: z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    z.email().optional(),
  ),
  OUR_COMPANY_NAME: z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    z.string().optional(),
  ),
  /** 통합 발주서 등 내부 운영 알림 수신(쉼표 구분 가능 — 첫 주소만 사용) */
  KOREA_OPS_EMAIL: z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    z.string().optional(),
  ),
  R2_ENDPOINT: z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    z.string().optional(),
  ),
  R2_ACCESS_KEY_ID: z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    z.string().optional(),
  ),
  R2_SECRET_ACCESS_KEY: z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    z.string().optional(),
  ),
  R2_BUCKET_NAME: z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    z.string().optional(),
  ),
  /** 공개 버킷/커스텀 도메인 베이스 URL (끝 슬래시 없음 권장). 서버·업로드 응답용. */
  R2_PUBLIC_URL: z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    z.string().optional(),
  ),
  /** 브라우저에서 상대 미디어 키 보정용. 배포 시 R2_PUBLIC_URL과 동일 값 권장. */
  NEXT_PUBLIC_R2_PUBLIC_URL: z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    z.string().optional(),
  ),
});

const parsed = envSchema.safeParse({
  DATABASE_URL: process.env.DATABASE_URL,
  JWT_SECRET: process.env.JWT_SECRET,
  IMAP_HOST: process.env.IMAP_HOST,
  IMAP_USER: process.env.IMAP_USER,
  IMAP_PASSWORD: process.env.IMAP_PASSWORD,
  IMAP_PORT: process.env.IMAP_PORT,
  IMAP_SECURE: process.env.IMAP_SECURE,
  TAX_INVOICE_INBOX_EMAIL: process.env.TAX_INVOICE_INBOX_EMAIL,
  SMTP_HOST: process.env.SMTP_HOST,
  SMTP_PORT: process.env.SMTP_PORT,
  SMTP_USER: process.env.SMTP_USER,
  SMTP_PASSWORD: process.env.SMTP_PASSWORD,
  SMTP_SECURE: process.env.SMTP_SECURE,
  SMTP_FROM_EMAIL: process.env.SMTP_FROM_EMAIL,
  OUR_COMPANY_NAME: process.env.OUR_COMPANY_NAME,
  KOREA_OPS_EMAIL: process.env.KOREA_OPS_EMAIL,
  R2_ENDPOINT: process.env.R2_ENDPOINT,
  R2_ACCESS_KEY_ID: process.env.R2_ACCESS_KEY_ID,
  R2_SECRET_ACCESS_KEY: process.env.R2_SECRET_ACCESS_KEY,
  R2_BUCKET_NAME: process.env.R2_BUCKET_NAME,
  R2_PUBLIC_URL: process.env.R2_PUBLIC_URL,
  NEXT_PUBLIC_R2_PUBLIC_URL: process.env.NEXT_PUBLIC_R2_PUBLIC_URL,
});

if (!parsed.success) {
  throw new Error(`환경변수 검증 실패: ${parsed.error.message}`);
}

export const env = parsed.data;
