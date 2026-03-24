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

/**
 * NUMBER 필드 값만 단가 후보로 파싱한다. 통화 기호·단위가 붙은 문자열에서 첫 숫자 토큰을 추출한다.
 */
export function parseBuyerNumberFieldValue(raw: string | null | undefined): number | null {
  if (raw == null) return null;
  const s = String(raw).trim();
  if (!s) return null;
  const noComma = s.replace(/,/g, "");
  const direct = Number(noComma);
  if (Number.isFinite(direct)) return direct;
  const m = s.match(/-?\d[\d.,]*/);
  if (!m) return null;
  const n = Number(m[0].replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}

export function resolveBuyerDisplayName(fields: BuyerFormFieldRow[], valueByKey: Record<string, string | null>) {
  const list = enabledFieldsSorted(fields);
  /** 대표명/ name 키 없이도, 정렬 순서대로 첫 번째 비어 있지 않은 값을 쓴다. */
  for (const f of list) {
    const v = valueByKey[f.field_key]?.trim();
    if (v && v.length > 0) return v;
  }
  const first = list[0];
  return first ? first.field_label : "—";
}

/** 동적 값이 비어 있을 때 카탈로그용 표시명 (스키마 product_name / product_code, UI에는 고정 컬럼 직접 노출 금지·fallback 전용) */
export function resolveBuyerCatalogDisplayName(
  fields: BuyerFormFieldRow[],
  valueByKey: Record<string, string | null>,
  catalog: { product_name: string; product_code: string },
) {
  const fromForm = resolveBuyerDisplayName(fields, valueByKey);
  if (fromForm !== "—") return fromForm;
  const pn = catalog.product_name?.trim();
  if (pn) return pn;
  const pc = catalog.product_code?.trim();
  if (pc) return pc;
  return "—";
}

export function resolveBuyerUnitPrice(
  fields: BuyerFormFieldRow[],
  valueByKey: Record<string, string | null>,
): number | null {
  const list = enabledFieldsSorted(fields);

  const tryParse = (f: BuyerFormFieldRow): number | null => {
    if (f.field_type !== SupplierProductFieldType.NUMBER) return null;
    return parseBuyerNumberFieldValue(valueByKey[f.field_key]);
  };

  const primary = list.find((f) => f.is_primary_price && f.field_type === SupplierProductFieldType.NUMBER);
  if (primary) {
    const n = tryParse(primary);
    if (n != null) return n;
  }
  const priceKey = list.find((f) => f.field_key === "price" && f.field_type === SupplierProductFieldType.NUMBER);
  if (priceKey) {
    const n = tryParse(priceKey);
    if (n != null) return n;
  }
  for (const f of list) {
    if (f.field_type !== SupplierProductFieldType.NUMBER) continue;
    const n = tryParse(f);
    if (n != null) return n;
  }
  return null;
}

/** 주문 라인 스냅샷: OrderItem 필수 컬럼 — 동적 값 우선, 없으면 빈 문자열/0 */
export function resolveBuyerOrderLineSnapshots(
  fields: BuyerFormFieldRow[],
  valueByKey: Record<string, string | null>,
  catalog?: { product_name: string; product_code: string },
) {
  const sku = valueByKey["sku"]?.trim() ?? "";
  const name = catalog
    ? resolveBuyerCatalogDisplayName(fields, valueByKey, catalog)
    : resolveBuyerDisplayName(fields, valueByKey);
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
