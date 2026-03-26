import { NextRequest } from "next/server";
import { Language, Prisma, ProductStatus } from "@prisma/client";

import { requireAuth } from "@/lib/auth";
import { handleRouteError, HttpError, ok } from "@/lib/http";
import {
  assertSupplierProductCategoryMatch,
  productCategoryForWrite,
} from "@/lib/product-category-policy";
import { prisma } from "@/lib/prisma";
import { createAuditLog } from "@/server/services/audit-log";
import { generateProductTranslations } from "@/server/services/product-translation-service";
import {
  parseSupplierProductExcelRows,
  parseSupplierProductExcelWithHeaders,
} from "@/server/services/supplier-product-excel-service";
import { getSupplierActiveProductForm } from "@/server/services/supplier-product-form-service";
import {
  upsertSupplierProductFieldValues,
  validateAndNormalizeDynamicValues,
} from "@/server/services/supplier-dynamic-product-service";

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request, ["SUPPLIER"]);
    const supplierId = user.supplierId;
    if (!supplierId) {
      throw new HttpError(400, "공급사 계정 정보가 올바르지 않습니다.");
    }

    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      throw new HttpError(400, "엑셀 파일이 필요합니다.");
    }
    if (!file.name.toLowerCase().match(/\.(xlsx|xls)$/)) {
      throw new HttpError(400, "엑셀 파일만 업로드할 수 있습니다.");
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const form = await getSupplierActiveProductForm(supplierId, user.id);
    const enabledFields = form.fields
      .filter((field) => field.is_enabled)
      .sort((a, b) => a.sort_order - b.sort_order || a.id - b.id);

    const keyToField = new Map(enabledFields.map((f) => [f.field_key, f]));
    const labelToField = new Map(enabledFields.map((f) => [f.field_label, f]));

    const parsed = parseSupplierProductExcelWithHeaders(buffer);
    const useNewFormat =
      parsed &&
      parsed.dataRows.length > 0 &&
      parsed.headerLabels.length > 0;

    type DataRow = Record<string, unknown> | unknown[];
    let rows: DataRow[];
    let rowNoOffset: number;
    let resolveRow: (row: DataRow, rowIndex: number) => {
      categoryName: string;
      formValues: Record<string, unknown>;
      imageUrl: string | null;
      sourceLanguage: string;
    };

    if (useNewFormat && parsed) {
      rows = parsed.dataRows as DataRow[];
      rowNoOffset = 3;
      const lastCol = parsed.headerLabels.length - 1;
      const categoryCol = 0;
      const imageCol = lastCol;
      resolveRow = (row: DataRow, _rowIndex: number) => {
        const arr = row as unknown[];
        const categoryName = String(arr[categoryCol] ?? "").trim();
        const formValues: Record<string, unknown> = {};
        for (let i = 1; i < imageCol; i++) {
          const key = parsed!.headerKeys[i]?.trim();
          const label = parsed!.headerLabels[i]?.trim();
          const field = (key && keyToField.get(key)) ?? (label && labelToField.get(label));
          if (field) formValues[field.field_key] = arr[i];
        }
        const imageUrl = String(arr[imageCol] ?? "").trim() || null;
        const sourceLanguage = "ko";
        return { categoryName, formValues, imageUrl, sourceLanguage };
      };
    } else {
      const legacyRows = parseSupplierProductExcelRows(buffer);
      if (legacyRows.length === 0) {
        throw new HttpError(400, "업로드할 데이터가 없습니다.");
      }
      rows = legacyRows;
      rowNoOffset = 2;
      const labelToKey = new Map(enabledFields.map((f) => [f.field_label, f.field_key]));
      resolveRow = (row: DataRow) => {
        const rec = row as Record<string, unknown>;
        const categoryName = String(rec["카테고리"] ?? "").trim();
        const formValues: Record<string, unknown> = {};
        for (const [label, key] of labelToKey.entries()) {
          formValues[key] = rec[label];
        }
        const imageUrl = String(rec["이미지URL(선택)"] ?? "").trim() || null;
        const sourceLanguage = (String(rec["원문언어"] ?? "").trim().toLowerCase() || "ko") as string;
        return { categoryName, formValues, imageUrl, sourceLanguage };
      };
    }

    const categories = await prisma.category.findMany({
      where: { supplier_id: supplierId, is_active: true },
      select: { id: true, category_name: true },
    });
    const categoryMap = new Map(categories.map((c) => [c.category_name, c.id]));

    const supplier = await prisma.supplier.findUnique({
      where: { id: supplierId },
      select: { country_code: true, productCategory: true },
    });
    if (!supplier) {
      throw new HttpError(400, "공급사 정보를 찾을 수 없습니다.");
    }

    let successCount = 0;
    let failCount = 0;
    const errors: string[] = [];

    for (const [index, row] of rows.entries()) {
      const rowNo = index + rowNoOffset;
      try {
        const { categoryName, formValues, imageUrl: imageUrlValue, sourceLanguage: sourceLanguageVal } = resolveRow(row, index);
        if (!categoryName) {
          throw new HttpError(400, "카테고리 값이 필요합니다.");
        }
        const categoryId = categoryMap.get(categoryName);
        if (!categoryId) {
          throw new HttpError(400, `카테고리를 찾을 수 없습니다. (${categoryName})`);
        }

        const normalized = validateAndNormalizeDynamicValues({
          fields: enabledFields,
          values: formValues,
        });

        const allowedLanguages: Language[] = ["ko", "en", "mn", "ar"];
        const finalSourceLanguage = allowedLanguages.includes(sourceLanguageVal as Language) ? (sourceLanguageVal as Language) : "ko";

        const upserted = await prisma.$transaction(async (tx) => {
          const existing = await tx.product.findFirst({
            where: {
              supplier_id: supplierId,
              OR: [
                { sku: normalized.productCore.sku },
                { product_code: normalized.productCore.sku },
              ],
            },
            select: { id: true, productCategory: true },
          });

          const line = productCategoryForWrite(supplier.productCategory);
          if (existing) {
            assertSupplierProductCategoryMatch(supplier.productCategory, existing.productCategory);
          }

          const payload = {
            supplier_id: supplierId,
            category_id: categoryId,
            productCategory: line,
            country_code: supplier.country_code,
            name_original: normalized.productCore.name,
            description_original: normalized.productCore.description,
            source_language: finalSourceLanguage,
            name: normalized.productCore.name,
            sku: normalized.productCore.sku,
            description: normalized.productCore.description,
            specification: normalized.productCore.specification,
            product_code: normalized.productCore.sku,
            product_name: normalized.productCore.name,
            image_url: imageUrlValue,
            spec: normalized.productCore.specification,
            unit: normalized.productCore.unit,
            price: new Prisma.Decimal(normalized.productCore.price),
            currency: normalized.productCore.currency,
            memo: normalized.productCore.description,
            status: ProductStatus.DRAFT,
            rejection_reason: null,
            is_active: false,
          };

          const product = existing
            ? await tx.product.update({
                where: { id: existing.id },
                data: payload,
              })
            : await tx.product.create({ data: payload });

          await upsertSupplierProductFieldValues(tx, {
            productId: product.id,
            formId: form.id,
            fields: enabledFields,
            normalizedValues: normalized.normalizedValues,
          });
          return product;
        });

        await generateProductTranslations({
          productId: upserted.id,
          nameOriginal: upserted.name_original,
          descriptionOriginal: upserted.description_original,
          sourceLanguage: upserted.source_language,
        });
        successCount += 1;
      } catch (error) {
        failCount += 1;
        errors.push(
          `${rowNo}행: ${error instanceof Error ? error.message : "상품 처리 중 오류가 발생했습니다."}`,
        );
      }
    }

    await createAuditLog({
      actorId: user.id,
      actionType: "SUPPLIER_IMPORT_PRODUCT_EXCEL",
      targetType: "SUPPLIER",
      targetId: supplierId,
      afterData: {
        totalRows: rows.length,
        successCount,
        failCount,
      },
    });

    return ok({
      totalRows: rows.length,
      successCount,
      failCount,
      errors,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
