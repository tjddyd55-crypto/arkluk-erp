import { PassThrough } from "stream";

import PDFDocument from "pdfkit";
import { OsPdfStatus, Prisma } from "@prisma/client";

import { HttpError } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { existsPdf, readPdf, savePdf } from "@/server/services/pdf-storage-service";

/** 발주서 PDF는 OrderItem 스냅샷만 사용한다 (주문 시점 증거). live Product.name/price 미사용. */

function formatYmd(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** 주문 생성일(created_at) 기준 연도로 PO 참조를 고정한다. */
export function poRefForSupplier(
  orderNo: string,
  orderSupplierId: number,
  orderCreatedAt: Date,
) {
  const year = new Date(orderCreatedAt).getFullYear();
  return `PO-${year}-${orderNo.replace(/^ORD-?/i, "")}-S${orderSupplierId}`;
}

function storageRelPath(...segments: string[]) {
  return segments.join("/");
}

export async function readStoredPdfBuffer(relPath: string | null): Promise<Buffer | null> {
  if (!relPath?.trim()) {
    return null;
  }
  if (!existsPdf(relPath)) {
    return null;
  }
  try {
    return await readPdf(relPath);
  } catch {
    return null;
  }
}

function pdfErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

/**
 * 통합·공급사별 발주서 PDF를 스토리지에 저장하고 DB·pdf_status를 갱신한다.
 * 실패 시 주문은 롤백하지 않고 FAILED·pdf_last_error만 남긴다.
 */
export async function persistOrderPoPdfs(orderId: number): Promise<void> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      order_no: true,
      created_at: true,
      combined_po_pdf_path: true,
    },
  });
  if (!order) {
    return;
  }

  const itemCount = await prisma.orderItem.count({ where: { order_id: orderId } });
  if (itemCount === 0) {
    return;
  }

  const year = new Date(order.created_at).getFullYear();
  const combinedFile = `order-${orderId}-combined.pdf`;
  const combinedRel = storageRelPath("storage", "order-pdfs", String(year), combinedFile);

  try {
    const { buffer } = await generateBuyerOrderCombinedPdfBuffer(orderId);
    const targetRel = order.combined_po_pdf_path ?? combinedRel;
    await savePdf(targetRel, buffer);
    await prisma.order.update({
      where: { id: orderId },
      data: {
        combined_po_pdf_path: targetRel,
        combined_pdf_status: OsPdfStatus.SUCCESS,
        combined_pdf_last_error: null,
        combined_pdf_generated_at: new Date(),
      },
    });
  } catch (error) {
    await prisma.order.update({
      where: { id: orderId },
      data: {
        combined_pdf_status: OsPdfStatus.FAILED,
        combined_pdf_last_error: pdfErrorMessage(error),
      },
    });
  }

  const orderSuppliers = await prisma.orderSupplier.findMany({
    where: { order_id: orderId },
    select: {
      id: true,
      supplier_po_pdf_path: true,
      po_snapshot_ref: true,
    },
  });

  for (const os of orderSuppliers) {
    const poRef = poRefForSupplier(order.order_no, os.id, new Date(order.created_at));
    const sectionFile = `order-${orderId}-supplier-${os.id}.pdf`;
    const sectionRel = storageRelPath("storage", "order-pdfs", String(year), sectionFile);

    try {
      const { buffer } = await generateBuyerOrderSupplierPdfBuffer({
        orderId,
        orderSupplierId: os.id,
      });
      const targetRel = os.supplier_po_pdf_path ?? sectionRel;
      await savePdf(targetRel, buffer);
      await prisma.orderSupplier.update({
        where: { id: os.id },
        data: {
          supplier_po_pdf_path: targetRel,
          po_snapshot_ref: os.po_snapshot_ref ?? poRef,
          pdf_status: OsPdfStatus.SUCCESS,
          pdf_last_error: null,
          pdf_generated_at: new Date(),
        },
      });
    } catch (error) {
      await prisma.orderSupplier.update({
        where: { id: os.id },
        data: {
          pdf_status: OsPdfStatus.FAILED,
          pdf_last_error: pdfErrorMessage(error),
        },
      });
    }
  }
}

