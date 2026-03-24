import {
  AssignmentMode,
  OrderItemStatus,
  OrderSupplierStatus,
  OsEmailStatus,
  OsPdfStatus,
  Role,
} from "@prisma/client";

import type { AuthUser } from "@/lib/auth";
import { env } from "@/lib/env";
import { HttpError } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { sendMail } from "@/server/services/mail-service";
import { persistOrderPoPdfs, poRefForSupplier } from "@/server/services/order-pdf-service";
import { existsPdf, readPdf } from "@/server/services/pdf-storage-service";
import { syncOrderAggregateStatus } from "@/server/services/order-status-sync-service";

export function parseKoreaOpsEmails(): string[] {
  const raw = env.KOREA_OPS_EMAIL?.trim();
  if (!raw) {
    throw new HttpError(500, "KOREA_OPS_EMAIL 환경변수가 설정되어 있지 않습니다.");
  }
  const list = raw
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && s.includes("@"));
  if (list.length === 0) {
    throw new HttpError(500, "KOREA_OPS_EMAIL 형식이 올바르지 않습니다.");
  }
  return list;
}

async function assertBuyerCanAccessOrder(orderId: number, user: AuthUser) {
  const allowed = await prisma.order.findFirst({
    where:
      user.role === Role.COUNTRY_ADMIN
        ? { id: orderId, country_id: user.countryId! }
        : { id: orderId, buyer_id: user.id },
    select: { id: true },
  });
  if (!allowed) {
    throw new HttpError(404, "주문을 찾을 수 없습니다.");
  }
}

async function loadOrderBuyerEmail(orderId: number): Promise<{
  orderNo: string;
  email: string | null;
} | null> {
  const row = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      order_no: true,
      buyer: { select: { email: true } },
    },
  });
  if (!row) {
    return null;
  }
  return {
    orderNo: row.order_no,
    email: row.buyer?.email?.trim() ?? null,
  };
}

/** 주문 생성 파이프라인용: PDF 성공 + PENDING 구간에 자동 발송. */
export async function sendSupplierAutoPoEmail(
  orderSupplierId: number,
  actorId: number,
): Promise<{ success: boolean; errorMessage: string | null; mocked: boolean }> {
  const row = await prisma.orderSupplier.findUnique({
    where: { id: orderSupplierId },
    include: {
      supplier: {
        select: {
          supplier_name: true,
          company_name: true,
          order_email: true,
          contact_email: true,
          cc_email: true,
        },
      },
      order: { select: { id: true, order_no: true, created_at: true } },
    },
  });

  if (!row) {
    throw new HttpError(404, "공급사 주문 구간을 찾을 수 없습니다.");
  }

  if (row.pdf_status !== OsPdfStatus.SUCCESS) {
    await prisma.orderSupplier.update({
      where: { id: orderSupplierId },
      data: {
        email_status: OsEmailStatus.FAILED,
        email_last_error: "PDF가 성공 상태가 아니어서 발송할 수 없습니다.",
      },
    });
    return { success: false, errorMessage: "PDF가 준비되지 않았습니다.", mocked: false };
  }

  const to = row.supplier.order_email?.trim() || row.supplier.contact_email?.trim();
  if (!to) {
    await prisma.orderSupplier.update({
      where: { id: orderSupplierId },
      data: {
        email_status: OsEmailStatus.FAILED,
        email_last_error: "공급사 발주/연락 이메일이 없습니다.",
      },
    });
    return { success: false, errorMessage: "공급사 이메일이 없습니다.", mocked: false };
  }

  if (!row.supplier_po_pdf_path || !existsPdf(row.supplier_po_pdf_path)) {
    await prisma.orderSupplier.update({
      where: { id: orderSupplierId },
      data: {
        email_status: OsEmailStatus.FAILED,
        email_last_error: "저장된 PDF 파일을 찾을 수 없습니다.",
      },
    });
    return { success: false, errorMessage: "PDF 파일을 찾을 수 없습니다.", mocked: false };
  }

  const buffer = await readPdf(row.supplier_po_pdf_path);
  const poRef =
    row.po_snapshot_ref?.trim() ||
    poRefForSupplier(row.order.order_no, row.id, new Date(row.order.created_at));
  const label = row.supplier.company_name?.trim() || row.supplier.supplier_name;
  const subject = `[발주서] ${row.order.order_no} (${label})`;
  const text = [
    `PO 참조: ${poRef}`,
    `주문번호: ${row.order.order_no}`,
    "",
    "첨부 PDF는 주문 생성 시점 품목 스냅샷입니다.",
  ].join("\n");

  const mailResult = await sendMail({
    to,
    cc: row.supplier.cc_email,
    subject,
    text,
    attachments: [
      {
        filename: `${poRef.replace(/[^\w.-]+/g, "_")}.pdf`,
        content: buffer,
        contentType: "application/pdf",
      },
    ],
  });

  await prisma.$transaction(async (tx) => {
    if (mailResult.success) {
      await tx.orderSupplier.update({
        where: { id: orderSupplierId },
        data: {
          status: OrderSupplierStatus.SENT,
          email_status: OsEmailStatus.SENT,
          email_sent_at: new Date(),
          email_sent_to: to,
          email_last_error: null,
          portal_visible: true,
          email_sent: true,
          sent_at: row.sent_at ?? new Date(),
          sent_by: actorId,
        },
      });
      await tx.orderItem.updateMany({
        where: {
          order_id: row.order_id,
          supplier_id: row.supplier_id,
          status: OrderItemStatus.CREATED,
        },
        data: {
          status: OrderItemStatus.ASSIGNED,
          assigned_by: actorId,
          assigned_at: new Date(),
          assignment_mode: AssignmentMode.AUTO_PRODUCT,
        },
      });
    } else {
      await tx.orderSupplier.update({
        where: { id: orderSupplierId },
        data: {
          email_status: OsEmailStatus.FAILED,
          email_last_error: mailResult.errorMessage ?? "메일 발송 실패",
        },
      });
    }
    await syncOrderAggregateStatus(row.order_id, tx);
  });

  return mailResult;
}

