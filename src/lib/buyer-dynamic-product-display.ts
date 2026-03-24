import { SupplierProductFieldType } from "@prisma/client";

/** 바이어 UI·장바구니·주문 스냅샷용 (Prisma include 결과와 호환) */
export type BuyerFormFieldRow = {
  id: number;
  field_key: string;
  field_label: string;
  field_type: SupplierProductFieldType;
  is_enabled: boolean;
  is_primary_name: boolean;
  is_primary_price: boolean;
  sort_order: number;
};

export function valueMapFromProductFieldValues(
  rows: Array<{ field: { field_key: string }; value_text: string | null }>,
): Record<string, string | null> {
  const m: Record<string, string | null> = {};
  for (const row of rows) {
    m[row.field.field_key] = row.value_text;
  }
  return m;
}

function enabledFieldsSorted(fields: BuyerFormFieldRow[]) {
  return [...fields].filter((f) => f.is_enabled).sort((a, b) => a.sort_order - b.sort_order || a.id - b.id);
}

export function resolveBuyerDisplayName(fields: BuyerFormFieldRow[], valueByKey: Record<string, string | null>) {
  const list = enabledFieldsSorted(fields);
  const primary = list.find((f) => f.is_primary_name);
  if (primary) {
    const v = valueByKey[primary.field_key]?.trim();
    if (v) return v;
  }
  const nameField = list.find((f) => f.field_key === "name");
  if (nameField) {
    const v = valueByKey[nameField.field_key]?.trim();
    if (v) return v;
  }
  const first = list[0];
  if (first) {
    const v = valueByKey[first.field_key]?.trim();
    return v && v.length > 0 ? v : first.field_label;
  }
  return "—";
}

export function resolveBuyerUnitPrice(
  fields: BuyerFormFieldRow[],
  valueByKey: Record<string, string | null>,
): number | null {
  const list = enabledFieldsSorted(fields);
  const primary = list.find((f) => f.is_primary_price && f.field_type === SupplierProductFieldType.NUMBER);
  const priceField =
    primary ?? list.find((f) => f.field_key === "price" && f.field_type === SupplierProductFieldType.NUMBER);
  if (!priceField) return null;
  const raw = valueByKey[priceField.field_key];
  if (raw == null || String(raw).trim() === "") return null;
  const n = Number(String(raw).replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}

/** 주문 라인 스냅샷: OrderItem 필수 컬럼 — 동적 값 우선, 없으면 빈 문자열/0 */
export function resolveBuyerOrderLineSnapshots(
  fields: BuyerFormFieldRow[],
  valueByKey: Record<string, string | null>,
) {
  const sku = valueByKey["sku"]?.trim() ?? "";
  const name = resolveBuyerDisplayName(fields, valueByKey);
  const spec = valueByKey["specification"]?.trim() ?? "";
  const unit = valueByKey["unit"]?.trim() ?? "";
  const unitPrice = resolveBuyerUnitPrice(fields, valueByKey);
  return {
    productCode: sku.length > 0 ? sku : "—",
    productName: name,
    spec,
    unit,
    unitPrice,
  };
}

export function listDetailFieldRows(
  fields: BuyerFormFieldRow[],
  valueByKey: Record<string, string | null>,
): Array<{ field_key: string; field_label: string; value: string }> {
  return enabledFieldsSorted(fields).map((f) => ({
    field_key: f.field_key,
    field_label: f.field_label,
    value: valueByKey[f.field_key]?.trim() ?? "—",
  }));
}
