import { z } from "zod";

const positiveNumber = z.coerce.number().positive();
const translationLanguageSchema = z.enum(["ko", "en", "mn", "ar"]);

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
  companyName: z.string().trim().min(2).max(150),
  companyCode: z.string().trim().min(1).max(50),
  countryCode: z.string().trim().min(2).max(10).default("KR"),
  businessNumber: z.string().trim().min(3).max(40).optional().nullable(),
  representativeName: z.string().trim().min(2).max(100).optional().nullable(),
  contactName: z.string().trim().min(2).max(100).optional().nullable(),
  contactEmail: z.email(),
  contactPhone: z.string().trim().min(3).max(40).optional().nullable(),
  address: z.string().trim().max(300).optional().nullable(),
  status: z.enum(["PENDING", "ACTIVE", "INACTIVE", "SUSPENDED"]).optional(),
  supplierCode: z.string().max(50).optional().nullable(),
  supplierName: z.string().min(2).max(150).optional(),
  orderEmail: z.email().optional(),
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
  countryCode: z.string().trim().min(2).max(10).optional(),
  sourceLanguage: translationLanguageSchema.optional(),
  productCode: z.string().min(1).max(80),
  productName: z.string().min(1).max(200),
  productImageUrl: z.url().optional().nullable(),
  spec: z.string().min(1).max(200),
  unit: z.string().min(1).max(40),
  price: z.coerce.number().positive(),
  memo: z.string().max(500).optional().nullable(),
  sortOrder: z.coerce.number().int().default(0),
  isActive: z.boolean().optional(),
  status: z.enum(["DRAFT", "PENDING", "APPROVED", "REJECTED"]).optional(),
  currency: z.string().trim().min(3).max(10).optional(),
});

export const supplierProductCreateSchema = z.object({
  categoryId: positiveNumber,
  sourceLanguage: translationLanguageSchema.optional(),
  name: z.string().trim().min(1).max(200),
  sku: z.string().trim().min(1).max(80),
  description: z.string().trim().max(1000).optional().nullable(),
  specification: z.string().trim().min(1).max(300),
  price: z.coerce.number().positive(),
  currency: z.string().trim().min(3).max(10).default("KRW"),
  thumbnailUrl: z.url().optional().nullable(),
});

export const supplierProductUpdateSchema = supplierProductCreateSchema
  .partial()
  .extend({
    categoryId: positiveNumber.optional(),
  });

export const supplierProductSubmitSchema = z.object({
  submit: z.literal(true).optional().default(true),
});

export const productReviewSchema = z.object({
  status: z.enum(["APPROVED", "REJECTED"]),
  reason: z.string().trim().max(1000).optional().nullable(),
}).superRefine((value, ctx) => {
  if (value.status === "REJECTED" && !value.reason?.trim()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["reason"],
      message: "반려 사유를 입력해 주세요.",
    });
  }
});

