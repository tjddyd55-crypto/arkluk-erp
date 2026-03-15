import { NextRequest } from "next/server";

import { requireAuth } from "@/lib/auth";
import { handleRouteError, HttpError, ok } from "@/lib/http";
import { prisma } from "@/lib/prisma";

const ADMIN_ROLES = ["SUPER_ADMIN", "KOREA_SUPPLY_ADMIN", "ADMIN"] as const;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireAuth(request, [...ADMIN_ROLES]);

    const { id } = await params;
    const productId = Number(id);
    if (Number.isNaN(productId)) {
      throw new HttpError(400, "유효하지 않은 상품 ID입니다.");
    }

    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: { id: true },
    });
    if (!product) {
      throw new HttpError(404, "상품을 찾을 수 없습니다.");
    }

    const logs = await prisma.productApprovalLog.findMany({
      where: { product_id: productId },
      include: {
        actor: {
          select: {
            id: true,
            name: true,
            login_id: true,
          },
        },
      },
      orderBy: { created_at: "desc" },
    });

    const history = logs.map((log) => ({
      timestamp: log.created_at.toISOString(),
      action: log.action,
      user: log.actor.name || log.actor.login_id,
      reason: log.reason,
    }));

    return ok(history);
  } catch (error) {
    return handleRouteError(error);
  }
}
