import { z } from "zod";

import { SUPPLIER_PRODUCT_FIELD_DEFAULT_LABEL_BY_KEY } from "@/lib/supplier-product-field-defaults";

const positiveNumber = z.coerce.number().positive();
const translationLanguageSchema = z.enum(["ko", "en", "mn", "ar"]);

export const productCategorySchema = z.enum(["CONSTRUCTION", "GENERAL"]);
export const supplierProductFieldTypeSchema = z.enum([
  "TEXT",
  "TEXTAREA",
  "NUMBER",
  "SELECT",
  "BOOLEAN",
  "DATE",
]);

export const loginSchema = z.object({
  loginId: z.string().min(3),
  password: z.string().min(6),
});

export const countryUpsertSchema = z.object({
  countryCode: z.string().min(2).max(10),
  countryName: z.string().min(2).max(100),
  isActive: z.boolean().optional(),
});

/** 회사코드(company_code)는 서버 자동 생성 — 클라이언트에서 보내지 않음 */
export const supplierUpsertSchema = z.object({
  companyName: z.string().trim().min(2).max(150),
  countryCode: z.string().trim().min(2).max(10).default("KR"),
  /** 건축자재(CONSTRUCTION) / 기타상품(GENERAL). 미전달 시 CONSTRUCTION */
  productCategory: productCategorySchema.optional(),
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

export const supplierLoginIdSchema = z
  .string()
  .trim()
  .min(3)
  .max(100)
  .regex(/^[^\s]+$/, "로그인 아이디에 공백을 사용할 수 없습니다.");

/** 공급사 신규 생성: 로그인 계정 필수 */
export const supplierCreateSchema = supplierUpsertSchema.extend({
  loginId: supplierLoginIdSchema,
  password: z.string().min(8).max(128),
});

/** 공급사 수정: loginId·password(8자+)는 선택, 보낸 항목만 반영 */
export const supplierUpdateSchema = supplierUpsertSchema.partial().extend({
  loginId: supplierLoginIdSchema.optional(),
  password: z.string().min(8).max(128).optional(),
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

/** productCategory 등 알 수 없는 필드는 Zod 기본 동작으로 무시(스트립)된다. 값은 항상 supplier.productCategory에서만 쓴다. */
export const supplierDynamicProductUpsertSchema = z.object({
  categoryId: positiveNumber,
  sourceLanguage: translationLanguageSchema.optional(),
  imageUrl: z.string().trim().max(500).optional().nullable(),
  formValues: z.record(z.string(), z.unknown()),
});

/** productCategory 요청값은 무시된다. */
export const supplierDynamicProductPatchSchema = z.object({
  categoryId: positiveNumber.optional(),
  sourceLanguage: translationLanguageSchema.optional(),
  imageUrl: z.string().trim().max(500).optional().nullable(),
  formValues: z.record(z.string(), z.unknown()).optional(),
});

/** Prisma Json / JSON.parse 결과에 맞춤(객체·배열·원시·null). */
const prismaJsonValueSchema = z.union([
  z.record(z.string(), z.unknown()),
  z.array(z.unknown()),
  z.string(),
  z.number(),
  z.boolean(),
  z.null(),
]);

export const supplierProductFormFieldSchema = z.object({
  id: z.coerce.number().int().positive().optional(),
  /** 신규 필드는 생략(서버 자동 생성). 기존 필드는 매칭용으로만 전송, 수정 불가. */
  fieldKey: z.preprocess(
    (v) => (v === null || v === "" ? undefined : v),
    z.string().trim().max(100).optional(),
  ),
  /** 비활성(숨김) 필드는 서버에서 field_key 기준으로 보정될 수 있어 빈 값 허용 */
  fieldLabel: z.string().trim().max(150),
  fieldType: supplierProductFieldTypeSchema,
  isRequired: z.boolean().optional(),
  isEnabled: z.boolean().optional(),
  isPrimaryName: z.boolean().optional(),
  isPrimaryPrice: z.boolean().optional(),
  sortOrder: z.preprocess((v) => {
    if (v === null || v === undefined || v === "") return undefined;
    const n = typeof v === "number" ? v : Number(v);
    return Number.isFinite(n) ? Math.trunc(n) : undefined;
  }, z.number().int().optional()),
  placeholderText: z.string().trim().max(200).optional().nullable(),
  helpText: z.string().trim().max(500).optional().nullable(),
  validationJson: prismaJsonValueSchema.optional().nullable(),
});

function normalizeFieldKeyForLabelCoerce(fieldKey: string) {
  const normalized = fieldKey
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
  return normalized || fieldKey.trim().toLowerCase();
}

function coerceSupplierProductFormFieldForParse(field: unknown): unknown {
  if (!field || typeof field !== "object") return field;
  const f = field as Record<string, unknown>;
  const label = typeof f.fieldLabel === "string" ? f.fieldLabel.trim() : "";
  const isEnabled = f.isEnabled !== false;
  const keyRaw = f.fieldKey;
  const key = typeof keyRaw === "string" ? keyRaw.trim() : "";

  if (label.length >= 1) {
    return { ...f, fieldLabel: label };
  }
  if (!isEnabled && key.length > 0) {
    const nk = normalizeFieldKeyForLabelCoerce(key);
    const fallback = SUPPLIER_PRODUCT_FIELD_DEFAULT_LABEL_BY_KEY[nk] ?? key;
    return { ...f, fieldLabel: fallback };
  }
  return { ...f, fieldLabel: label };
}

function coerceSupplierProductFormSaveBody(raw: unknown): unknown {
  if (!raw || typeof raw !== "object") return raw;
  const body = raw as { fields?: unknown };
  if (!Array.isArray(body.fields)) return raw;
  return {
    ...body,
    fields: body.fields.map(coerceSupplierProductFormFieldForParse),
  };
}

const supplierProductFormSaveBodySchema = z
  .object({
    /** 빈 문자열은 서버에서 생략(기존 폼 이름 유지) */
    name: z.preprocess(
      (v) => (v === null || v === undefined || (typeof v === "string" && v.trim() === "") ? undefined : v),
      z.string().trim().min(1).max(120).optional(),
    ),
    isActive: z.boolean().optional(),
    fields: z.array(supplierProductFormFieldSchema).min(1),
  })
  .superRefine((data, ctx) => {
    data.fields.forEach((field, index) => {
      if (field.isEnabled !== false && field.fieldLabel.trim().length < 1) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "표시명을 입력해 주세요.",
          path: ["fields", index, "fieldLabel"],
        });
      }
    });
  });

/** 저장 본문: 숨김 필드 + 빈 표시명 + field_key 있음 → 기본 표시명으로 보정 후 Zod 검증 */
export const supplierProductFormSaveSchema = z.preprocess(
  coerceSupplierProductFormSaveBody,
  supplierProductFormSaveBodySchema,
);

export const supplierProductFieldRequestCreateSchema = z.object({
  requestTitle: z.string().trim().min(1).max(150),
  requestedFieldLabel: z.string().trim().min(1).max(150),
  requestedFieldType: supplierProductFieldTypeSchema,
  requestReason: z.string().trim().min(1).max(1000),
});

export const supplierProductFieldRequestReviewSchema = z.object({
  status: z.enum(["APPROVED", "REJECTED"]),
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

export const bulkProductApproveSchema = z.object({
  productIds: z.array(z.coerce.number().int().positive()).min(1),
});

export const bulkProductRejectSchema = z.object({
  productIds: z.array(z.coerce.number().int().positive()).min(1),
  rejectReason: z.string().trim().min(1).max(1000),
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

export const buyerCartAddSchema = z.object({
  productId: positiveNumber,
  quantity: z.coerce.number().positive(),
});

export const buyerCartItemPatchSchema = z.object({
  itemId: positiveNumber,
  quantity: z.coerce.number().positive(),
});

export const buyerCartItemDeleteSchema = z.object({
  itemId: positiveNumber,
});

export const buyerOrderCheckoutFromCartSchema = z.object({
  checkoutFromCart: z.literal(true),
  memo: z.string().max(1000).optional().nullable(),
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
