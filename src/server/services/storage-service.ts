import { createReadStream, existsSync } from "fs";
import { readFile } from "fs/promises";
import path from "path";
import { Readable } from "stream";
import { unlink } from "fs/promises";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

import { env } from "@/lib/env";

let r2Client: S3Client | null = null;

/** DB·레거시 경로를 R2 Object Key로 정규화한다 (선행 storage/, 슬래시 제거). */
export function normalizeStorageKey(storedPath: string): string {
  let s = storedPath.trim().replace(/\\/g, "/");
  while (s.startsWith("/")) {
    s = s.slice(1);
  }
  return s.replace(/^storage\//, "");
}

/**
 * DB에 저장된 값(상대 키 또는 R2 공개 URL)을 R2 Object Key로 통일한다.
 * 로컬 레거시 경로는 normalizeStorageKey와 동일하게 처리한다.
 */
export function resolveR2ObjectKey(storedPath: string): string {
  const s = storedPath.trim();
  if (!s) {
    return "";
  }
  if (/^https?:\/\//i.test(s)) {
    const bases = [env.R2_PUBLIC_URL, process.env.NEXT_PUBLIC_R2_PUBLIC_URL]
      .filter((b): b is string => Boolean(b?.trim()))
      .map((b) => b.trim().replace(/\/+$/, ""));
    const lower = s.toLowerCase();
    for (const base of bases) {
      const prefix = `${base.toLowerCase()}/`;
      if (lower.startsWith(prefix)) {
        return normalizeStorageKey(s.slice(base.length + 1));
      }
    }
    try {
      const path = new URL(s).pathname.replace(/^\/+/, "");
      return normalizeStorageKey(path);
    } catch {
      return normalizeStorageKey(s);
    }
  }
  return normalizeStorageKey(s);
}

/** 플랫폼 정적 자산 R2 키 프리픽스 (버킷은 R2_BUCKET_NAME, 예: platform-assets). */
export const ARKLUX_PLATFORM_PREFIX = "arklux";

/**
 * company_code를 객체 경로 세그먼트로 쓸 수 있는지 검증한다.
 * 회사명이 아닌 DB `Supplier.company_code`만 사용한다.
 */
export function assertSafeCompanyCodeSegment(companyCode: string): string {
  const s = companyCode.trim();
  if (!s) {
    throw new Error("company_code가 비어 있습니다.");
  }
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(s)) {
    throw new Error("company_code에 스토리지 경로에 사용할 수 없는 문자가 포함되어 있습니다.");
  }
  return s;
}

/**
 * 논리 조합 `companyCode` + `fileName` → R2 키 `arklux/{companyCode}/{fileName}`.
 * fileName은 단일 세그먼트(슬래시·.. 금지).
 */
export function buildArkluxAssetObjectKey(companyCode: string, fileName: string): string {
  const code = assertSafeCompanyCodeSegment(companyCode);
  const base = fileName.trim().replace(/\\/g, "/");
  if (!base || base.includes("/") || base.includes("..")) {
    throw new Error("유효하지 않은 파일명입니다.");
  }
  return `${ARKLUX_PLATFORM_PREFIX}/${code}/${base}`;
}

/** 공급사 상품 이미지 R2 키: `products/{productId}/images/{fileName}` */
export function buildSupplierProductImageObjectKey(productId: number, fileName: string): string {
  if (!Number.isInteger(productId) || productId <= 0) {
    throw new Error("유효하지 않은 상품 ID입니다.");
  }
  const base = fileName.trim().replace(/\\/g, "/");
  if (!base || base.includes("/") || base.includes("..")) {
    throw new Error("유효하지 않은 파일명입니다.");
  }
  return `products/${productId}/images/${base}`;
}

