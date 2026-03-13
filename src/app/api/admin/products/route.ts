import { NextRequest } from "next/server";
import { Prisma, ProductStatus } from "@prisma/client";

import { requireAuth } from "@/lib/auth";
import { handleRouteError, HttpError, ok } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { productUpsertSchema } from "@/lib/schemas";
import { toNumber } from "@/lib/utils";
import { createAuditLog } from "@/server/services/audit-log";

const ADMIN_ROLES = ["SUPER_ADMIN", "KOREA_SUPPLY_ADMIN", "ADMIN"] as const;

function resolveProductStatus(value: string | null): ProductStatus | undefined {
  if (value === "DRAFT") return ProductStatus.DRAFT;
  if (value === "PENDING") return ProductStatus.PENDING;
  if (value === "APPROVED") return ProductStatus.APPROVED;
  if (value === "REJECTED") return ProductStatus.REJECTED;
  return undefined;
}

export async function GET(request: NextRequest) {
  try {
    await requireAuth(request, [...ADMIN_ROLES]);
    const supplierId = toNumber(request.nextUrl.searchParams.get("supplierId"));
    const categoryId = toNumber(request.nextUrl.searchParams.get("categoryId"));
    const keyword = request.nextUrl.searchParams.get("keyword")?.trim();
    const isActive = request.nextUrl.searchParams.get("isActive");
    const status = resolveProductStatus(request.nextUrl.searchParams.get("status"));

    const where: Prisma.ProductWhereInput = {
      ...(supplierId ? { supplier_id: supplierId } : {}),
      ...(categoryId ? { category_id: categoryId } : {}),
      ...(isActive ? { is_active: isActive === "true" } : {}),
      ...(status ? { status } : {}),
      ...(keyword
        ? {
            OR: [
              { product_code: { contains: keyword, mode: "insensitive" } },
              { product_name: { contains: keyword, mode: "insensitive" } },
              { spec: { contains: keyword, mode: "insensitive" } },
            ],
          }
        : {}),
    };

    const products = await prisma.product.findMany({
      where,
      include: {
        supplier: true,
        category: true,
      },
      orderBy: [{ supplier_id: "asc" }, { category_id: "asc" }, { sort_order: "asc" }],
    });

    return ok(products);
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request, [...ADMIN_ROLES]);
    const body = await request.json();
    const parsed = productUpsertSchema.safeParse(body);
    if (!parsed.success) {
      throw new HttpError(400, "상품 요청 값이 올바르지 않습니다.");
    }

    const created = await prisma.product.create({
      data: {
        supplier_id: parsed.data.supplierId,
        category_id: parsed.data.categoryId,
        name: parsed.data.productName,
        sku: parsed.data.productCode,
        description: parsed.data.memo ?? null,
        specification: parsed.data.spec,
        product_code: parsed.data.productCode,
        product_name: parsed.data.productName,
        thumbnail_url: parsed.data.productImageUrl ?? null,
        currency: parsed.data.currency ?? "KRW",
        status: parsed.data.status ?? ProductStatus.APPROVED,
        product_image_url: parsed.data.productImageUrl ?? null,
        spec: parsed.data.spec,
        unit: parsed.data.unit,
        price: new Prisma.Decimal(parsed.data.price),
        memo: parsed.data.memo ?? null,
        sort_order: parsed.data.sortOrder,
        is_active: parsed.data.isActive ?? true,
      },
    });

    await createAuditLog({
      actorId: user.id,
      actionType: "CREATE_PRODUCT",
      targetType: "PRODUCT",
      targetId: created.id,
      afterData: parsed.data,
    });

    return ok(created, { status: 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}
