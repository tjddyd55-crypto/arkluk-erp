"use client";

import { useEffect, useMemo, useState } from "react";

import { SUPPLIER_PRODUCT_FIELD_DEFAULT_LABEL_BY_KEY } from "@/lib/supplier-product-field-defaults";

type Supplier = {
  id: number;
  supplier_name: string;
  company_name: string;
};

type FormFieldRow = {
  id?: number;
  /** 저장 전 신규 행 식별(정렬 이동용) */
  clientTempId?: string;
  fieldKey: string;
  fieldLabel: string;
  fieldType: "TEXT" | "TEXTAREA" | "NUMBER" | "SELECT" | "BOOLEAN" | "DATE";
  isRequired: boolean;
  isEnabled: boolean;
  isPrimaryName: boolean;
  isPrimaryPrice: boolean;
  sortOrder: number;
  placeholderText: string;
  helpText: string;
  validationJson: string;
};

type ProductFormResponse = {
  id: number;
  supplier_id: number;
  name: string;
  is_active: boolean;
  fields: Array<{
    id: number;
    field_key: string;
    field_label: string;
    field_type: FormFieldRow["fieldType"];
    is_required: boolean;
    is_enabled: boolean;
    sort_order: number;
    placeholder_text: string | null;
    help_text: string | null;
    validation_json: unknown;
    is_primary_name?: boolean;
    is_primary_price?: boolean;
  }>;
};

const FIELD_TYPE_OPTIONS: Array<{ value: FormFieldRow["fieldType"]; label: string }> = [
  { value: "TEXT", label: "텍스트" },
  { value: "TEXTAREA", label: "긴 텍스트" },
  { value: "NUMBER", label: "숫자" },
  { value: "SELECT", label: "선택" },
  { value: "BOOLEAN", label: "참/거짓" },
  { value: "DATE", label: "날짜" },
];

function getFallbackFieldLabel(fieldKey: string, isEnabled: boolean) {
  const normalizedKey = fieldKey.trim().toLowerCase();
  if (isEnabled || normalizedKey === "") {
    return "";
  }
  return SUPPLIER_PRODUCT_FIELD_DEFAULT_LABEL_BY_KEY[normalizedKey] ?? fieldKey.trim();
}

function resolveRowFieldLabel(row: Pick<FormFieldRow, "fieldLabel" | "fieldKey" | "isEnabled">) {
  const label = row.fieldLabel.trim();
  if (label !== "") {
    return label;
  }
  return getFallbackFieldLabel(row.fieldKey, row.isEnabled);
}

function parseValidationJson(raw: string, rowNumber: number) {
  if (raw.trim() === "") {
    return null;
  }
  try {
    return JSON.parse(raw);
  } catch {
    throw new Error(`${rowNumber}번째 필드의 validation JSON 형식이 올바르지 않습니다.`);
  }
}

function buildSaveFields(rows: FormFieldRow[]) {
  return sortRowsForDisplay(rows).map((row, index) => {
    const fieldLabel = resolveRowFieldLabel(row);
    if (fieldLabel === "") {
      throw new Error(`${index + 1}번째 필드의 표시명을 입력해 주세요.`);
    }

    return {
      id: row.id,
      fieldKey: row.id != null && row.fieldKey.trim() !== "" ? row.fieldKey.trim() : undefined,
      fieldLabel,
      fieldType: row.fieldType,
      isRequired: row.isRequired,
      isEnabled: row.isEnabled,
      isPrimaryName: row.isPrimaryName,
      isPrimaryPrice: row.isPrimaryPrice,
      sortOrder: row.sortOrder,
      placeholderText: row.placeholderText.trim() || null,
      helpText: row.helpText.trim() || null,
      validationJson: parseValidationJson(row.validationJson, index + 1),
    };
  });
}

function mapField(field: ProductFormResponse["fields"][number]): FormFieldRow {
  return {
    id: field.id,
    fieldKey: field.field_key,
    fieldLabel: field.field_label.trim() || getFallbackFieldLabel(field.field_key, field.is_enabled),
    fieldType: field.field_type,
    isRequired: field.is_required,
    isEnabled: field.is_enabled,
    isPrimaryName: field.is_primary_name ?? false,
    isPrimaryPrice: field.is_primary_price ?? false,
    sortOrder: field.sort_order,
    placeholderText: field.placeholder_text ?? "",
    helpText: field.help_text ?? "",
    validationJson: field.validation_json ? JSON.stringify(field.validation_json) : "",
  };
}

function rowStableKey(row: FormFieldRow, index: number) {
  return row.id != null ? `id:${row.id}` : `tmp:${row.clientTempId ?? index}`;
}

