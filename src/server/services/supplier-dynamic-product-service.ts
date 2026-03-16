import { Prisma, SupplierProductField, SupplierProductFieldType } from "@prisma/client";

import { HttpError } from "@/lib/http";

type ValidationRule = {
  min?: number;
  max?: number;
  pattern?: string;
  options?: string[];
};

type DynamicValidateInput = {
  fields: Array<Pick<
    SupplierProductField,
    | "id"
    | "field_key"
    | "field_label"
    | "field_type"
    | "is_required"
    | "is_enabled"
    | "validation_json"
  >>;
  values: Record<string, unknown>;
};

type NormalizedDynamicResult = {
  normalizedValues: Record<string, string | null>;
  productCore: {
    sku: string;
    name: string;
    specification: string;
    price: number;
    currency: string;
    description: string | null;
    unit: string;
  };
};

function normalizeBlank(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null;
  }
  const text = String(value).trim();
  return text.length > 0 ? text : null;
}

function parseValidationRules(raw: Prisma.JsonValue | null): ValidationRule {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return {};
  }
  const obj = raw as Record<string, unknown>;
  const options = Array.isArray(obj.options)
    ? obj.options.map((item) => String(item).trim()).filter(Boolean)
    : undefined;
  return {
    min: typeof obj.min === "number" ? obj.min : undefined,
    max: typeof obj.max === "number" ? obj.max : undefined,
    pattern: typeof obj.pattern === "string" ? obj.pattern : undefined,
    options,
  };
}

function validateByFieldType(
  field: DynamicValidateInput["fields"][number],
  value: unknown,
): string | null {
  const rules = parseValidationRules(field.validation_json);
  const text = normalizeBlank(value);
  if (!text) {
    if (field.is_required) {
      throw new HttpError(400, `${field.field_label}은(는) 필수값입니다.`);
    }
    return null;
  }

  if (field.field_type === SupplierProductFieldType.NUMBER) {
    const parsed = Number(text);
    if (Number.isNaN(parsed)) {
      throw new HttpError(400, `${field.field_label}은(는) 숫자여야 합니다.`);
    }
    if (rules.min !== undefined && parsed < rules.min) {
      throw new HttpError(400, `${field.field_label}은(는) ${rules.min} 이상이어야 합니다.`);
    }
    if (rules.max !== undefined && parsed > rules.max) {
      throw new HttpError(400, `${field.field_label}은(는) ${rules.max} 이하여야 합니다.`);
    }
    return String(parsed);
  }

  if (field.field_type === SupplierProductFieldType.BOOLEAN) {
    const lowered = text.toLowerCase();
    if (!["true", "false", "1", "0", "yes", "no"].includes(lowered)) {
      throw new HttpError(400, `${field.field_label}은(는) true/false 값이어야 합니다.`);
    }
    return ["true", "1", "yes"].includes(lowered) ? "true" : "false";
  }

  if (field.field_type === SupplierProductFieldType.DATE) {
    const parsed = new Date(text);
    if (Number.isNaN(parsed.getTime())) {
      throw new HttpError(400, `${field.field_label}의 날짜 형식이 올바르지 않습니다.`);
    }
    return parsed.toISOString().slice(0, 10);
  }

  if (field.field_type === SupplierProductFieldType.SELECT) {
    if (!rules.options || rules.options.length === 0) {
      throw new HttpError(400, `${field.field_label} 선택 옵션이 정의되지 않았습니다.`);
    }
    if (!rules.options.includes(text)) {
      throw new HttpError(400, `${field.field_label}은(는) 허용된 옵션만 입력할 수 있습니다.`);
    }
    return text;
  }

  if (rules.pattern) {
    const regex = new RegExp(rules.pattern);
    if (!regex.test(text)) {
      throw new HttpError(400, `${field.field_label} 입력 형식이 올바르지 않습니다.`);
    }
  }
  if (rules.min !== undefined && text.length < rules.min) {
    throw new HttpError(400, `${field.field_label}은(는) 최소 ${rules.min}자 이상이어야 합니다.`);
  }
  if (rules.max !== undefined && text.length > rules.max) {
    throw new HttpError(400, `${field.field_label}은(는) 최대 ${rules.max}자 이하여야 합니다.`);
  }
  return text;
}

export function validateAndNormalizeDynamicValues(input: DynamicValidateInput): NormalizedDynamicResult {
  const enabledFields = input.fields.filter((field) => field.is_enabled);
  const normalizedValues: Record<string, string | null> = {};

  for (const field of enabledFields) {
    const raw = input.values[field.field_key];
    normalizedValues[field.field_key] = validateByFieldType(field, raw);
  }

  const sku = normalizeBlank(normalizedValues.sku);
  const name = normalizeBlank(normalizedValues.name);
  const specification = normalizeBlank(normalizedValues.specification);
  const price = Number(normalizedValues.price);
  if (!sku || !name || !specification || Number.isNaN(price) || price <= 0) {
    throw new HttpError(400, "핵심 필드(sku/name/specification/price) 값이 올바르지 않습니다.");
  }
  const currency = normalizeBlank(normalizedValues.currency) ?? "KRW";
  const description = normalizeBlank(normalizedValues.description);
  const unit = normalizeBlank(normalizedValues.unit) ?? "EA";

  return {
    normalizedValues,
    productCore: {
      sku,
      name,
      specification,
      price,
      currency: currency.toUpperCase(),
      description,
      unit,
    },
  };
}

export async function upsertSupplierProductFieldValues(
  tx: Prisma.TransactionClient,
  input: {
    productId: number;
    formId: number;
    fields: Array<Pick<SupplierProductField, "id" | "field_key" | "is_enabled">>;
    normalizedValues: Record<string, string | null>;
  },
) {
  const enabledFields = input.fields.filter((field) => field.is_enabled);
  const targetFieldIds = enabledFields.map((field) => field.id);

  await tx.supplierProductFieldValue.deleteMany({
    where: {
      product_id: input.productId,
      field: {
        form_id: input.formId,
        id: { notIn: targetFieldIds.length > 0 ? targetFieldIds : [-1] },
      },
    },
  });

  for (const field of enabledFields) {
    await tx.supplierProductFieldValue.upsert({
      where: {
        product_id_field_id: {
          product_id: input.productId,
          field_id: field.id,
        },
      },
      create: {
        product_id: input.productId,
        field_id: field.id,
        value_text: input.normalizedValues[field.field_key] ?? null,
      },
      update: {
        value_text: input.normalizedValues[field.field_key] ?? null,
      },
    });
  }
}