/** 관리자/바이어 재생성용: 공급사 구간 PDF만 다시 쓴다. */
export async function regenerateSupplierSectionPdf(orderSupplierId: number): Promise<void> {
  const os = await prisma.orderSupplier.findUnique({
    where: { id: orderSupplierId },
    include: {
      order: { select: { id: true, order_no: true, created_at: true } },
    },
  });
  if (!os) {
    throw new HttpError(404, "공급사 주문 구간을 찾을 수 없습니다.");
  }
  const orderId = os.order_id;
  const year = new Date(os.order.created_at).getFullYear();
  /** 기존 파일을 덮어쓰지 않고 버전 파일로 새로 저장 (증거 보존). */
  const sectionRel = storageRelPath(
    "storage",
    "order-pdfs",
    String(year),
    `order-${orderId}-supplier-${os.id}-${Date.now()}.pdf`,
  );
  const poRef = poRefForSupplier(os.order.order_no, os.id, new Date(os.order.created_at));

  try {
    const { buffer } = await generateBuyerOrderSupplierPdfBuffer({
      orderId,
      orderSupplierId: os.id,
    });
    await savePdf(sectionRel, buffer);
    await prisma.orderSupplier.update({
      where: { id: os.id },
      data: {
        supplier_po_pdf_path: sectionRel,
        po_snapshot_ref: poRef,
        pdf_status: OsPdfStatus.SUCCESS,
        pdf_last_error: null,
        pdf_generated_at: new Date(),
      },
    });
  } catch (error) {
    await prisma.orderSupplier.update({
      where: { id: os.id },
      data: {
        pdf_status: OsPdfStatus.FAILED,
        pdf_last_error: pdfErrorMessage(error),
      },
    });
    throw error;
  }
}

export async function resolveBuyerOrderCombinedPdf(orderId: number): Promise<{
  buffer: Buffer;
  fileName: string;
}> {
  const row = await prisma.order.findUnique({
    where: { id: orderId },
    select: { combined_po_pdf_path: true, order_no: true },
  });
  if (row?.combined_po_pdf_path) {
    const fromDisk = await readStoredPdfBuffer(row.combined_po_pdf_path);
    if (fromDisk) {
      const safeNo = row.order_no.replace(/[^\w.-]+/g, "_");
      return { buffer: fromDisk, fileName: `PO_${safeNo}_ALL.pdf` };
    }
  }
  return generateBuyerOrderCombinedPdfBuffer(orderId);
}

export async function resolveBuyerOrderSupplierPdf(params: {
  orderId: number;
  orderSupplierId: number;
}): Promise<{ buffer: Buffer; fileName: string }> {
  const os = await prisma.orderSupplier.findUnique({
    where: { id: params.orderSupplierId },
    select: { order_id: true, supplier_po_pdf_path: true, supplier_id: true },
  });
  if (!os || os.order_id !== params.orderId) {
    return generateBuyerOrderSupplierPdfBuffer(params);
  }
  if (os.supplier_po_pdf_path) {
    const fromDisk = await readStoredPdfBuffer(os.supplier_po_pdf_path);
    if (fromDisk) {
      const order = await prisma.order.findUnique({
        where: { id: params.orderId },
        select: { order_no: true },
      });
      const safeNo = order?.order_no.replace(/[^\w.-]+/g, "_") ?? String(params.orderId);
      return {
        buffer: fromDisk,
        fileName: `PO_${safeNo}_supplier_${os.supplier_id}.pdf`,
      };
    }
  }
  return generateBuyerOrderSupplierPdfBuffer(params);
}

export async function resolveSupplierOrderPdf(params: {
  orderId: number;
  supplierId: number;
}): Promise<{ buffer: Buffer; fileName: string }> {
  const os = await prisma.orderSupplier.findFirst({
    where: { order_id: params.orderId, supplier_id: params.supplierId },
    select: { id: true },
  });
  if (!os) {
    throw new HttpError(404, "주문을 찾을 수 없습니다.");
  }
  return resolveBuyerOrderSupplierPdf({
    orderId: params.orderId,
    orderSupplierId: os.id,
  });
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
      .fontSize(8)
      .text(values[i] ?? "", x + 3, y + 4, {
        width: widths[i] - 6,
        height: rowHeight - 8,
      });
    x += widths[i];
  }
}

