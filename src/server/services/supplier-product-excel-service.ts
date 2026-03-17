import * as XLSX from "xlsx";

/** 1행: 표시명(사용자용), 2행: 내부키(시스템용). 업로드 시 field_key 우선 매핑. */
export function buildSupplierProductExcelTemplate(input: {
  columns: Array<{ label: string; fieldKey: string }>;
}) {
  const row1 = ["카테고리", ...input.columns.map((c) => c.label), "이미지URL(선택)"];
  const row2 = ["", ...input.columns.map((c) => c.fieldKey), ""];
  const worksheet = XLSX.utils.aoa_to_sheet([row1, row2]);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "supplier_products");
  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
}

export type ParsedSupplierProductSheet = {
  /** 1행: 표시명 */
  headerLabels: string[];
  /** 2행: 내부키 (매핑 우선 사용) */
  headerKeys: string[];
  /** 3행부터 데이터 */
  dataRows: unknown[][];
};

/** 1·2행을 헤더로 파싱하고, 3행부터 데이터 행 반환. */
export function parseSupplierProductExcelWithHeaders(
  buffer: Buffer,
): ParsedSupplierProductSheet | null {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const firstSheetName = workbook.SheetNames[0];
  const firstSheet = workbook.Sheets[firstSheetName];
  if (!firstSheet) return null;
  const aoa = XLSX.utils.sheet_to_json<unknown[]>(firstSheet, {
    header: 1,
    defval: "",
    raw: false,
  }) as unknown[][];
  if (aoa.length < 2) return null;
  const len = Math.max((aoa[0] as unknown[]).length, (aoa[1] as unknown[]).length, 1);
  const headerLabels = Array.from({ length: len }, (_, i) =>
    String((aoa[0] as unknown[])[i] ?? "").trim(),
  );
  const headerKeys = Array.from({ length: len }, (_, i) =>
    String((aoa[1] as unknown[])[i] ?? "").trim(),
  );
  const dataRows = aoa.slice(2).filter((row) =>
    (row as unknown[]).some((cell) => cell != null && String(cell).trim() !== ""),
  );
  return { headerLabels, headerKeys, dataRows };
}

/** 레거시: 1행만 헤더로 사용. 기존 엑셀 fallback용. */
export function parseSupplierProductExcelRows(buffer: Buffer) {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const firstSheetName = workbook.SheetNames[0];
  const firstSheet = workbook.Sheets[firstSheetName];
  if (!firstSheet) {
    return [];
  }
  return XLSX.utils.sheet_to_json(firstSheet, { defval: "" }) as Array<Record<string, unknown>>;
}
