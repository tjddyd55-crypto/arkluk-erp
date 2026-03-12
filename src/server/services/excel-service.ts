import * as XLSX from "xlsx";
import { Prisma } from "@prisma/client";

import { HttpError } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { createAuditLog } from "@/server/services/audit-log";

const PRODUCT_TEMPLATE_COLUMNS = [
  "공급사",
  "카테고리",
  "상품코드",
  "상품명",
  "규격",
  "단위",
  "가격",
  "메모",
];

const ORDER_TEMPLATE_COLUMNS = [
  "상품코드",
  "카테고리",
  "상품명",
  "규격",
  "단위",
  "주문수량",
  "메모",
];

type ProductExcelRow = {
  supplierName?: string;
  categoryName?: string;
  productCode?: string;
  productName?: string;
  spec?: string;
  unit?: string;
  price?: number;
  memo?: string;
};

export function buildProductExcel(products: Array<Record<string, unknown>>) {
  const worksheet = XLSX.utils.json_to_sheet(products, {
    header: PRODUCT_TEMPLATE_COLUMNS,
  });
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "products");
  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
}

function parseProductRows(buffer: Buffer) {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const firstSheetName = workbook.SheetNames[0];
  const firstSheet = workbook.Sheets[firstSheetName];
  if (!firstSheet) {
    throw new HttpError(400, "엑셀 시트를 읽을 수 없습니다.");
  }

  return XLSX.utils.sheet_to_json(firstSheet).map((row) => {
    const data = row as Record<string, string | number | undefined>;
    return {
      supplierName: String(data["공급사"] ?? "").trim(),
      categoryName: String(data["카테고리"] ?? "").trim(),
      productCode: String(data["상품코드"] ?? "").trim(),
      productName: String(data["상품명"] ?? "").trim(),
      spec: String(data["규격"] ?? "").trim(),
      unit: String(data["단위"] ?? "").trim(),
      price: Number(data["가격"] ?? 0),
      memo: String(data["메모"] ?? "").trim(),
    } as ProductExcelRow;
  });
}

export async function upsertProductsFromExcel(actorId: number, buffer: Buffer) {
  const rows = parseProductRows(buffer);
  if (rows.length === 0) {
    throw new HttpError(400, "업로드할 데이터가 없습니다.");
  }

  const errors: string[] = [];
  let created = 0;
  let updated = 0;

  await prisma.$transaction(async (tx) => {
    for (const [index, row] of rows.entries()) {
      const rowNo = index + 2;
      if (
        !row.supplierName ||
        !row.categoryName ||
        !row.productCode ||
        !row.productName ||
        !row.spec ||
        !row.unit ||
        !row.price
      ) {
        errors.push(`${rowNo}행: 필수 값 누락`);
        continue;
      }

      const supplier = await tx.supplier.findFirst({
        where: { supplier_name: row.supplierName },
      });
      if (!supplier) {
        errors.push(`${rowNo}행: 공급사 없음 (${row.supplierName})`);
        continue;
      }

      const category = await tx.category.findFirst({
        where: {
          supplier_id: supplier.id,
          category_name: row.categoryName,
          is_active: true,
        },
      });
      if (!category) {
        errors.push(`${rowNo}행: 카테고리 없음 (${row.categoryName})`);
        continue;
      }

      const existing = await tx.product.findUnique({
        where: {
          supplier_id_product_code: {
            supplier_id: supplier.id,
            product_code: row.productCode,
          },
        },
      });

      const payload = {
        supplier_id: supplier.id,
        category_id: category.id,
        product_code: row.productCode,
        product_name: row.productName,
        spec: row.spec,
        unit: row.unit,
        price: new Prisma.Decimal(row.price),
        memo: row.memo || null,
        is_active: true,
      };

      if (!existing) {
        await tx.product.create({ data: payload });
        created += 1;
      } else {
        await tx.product.update({
          where: { id: existing.id },
          data: payload,
        });
        updated += 1;
      }
    }

    await createAuditLog(
      {
        actorId,
        actionType: "UPLOAD_PRODUCT_EXCEL",
        targetType: "PRODUCT",
        targetId: 0,
        afterData: { created, updated, errors: errors.length },
      },
      tx,
    );
  });

  return {
    created,
    updated,
    errors,
  };
}

export async function buildOrderTemplateBySupplier(supplierId: number) {
  const products = await prisma.product.findMany({
    where: {
      supplier_id: supplierId,
      is_active: true,
    },
    include: { category: true },
    orderBy: [{ category: { sort_order: "asc" } }, { sort_order: "asc" }],
  });

  const rows = products.map((product) => ({
    상품코드: product.product_code,
    카테고리: product.category.category_name,
    상품명: product.product_name,
    규격: product.spec,
    단위: product.unit,
    주문수량: "",
    메모: "",
  }));

  const worksheet = XLSX.utils.json_to_sheet(rows, {
    header: ORDER_TEMPLATE_COLUMNS,
  });
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "order_template");
  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
}

export async function parseBuyerOrderExcel(supplierId: number, buffer: Buffer) {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const firstSheetName = workbook.SheetNames[0];
  const firstSheet = workbook.Sheets[firstSheetName];
  if (!firstSheet) {
    throw new HttpError(400, "엑셀 시트를 읽을 수 없습니다.");
  }

  const rows = XLSX.utils.sheet_to_json(firstSheet) as Array<Record<string, string | number>>;
  const productCodeList = rows
    .map((row) => String(row["상품코드"] ?? "").trim())
    .filter(Boolean);

  const products = await prisma.product.findMany({
    where: {
      supplier_id: supplierId,
      product_code: { in: productCodeList },
    },
  });
  const productCodeMap = new Map(products.map((product) => [product.product_code, product]));

  const validItems: Array<{ productId: number; qty: number; memo?: string | null }> = [];
  const errors: string[] = [];

  rows.forEach((row, idx) => {
    const rowNo = idx + 2;
    const productCode = String(row["상품코드"] ?? "").trim();
    const qtyValue = row["주문수량"];
    const memo = String(row["메모"] ?? "").trim();

    if (!productCode) {
      errors.push(`${rowNo}행: 상품코드 없음`);
      return;
    }

    const product = productCodeMap.get(productCode);
    if (!product) {
      errors.push(`${rowNo}행: 상품코드 미존재 또는 공급사 불일치 (${productCode})`);
      return;
    }
    if (!product.is_active) {
      errors.push(`${rowNo}행: 비활성 상품 (${productCode})`);
      return;
    }

    const qty = Number(qtyValue ?? 0);
    if (!qtyValue || Number.isNaN(qty) || qty <= 0) {
      return;
    }

    validItems.push({
      productId: product.id,
      qty,
      memo: memo || null,
    });
  });

  return {
    validItems,
    errors,
  };
}