async function executeOrderSupplierPoPdfEmailResend(params: {
  orderId: number;
  orderSupplierId: number;
  actorUserId: number;
  assignmentModeForNewItems: AssignmentMode;
}): Promise<{ success: boolean; errorMessage: string | null; mocked: boolean }> {
  await persistOrderPoPdfs(params.orderId);

  const row = await prisma.orderSupplier.findFirst({
    where: {
      id: params.orderSupplierId,
      order_id: params.orderId,
    },
    include: {
      supplier: {
        select: {
          supplier_name: true,
          company_name: true,
          order_email: true,
          contact_email: true,
          cc_email: true,
        },
      },
      order: {
        select: {
          order_no: true,
          created_at: true,
        },
      },
    },
  });

  if (!row) {
    throw new HttpError(404, "공급사 주문 구간을 찾을 수 없습니다.");
  }

  const to = row.supplier.order_email?.trim() || row.supplier.contact_email?.trim();
  if (!to) {
    throw new HttpError(400, "공급사 발주/연락 이메일이 등록되어 있지 않습니다.");
  }

  if (!row.supplier_po_pdf_path) {
    throw new HttpError(500, "저장된 발주서 PDF가 없습니다. 잠시 후 다시 시도해 주세요.");
  }
  if (!existsPdf(row.supplier_po_pdf_path)) {
    throw new HttpError(500, "발주서 PDF 파일을 찾을 수 없습니다.");
  }

  const buffer = await readPdf(row.supplier_po_pdf_path);
  const poRef =
    row.po_snapshot_ref?.trim() ||
    poRefForSupplier(row.order.order_no, row.id, new Date(row.order.created_at));

  const label = row.supplier.company_name?.trim() || row.supplier.supplier_name;
  const subject = `[발주서] ${row.order.order_no} (${label})`;
  const text = [
    `PO 참조: ${poRef}`,
    `주문번호: ${row.order.order_no}`,
    "",
    "첨부 PDF는 주문 생성 시점 품목 스냅샷입니다.",
  ].join("\n");

  const mailResult = await sendMail({
    to,
    cc: row.supplier.cc_email,
    subject,
    text,
    attachments: [
      {
        filename: `${poRef.replace(/[^\w.-]+/g, "_")}.pdf`,
        content: buffer,
        contentType: "application/pdf",
      },
    ],
  });

  await prisma.$transaction(async (tx) => {
    if (mailResult.success) {
      const base = {
        email_status: OsEmailStatus.SENT,
        email_sent_at: new Date(),
        email_sent_to: to,
        email_last_error: null,
      };
      if (row.status === OrderSupplierStatus.PENDING) {
        await tx.orderSupplier.update({
          where: { id: row.id },
          data: {
            ...base,
            status: OrderSupplierStatus.SENT,
            portal_visible: true,
            email_sent: true,
            sent_at: row.sent_at ?? new Date(),
            sent_by: params.actorUserId,
          },
        });
        await tx.orderItem.updateMany({
          where: {
            order_id: params.orderId,
            supplier_id: row.supplier_id,
            status: OrderItemStatus.CREATED,
          },
          data: {
            status: OrderItemStatus.ASSIGNED,
            assigned_by: params.actorUserId,
            assigned_at: new Date(),
            assignment_mode: params.assignmentModeForNewItems,
          },
        });
      } else {
        await tx.orderSupplier.update({
          where: { id: row.id },
          data: base,
        });
      }
    } else {
      await tx.orderSupplier.update({
        where: { id: row.id },
        data: {
          email_status: OsEmailStatus.FAILED,
          email_last_error: mailResult.errorMessage ?? "메일 발송 실패",
        },
      });
    }
    await syncOrderAggregateStatus(params.orderId, tx);
  });

  return mailResult;
}

