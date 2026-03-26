import { NextRequest, NextResponse } from "next/server";
import { Prisma, ProductStatus } from "@prisma/client";

import { requireAuth } from "@/lib/auth";
import { handleRouteError, HttpError, ok } from "@/lib/http";
import {
  assertSupplierProductCategoryMatch,
  productCategoryForWrite,
} from "@/lib/product-category-policy";
import { prisma } from "@/lib/prisma";
import {
  supplierDynamicProductPatchSchema,
  supplierProductUpdateSchema,
} from "@/lib/schemas";
import { createAuditLog } from "@/server/services/audit-log";
import { generateProductTranslations } from "@/server/services/product-translation-service";
import {
  upsertSupplierProductFieldValues,
  validateAndNormalizeDynamicValues,
} from "@/server/services/supplier-dynamic-product-service";
import { getSupplierActiveProductForm } from "@/server/services/supplier-product-form-service";
import { deleteSupplierProductImageIfOwned } from "@/server/services/supplier-product-image-storage";

const PRODUCT_PATCH_INCLUDE = {
  field_values: {
    include: {
      field: {
        select: { id: true, form_id: true, field_key: true },
      },
    },
  },
} as const;

function comparableFieldText(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }
  return String(value).trim();
}

function resolveNextImageUrl(
  dynamicSuccess: boolean,
  dynamicImage: string | null | undefined,
  legacyThumb: string | null | undefined,
  beforeImage: string | null,
): string | null {
  if (dynamicSuccess) {
    return dynamicImage === undefined ? beforeImage : dynamicImage;
  }
  return legacyThumb === undefined ? beforeImage : legacyThumb;
}

/** PATCH 비교용 스냅샷(저장 예정 값과 동일한 규칙으로 정규화) */
type SupplierProductPatchDiffSnapshot = {
  categoryId: number;
  countryCode: string;
  sourceLanguage: string;
  sku: string;
  name: string;
  description: string;
  specification: string;
  price: string;
  currency: string;
  unit: string;
  thumbnail: string;
  dynamicFields: Record<string, string>;
};

function canonicalProductDescriptionFromBefore(
  row: Prisma.ProductGetPayload<{ include: typeof PRODUCT_PATCH_INCLUDE }>,
): string {
  return (
    comparableFieldText(row.description_original) ||
    comparableFieldText(row.description) ||
    comparableFieldText(row.memo)
  );
}

function buildDynamicFieldMapFromNormalized(
  formFields: Array<{ field_key: string; is_enabled: boolean }>,
  values: Record<string, string | null | undefined>,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const f of formFields.filter((x) => x.is_enabled)) {
    out[f.field_key] = comparableFieldText(values[f.field_key]);
  }
  return out;
}

function buildDynamicFieldMapFromExisting(
  formFields: Array<{ field_key: string; is_enabled: boolean }>,
  existingValues: Record<string, unknown>,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const f of formFields.filter((x) => x.is_enabled)) {
    out[f.field_key] = comparableFieldText(existingValues[f.field_key]);
  }
  return out;
}

function buildExistingPatchSnapshot(
  before: Prisma.ProductGetPayload<{ include: typeof PRODUCT_PATCH_INCLUDE }>,
  existingValues: Record<string, unknown>,
  formFields: Array<{ field_key: string; is_enabled: boolean }>,
): SupplierProductPatchDiffSnapshot {
  const beforePrimaryImage = before.image_url ?? before.thumbnail_url ?? before.product_image_url ?? null;
  return {
    categoryId: before.category_id,
    countryCode: before.country_code,
    sourceLanguage: before.source_language,
    sku: before.sku ?? before.product_code,
    name: before.name_original,
    description: canonicalProductDescriptionFromBefore(before),
    specification: before.specification ?? before.spec,
    price: before.price.toString(),
    currency: String(before.currency).toUpperCase(),
    unit: before.unit,
    thumbnail: comparableFieldText(beforePrimaryImage),
    dynamicFields: buildDynamicFieldMapFromExisting(formFields, existingValues),
  };
}

