import { Prisma, SupplierProductFieldType } from "@prisma/client";

import { HttpError } from "@/lib/http";
import { prisma } from "@/lib/prisma";

export const CORE_PRODUCT_FIELD_KEYS = ["sku", "name", "specification", "price"] as const;
export const DEFAULT_SUPPLIER_PRODUCT_FORM_NAME = "기본 상품 등록 폼";

export type ProductFormFieldInput = {
  id?: number;
  fieldKey: string;
  fieldLabel: string;
  fieldType: SupplierProductFieldType;
  isRequired?: boolean;
  isEnabled?: boolean;
  sortOrder?: number;
  placeholderText?: string | null;
  helpText?: string | null;
  validationJson?: unknown;
};

export const DEFAULT_SUPPLIER_PRODUCT_FIELDS: ProductFormFieldInput[] = [
  { fieldKey: "sku", fieldLabel: "SKU", fieldType: SupplierProductFieldType.TEXT, isRequired: true, sortOrder: 10 },
  { fieldKey: "name", fieldLabel: "상품명", fieldType: SupplierProductFieldType.TEXT, isRequired: true, sortOrder: 20 },
  {
    fieldKey: "specification",
    fieldLabel: "규격",
    fieldType: SupplierProductFieldType.TEXT,
    isRequired: true,
    sortOrder: 30,
  },
  {
    fieldKey: "price",
    fieldLabel: "가격",
    fieldType: SupplierProductFieldType.NUMBER,
    isRequired: true,
    sortOrder: 40,
    validationJson: { min: 0.01 },
  },
  {
    fieldKey: "currency",
    fieldLabel: "통화",
    fieldType: SupplierProductFieldType.TEXT,
    isRequired: false,
    sortOrder: 50,
    placeholderText: "KRW",
  },
  {
    fieldKey: "description",
    fieldLabel: "상품 설명",
    fieldType: SupplierProductFieldType.TEXTAREA,
    isRequired: false,
    sortOrder: 60,
  },
  {
    fieldKey: "unit",
    fieldLabel: "단위",
    fieldType: SupplierProductFieldType.TEXT,
    isRequired: false,
    sortOrder: 70,
    placeholderText: "EA",
  },
];

type FormWithFields = Prisma.SupplierProductFormGetPayload<{
  include: {
    fields: {
      orderBy: [{ sort_order: "asc" }, { id: "asc" }];
    };
  };
}>;

type TxClient = Prisma.TransactionClient | typeof prisma;

function normalizeFieldKey(fieldKey: string) {
  const normalized = fieldKey
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
  if (!normalized) {
    throw new HttpError(400, "field_key는 영문/숫자/언더스코어 조합이어야 합니다.");
  }
  return normalized;
}

function normalizeFieldInput(input: ProductFormFieldInput, index: number): ProductFormFieldInput {
  if (!input.fieldLabel?.trim()) {
    throw new HttpError(400, "field_label은 필수입니다.");
  }
  return {
    ...input,
    fieldKey: normalizeFieldKey(input.fieldKey),
    fieldLabel: input.fieldLabel.trim(),
    isRequired: input.isRequired ?? false,
    isEnabled: input.isEnabled ?? true,
    sortOrder: input.sortOrder ?? (index + 1) * 10,
    placeholderText: input.placeholderText?.trim() || null,
    helpText: input.helpText?.trim() || null,
    validationJson: input.validationJson ?? null,
  };
}

function toJsonValue(
  value: unknown,
): Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (value === null) {
    return Prisma.JsonNull;
  }
  const cloned = JSON.parse(JSON.stringify(value)) as Prisma.JsonValue;
  return cloned === null ? Prisma.JsonNull : (cloned as Prisma.InputJsonValue);
}

function validateFieldSet(fields: ProductFormFieldInput[]) {
  const normalizedFields = fields.map(normalizeFieldInput);
  const uniqueKeys = new Set<string>();
  for (const field of normalizedFields) {
    if (uniqueKeys.has(field.fieldKey)) {
      throw new HttpError(400, `중복 field_key가 있습니다. (${field.fieldKey})`);
    }
    uniqueKeys.add(field.fieldKey);
  }

  for (const coreKey of CORE_PRODUCT_FIELD_KEYS) {
    const coreField = normalizedFields.find((field) => field.fieldKey === coreKey);
    if (!coreField || !coreField.isEnabled || !coreField.isRequired) {
      throw new HttpError(
        400,
        `핵심 필드(${coreKey})는 활성화된 필수값이어야 합니다.`,
      );
    }
  }
  return normalizedFields;
}

async function createDefaultForm(
  supplierId: number,
  actorId: number | null,
  tx: TxClient,
) {
  const created = await tx.supplierProductForm.create({
    data: {
      supplier_id: supplierId,
      name: DEFAULT_SUPPLIER_PRODUCT_FORM_NAME,
      is_active: true,
      created_by: actorId,
      updated_by: actorId,
      fields: {
        create: DEFAULT_SUPPLIER_PRODUCT_FIELDS.map((field) => ({
          field_key: field.fieldKey,
          field_label: field.fieldLabel,
          field_type: field.fieldType,
          is_required: field.isRequired ?? false,
          is_enabled: true,
          sort_order: field.sortOrder ?? 0,
          placeholder_text: field.placeholderText ?? null,
          help_text: field.helpText ?? null,
          validation_json: toJsonValue(field.validationJson),
        })),
      },
    },
    include: {
      fields: {
        orderBy: [{ sort_order: "asc" }, { id: "asc" }],
      },
    },
  });
  return created;
}

