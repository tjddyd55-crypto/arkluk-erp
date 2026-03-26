import { NextRequest } from "next/server";
import { ProductApprovalAction, ProductStatus } from "@prisma/client";

import { requireAuth } from "@/lib/auth";
import { handleRouteError, HttpError, ok } from "@/lib/http";
import { assertSupplierProductCategoryMatch } from "@/lib/product-category-policy";
import { prisma } from "@/lib/prisma";
import { bulkProductRejectSchema } from "@/lib/schemas";
import { createAuditLog } from "@/server/services/audit-log";

const ADMIN_ROLES = ["SUPER_ADMIN", "KOREA_SUPPLY_ADMIN", "ADMIN"] as const;

export async function POST(request: NextRequest) {
  try {
    const actor = await requireAuth(request, [...ADMIN_ROLES]);
    const parsed = bulkProductRejectSchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) {
      throw new HttpError(400, "일괄 반려 요청 값이 올바르지 않습니다.");
    }

    const requestedIds = [...new Set(parsed.data.productIds)];
    const beforeRows = await prisma.product.findMany({
      where: {
        id: { in: requestedIds },
      },
      select: {
        id: true,
        status: true,
        is_active: true,
        rejection_reason: true,
        supplier_id: true,
        productCategory: true,
      },
    });
    const targetRows = beforeRows.filter((row) => row.status === ProductStatus.PENDING);
    if (targetRows.length === 0) {
      throw new HttpError(400, "반려 가능한 승인 대기 상태 상품이 없습니다.");
    }

    const targetIds = targetRows.map((row) => row.id);
    const rejectReason = parsed.data.rejectReason.trim();

    const supplierIds = [...new Set(targetRows.map((row) => row.supplier_id))];
    const supplierLines = await prisma.supplier.findMany({
      where: { id: { in: supplierIds } },
      select: { id: true, productCategory: true },
    });
    const lineBySupplier = new Map(supplierLines.map((s) => [s.id, s.productCategory]));
    for (const row of targetRows) {
      const line = lineBySupplier.get(row.supplier_id);
      if (line === undefined) {
        throw new HttpError(400, `공급사를 찾을 수 없습니다. (상품 ${row.id})`);
      }
      assertSupplierProductCategoryMatch(line, row.productCategory);
    }

    await prisma.$transaction(async (tx) => {
      await tx.product.updateMany({
        where: { id: { in: targetIds } },
        data: {
          status: ProductStatus.REJECTED,
          is_active: false,
          rejection_reason: rejectReason,
        },
      });

      await tx.productApprovalLog.createMany({
        data: targetIds.map((productId) => ({
          product_id: productId,
          action: ProductApprovalAction.REJECT,
          actor_user_id: actor.id,
          reason: rejectReason,
        })),
      });

      for (const row of targetRows) {
        await createAuditLog(
          {
            actorId: actor.id,
            actionType: "REVIEW_SUPPLIER_PRODUCT",
            targetType: "PRODUCT",
            targetId: row.id,
            beforeData: row,
            afterData: {
              status: ProductStatus.REJECTED,
              is_active: false,
              rejection_reason: rejectReason,
            },
          },
          tx,
        );
      }
    });

    return ok({
      rejectedCount: targetIds.length,
      skippedCount: requestedIds.length - targetIds.length,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
