import { z } from "zod";

const positiveNumber = z.coerce.number().positive();

export const loginSchema = z.object({
  loginId: z.string().min(3),
  password: z.string().min(6),
});

export const countryUpsertSchema = z.object({
  countryCode: z.string().min(2).max(10),
  countryName: z.string().min(2).max(100),
  isActive: z.boolean().optional(),
});

export const supplierUpsertSchema = z.object({
  supplierCode: z.string().max(50).optional().nullable(),
  supplierName: z.string().min(2).max(150),
  orderEmail: z.email(),
  ccEmail: z.email().optional().nullable(),
  invoiceSenderEmail: z.email().optional().nullable(),
  isActive: z.boolean().optional(),
  allowSupplierProductEdit: z.boolean().optional(),
});

export const supplierInvoiceSendersSchema = z.object({
  senderEmails: z.array(z.email()).max(20),
});

export const categoryUpsertSchema = z.object({
  supplierId: positiveNumber,
  categoryName: z.string().min(1).max(100),
  sortOrder: z.coerce.number().int().default(0),
  isActive: z.boolean().optional(),
});

export const productUpsertSchema = z.object({
  supplierId: positiveNumber,
  categoryId: positiveNumber,
  productCode: z.string().min(1).max(80),
  productName: z.string().min(1).max(200),
  productImageUrl: z.url().optional().nullable(),
  spec: z.string().min(1).max(200),
  unit: z.string().min(1).max(40),
  price: z.coerce.number().positive(),
  memo: z.string().max(500).optional().nullable(),
  sortOrder: z.coerce.number().int().default(0),
  isActive: z.boolean().optional(),
});

export const userUpsertSchema = z.object({
  loginId: z.string().min(3).max(50),
  password: z.string().min(6).max(120).optional(),
  name: z.string().min(2).max(100),
  email: z.email().optional().nullable(),
  role: z.enum(["SUPER_ADMIN", "ADMIN", "BUYER", "SUPPLIER"]),
  countryId: z.coerce.number().int().positive().optional().nullable(),
  supplierId: z.coerce.number().int().positive().optional().nullable(),
  isActive: z.boolean().optional(),
});

export const createOrderSchema = z.object({
  memo: z.string().max(1000).optional().nullable(),
  projectId: z.coerce.number().int().positive().optional().nullable(),
  items: z
    .array(
      z.object({
        productId: positiveNumber,
        qty: z.coerce.number().positive(),
        memo: z.string().max(500).optional().nullable(),
      }),
    )
    .min(1),
});

export const updateOrderSchema = z.object({
  status: z.enum(["PENDING", "REVIEWING"]).optional(),
  operations: z
    .array(
      z.discriminatedUnion("actionType", [
        z.object({
          actionType: z.literal("UPDATE_QTY"),
          orderItemId: positiveNumber,
          qty: z.coerce.number().positive(),
        }),
        z.object({
          actionType: z.literal("DELETE_ITEM"),
          orderItemId: positiveNumber,
        }),
        z.object({
          actionType: z.literal("ADD_ITEM"),
          productId: positiveNumber,
          qty: z.coerce.number().positive(),
          memo: z.string().max(500).optional().nullable(),
        }),
      ]),
    )
    .default([]),
});

export const createQuoteSchema = z.object({
  buyerId: positiveNumber,
  countryId: positiveNumber,
  projectId: z.coerce.number().int().positive().optional().nullable(),
  supplierId: z.coerce.number().int().positive().optional().nullable(),
  memo: z.string().max(1000).optional().nullable(),
  items: z
    .array(
      z.object({
        productId: positiveNumber,
        qty: z.coerce.number().positive(),
      }),
    )
    .min(1),
});

export const taxInvoiceLinkSchema = z.object({
  orderId: z.coerce.number().int().positive().optional(),
  orderNo: z.string().trim().min(1).optional(),
});
