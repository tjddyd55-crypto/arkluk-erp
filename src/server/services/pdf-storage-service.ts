import { existsSync } from "fs";
import { mkdir, readFile, unlink, writeFile } from "fs/promises";
import path from "path";

/** 로컬 디스크 구현. 이후 R2/S3는 이 모듈만 교체하면 된다. */

function absFromRel(rel: string) {
  const normalized = rel.replace(/\//g, path.sep);
  return path.join(process.cwd(), normalized);
}

export async function savePdf(relPath: string, buffer: Buffer): Promise<void> {
  const abs = absFromRel(relPath);
  await mkdir(path.dirname(abs), { recursive: true });
  await writeFile(abs, buffer);
}

export async function readPdf(relPath: string): Promise<Buffer> {
  return readFile(absFromRel(relPath));
}

export function existsPdf(relPath: string): boolean {
  return existsSync(absFromRel(relPath));
}

export async function deletePdf(relPath: string): Promise<void> {
  if (!existsPdf(relPath)) {
    return;
  }
  await unlink(absFromRel(relPath));
}
