import { AssignmentMode } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { sendMail } from "@/server/services/mail-service";
import { AssignmentSettings } from "@/server/services/assignment-settings-service";

type AssignmentNotificationInput = {
  orderId: number;
  orderNo: string;
  supplier: {
    id: number;
    supplier_name: string;
    order_email: string;
    cc_email: string | null;
  };
  mode: AssignmentMode;
  settings: AssignmentSettings;
};

function buildMessage(input: AssignmentNotificationInput) {
  const modeLabel =
    input.mode === AssignmentMode.MANUAL
      ? "수동"
      : input.mode === AssignmentMode.AUTO_PRODUCT
        ? "자동(상품 기준)"
        : "자동(타임아웃)";
  const subject = `[주문 배정 알림] ${input.orderNo}`;
  const text = `주문 ${input.orderNo} 품목이 ${modeLabel} 방식으로 ${input.supplier.supplier_name}에 배정되었습니다. 포털에서 주문을 확인해 주세요.`;
  return { subject, text };
}

export async function notifyOrderAssignment(input: AssignmentNotificationInput) {
  const { subject, text } = buildMessage(input);

  if (input.settings.notifications.email) {
    try {
      const mailResult = await sendMail({
        to: input.supplier.order_email,
        cc: input.supplier.cc_email,
        subject,
        text,
      });

      await prisma.emailLog.create({
        data: {
          related_type: "ORDER",
          related_id: input.orderId,
          supplier_id: input.supplier.id,
          to_email: input.supplier.order_email,
          cc_email: input.supplier.cc_email,
          subject,
          body_preview: text,
          status: mailResult.success ? "SUCCESS" : "FAILED",
          error_message: mailResult.errorMessage,
          sent_at: mailResult.success ? new Date() : null,
        },
      });
    } catch {
      // 알림 실패가 배정 결과를 롤백시키지 않도록 삼킵니다.
    }
  }

  // Future extensions: Slack / SMS / Webhook
  // 설정만 저장하고 실제 전송 어댑터는 추후 채널별 서비스로 분리해 연결합니다.
}
