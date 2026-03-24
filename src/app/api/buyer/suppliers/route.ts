import { NextRequest } from "next/server";

import { requireAuth } from "@/lib/auth";
import { handleRouteError, ok } from "@/lib/http";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/buyer/suppliers
 *
 * 공급사 목록은 의도적으로 느슨하게 유지한다 (상품 노출·승인·동적필드는 /api/buyer/products 쪽).
 *
 * [이전 조건 — 0건 원인 후보]
 * - supplier: is_active, status = ACTIVE
 * - product.some: is_active, status = APPROVED, country_code = 바이어 국가
 * - (고정 name/price 필터는 본 API에 없었음)
 *
 * [현재 조건]
 * - supplier.is_active = true
 * - 해당 supplier에 연결된 Product row 1개 이상 (상태·국가·is_active·필드값 미검사)
 */
function shouldLogBuyerSuppliersDebug() {
  return (
    process.env.DEBUG_BUYER_SUPPLIERS === "1" || process.env.NODE_ENV === "development"
  );
}

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request, ["BUYER"]);

    const logDebug = shouldLogBuyerSuppliersDebug();
    let totalSuppliers = 0;
    let activeSupplierCount = 0;
    let supplierIdsWithAnyProduct = 0;

    let supplierCountAfterFinalWhere = 0;

    if (logDebug) {
      [totalSuppliers, activeSupplierCount, supplierCountAfterFinalWhere] = await Promise.all([
        prisma.supplier.count(),
        prisma.supplier.count({ where: { is_active: true } }),
        prisma.supplier.count({
          where: { is_active: true, products: { some: {} } },
        }),
      ]);
      const grouped = await prisma.product.groupBy({
        by: ["supplier_id"],
        _count: { _all: true },
      });
      supplierIdsWithAnyProduct = grouped.length;
    }

    const suppliers = await prisma.supplier.findMany({
      where: {
        is_active: true,
        products: { some: {} },
      },
      orderBy: [{ supplier_name: "asc" }],
    });

    if (logDebug) {
      // eslint-disable-next-line no-console -- 임시 진단용 (DEBUG_BUYER_SUPPLIERS 또는 development)
      console.info("[GET /api/buyer/suppliers] debug", {
        buyerUserId: user.id,
        buyerCountryId: user.countryId ?? null,
        counts: {
          totalSuppliers,
          activeSupplierCount,
          distinctSuppliersWithAnyProductRow: supplierIdsWithAnyProduct,
          afterFinalWhere: supplierCountAfterFinalWhere,
          returned: suppliers.length,
        },
        appliedWhere: {
          supplier: ["is_active === true"],
          product: ["some: {} (아무 Product row 1건 이상, status/country/is_active/필드 미필터)"],
        },
      });
    }

    return ok(suppliers);
  } catch (error) {
    return handleRouteError(error);
  }
}