function sortRowsForDisplay(list: FormFieldRow[]) {
  return [...list].sort((a, b) => {
    if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
    const ak = a.id ?? 0;
    const bk = b.id ?? 0;
    if (ak !== bk) return ak - bk;
    return (a.clientTempId ?? "").localeCompare(b.clientTempId ?? "");
  });
}

export function SupplierProductFormManager() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [selectedSupplierId, setSelectedSupplierId] = useState<number | null>(null);
  const [formName, setFormName] = useState("기본 상품 등록 폼");
  const [rows, setRows] = useState<FormFieldRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  /** 내부키(read-only) + validation(json) 표시 */
  const [showAdvancedSettings, setShowAdvancedSettings] = useState(false);
  /** 필드 추가용: 표시명·타입 입력 후 행 추가 */
  const [composerOpen, setComposerOpen] = useState(false);
  const [newFieldLabel, setNewFieldLabel] = useState("");
  const [newFieldType, setNewFieldType] = useState<FormFieldRow["fieldType"]>("TEXT");

  const displayRows = useMemo(() => sortRowsForDisplay(rows), [rows]);

  const baseColCount = 8;
  const advancedColCount = 4;
  const totalColCount = baseColCount + (showAdvancedSettings ? advancedColCount : 0);

  useEffect(() => {
    async function loadSuppliers() {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch("/api/admin/suppliers");
        const result = await response.json();
        if (!response.ok || !result.success) {
          throw new Error(result.message ?? "공급사 목록 조회 실패");
        }
        const supplierRows = (result.data as Supplier[]).sort((a, b) =>
          (a.company_name ?? a.supplier_name).localeCompare(b.company_name ?? b.supplier_name),
        );
        setSuppliers(supplierRows);
        if (supplierRows.length > 0) {
          setSelectedSupplierId(supplierRows[0].id);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "공급사 목록 조회 실패");
      } finally {
        setLoading(false);
      }
    }
    loadSuppliers();
  }, []);

  async function loadForm(supplierId: number) {
    setError(null);
    setMessage(null);
    try {
      const response = await fetch(`/api/admin/suppliers/${supplierId}/product-form`);
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.message ?? "상품 폼 조회 실패");
      }
      const form = result.data as ProductFormResponse;
      setFormName(form.name);
      setRows(form.fields.map(mapField));
    } catch (err) {
      setError(err instanceof Error ? err.message : "상품 폼 조회 실패");
    }
  }

  useEffect(() => {
    if (!selectedSupplierId) return;
    void loadForm(selectedSupplierId);
  }, [selectedSupplierId]);

  function findRowIndexInState(target: FormFieldRow): number {
    return rows.findIndex((r) => {
      if (target.id != null && r.id === target.id) return true;
      if (target.clientTempId && r.clientTempId === target.clientTempId) return true;
      return false;
    });
  }

  function moveRowInOrder(displayIndex: number, direction: "up" | "down") {
    const sorted = sortRowsForDisplay(rows);
    const j = direction === "up" ? displayIndex - 1 : displayIndex + 1;
    if (j < 0 || j >= sorted.length) return;
    const rowA = sorted[displayIndex];
    const rowB = sorted[j];
    const idxA = findRowIndexInState(rowA);
    const idxB = findRowIndexInState(rowB);
    if (idxA < 0 || idxB < 0) return;
    setRows((prev) => {
      const next = [...prev];
      const soA = next[idxA].sortOrder;
      const soB = next[idxB].sortOrder;
      next[idxA] = { ...next[idxA], sortOrder: soB };
      next[idxB] = { ...next[idxB], sortOrder: soA };
      return next;
    });
  }

  function openFieldComposer() {
    setComposerOpen(true);
    setNewFieldLabel("");
    setNewFieldType("TEXT");
  }

  function confirmAddFieldFromComposer() {
    const label = newFieldLabel.trim();
    if (!label) {
      setError("표시명을 입력해 주세요.");
      return;
    }
    setError(null);
    setRows((prev) => {
      const nextSort =
        prev.length > 0 ? Math.max(...prev.map((r) => r.sortOrder)) + 10 : 10;
      return [
        ...prev,
        {
          clientTempId:
            typeof crypto !== "undefined" && crypto.randomUUID
              ? crypto.randomUUID()
              : `tmp-${Date.now()}`,
          fieldKey: "",
          fieldLabel: label,
          fieldType: newFieldType,
          isRequired: false,
          isEnabled: true,
          isPrimaryName: false,
          isPrimaryPrice: false,
          sortOrder: nextSort,
          placeholderText: "",
          helpText: "",
          validationJson: "",
        },
      ];
    });
    setComposerOpen(false);
    setNewFieldLabel("");
    setNewFieldType("TEXT");
  }

  function updateField(indexInRows: number, patch: Partial<FormFieldRow>) {
    setRows((prev) => prev.map((row, idx) => (idx === indexInRows ? { ...row, ...patch } : row)));
  }

  function updateFieldByDisplayRow(displayRow: FormFieldRow, patch: Partial<FormFieldRow>) {
    const idx = findRowIndexInState(displayRow);
    if (idx >= 0) updateField(idx, patch);
  }

  function requestDeactivateField(displayRow: FormFieldRow) {
    if (!displayRow.isEnabled) return;
    const okConfirm = window.confirm(
      "이 필드를 숨기시겠습니까?\n비활성화된 필드는 입력 폼·엑셀 템플릿에서 제외되며, 기존 상품 데이터는 유지됩니다.",
    );
    if (!okConfirm) return;
    if (displayRow.id == null) {
      setRows((prev) => {
        const i = prev.findIndex(
          (r) => r.clientTempId != null && r.clientTempId === displayRow.clientTempId,
        );
        if (i < 0) return prev;
        return prev.filter((_, idx) => idx !== i);
      });
      return;
    }
    updateFieldByDisplayRow(displayRow, { isEnabled: false });
  }

  function requestReactivateField(displayRow: FormFieldRow) {
    if (displayRow.isEnabled) return;
    updateFieldByDisplayRow(displayRow, { isEnabled: true });
  }

  async function saveForm() {
    if (!selectedSupplierId) {
      setError("공급사를 먼저 선택해 주세요.");
      return;
    }

    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const payload = {
        name: formName.trim(),
        fields: buildSaveFields(rows),
      };
      const response = await fetch(`/api/admin/suppliers/${selectedSupplierId}/product-form`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.message ?? "상품 폼 저장 실패");
      }
      setMessage("공급사 상품 폼이 저장되었습니다.");
      const form = result.data as ProductFormResponse;
      setFormName(form.name);
      setRows(form.fields.map(mapField));
    } catch (err) {
      setError(err instanceof Error ? err.message : "상품 폼 저장 실패");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="space-y-4 rounded border border-[#2d333d] bg-[#1a1d23] p-4">
      <div>
        <h2 className="text-lg font-semibold text-white">공급사 상품 입력 폼 설정</h2>
        <p className="mt-2 text-sm leading-relaxed text-gray-400">
          이 설정은 상품 등록 화면과 엑셀 업로드 구조에 그대로 반영됩니다.
          <span className="font-medium text-gray-300"> 표시명</span>은 엑셀 1행(사용자용 헤더)에
          사용되며, 시스템 식별은 서버가 부여한 내부키로 처리됩니다.
        </p>
      </div>

      {error ? <p className="rounded bg-red-950/30 p-2 text-sm text-red-400">{error}</p> : null}
      {message ? <p className="rounded bg-emerald-50 p-2 text-sm text-emerald-700">{message}</p> : null}

      {loading ? <p className="text-sm text-gray-400">공급사 목록을 불러오는 중...</p> : null}

      {!loading ? (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <select
              className="rounded border border-[#2d333d] px-2 py-1 text-sm"
              value={selectedSupplierId ?? ""}
              onChange={(e) => setSelectedSupplierId(e.target.value ? Number(e.target.value) : null)}
            >
              {suppliers.map((supplier) => (
                <option key={supplier.id} value={supplier.id}>
                  {supplier.company_name ?? supplier.supplier_name}
                </option>
              ))}
            </select>
            <input
              className="w-64 rounded border border-[#2d333d] px-2 py-1 text-sm"
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              placeholder="폼 이름"
            />
            <button
              type="button"
              className="rounded border border-[#2d333d] px-3 py-1 text-sm"
              onClick={openFieldComposer}
            >
              필드 추가
            </button>
            <button
              type="button"
              className="rounded bg-blue-600 px-3 py-1 text-sm text-white disabled:opacity-60"
              onClick={saveForm}
              disabled={saving}
            >
              {saving ? "저장 중..." : "폼 저장"}
            </button>
            <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-400">
              <input
                type="checkbox"
                checked={showAdvancedSettings}
                onChange={(e) => setShowAdvancedSettings(e.target.checked)}
              />
              고급 설정 (내부키·validation·바이어 대표필드)
            </label>
          </div>

          {composerOpen ? (
            <div className="flex flex-wrap items-end gap-2 rounded-md border border-dashed border-[#2d333d] bg-[#111318] p-3">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-gray-400">표시명</label>
                <input
                  className="min-w-[12rem] rounded border border-[#2d333d] px-2 py-1 text-sm"
                  value={newFieldLabel}
                  onChange={(e) => setNewFieldLabel(e.target.value)}
                  placeholder="예: 재고 수량"
                  autoFocus
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-gray-400">타입</label>
                <select
                  className="rounded border border-[#2d333d] px-2 py-1 text-sm"
                  value={newFieldType}
                  onChange={(e) => setNewFieldType(e.target.value as FormFieldRow["fieldType"])}
                >
                  {FIELD_TYPE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <button
                type="button"
                className="rounded bg-[#2a2f3a] px-3 py-1 text-sm text-white hover:bg-[#323842]"
                onClick={confirmAddFieldFromComposer}
              >
                추가
              </button>
              <button
                type="button"
                className="rounded border border-[#2d333d] px-3 py-1 text-sm"
                onClick={() => setComposerOpen(false)}
              >
                취소
              </button>
            </div>
          ) : null}

          <div className="overflow-auto rounded border border-[#2d333d]">
            <table className="min-w-full border-collapse text-sm">
              <thead>
                <tr className="bg-[#111318] text-left text-xs font-semibold uppercase tracking-wide text-gray-400">
                  <th className="border-b border-[#2d333d] px-3 py-2" style={{ minWidth: "14rem" }}>
                    표시명
                  </th>
                  <th className="border-b border-[#2d333d] px-2 py-2">타입</th>
                  <th className="border-b border-[#2d333d] px-2 py-2 text-center" title="필수 입력">
                    필수
                  </th>
                  <th className="border-b border-[#2d333d] px-2 py-2 text-center">활성</th>
                  <th className="border-b border-[#2d333d] px-2 py-2 text-center">순서</th>
                  <th className="border-b border-[#2d333d] px-2 py-2">placeholder</th>
                  <th className="border-b border-[#2d333d] px-2 py-2">도움말</th>
                  {showAdvancedSettings ? (
                    <>
                      <th className="border-b border-[#2d333d] px-2 py-2">validation (JSON)</th>
                      <th className="border-b border-[#2d333d] px-2 py-2">내부키</th>
                      <th className="border-b border-[#2d333d] px-2 py-2 text-center" title="바이어 상품 목록 대표명">
                        대표명
                      </th>
                      <th className="border-b border-[#2d333d] px-2 py-2 text-center" title="바이어 상품 목록 대표 단가">
                        대표가
                      </th>
                    </>
                  ) : null}
                  <th className="border-b border-[#2d333d] px-2 py-2 text-center">비활성화</th>
                </tr>
              </thead>
              <tbody>
                {displayRows.map((row, displayIndex) => {
                  const stateIdx = findRowIndexInState(row);
                  const disabledVisual = !row.isEnabled;
                  return (
                    <tr
                      key={rowStableKey(row, displayIndex)}
                      className={disabledVisual ? "bg-[#111318]/80 text-gray-400" : ""}
                    >
                      <td className="border-b border-[#2d333d] px-3 py-2">
                        <input
                          className="w-full min-w-[12rem] rounded border border-[#2d333d] px-2 py-1.5 text-sm font-medium text-white"
                          value={row.fieldLabel}
                          onChange={(e) => stateIdx >= 0 && updateField(stateIdx, { fieldLabel: e.target.value })}
                          disabled={stateIdx < 0}
                        />
                      </td>
                      <td className="border-b border-[#2d333d] px-2 py-2">
                        <select
                          className="rounded border border-[#2d333d] px-2 py-1 text-xs"
                          value={row.fieldType}
                          onChange={(e) =>
                            stateIdx >= 0 &&
                            updateField(stateIdx, {
                              fieldType: e.target.value as FormFieldRow["fieldType"],
                            })
                          }
                          disabled={stateIdx < 0}
                        >
                          {FIELD_TYPE_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="border-b border-[#2d333d] px-2 py-2 text-center">
                        <button
                          type="button"
                          title={row.isRequired ? "필수 입력" : "선택 입력"}
                          className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-[#2d333d] bg-[#1a1d23] text-lg leading-none text-gray-300 hover:bg-[#23272f]"
                          onClick={() =>
                            stateIdx >= 0 && updateField(stateIdx, { isRequired: !row.isRequired })
                          }
                          disabled={stateIdx < 0}
                        >
                          {row.isRequired ? "✓" : "—"}
                        </button>
                      </td>
                      <td className="border-b border-[#2d333d] px-2 py-2 text-center">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
                            row.isEnabled
                              ? "bg-emerald-950/40 text-emerald-300"
                              : "bg-[#2d333d] text-gray-400"
                          }`}
                        >
                          {row.isEnabled ? "노출" : "숨김"}
                        </span>
                      </td>
                      <td className="border-b border-[#2d333d] px-1 py-2 text-center">
                        <div className="inline-flex flex-col gap-0.5">
                          <button
                            type="button"
                            className="rounded border border-[#2d333d] px-1.5 py-0 text-xs hover:bg-[#23272f] disabled:opacity-40"
                            disabled={displayIndex === 0}
                            onClick={() => moveRowInOrder(displayIndex, "up")}
                            title="위로"
                          >
                            ▲
                          </button>
                          <button
                            type="button"
                            className="rounded border border-[#2d333d] px-1.5 py-0 text-xs hover:bg-[#23272f] disabled:opacity-40"
                            disabled={displayIndex >= displayRows.length - 1}
                            onClick={() => moveRowInOrder(displayIndex, "down")}
                            title="아래로"
                          >
                            ▼
                          </button>
                        </div>
                      </td>
                      <td className="border-b border-[#2d333d] px-2 py-2">
                        <input
                          className="w-36 max-w-full rounded border border-[#2d333d] px-2 py-1 text-xs"
                          value={row.placeholderText}
                          onChange={(e) =>
                            stateIdx >= 0 && updateField(stateIdx, { placeholderText: e.target.value })
                          }
                          disabled={stateIdx < 0}
                        />
                      </td>
                      <td className="border-b border-[#2d333d] px-2 py-2">
                        <input
                          className="w-36 max-w-full rounded border border-[#2d333d] px-2 py-1 text-xs"
                          value={row.helpText}
                          onChange={(e) => stateIdx >= 0 && updateField(stateIdx, { helpText: e.target.value })}
                          disabled={stateIdx < 0}
                        />
                      </td>
                      {showAdvancedSettings ? (
                        <>
                          <td className="border-b border-[#2d333d] px-2 py-2">
                            <input
                              className="w-44 max-w-full rounded border border-[#2d333d] px-2 py-1 font-mono text-xs"
                              value={row.validationJson}
                              onChange={(e) =>
                                stateIdx >= 0 && updateField(stateIdx, { validationJson: e.target.value })
                              }
                              placeholder='{"min":0}'
                              disabled={stateIdx < 0}
                            />
                          </td>
                          <td className="border-b border-[#2d333d] px-2 py-2">
                            <span
                              className="inline-block max-w-[10rem] truncate rounded border border-[#2d333d] bg-[#111318] px-2 py-1 font-mono text-xs text-gray-400"
                              title={row.fieldKey || "저장 시 서버에서 부여"}
                            >
                              {row.fieldKey || "— (저장 시 부여)"}
                            </span>
                          </td>
                          <td className="border-b border-[#2d333d] px-2 py-2 text-center">
                            <input
                              type="checkbox"
                              checked={row.isPrimaryName}
                              onChange={(e) =>
                                stateIdx >= 0 &&
                                updateField(stateIdx, { isPrimaryName: e.target.checked })
                              }
                              disabled={stateIdx < 0}
                              title="바이어 목록 대표 표시명"
                            />
                          </td>
                          <td className="border-b border-[#2d333d] px-2 py-2 text-center">
                            <input
                              type="checkbox"
                              checked={row.isPrimaryPrice}
                              onChange={(e) =>
                                stateIdx >= 0 &&
                                updateField(stateIdx, { isPrimaryPrice: e.target.checked })
                              }
                              disabled={stateIdx < 0}
                              title="바이어 목록 대표 단가(숫자 필드 권장)"
                            />
                          </td>
                        </>
                      ) : null}
                      <td className="border-b border-[#2d333d] px-2 py-2 text-center">
                        {row.isEnabled ? (
                          <button
                            type="button"
                            className="rounded border border-amber-700/50 bg-amber-950/30 px-2 py-1 text-xs font-medium text-amber-200 hover:bg-amber-950/50"
                            onClick={() => requestDeactivateField(row)}
                          >
                            비활성화
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="rounded border border-[#2d333d] bg-[#1a1d23] px-2 py-1 text-xs font-medium text-gray-300 hover:bg-[#23272f]"
                            onClick={() => requestReactivateField(row)}
                          >
                            다시 노출
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {rows.length === 0 ? (
                  <tr>
                    <td className="px-3 py-6 text-center text-gray-400" colSpan={totalColCount}>
                      등록된 필드가 없습니다. 「필드 추가」로 항목을 만드세요.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </>
      ) : null}
    </section>
  );
}
