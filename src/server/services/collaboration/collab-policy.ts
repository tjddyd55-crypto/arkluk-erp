/** 협업 프로젝트 파일 용량·presign 만료 (env 미설정 시 기본값) */

const DEFAULT_MAX_BYTES = 52_428_800; // 50MB

function parsePositiveEnv(name: string, fallback: number): number {
  const n = Number(process.env[name]);
  if (!Number.isFinite(n) || n <= 0) {
    return fallback;
  }
  return Math.min(n, 200 * 1024 * 1024);
}

export function getCollabProjectFileMaxBytes(): number {
  return parsePositiveEnv("PROJECT_FILE_MAX_BYTES", DEFAULT_MAX_BYTES);
}

export function getCollabReplyFileMaxBytes(): number {
  return parsePositiveEnv("PROJECT_REPLY_FILE_MAX_BYTES", DEFAULT_MAX_BYTES);
}

export function getCollabPresignPutExpiresSec(): number {
  return parsePositiveEnv("COLLAB_PRESIGN_PUT_EXPIRES", 900);
}

export function getCollabPresignGetExpiresSec(): number {
  return parsePositiveEnv("COLLAB_PRESIGN_GET_EXPIRES", 300);
}

const MAX_ORIGINAL_NAME_LEN = 255;

export function sanitizeOriginalFilename(name: string): string {
  const trimmed = name.trim().replace(/[/\\]/g, "_");
  if (!trimmed) {
    return "file";
  }
  return trimmed.length > MAX_ORIGINAL_NAME_LEN ? trimmed.slice(0, MAX_ORIGINAL_NAME_LEN) : trimmed;
}

export function fileExtFromName(filename: string): string | null {
  const base = filename.trim();
  const dot = base.lastIndexOf(".");
  if (dot <= 0 || dot === base.length - 1) {
    return null;
  }
  const ext = base.slice(dot + 1).toLowerCase();
  return ext.length > 32 ? ext.slice(0, 32) : ext;
}