function buildNextPatchSnapshot(input: {
  nextCategoryId: number;
  nextCountryCode: string;
  nextSourceLanguage: Prisma.ProductGetPayload<{ include: typeof PRODUCT_PATCH_INCLUDE }>["source_language"];
  normalized: ReturnType<typeof validateAndNormalizeDynamicValues>;
  nextImageUrl: string | null;
  formFields: Array<{ field_key: string; is_enabled: boolean }>;
}): SupplierProductPatchDiffSnapshot {
  const { nextCategoryId, nextCountryCode, nextSourceLanguage, normalized, nextImageUrl, formFields } = input;
  return {
    categoryId: nextCategoryId,
    countryCode: nextCountryCode,
    sourceLanguage: nextSourceLanguage,
    sku: normalized.productCore.sku,
    name: normalized.productCore.name,
    description: comparableFieldText(normalized.productCore.description),
    specification: normalized.productCore.specification,
    price: new Prisma.Decimal(normalized.productCore.price).toString(),
    currency: normalized.productCore.currency,
    unit: normalized.productCore.unit,
    thumbnail: comparableFieldText(nextImageUrl),
    dynamicFields: buildDynamicFieldMapFromNormalized(formFields, normalized.normalizedValues),
  };
}

function patchPriceUnchanged(existingPrice: Prisma.Decimal, nextPriceStr: string): boolean {
  try {
    return existingPrice.equals(new Prisma.Decimal(nextPriceStr));
  } catch {
    return false;
  }
}

/** 기존 행·적용 예정 값 스냅샷을 비교해 변경 필드 키를 계산한다. */
function getSupplierProductPatchDiff(
  existing: SupplierProductPatchDiffSnapshot,
  next: SupplierProductPatchDiffSnapshot,
  existingPriceDecimal: Prisma.Decimal,
): { hasChanged: boolean; changedFields: string[] } {
  const changedFields: string[] = [];

  if (existing.categoryId !== next.categoryId) {
    changedFields.push("categoryId");
  }
  if (existing.countryCode !== next.countryCode) {
    changedFields.push("countryCode");
  }
  if (existing.sourceLanguage !== next.sourceLanguage) {
    changedFields.push("sourceLanguage");
  }
  if (existing.sku !== next.sku) {
    changedFields.push("sku");
  }
  if (existing.name !== next.name) {
    changedFields.push("name");
  }
  if (existing.description !== next.description) {
    changedFields.push("description");
  }
  if (existing.specification !== next.specification) {
    changedFields.push("specification");
  }
  if (!patchPriceUnchanged(existingPriceDecimal, next.price)) {
    changedFields.push("price");
  }
  if (existing.currency !== next.currency) {
    changedFields.push("currency");
  }
  if (existing.unit !== next.unit) {
    changedFields.push("unit");
  }
  if (existing.thumbnail !== next.thumbnail) {
    changedFields.push("thumbnail");
  }

  const dynamicKeys = new Set([
    ...Object.keys(existing.dynamicFields),
    ...Object.keys(next.dynamicFields),
  ]);
  for (const key of dynamicKeys) {
    const a = existing.dynamicFields[key] ?? "";
    const b = next.dynamicFields[key] ?? "";
    if (a !== b) {
      changedFields.push(`field:${key}`);
    }
  }

  changedFields.sort();
  return { hasChanged: changedFields.length > 0, changedFields };
}

function mergeLegacyPatchValues(
  formValues: Record<string, unknown>,
  legacy: Partial<{
    name: string;
    sku: string;
    description: string | null;
    specification: string;
    price: number;
    currency: string;
  }>,
) {
  const next = { ...formValues };
  if (legacy.name !== undefined) next.name = legacy.name;
  if (legacy.sku !== undefined) next.sku = legacy.sku;
  if (legacy.description !== undefined) next.description = legacy.description ?? "";
  if (legacy.specification !== undefined) next.specification = legacy.specification;
  if (legacy.price !== undefined) next.price = legacy.price;
  if (legacy.currency !== undefined) next.currency = legacy.currency;
  return next;
}