export const userUpsertSchema = z.object({
  loginId: z.string().min(3).max(50),
  password: z.string().min(6).max(120).optional(),
  name: z.string().min(2).max(100),
  email: z.email().optional().nullable(),
  role: z.enum([
    "SUPER_ADMIN",
    "KOREA_SUPPLY_ADMIN",
    "COUNTRY_ADMIN",
    "ADMIN",
    "BUYER",
    "SUPPLIER",
  ]),
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

export const createCountryOrderDraftSchema = z.object({
  memo: z.string().max(1000).optional().nullable(),
  projectId: z.coerce.number().int().positive().optional().nullable(),
});

export const addCountryOrderItemsSchema = z.object({
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
  status: z
    .enum([
      "CREATED",
      "UNDER_REVIEW",
      "ASSIGNED",
      "PENDING",
      "REVIEWING",
    ])
    .optional(),
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

export const purchaseOrderTemplateUpsertSchema = z.object({
  supplierId: z.coerce.number().int().positive().optional().nullable(),
  templateName: z.string().trim().min(1).max(120),
  titleKo: z.string().trim().min(1).max(120),
  titleEn: z.string().trim().min(1).max(120),
  buyerName: z.string().trim().max(120).optional().nullable(),
  footerNote: z.string().trim().max(500).optional().nullable(),
  isDefault: z.boolean().optional(),
  isActive: z.boolean().optional(),
});

export const supplierOrderConfirmSchema = z.object({
  expectedDeliveryDate: z.coerce.date().optional().nullable(),
  supplierNote: z.string().trim().max(1000).optional().nullable(),
});

export const supplierDeliveryUpdateSchema = z.object({
  expectedDeliveryDate: z.coerce.date(),
  supplierNote: z.string().trim().max(1000).optional().nullable(),
});

export const supplierShipSchema = z.object({
  supplierNote: z.string().trim().max(1000).optional().nullable(),
});

export const supplierDeliverSchema = z.object({
  supplierNote: z.string().trim().max(1000).optional().nullable(),
});

export const orderSupplierCancelSchema = z.object({
  reason: z.string().trim().max(1000).optional().nullable(),
});

export const orderItemAssignSchema = z.object({
  orderItemId: positiveNumber,
  supplierId: positiveNumber,
});

export const assignmentSettingsSchema = z.object({
  modes: z.object({
    manual: z.boolean().default(true),
    autoProduct: z.boolean().default(true),
    autoTimeout: z.boolean().default(true),
  }),
  timeoutHours: z.coerce.number().int().min(1).max(168).default(24),
  notifications: z.object({
    email: z.boolean().default(true),
    slack: z.boolean().default(false),
    sms: z.boolean().default(false),
    webhook: z.boolean().default(false),
  }),
  webhookUrl: z.url().optional().nullable(),
  automationActorUserId: z.coerce.number().int().positive().optional().nullable(),
});

export const shipmentCreateSchema = z.object({
  carrier: z.string().trim().max(100).optional().nullable(),
  trackingNumber: z.string().trim().max(120).optional().nullable(),
});

export const shipmentItemAddSchema = z.object({
  orderItemId: positiveNumber,
  quantity: z.coerce.number().positive(),
});

export const shipmentStatusAddSchema = z.object({
  statusMessage: z.string().trim().min(1).max(1000),
});

export const buyerOrderStatusUpdateSchema = z.object({
  status: z.enum([
    "ORDER_CREATED",
    "PAYMENT_PENDING",
    "PAYMENT_COMPLETED",
    "ORDER_CANCELLED",
  ]),
});

export const supplierShipmentStatusUpdateSchema = z.object({
  status: z.enum(["CONFIRMED", "PREPARING", "PACKING", "SHIPPED", "DELIVERED", "HOLD"]),
  statusMessage: z.string().trim().max(1000).optional().nullable(),
});

export const projectStatusSchema = z.enum([
  "DRAFT",
  "QUOTING",
  "QUOTED",
  "ORDERING",
  "ACTIVE",
  "COMPLETED",
  "CANCELLED",
]);

export const projectUpsertSchema = z.object({
  projectName: z.string().trim().min(1).max(150),
  buyerId: positiveNumber,
  countryId: positiveNumber,
  memo: z.string().trim().max(2000).optional().nullable(),
  location: z.string().trim().max(200).optional().nullable(),
  startDate: z.coerce.date().optional().nullable(),
  endDate: z.coerce.date().optional().nullable(),
  status: projectStatusSchema.optional(),
});

export const projectPatchSchema = z.object({
  projectName: z.string().trim().min(1).max(150).optional(),
  buyerId: positiveNumber.optional(),
  countryId: positiveNumber.optional(),
  memo: z.string().trim().max(2000).optional().nullable(),
  location: z.string().trim().max(200).optional().nullable(),
  startDate: z.coerce.date().optional().nullable(),
  endDate: z.coerce.date().optional().nullable(),
  status: projectStatusSchema.optional(),
});

export const createProjectQuoteSchema = z.object({
  memo: z.string().trim().max(1000).optional().nullable(),
  items: z
    .array(
      z.object({
        productId: positiveNumber,
        qty: z.coerce.number().positive(),
      }),
    )
    .min(1),
});
