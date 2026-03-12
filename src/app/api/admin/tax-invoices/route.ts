import { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";

import { requireAuth } from "@/lib/auth";
import { handleRouteError, ok } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { toNumber } from "@/lib/utils";

const ADMIN_ROLES = ["SUPER_ADMIN", "ADMIN"] as const;

export async function GET(request: NextRequest) {
  try {
    await requireAuth(request, [...ADMIN_ROLES]);

    const supplierId = toNumber(request.nextUrl.searchParams.get("supplierId"));
    const unclassified = request.nextUrl.searchParams.get("unclassified") === "true";
    const fromEmail = request.nextUrl.searchParams.get("fromEmail")?.trim();
    const orderNo = request.nextUrl.searchParams.get("orderNo")?.trim();
    const fromDate = request.nextUrl.searchParams.get("fromDate");
    const toDate = request.nextUrl.searchParams.get("toDate");

    const conditions: Prisma.TaxInvoiceWhereInput[] = [];
    if (supplierId) {
      conditions.push({ supplier_id: supplierId });
    }
    if (unclassified) {
      conditions.push({ supplier_id: null });
    }
    if (orderNo) {
      conditions.push({
        order: {
          order_no: {
            contains: orderNo,
            mode: Prisma.QueryMode.insensitive,
          },
        },
      });
    }
    if (fromEmail || fromDate || toDate) {
      conditions.push({
        email_inbox: {
          ...(fromEmail
            ? {
                from_email: {
                  contains: fromEmail,
                  mode: Prisma.QueryMode.insensitive,
                },
              }
            : {}),
          ...(fromDate || toDate
            ? {
                received_at: {
                  ...(fromDate ? { gte: new Date(fromDate) } : {}),
                  ...(toDate ? { lte: new Date(`${toDate}T23:59:59.999Z`) } : {}),
                },
              }
            : {}),
        },
      });
    }

    const where: Prisma.TaxInvoiceWhereInput =
      conditions.length > 0
        ? {
            AND: conditions,
          }
        : {};

    const invoices = await prisma.taxInvoice.findMany({
      where,
      include: {
        supplier: true,
        order: true,
        email_inbox: true,
        files: true,
      },
      orderBy: [{ created_at: "desc" }],
    });

    const mailboxMap = new Map<
      string,
      {
        supplierId: number | null;
        supplierName: string;
        count: number;
      }
    >();

    for (const invoice of invoices) {
      const key = invoice.supplier_id ? String(invoice.supplier_id) : "unclassified";
      const supplierName = invoice.supplier?.supplier_name ?? "미분류";
      const current = mailboxMap.get(key) ?? {
        supplierId: invoice.supplier_id,
        supplierName,
        count: 0,
      };
      current.count += 1;
      mailboxMap.set(key, current);
    }

    return ok({
      mailbox: [...mailboxMap.values()],
      invoices,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
