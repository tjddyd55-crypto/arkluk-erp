import {
  AssignmentMode,
  OrderItemStatus,
  OrderSupplierStatus,
  OsEmailStatus,
  OsPdfStatus,
} from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { persistOrderPoPdfs } from "@/server/services/order-pdf-service";
import { sendSupplierAutoPoEmail } from "@/server/services/order-po-email-service";

/**
 * 주문 생성/품목 변경 후: PDF 저장 → PDF 성공 구간에 대해 자동 발주 메일 시도.
 * 메일 실패는 OrderSupplier.email_status=FAILED 로 남기며 주문은 유지한다.
 */
export async function runPostOrderPoAndEmailPipeline(
  orderId: number,
  actorId: number,
): Promise<void> {
  await persistOrderPoPdfs(orderId);

  const rows = await prisma.orderSupplier.findMany({
    where: { order_id: orderId },
    select: { id: true, pdf_status: true, email_status: true, status: true },
  });

  for (const r of rows) {
    if (
      r.pdf_status !== OsPdfStatus.SUCCESS ||
      r.email_status !== OsEmailStatus.PENDING ||
      r.status !== OrderSupplierStatus.PENDING
    ) {
      continue;
    }
    try {
      await sendSupplierAutoPoEmail(r.id, actorId);
    } catch (err) {
      console.error("[sendSupplierAutoPoEmail]", r.id, err);
      await prisma.orderSupplier
        .update({
          where: { id: r.id },
          data: {
            email_status: OsEmailStatus.FAILED,
            email_last_error:
              err instanceof Error ? err.message : "자동 발주 메일 처리 오류",
          },
        })
        .catch(() => undefined);
    }
  }
}
