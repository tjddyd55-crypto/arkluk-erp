import * as XLSX from "xlsx";

export function buildSupplierProductExcelTemplate(input: {
  labels: string[];
}) {
  const headers = ["카테고리", ...input.labels, "이미지URL(선택)"];
  const worksheet = XLSX.utils.aoa_to_sheet([headers]);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "supplier_products");
  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
}

export function parseSupplierProductExcelRows(buffer: Buffer) {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const firstSheetName = workbook.SheetNames[0];
  const firstSheet = workbook.Sheets[firstSheetName];
  if (!firstSheet) {
    return [];
  }
  return XLSX.utils.sheet_to_json(firstSheet, { defval: "" }) as Array<Record<string, unknown>>;
}
