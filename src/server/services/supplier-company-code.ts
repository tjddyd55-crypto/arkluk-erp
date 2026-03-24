import { randomBytes } from "node:crypto";

import { Prisma } from "@prisma/client";

import { HttpError } from "@/lib/http";

const PREFIX = "sup_";
const RANDOM_HEX_BYTES = 4;

type Tx = Prisma.TransactionClient;

/** sup_ + 8자 hex, DB 내 유일 */
export async function generateUniqueSupplierCompanyCode(tx: Tx): Promise<string> {
  const maxAttempts = 50;
  for (let i = 0; i < maxAttempts; i++) {
    const code = PREFIX + randomBytes(RANDOM_HEX_BYTES).toString("hex");
    const existing = await tx.supplier.findUnique({
      where: { company_code: code },
      select: { id: true },
    });
    if (!existing) return code;
  }
  throw new HttpError(500, "회사코드 자동 생성에 실패했습니다. 다시 시도해 주세요.");
}
