import type { NextRequest } from "next/server";
import { PoPdfDownloadType, Role } from "@prisma/client";

import { prisma } from "@/lib/prisma";

function clientIpFromRequest(request: NextRequest): string | null {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) {
      return first.slice(0, 64);
    }
  }
  const realIp = request.headers.get("x-real-ip")?.trim();
  return realIp ? realIp.slice(0, 64) : null;
}

export async function logPoPdfDownload(params: {
  orderId: number;
  orderSupplierId?: number | null;
  userId: number;
  role: Role;
  downloadType: PoPdfDownloadType;
  request: NextRequest;
}): Promise<void> {
  const req = params.request;
  const ua = req.headers.get("user-agent");
  await prisma.poPdfDownloadLog.create({
    data: {
      order_id: params.orderId,
      order_supplier_id: params.orderSupplierId ?? null,
      user_id: params.userId,
      role: params.role,
      download_type: params.downloadType,
      ip: clientIpFromRequest(req),
      user_agent: ua ? ua.slice(0, 512) : null,
    },
  });
}