const COL_WIDTHS = [26, 96, 58, 30, 38, 46, 46, 44];

function drawTableHeader(doc: PDFKit.PDFDocument, startY: number, rowHeight: number) {
  drawRow(
    doc,
    ["No", "Product", "Spec", "Unit", "Qty", "Price", "Amt", "Note"],
    COL_WIDTHS,
    startY,
    rowHeight,
  );
  return startY + rowHeight;
}

function drawItemRows(
  doc: PDFKit.PDFDocument,
  items: Array<{
    product_name_snapshot: string;
    spec_snapshot: string;
    unit_snapshot: string;
    qty: Prisma.Decimal;
    price_snapshot: Prisma.Decimal;
    amount: Prisma.Decimal;
    memo: string | null;
  }>,
  startY: number,
  rowHeight: number,
): number {
  let y = startY;
  items.forEach((item, idx) => {
    if (y + rowHeight > doc.page.height - 72) {
      doc.addPage();
      y = 50;
      y = drawTableHeader(doc, y, rowHeight);
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
        item.amount.toString(),
        item.memo ?? "",
      ],
      COL_WIDTHS,
      y,
      rowHeight,
    );
    y += rowHeight;
  });
  return y;
}

function docToBuffer(doc: InstanceType<typeof PDFDocument>): Promise<Buffer> {
  const pass = new PassThrough();
  const chunks: Buffer[] = [];
  pass.on("data", (c: Buffer) => chunks.push(c));
  doc.pipe(pass);
  return new Promise((resolve, reject) => {
    pass.on("end", () => resolve(Buffer.concat(chunks)));
    pass.on("error", reject);
    doc.on("error", reject);
    doc.end();
  });
}

export async function generateBuyerOrderSupplierPdfBuffer(params: {
  orderId: number;
  orderSupplierId: number;
}): Promise<{ buffer: Buffer; fileName: string }> {
  const os = await prisma.orderSupplier.findUnique({
    where: { id: params.orderSupplierId },
    include: {
      supplier: true,
      order: {
        include: {
          buyer: { select: { name: true, email: true } },
          country: { select: { country_name: true } },
        },
      },
    },
  });

  if (!os || os.order_id !== params.orderId) {
    throw new HttpError(404, "공급사 주문 구간을 찾을 수 없습니다.");
  }

  const items = await prisma.orderItem.findMany({
    where: { order_id: params.orderId, supplier_id: os.supplier_id },
    orderBy: [{ id: "asc" }],
  });

  if (items.length === 0) {
    throw new HttpError(400, "발주서에 포함할 품목이 없습니다.");
  }

  const doc = new PDFDocument({ size: "A4", margin: 40 });
  const poRef =
    os.po_snapshot_ref?.trim() ||
    poRefForSupplier(os.order.order_no, os.id, new Date(os.order.created_at));
  const rowHeight = 32;

  doc.fontSize(18).text("Purchase Order / 발주서", { align: "center" });
  doc.moveDown(0.5);
  doc.fontSize(10);
  doc.text(`PO Ref: ${poRef}`);
  doc.text(`Order No: ${os.order.order_no}`);
  doc.text(`Date: ${formatYmd(new Date(os.order.created_at))}`);
  doc.moveDown(0.3);
  doc.text(`Buyer: ${os.order.buyer.name}`);
  if (os.order.buyer.email) doc.text(`Buyer email: ${os.order.buyer.email}`);
  doc.text(`Country: ${os.order.country.country_name}`);
  doc.moveDown(0.3);
  doc.text(`Supplier: ${os.supplier.company_name || os.supplier.supplier_name}`);
  if (os.supplier.contact_email) doc.text(`Supplier email: ${os.supplier.contact_email}`);
  if (os.supplier.contact_phone) doc.text(`Supplier phone: ${os.supplier.contact_phone}`);
  doc.moveDown(0.5);
  if (os.order.memo) {
    doc.fontSize(9).fillColor("#333").text(`Memo: ${os.order.memo}`);
    doc.fillColor("#000");
    doc.moveDown(0.3);
  }

  let y = doc.y;
  y = drawTableHeader(doc, y, rowHeight);
  y = drawItemRows(doc, items, y, rowHeight);

  const subtotal = items.reduce((s, it) => s.add(it.amount), new Prisma.Decimal(0));
  doc.fontSize(11).text(`Subtotal: ${subtotal.toString()}`, 40, y + 8, { align: "right", width: 515 });

  const buffer = await docToBuffer(doc);
  const safeNo = os.order.order_no.replace(/[^\w.-]+/g, "_");
  return {
    buffer,
    fileName: `PO_${safeNo}_supplier_${os.supplier_id}.pdf`,
  };
}

