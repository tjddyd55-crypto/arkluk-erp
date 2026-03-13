import { NextRequest } from "next/server";
import { Prisma, ProductStatus } from "@prisma/client";

import { requireAuth } from "@/lib/auth";
import { handleRouteError, HttpError, ok } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { supplierProductCreateSchema } from "@/lib/schemas";
import { createAuditLog } from "@/server/services/audit-log";

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request, ["SUPPLIER"]);
    if (!user.supplierId) {
      throw new HttpError(400, "공급사 계정 정보가 올바르지 않습니다.");
    }

    const products = await prisma.product.findMany({
      where: { supplier_id: user.supplierId },
      include: {
        category: true,
      },
      orderBy: [{ category_id: "asc" }, { sort_order: "asc" }],
    });
    return ok(products);
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request, ["SUPPLIER"]);
    if (!user.supplierId) {
      throw new HttpError(400, "공급사 계정 정보가 올바르지 않습니다.");
    }

    const parsed = supplierProductCreateSchema.safeParse(await request.json());
    if (!parsed.success) {
      throw new HttpError(400, "상품 등록 값이 올바르지 않습니다.");
    }

    const category = await prisma.category.findFirst({
      where: {
        id: parsed.data.categoryId,
        supplier_id: user.supplierId,
        is_active: true,
      },
      select: { id: true },
    });
    if (!category) {
      throw new HttpError(400, "해당 공급사에서 사용할 수 없는 카테고리입니다.");
    }

    const existing = await prisma.product.findFirst({
      where: {
        supplier_id: user.supplierId,
        OR: [{ sku: parsed.data.sku }, { product_code: parsed.data.sku }],
      },
      select: { id: true },
    });
    if (existing) {
      throw new HttpError(409, "이미 등록된 SKU입니다.");
    }

    const created = await prisma.product.create({
      data: {
        supplier_id: user.supplierId,
        category_id: parsed.data.categoryId,
        name: parsed.data.name,
        sku: parsed.data.sku,
        description: parsed.data.description ?? null,
        specification: parsed.data.specification,
        price: new Prisma.Decimal(parsed.data.price),
        currency: parsed.data.currency,
        thumbnail_url: parsed.data.thumbnailUrl ?? null,
        status: ProductStatus.DRAFT,
        is_active: false,
        product_code: parsed.data.sku,
        product_name: parsed.data.name,
        product_image_url: parsed.data.thumbnailUrl ?? null,
        spec: parsed.data.specification,
        unit: "EA",
        memo: parsed.data.description ?? null,
      },
    });

    await createAuditLog({
      actorId: user.id,
      actionType: "SUPPLIER_CREATE_PRODUCT_DRAFT",
      targetType: "PRODUCT",
      targetId: created.id,
      afterData: {
        status: created.status,
        sku: created.sku,
      },
    });

    return ok(created, { status: 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}
