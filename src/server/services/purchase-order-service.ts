import { createWriteStream } from "fs";
import { mkdir } from "fs/promises";
import path from "path";

import PDFDocument from "pdfkit";
import { Prisma } from "@prisma/client";

import { env } from "@/lib/env";
import { HttpError } from "@/lib/http";
import { prisma } from "@/lib/prisma";

const PURCHASE_ORDER_DIR = path.join(process.cwd(), "storage", "purchase-orders");

type PurchaseOrderFileInfo = {
  filePath: string;
  fileName: string;
  fileUrl: string;
};

type ResolvedTemplate = {
  titleKo: string;
  titleEn: string;
  buyerName: string;
  footerNote: string | null;
};

function formatYmd(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function drawRow(
  doc: PDFKit.PDFDocument,
  values: string[],
  widths: number[],
  y: number,
  rowHeight: number,
) {
  let x = 40;
  for (let i = 0; i < values.length; i += 1) {
    doc.rect(x, y, widths[i], rowHeight).stroke();
    doc
      .fontSize(9)
      .text(values[i] ?? "", x + 4, y + 4, {
        width: widths[i] - 8,
        height: rowHeight - 8,
      });
    x += widths[i];
  }
}

async function resolvePurchaseOrderTemplate(supplierId: number): Promise<ResolvedTemplate> {
  const supplierTemplate = await prisma.purchaseOrderTemplate.findFirst({
    where: {
      supplier_id: supplierId,
      is_active: true,
    },
    orderBy: [{ updated_at: "desc" }],
  });
  if (supplierTemplate) {
    return {
      titleKo: supplierTemplate.title_ko,
      titleEn: supplierTemplate.title_en,
      buyerName: supplierTemplate.buyer_name ?? env.OUR_COMPANY_NAME ?? "우리 회사명",
      footerNote: supplierTemplate.footer_note ?? null,
    };
  }

  const defaultTemplate = await prisma.purchaseOrderTemplate.findFirst({
    where: {
      is_default: true,
      is_active: true,
    },
    orderBy: [{ updated_at: "desc" }],
  });
  if (defaultTemplate) {
    return {
      titleKo: defaultTemplate.title_ko,
      titleEn: defaultTemplate.title_en,
      buyerName: defaultTemplate.buyer_name ?? env.OUR_COMPANY_NAME ?? "우리 회사명",
      footerNote: defaultTemplate.footer_note ?? null,
    };
  }

  return {
    titleKo: "발주서",
    titleEn: "Purchase Order",
    buyerName: env.OUR_COMPANY_NAME ?? "우리 회사명",
    footerNote: null,
  };
}

export async function generatePurchaseOrderPDF(
  orderId: number,
  supplierId: number,
): Promise<PurchaseOrderFileInfo> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      buyer: true,
      order_items: {
        where: { supplier_id: supplierId },
        orderBy: [{ id: "asc" }],
      },
      suppliers: {
        where: { supplier_id: supplierId },
        include: { supplier: true },
      },
    },
  });

  if (!order) {
    throw new HttpError(404, "주문을 찾을 수 없습니다.");
  }
  if (order.order_items.length === 0) {
    throw new HttpError(400, "발주서를 생성할 공급사 주문 품목이 없습니다.");
  }

  const supplier = order.suppliers[0]?.supplier;
  if (!supplier) {
    throw new HttpError(404, "공급사 정보를 찾을 수 없습니다.");
  }

  await mkdir(PURCHASE_ORDER_DIR, { recursive: true });
  const template = await resolvePurchaseOrderTemplate(supplierId);

  const fileName = `PO_${supplierId}_${order.order_no}.pdf`;
  const filePath = path.join(PURCHASE_ORDER_DIR, fileName);
  const fileUrl = path.join("storage", "purchase-orders", fileName).replaceAll("\\", "/");

  await new Promise<void>((resolve, reject) => {
    const doc = new PDFDocument({
      size: "A4",
      margin: 40,
    });
    const stream = createWriteStream(filePath);

    doc.pipe(stream);

    doc.fontSize(20).text(template.titleEn, { align: "center" });
    doc.moveDown(0.3);
    doc.fontSize(14).text(template.titleKo, { align: "center" });
    doc.moveDown(1);

    doc.fontSize(11).text(`발주번호: ${order.order_no}`);
    doc.text(`발주일: ${formatYmd(new Date())}`);
    doc.text(`공급사: ${supplier.supplier_name}`);
    doc.text(`발주처: ${template.buyerName}`);
    doc.moveDown(1);

    const columnWidths = [35, 130, 95, 55, 55, 65, 85];
    const rowHeight = 34;
    let y = doc.y;

    drawRow(
      doc,
      ["No", "제품명", "규격", "단위", "수량", "단가", "비고"],
      columnWidths,
      y,
      rowHeight,
    );
    y += rowHeight;

    order.order_items.forEach((item, idx) => {
      if (y + rowHeight > doc.page.height - 60) {
        doc.addPage();
        y = 60;
        drawRow(
          doc,
          ["No", "제품명", "규격", "단위", "수량", "단가", "비고"],
          columnWidths,
          y,
          rowHeight,
        );
        y += rowHeight;
      }

      drawRow(
        doc,
        [
          String(idx + 1),
          item.product_name_snapshot,
          item.spec_snapshot,
          item.unit_snapshot,
          item.qty.toString(),
          item.price_snapshot.toString(),
          item.memo ?? "",
        ],
        columnWidths,
        y,
        rowHeight,
      );
      y += rowHeight;
    });

    const totalAmount = order.order_items.reduce(
      (sum, item) => sum.add(item.amount),
      new Prisma.Decimal(0),
    );
    doc.moveDown(2);
    doc.fontSize(11).text(`합계 금액: ${totalAmount.toString()}`, { align: "right" });
    if (template.footerNote) {
      doc.moveDown(1);
      doc.fontSize(9).fillColor("#666").text(template.footerNote, { align: "left" });
      doc.fillColor("#000");
    }

    doc.end();

    stream.on("finish", () => resolve());
    stream.on("error", (error) => reject(error));
  });

  return { filePath, fileName, fileUrl };
}

export async function upsertPurchaseOrderRecord(
  params: {
    orderId: number;
    supplierId: number;
    fileName: string;
    fileUrl: string;
    createdBy: number;
  },
  tx: Prisma.TransactionClient | typeof prisma = prisma,
) {
  const existing = await tx.purchaseOrder.findUnique({
    where: {
      order_id_supplier_id: {
        order_id: params.orderId,
        supplier_id: params.supplierId,
      },
    },
  });

  if (existing) {
    return tx.purchaseOrder.update({
      where: { id: existing.id },
      data: {
        file_name: params.fileName,
        file_url: params.fileUrl,
        created_by: params.createdBy,
        created_at: new Date(),
      },
    });
  }

  return tx.purchaseOrder.create({
    data: {
      order_id: params.orderId,
      supplier_id: params.supplierId,
      file_name: params.fileName,
      file_url: params.fileUrl,
      created_by: params.createdBy,
    },
  });
}