export async function generateBuyerOrderCombinedPdfBuffer(orderId: number): Promise<{
  buffer: Buffer;
  fileName: string;
}> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      buyer: { select: { name: true, email: true } },
      country: { select: { country_name: true } },
      order_items: {
        orderBy: [{ supplier_id: "asc" }, { id: "asc" }],
        include: {
          supplier: { select: { supplier_name: true, company_name: true } },
        },
      },
    },
  });

  if (!order) {
    throw new HttpError(404, "주문을 찾을 수 없습니다.");
  }
  if (order.order_items.length === 0) {
    throw new HttpError(400, "발주서에 포함할 품목이 없습니다.");
  }

  const doc = new PDFDocument({ size: "A4", margin: 40 });
  const rowHeight = 32;

  doc.fontSize(18).text("Consolidated Purchase Order / 통합 발주서", { align: "center" });
  doc.moveDown(0.5);
  doc.fontSize(10);
  doc.text(`Order No: ${order.order_no}`);
  doc.text(`Date: ${formatYmd(new Date(order.created_at))}`);
  doc.text(`Buyer: ${order.buyer.name}`);
  if (order.buyer.email) doc.text(`Buyer email: ${order.buyer.email}`);
  doc.text(`Country: ${order.country.country_name}`);
  doc.moveDown(0.3);
  if (order.memo) {
    doc.fontSize(9).fillColor("#333").text(`Memo: ${order.memo}`);
    doc.fillColor("#000");
    doc.moveDown(0.3);
  }

  const bySupplier = new Map<
    number,
    { label: string; items: typeof order.order_items }
  >();
  for (const line of order.order_items) {
    const label = line.supplier.company_name?.trim() || line.supplier.supplier_name;
    if (!bySupplier.has(line.supplier_id)) {
      bySupplier.set(line.supplier_id, { label, items: [] });
    }
    bySupplier.get(line.supplier_id)!.items.push(line);
  }

  let y = doc.y;
  let grand = new Prisma.Decimal(0);

  for (const { label, items } of bySupplier.values()) {
    if (y > doc.page.height - 120) {
      doc.addPage();
      y = 50;
    }
    doc.fontSize(12).text(`Supplier: ${label}`, 40, y);
    y = doc.y + 6;
    y = drawTableHeader(doc, y, rowHeight);
    y = drawItemRows(doc, items, y, rowHeight);
    const sub = items.reduce((s, it) => s.add(it.amount), new Prisma.Decimal(0));
    grand = grand.add(sub);
    doc.fontSize(10).text(`Section subtotal: ${sub.toString()}`, 40, y + 4, {
      align: "right",
      width: 515,
    });
    y = doc.y + 16;
  }

  doc.fontSize(12).text(`Grand total: ${grand.toString()}`, 40, y + 4, {
    align: "right",
    width: 515,
  });

  const buffer = await docToBuffer(doc);
  const safeNo = order.order_no.replace(/[^\w.-]+/g, "_");
  return { buffer, fileName: `PO_${safeNo}_ALL.pdf` };
}

export async function generateSupplierOrderPdfBuffer(params: {
  orderId: number;
  supplierId: number;
}): Promise<{ buffer: Buffer; fileName: string }> {
  const os = await prisma.orderSupplier.findFirst({
    where: { order_id: params.orderId, supplier_id: params.supplierId },
  });
  if (!os) {
    throw new HttpError(404, "주문을 찾을 수 없습니다.");
  }
  return generateBuyerOrderSupplierPdfBuffer({
    orderId: params.orderId,
    orderSupplierId: os.id,
  });
}