/** 상품별 이미지: `products/{productId}/images/...` 키로 저장하고 동일 키 문자열을 반환한다. */
export async function saveSupplierProductImage(
  buffer: Buffer,
  productId: number,
  fileName: string,
  contentType: string,
): Promise<string> {
  const key = buildSupplierProductImageObjectKey(productId, fileName);
  return saveFile(buffer, key, contentType);
}

/**
 * 공급사 상품 이미지: `arklux/{companyCode}/{fileName}` 키로 저장하고, DB에 넣을 동일 키 문자열을 반환한다.
 */
export async function saveArkluxSupplierProductImage(
  buffer: Buffer,
  companyCode: string,
  fileName: string,
  contentType: string,
): Promise<string> {
  const key = buildArkluxAssetObjectKey(companyCode, fileName);
  return saveFile(buffer, key, contentType);
}

function localFileAbsolutePath(storedPath: string): string {
  const normalized = storedPath.trim().replace(/\\/g, "/");
  const segments = normalized.split("/").filter(Boolean);
  return path.join(process.cwd(), ...segments);
}

export function isR2Configured(): boolean {
  return Boolean(
    env.R2_ENDPOINT?.trim() &&
      env.R2_ACCESS_KEY_ID?.trim() &&
      env.R2_SECRET_ACCESS_KEY?.trim() &&
      env.R2_BUCKET_NAME?.trim(),
  );
}

function getR2Client(): S3Client {
  if (!isR2Configured()) {
    throw new Error("R2 환경변수가 설정되지 않았습니다.");
  }
  if (!r2Client) {
    r2Client = new S3Client({
      region: "auto",
      endpoint: env.R2_ENDPOINT!.trim(),
      credentials: {
        accessKeyId: env.R2_ACCESS_KEY_ID!.trim(),
        secretAccessKey: env.R2_SECRET_ACCESS_KEY!.trim(),
      },
    });
  }
  return r2Client;
}

export async function saveFile(
  buffer: Buffer,
  objectPath: string,
  contentType?: string,
): Promise<string> {
  const key = normalizeStorageKey(objectPath);
  const client = getR2Client();
  await client.send(
    new PutObjectCommand({
      Bucket: env.R2_BUCKET_NAME!.trim(),
      Key: key,
      Body: buffer,
      ContentType: contentType ?? "application/octet-stream",
    }),
  );
  return key;
}

/** R2 객체 삭제. 로컬 레거시 파일만 있는 환경에서는 해당 경로 파일을 제거한다. */
export async function deleteFile(objectPath: string): Promise<void> {
  const key = normalizeStorageKey(objectPath);
  if (!key) {
    return;
  }
  if (isR2Configured()) {
    await getR2Client().send(
      new DeleteObjectCommand({
        Bucket: env.R2_BUCKET_NAME!.trim(),
        Key: key,
      }),
    );
    return;
  }
  const abs = localFileAbsolutePath(objectPath);
  try {
    await unlink(abs);
  } catch (err: unknown) {
    const code = err && typeof err === "object" && "code" in err ? (err as NodeJS.ErrnoException).code : undefined;
    if (code !== "ENOENT") {
      throw err;
    }
  }
}

export type PresignedPutObjectInput = {
  key: string;
  contentType: string;
  expiresInSeconds?: number;
};

export type PresignedPutObjectResult = {
  uploadUrl: string;
  expiresAt: Date;
};

export async function createPresignedPutObjectUrl(
  input: PresignedPutObjectInput,
): Promise<PresignedPutObjectResult> {
  const client = getR2Client();
  const key = normalizeStorageKey(input.key);
  const expiresIn = input.expiresInSeconds ?? 900;
  const command = new PutObjectCommand({
    Bucket: env.R2_BUCKET_NAME!.trim(),
    Key: key,
    ContentType: input.contentType || "application/octet-stream",
  });
  const uploadUrl = await getSignedUrl(client, command, { expiresIn });
  return { uploadUrl, expiresAt: new Date(Date.now() + expiresIn * 1000) };
}

export type PresignedGetObjectInput = {
  key: string;
  expiresInSeconds?: number;
};