// TODO: 향후 필드별 승인 정책 적용 가능
// (예: 가격 변경만 재승인, 이미지 변경은 즉시 반영)

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireAuth(request, ["SUPPLIER"]);
    const supplierId = user.supplierId;
    if (!supplierId) {
      throw new HttpError(400, "공급사 계정 정보가 올바르지 않습니다.");
    }

    const { id } = await params;
    const productId = Number(id);
    if (Number.isNaN(productId)) {
      throw new HttpError(400, "유효하지 않은 상품 ID입니다.");
    }

    const body = await request.json();
    const dynamicParsed = supplierDynamicProductPatchSchema.safeParse(body);
    const legacyParsed = dynamicParsed.success ? null : supplierProductUpdateSchema.safeParse(body);
    if (!dynamicParsed.success && !legacyParsed?.success) {
      throw new HttpError(400, "상품 수정 값이 올바르지 않습니다.");
    }
    const legacyData = legacyParsed && legacyParsed.success ? legacyParsed.data : null;

    const before = await prisma.product.findFirst({
      where: { id: productId, supplier_id: supplierId },
      include: PRODUCT_PATCH_INCLUDE,
    });
    if (!before) {
      throw new HttpError(404, "상품을 찾을 수 없습니다.");
    }

    const categoryId = dynamicParsed.success ? dynamicParsed.data.categoryId : legacyData?.categoryId;

    if (categoryId) {
      const category = await prisma.category.findFirst({
        where: {
          id: categoryId,
          supplier_id: supplierId,
          is_active: true,
        },
      });
      if (!category) {
        throw new HttpError(400, "해당 공급사에서 사용할 수 없는 카테고리입니다.");
      }
    }
    const supplier = await prisma.supplier.findUnique({
      where: { id: supplierId },
      select: { country_code: true, productCategory: true },
    });
    if (!supplier) {
      throw new HttpError(400, "공급사 정보를 찾을 수 없습니다.");
    }
    assertSupplierProductCategoryMatch(supplier.productCategory, before.productCategory);
    const line = productCategoryForWrite(supplier.productCategory);

    const currentForm = await getSupplierActiveProductForm(supplierId, user.id);
    const existingValues = before.field_values.reduce<Record<string, unknown>>((acc, row) => {
      acc[row.field.field_key] = row.value_text;
      return acc;
    }, {});

    const mergedValues = dynamicParsed.success
      ? { ...existingValues, ...(dynamicParsed.data.formValues ?? {}) }
      : mergeLegacyPatchValues(existingValues, legacyData ?? {});

    const normalized = validateAndNormalizeDynamicValues({
      fields: currentForm.fields,
      values: mergedValues,
    });

    const beforePrimaryImage = before.image_url ?? before.thumbnail_url ?? before.product_image_url ?? null;
    const nextImageUrl = resolveNextImageUrl(
      dynamicParsed.success,
      dynamicParsed.success ? dynamicParsed.data.imageUrl : undefined,
      legacyData?.thumbnailUrl,
      beforePrimaryImage,
    );
    const nextSourceLanguage = dynamicParsed.success
      ? (dynamicParsed.data.sourceLanguage ?? before.source_language)
      : (legacyData?.sourceLanguage ?? before.source_language);
    const nextCategoryId = categoryId ?? before.category_id;

    const existingPatchSnapshot = buildExistingPatchSnapshot(before, existingValues, currentForm.fields);
    const nextPatchSnapshot = buildNextPatchSnapshot({
      nextCategoryId,
      nextCountryCode: supplier.country_code,
      nextSourceLanguage,
      normalized,
      nextImageUrl,
      formFields: currentForm.fields,
    });
    const { hasChanged, changedFields } = getSupplierProductPatchDiff(
      existingPatchSnapshot,
      nextPatchSnapshot,
      before.price,
    );

    if (!hasChanged) {
      return NextResponse.json({ success: true, unchanged: true });
    }

    const beforeSku = before.sku ?? before.product_code;
    const skuChanged = normalized.productCore.sku !== beforeSku;
    if (skuChanged) {
      const duplicate = await prisma.product.findFirst({
        where: {
          supplier_id: supplierId,
          id: { not: productId },
          OR: [
            { sku: normalized.productCore.sku },
            { product_code: normalized.productCore.sku },
          ],
        },
      });
      if (duplicate) {
        throw new HttpError(409, "이미 등록된 SKU입니다.");
      }
    }

    let nextStatus: ProductStatus = before.status;
    if (before.status === ProductStatus.APPROVED) {
      nextStatus = ProductStatus.PENDING;
    } else if (before.status === ProductStatus.REJECTED) {
      nextStatus = ProductStatus.DRAFT;
    }
    const clearRejection =
      before.status === ProductStatus.APPROVED || before.status === ProductStatus.REJECTED;

    const updated = await prisma.$transaction(async (tx) => {
      const next = await tx.product.update({
        where: { id: productId },
        data: {
          category_id: nextCategoryId,
          productCategory: line,
          country_code: supplier.country_code,
          name_original: normalized.productCore.name,
          description_original: normalized.productCore.description,
          source_language: nextSourceLanguage,
          name: normalized.productCore.name,
          sku: normalized.productCore.sku,
          description: normalized.productCore.description,
          specification: normalized.productCore.specification,
          product_name: normalized.productCore.name,
          product_code: normalized.productCore.sku,
          product_image_url: nextImageUrl ?? null,
          thumbnail_url: nextImageUrl ?? null,
          image_url: nextImageUrl ?? null,
          spec: normalized.productCore.specification,
          price: new Prisma.Decimal(normalized.productCore.price),
          currency: normalized.productCore.currency,
          memo: normalized.productCore.description,
          unit: normalized.productCore.unit,
          status: nextStatus,
          ...(clearRejection ? { rejection_reason: null } : {}),
        },
      });

      await upsertSupplierProductFieldValues(tx, {
        productId: productId,
        formId: currentForm.id,
        fields: currentForm.fields,
        normalizedValues: normalized.normalizedValues,
      });

      return next;
    });

    await generateProductTranslations({
      productId: updated.id,
      nameOriginal: updated.name_original,
      descriptionOriginal: updated.description_original,
      sourceLanguage: updated.source_language,
    });

    const afterSnapshot = await prisma.product.findUnique({
      where: { id: productId },
      include: PRODUCT_PATCH_INCLUDE,
    });
    if (!afterSnapshot || afterSnapshot.supplier_id !== supplierId) {
      throw new HttpError(500, "상품 저장 후 조회에 실패했습니다.");
    }

    await createAuditLog({
      actorId: user.id,
      actionType: "PRODUCT_UPDATED",
      targetType: "PRODUCT",
      targetId: productId,
      beforeData: before,
      afterData: {
        product: afterSnapshot,
        changedFields,
      },
    });

    const prevImage = before.image_url ?? before.thumbnail_url ?? before.product_image_url ?? null;
    const nextImage = nextImageUrl ?? null;
    if (comparableFieldText(prevImage) !== comparableFieldText(nextImage)) {
      try {
        await deleteSupplierProductImageIfOwned(supplierId, prevImage);
      } catch {
        /* 스토리지 삭제 실패는 상품 수정 결과를 막지 않음 */
      }
    }

    return ok(updated);
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireAuth(request, ["SUPPLIER"]);
    const supplierId = user.supplierId;
    if (!supplierId) {
      throw new HttpError(400, "공급사 계정 정보가 올바르지 않습니다.");
    }

    const { id } = await params;
    const productId = Number(id);
    if (Number.isNaN(productId)) {
      throw new HttpError(400, "유효하지 않은 상품 ID입니다.");
    }

    const before = await prisma.product.findFirst({
      where: { id: productId, supplier_id: supplierId },
    });
    if (!before) {
      throw new HttpError(404, "상품을 찾을 수 없습니다.");
    }

    const imagePathsBeforeDelete = [
      before.image_url,
      before.thumbnail_url,
      before.product_image_url,
    ].filter((v): v is string => Boolean(v?.trim()));

    await prisma.$transaction(async (tx) => {
      await tx.productApprovalLog.deleteMany({
        where: { product_id: productId },
      });
      await tx.productTranslation.deleteMany({
        where: { product_id: productId },
      });
      await tx.product.delete({
        where: { id: productId },
      });
    });

    await createAuditLog({
      actorId: user.id,
      actionType: "SUPPLIER_DELETE_PRODUCT",
      targetType: "PRODUCT",
      targetId: productId,
      beforeData: before,
    });

    for (const imagePath of imagePathsBeforeDelete) {
      try {
        await deleteSupplierProductImageIfOwned(supplierId, imagePath);
      } catch {
        /* 스토리지 삭제 실패는 삭제 응답을 막지 않음 */
      }
    }

    return ok({ deleted: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