export async function ensureSupplierActiveProductForm(
  supplierId: number,
  actorId: number | null,
  tx: TxClient = prisma,
): Promise<FormWithFields> {
  const existing = await tx.supplierProductForm.findFirst({
    where: { supplier_id: supplierId, is_active: true },
    include: {
      fields: {
        orderBy: [{ sort_order: "asc" }, { id: "asc" }],
      },
    },
  });
  if (existing) {
    if (existing.fields.length > 0) {
      return existing;
    }
    await tx.supplierProductField.createMany({
      data: DEFAULT_SUPPLIER_PRODUCT_FIELDS.map((field) => ({
        form_id: existing.id,
        field_key: field.fieldKey,
        field_label: field.fieldLabel,
        field_type: field.fieldType,
        is_required: field.isRequired ?? false,
        is_enabled: true,
        sort_order: field.sortOrder ?? 0,
        placeholder_text: field.placeholderText ?? null,
        help_text: field.helpText ?? null,
        validation_json: toJsonValue(field.validationJson),
      })),
      skipDuplicates: true,
    });
    return tx.supplierProductForm.findUniqueOrThrow({
      where: { id: existing.id },
      include: {
        fields: {
          orderBy: [{ sort_order: "asc" }, { id: "asc" }],
        },
      },
    });
  }

  return createDefaultForm(supplierId, actorId, tx);
}

export async function getSupplierActiveProductForm(
  supplierId: number,
  actorId: number | null = null,
  tx: TxClient = prisma,
) {
  return ensureSupplierActiveProductForm(supplierId, actorId, tx);
}

export async function saveSupplierProductForm(input: {
  supplierId: number;
  actorId: number;
  name?: string;
  isActive?: boolean;
  fields: ProductFormFieldInput[];
}) {
  const normalizedFields = validateFieldSet(input.fields);

  return prisma.$transaction(async (tx) => {
    const supplier = await tx.supplier.findUnique({ where: { id: input.supplierId }, select: { id: true } });
    if (!supplier) {
      throw new HttpError(404, "공급사를 찾을 수 없습니다.");
    }

    const form = await ensureSupplierActiveProductForm(input.supplierId, input.actorId, tx);

    const updatedForm = await tx.supplierProductForm.update({
      where: { id: form.id },
      data: {
        name: input.name?.trim() || form.name,
        is_active: input.isActive ?? true,
        updated_by: input.actorId,
      },
    });

    const existingFields = await tx.supplierProductField.findMany({
      where: { form_id: form.id },
      select: { id: true, field_key: true },
    });
    const existingById = new Map(existingFields.map((field) => [field.id, field]));
    const existingByKey = new Map(existingFields.map((field) => [field.field_key, field]));
    const keepFieldIds = new Set<number>();

    for (const field of normalizedFields) {
      const existing = (field.id ? existingById.get(field.id) : undefined) ?? existingByKey.get(field.fieldKey);
      if (existing) {
        await tx.supplierProductField.update({
          where: { id: existing.id },
          data: {
            field_key: field.fieldKey,
            field_label: field.fieldLabel,
            field_type: field.fieldType,
            is_required: field.isRequired ?? false,
            is_enabled: field.isEnabled ?? true,
            sort_order: field.sortOrder ?? 0,
            placeholder_text: field.placeholderText ?? null,
            help_text: field.helpText ?? null,
            validation_json: toJsonValue(field.validationJson),
          },
        });
        keepFieldIds.add(existing.id);
      } else {
        const created = await tx.supplierProductField.create({
          data: {
            form_id: form.id,
            field_key: field.fieldKey,
            field_label: field.fieldLabel,
            field_type: field.fieldType,
            is_required: field.isRequired ?? false,
            is_enabled: field.isEnabled ?? true,
            sort_order: field.sortOrder ?? 0,
            placeholder_text: field.placeholderText ?? null,
            help_text: field.helpText ?? null,
            validation_json: toJsonValue(field.validationJson),
          },
          select: { id: true },
        });
        keepFieldIds.add(created.id);
      }
    }

    const deleteTargets = existingFields.filter((field) => !keepFieldIds.has(field.id));
    for (const deleteTarget of deleteTargets) {
      const valueCount = await tx.supplierProductFieldValue.count({
        where: { field_id: deleteTarget.id },
      });
      if (valueCount > 0) {
        throw new HttpError(
          400,
          `입력 데이터가 있는 필드(${deleteTarget.field_key})는 삭제할 수 없습니다. 비활성화 후 사용해 주세요.`,
        );
      }
      await tx.supplierProductField.delete({ where: { id: deleteTarget.id } });
    }

    const saved = await tx.supplierProductForm.findUniqueOrThrow({
      where: { id: updatedForm.id },
      include: {
        fields: {
          orderBy: [{ sort_order: "asc" }, { id: "asc" }],
        },
      },
    });

    return saved;
  });
}