export type PresignedGetObjectResult = {
  downloadUrl: string;
  expiresIn: number;
};

export async function createPresignedGetObjectUrl(
  input: PresignedGetObjectInput,
): Promise<PresignedGetObjectResult> {
  const client = getR2Client();
  const key = normalizeStorageKey(input.key);
  const expiresIn = input.expiresInSeconds ?? 300;
  const command = new GetObjectCommand({
    Bucket: env.R2_BUCKET_NAME!.trim(),
    Key: key,
  });
  const downloadUrl = await getSignedUrl(client, command, { expiresIn });
  return { downloadUrl, expiresIn };
}

/** R2(또는 호환 S3) 객체 스트림. 호출 측에서 본문 소비 실패 시 스트림 정리 필요. */
export async function getFileStream(objectPath: string) {
  const key = resolveR2ObjectKey(objectPath);
  const client = getR2Client();
  const res = await client.send(
    new GetObjectCommand({
      Bucket: env.R2_BUCKET_NAME!.trim(),
      Key: key,
    }),
  );
  return res.Body ?? null;
}

export async function getFileBuffer(objectPath: string): Promise<Buffer> {
  const key = resolveR2ObjectKey(objectPath);
  const client = getR2Client();
  const res = await client.send(
    new GetObjectCommand({
      Bucket: env.R2_BUCKET_NAME!.trim(),
      Key: key,
    }),
  );
  if (!res.Body) {
    throw new Error("빈 스토리지 응답입니다.");
  }
  return Buffer.from(await res.Body.transformToByteArray());
}

export async function existsFile(objectPath: string): Promise<boolean> {
  if (isR2Configured()) {
    try {
      const key = resolveR2ObjectKey(objectPath);
      await getR2Client().send(
        new HeadObjectCommand({
          Bucket: env.R2_BUCKET_NAME!.trim(),
          Key: key,
        }),
      );
      return true;
    } catch {
      /* R2에 없으면 로컬 확인 */
    }
  }
  return existsSync(localFileAbsolutePath(objectPath));
}

export function getFileUrl(objectPath: string): string {
  const base = (env.R2_PUBLIC_URL ?? "").trim().replace(/\/+$/, "");
  const key = resolveR2ObjectKey(objectPath);
  if (!base) {
    return key;
  }
  return `${base}/${key}`;
}

/**
 * R2 우선, 없으면 서버 로컬 레거시 경로(storage/..., public/...).
 * 신규 저장은 R2만 사용한다.
 */
export async function readStoredFileBuffer(
  storedPath: string | null | undefined,
): Promise<Buffer | null> {
  if (!storedPath?.trim()) {
    return null;
  }
  if (isR2Configured()) {
    try {
      return await getFileBuffer(storedPath);
    } catch {
      /* 키 없음 등 → 로컬 */
    }
  }
  const abs = localFileAbsolutePath(storedPath);
  if (!existsSync(abs)) {
    return null;
  }
  try {
    return await readFile(abs);
  } catch {
    return null;
  }
}

/** 다운로드용 Node Readable (R2 스트림 또는 로컬 파일). 없으면 null. */
export async function openStoredFileReadStream(
  storedPath: string,
): Promise<NodeJS.ReadableStream | null> {
  if (isR2Configured()) {
    try {
      const body = await getFileStream(storedPath);
      if (body && typeof (body as NodeJS.ReadableStream).pipe === "function") {
        return body as NodeJS.ReadableStream;
      }
    } catch {
      /* 로컬 시도 */
    }
  }
  const abs = localFileAbsolutePath(storedPath);
  if (!existsSync(abs)) {
    return null;
  }
  return createReadStream(abs);
}

export function storedFileStreamToWebBody(stream: NodeJS.ReadableStream): ReadableStream<Uint8Array> {
  return Readable.toWeb(stream as Readable) as ReadableStream<Uint8Array>;
}
