import { Prisma, QuoteCreatorRole, QuoteStatus, Role } from "@prisma/client";

import { HttpError } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { buildDocumentNo } from "@/lib/utils";
import { createAuditLog } from "@/server/services/audit-log";

type QuoteActor = {
  id: number;
  role: Role;
  supplierId: number | null;
};

type CreateQuoteInput = {
  buyerId: number;
  countryId: number;
  projectId?: number | null;
  supplierId?: number | null;
  memo?: string | null;
  items: Array<{ productId: number; qty: number }>;
};

function calcAmount(price: Prisma.Decimal, qty: number) {
  return price.mul(new Prisma.Decimal(qty));
}

export async function createQuote(actor: QuoteActor, input: CreateQuoteInput) {
  const buyer = await prisma.user.findUnique({
    where: { id: input.buyerId },
    select: { id: true, role: true, country_id: true, is_active: true, email: true },
  });

  if (!buyer || !buyer.is_active || buyer.role !== Role.BUYER) {
    throw new HttpError(400, "견적 대상 바이어가 유효하지 않습니다.");
  }

  if (buyer.country_id !== input.countryId) {
    throw new HttpError(400, "바이어 국가와 견적 국가가 일치하지 않습니다.");
  }

  const productIds = [...new Set(input.items.map((item) => item.productId))];
  const products = await prisma.product.findMany({
    where: { id: { in: productIds }, is_active: true },
  });
  if (products.length !== productIds.length) {
    throw new HttpError(400, "견적 대상 상품 중 유효하지 않은 항목이 있습니다.");
  }
  const productMap = new Map(products.map((product) => [product.id, product]));

  if (actor.role === Role.SUPPLIER) {
    if (!actor.supplierId) {
      throw new HttpError(403, "공급사 계정에 supplier_id가 없습니다.");
    }
    const invalidProduct = products.find((product) => product.supplier_id !== actor.supplierId);
    if (invalidProduct) {
      throw new HttpError(403, "공급사는 자기 상품으로만 견적할 수 있습니다.");
    }
  }

  const quoteNo = buildDocumentNo("QTE");
  const creatorRole = actor.role === Role.SUPPLIER ? QuoteCreatorRole.SUPPLIER : QuoteCreatorRole.ADMIN;
  const supplierIds = new Set<number>();

  return prisma.$transaction(async (tx) => {
    const quote = await tx.quote.create({
      data: {
        quote_no: quoteNo,
        buyer_id: input.buyerId,
        country_id: input.countryId,
        project_id: input.projectId ?? null,
        created_by: actor.id,
        creator_role: creatorRole,
        supplier_id: creatorRole === QuoteCreatorRole.SUPPLIER ? actor.supplierId : input.supplierId ?? null,
        status: QuoteStatus.DRAFT,
        memo: input.memo ?? null,
      },
    });

    for (const item of input.items) {
      const product = productMap.get(item.productId);
      if (!product) {
        throw new HttpError(400, "상품을 찾을 수 없습니다.");
      }
      supplierIds.add(product.supplier_id);

      await tx.quoteItem.create({
        data: {
          quote_id: quote.id,
          supplier_id: product.supplier_id,
          category_id: product.category_id,
          product_id: product.id,
          product_code_snapshot: product.product_code,
          product_name_snapshot: product.product_name,
          spec_snapshot: product.spec,
          unit_snapshot: product.unit,
          price_snapshot: product.price,
          qty: new Prisma.Decimal(item.qty),
          amount: calcAmount(product.price, item.qty),
        },
      });
    }

    await createAuditLog(
      {
        actorId: actor.id,
        actionType: "CREATE_QUOTE",
        targetType: "QUOTE",
        targetId: quote.id,
        afterData: {
          quoteNo: quote.quote_no,
          supplierCount: supplierIds.size,
          itemCount: input.items.length,
        },
      },
      tx,
    );

    return quote;
  });
}