export async function emailBuyerOrderSupplierPoPdf(params: {
  orderId: number;
  orderSupplierId: number;
  user: AuthUser;
}): Promise<{ success: boolean; errorMessage: string | null; mocked: boolean }> {
  await assertBuyerCanAccessOrder(params.orderId, params.user);
  return executeOrderSupplierPoPdfEmailResend({
    orderId: params.orderId,
    orderSupplierId: params.orderSupplierId,
    actorUserId: params.user.id,
    assignmentModeForNewItems: AssignmentMode.MANUAL,
  });
}

/** 관리자/한국 운영: 바이어와 동일한 본문으로 공급사 발주 PDF 메일 재전송 */
export async function emailStaffOrderSupplierPoPdf(params: {
  orderId: number;
  orderSupplierId: number;
  staffUserId: number;
}): Promise<{ success: boolean; errorMessage: string | null; mocked: boolean }> {
  return executeOrderSupplierPoPdfEmailResend({
    orderId: params.orderId,
    orderSupplierId: params.orderSupplierId,
    actorUserId: params.staffUserId,
    assignmentModeForNewItems: AssignmentMode.MANUAL,
  });
}

export async function emailBuyerOrderCombinedPoPdf(params: {
  orderId: number;
  user: AuthUser;
}): Promise<{ success: boolean; errorMessage: string | null; mocked: boolean }> {
  await assertBuyerCanAccessOrder(params.orderId, params.user);

  const opsTo = parseKoreaOpsEmails();

  await persistOrderPoPdfs(params.orderId);

  const order = await prisma.order.findUnique({
    where: { id: params.orderId },
    select: {
      order_no: true,
      combined_po_pdf_path: true,
    },
  });
  if (!order) {
    throw new HttpError(404, "주문을 찾을 수 없습니다.");
  }
  if (!order.combined_po_pdf_path) {
    throw new HttpError(500, "저장된 통합 발주서 PDF가 없습니다.");
  }
  if (!existsPdf(order.combined_po_pdf_path)) {
    throw new HttpError(500, "통합 발주서 PDF 파일을 찾을 수 없습니다.");
  }

  const buffer = await readPdf(order.combined_po_pdf_path);
  const safeFile = order.order_no.replace(/[^\w.-]+/g, "_");
  const subject = `[통합 발주서] ${order.order_no}`;
  const text = [
    `주문번호: ${order.order_no}`,
    "",
    "첨부 PDF는 주문 생성 시점 품목 스냅샷(통합)입니다.",
  ].join("\n");

  return sendMail({
    to: opsTo,
    subject,
    text,
    attachments: [
      {
        filename: `PO_${safeFile}_ALL.pdf`,
        content: buffer,
        contentType: "application/pdf",
      },
    ],
  });
}

export async function sendBuyerOrderConfirmedEmail(
  orderId: number,
  supplierLabel: string,
): Promise<void> {
  const ctx = await loadOrderBuyerEmail(orderId);
  if (!ctx?.email) {
    return;
  }
  await sendMail({
    to: ctx.email,
    subject: `[발주 수락] ${ctx.orderNo}`,
    text: [
      `주문번호: ${ctx.orderNo}`,
      `${supplierLabel} 공급사가 발주를 수락했습니다.`,
    ].join("\n"),
  });
}

export async function sendBuyerOrderRejectedEmail(
  orderId: number,
  supplierLabel: string,
  reason?: string | null,
): Promise<void> {
  const ctx = await loadOrderBuyerEmail(orderId);
  if (!ctx?.email) {
    return;
  }
  await sendMail({
    to: ctx.email,
    subject: `[발주 거절] ${ctx.orderNo}`,
    text: [
      `주문번호: ${ctx.orderNo}`,
      `${supplierLabel} 공급사가 발주를 거절했습니다.`,
      reason ? `사유: ${reason}` : "",
    ]
      .filter(Boolean)
      .join("\n"),
  });
}

export async function sendBuyerShippingStartedEmail(
  orderId: number,
  supplierLabel: string,
  trackingNumber?: string | null,
): Promise<void> {
  const ctx = await loadOrderBuyerEmail(orderId);
  if (!ctx?.email) {
    return;
  }
  await sendMail({
    to: ctx.email,
    subject: `[배송 시작] ${ctx.orderNo}`,
    text: [
      `주문번호: ${ctx.orderNo}`,
      `${supplierLabel} 공급사 구간 배송이 시작되었습니다.`,
      trackingNumber ? `운송장: ${trackingNumber}` : "",
    ]
      .filter(Boolean)
      .join("\n"),
  });
}

export async function sendBuyerOrderCompletedEmail(
  orderId: number,
  supplierLabel: string,
): Promise<void> {
  const ctx = await loadOrderBuyerEmail(orderId);
  if (!ctx?.email) {
    return;
  }
  await sendMail({
    to: ctx.email,
    subject: `[거래 완료] ${ctx.orderNo}`,
    text: [
      `주문번호: ${ctx.orderNo}`,
      `${supplierLabel} 공급사 구간이 완료 처리되었습니다.`,
    ].join("\n"),
  });
}