export async function sendQuote(quoteId: number, actorId: number) {
  return prisma.$transaction(async (tx) => {
    const quote = await tx.quote.findUnique({
      where: { id: quoteId },
      include: {
        buyer: true,
      },
    });
    if (!quote) {
      throw new HttpError(404, "견적을 찾을 수 없습니다.");
    }
    if (quote.status === QuoteStatus.ACCEPTED || quote.status === QuoteStatus.REJECTED) {
      throw new HttpError(400, "종료된 견적은 발송할 수 없습니다.");
    }

    const updated = await tx.quote.update({
      where: { id: quoteId },
      data: { status: QuoteStatus.SENT },
    });

    if (quote.buyer.email) {
      await tx.emailLog.create({
        data: {
          related_type: "QUOTE",
          related_id: quoteId,
          supplier_id: quote.supplier_id,
          to_email: quote.buyer.email,
          subject: `[ARKLUK] 견적 발송 - ${quote.quote_no}`,
          body_preview: "새 견적이 발송되었습니다.",
          status: "SUCCESS",
          sent_at: new Date(),
        },
      });
    }

    await createAuditLog(
      {
        actorId,
        actionType: "SEND_QUOTE",
        targetType: "QUOTE",
        targetId: quoteId,
        beforeData: { status: quote.status },
        afterData: { status: updated.status },
      },
      tx,
    );
  });
}

export async function markQuoteViewed(quoteId: number, buyerId: number) {
  const quote = await prisma.quote.findUnique({ where: { id: quoteId } });
  if (!quote || quote.buyer_id !== buyerId) {
    throw new HttpError(404, "견적을 찾을 수 없습니다.");
  }
  if (quote.status === QuoteStatus.SENT) {
    await prisma.quote.update({
      where: { id: quoteId },
      data: { status: QuoteStatus.VIEWED },
    });
  }
}

export async function rejectQuote(quoteId: number, buyerId: number) {
  return prisma.$transaction(async (tx) => {
    const quote = await tx.quote.findUnique({ where: { id: quoteId } });
    if (!quote || quote.buyer_id !== buyerId) {
      throw new HttpError(404, "견적을 찾을 수 없습니다.");
    }
    if (quote.status === QuoteStatus.ACCEPTED) {
      throw new HttpError(400, "이미 승인된 견적은 거절할 수 없습니다.");
    }

    await tx.quote.update({
      where: { id: quoteId },
      data: { status: QuoteStatus.REJECTED },
    });
    await createAuditLog(
      {
        actorId: buyerId,
        actionType: "REJECT_QUOTE",
        targetType: "QUOTE",
        targetId: quoteId,
      },
      tx,
    );
  });
}

export async function acceptQuote(quoteId: number, buyerId: number) {
  return prisma.$transaction(async (tx) => {
    const quote = await tx.quote.findUnique({
      where: { id: quoteId },
      include: {
        quote_items: true,
        buyer: true,
      },
    });
    if (!quote || quote.buyer_id !== buyerId) {
      throw new HttpError(404, "견적을 찾을 수 없습니다.");
    }
    if (quote.status === QuoteStatus.ACCEPTED) {
      throw new HttpError(400, "이미 승인된 견적입니다.");
    }
    if (quote.status === QuoteStatus.REJECTED) {
      throw new HttpError(400, "거절된 견적은 승인할 수 없습니다.");
    }

    const order = await tx.order.create({
      data: {
        order_no: buildDocumentNo("ORD"),
        buyer_id: quote.buyer_id,
        country_id: quote.country_id,
        project_id: quote.project_id,
        memo: `견적(${quote.quote_no}) 전환 주문`,
        status: "PENDING",
      },
    });

    for (const item of quote.quote_items) {
      await tx.orderItem.create({
        data: {
          order_id: order.id,
          supplier_id: item.supplier_id,
          category_id: item.category_id,
          product_id: item.product_id,
          product_code_snapshot: item.product_code_snapshot,
          product_name_snapshot: item.product_name_snapshot,
          spec_snapshot: item.spec_snapshot,
          unit_snapshot: item.unit_snapshot,
          price_snapshot: item.price_snapshot,
          qty: item.qty,
          amount: item.amount,
        },
      });
    }

    const supplierIds = [...new Set(quote.quote_items.map((item) => item.supplier_id))];
    await tx.orderSupplier.createMany({
      data: supplierIds.map((supplierId) => ({
        order_id: order.id,
        supplier_id: supplierId,
        status: "WAITING",
      })),
      skipDuplicates: true,
    });

    await tx.quote.update({
      where: { id: quoteId },
      data: { status: QuoteStatus.ACCEPTED },
    });

    await createAuditLog(
      {
        actorId: buyerId,
        actionType: "ACCEPT_QUOTE",
        targetType: "QUOTE",
        targetId: quoteId,
        afterData: { orderId: order.id, orderNo: order.order_no },
      },
      tx,
    );

    return order;
  });
}
