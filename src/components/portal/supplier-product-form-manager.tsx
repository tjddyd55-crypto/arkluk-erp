"use client";

import { useEffect, useState } from "react";

type Supplier = {
  id: number;
  supplier_name: string;
  company_name: string;
};

type FormFieldRow = {
  id?: number;
  /** 서버 부여. 기존 필드만 있음, 신규는 빈 문자열 */
  fieldKey: string;
  fieldLabel: string;
  fieldType: "TEXT" | "TEXTAREA" | "NUMBER" | "SELECT" | "BOOLEAN" | "DATE";
  isRequired: boolean;
  isEnabled: boolean;
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

function mapField(field: ProductFormResponse["fields"][number]): FormFieldRow {
  return {
    id: field.id,
    fieldKey: field.field_key,
    fieldLabel: field.field_label,
    fieldType: field.field_type,
    isRequired: field.is_required,
    isEnabled: field.is_enabled,
    sortOrder: field.sort_order,
    placeholderText: field.placeholder_text ?? "",
    helpText: field.help_text ?? "",
    validationJson: field.validation_json ? JSON.stringify(field.validation_json) : "",
  };
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
  const [showAdvanced, setShowAdvanced] = useState(false);

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

  function addField() {
    setRows((prev) => [
      ...prev,
      {
        fieldKey: "",
        fieldLabel: "",
        fieldType: "TEXT",
        isRequired: false,
        isEnabled: true,
        sortOrder: prev.length > 0 ? Math.max(...prev.map((row) => row.sortOrder)) + 10 : 10,
        placeholderText: "",
        helpText: "",
        validationJson: "",
      },
    ]);
  }

  function updateField(index: number, patch: Partial<FormFieldRow>) {
    setRows((prev) => prev.map((row, idx) => (idx === index ? { ...row, ...patch } : row)));
  }

  function removeField(index: number) {
    setRows((prev) => prev.filter((_, idx) => idx !== index));
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
        fields: rows.map((row) => ({
          id: row.id,
          fieldKey: row.id != null && row.fieldKey.trim() !== "" ? row.fieldKey.trim() : undefined,
          fieldLabel: row.fieldLabel.trim(),
          fieldType: row.fieldType,
          isRequired: row.isRequired,
          isEnabled: row.isEnabled,
          sortOrder: row.sortOrder,
          placeholderText: row.placeholderText.trim() || null,
          helpText: row.helpText.trim() || null,
          validationJson: row.validationJson.trim() ? JSON.parse(row.validationJson) : null,
        })),
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
    <section className="space-y-3 rounded border border-slate-200 bg-white p-4">
      <h2 className="text-lg font-semibold text-slate-900">공급사 상품 입력 폼 설정</h2>
      {error ? <p className="rounded bg-red-50 p-2 text-sm text-red-700">{error}</p> : null}
      {message ? <p className="rounded bg-emerald-50 p-2 text-sm text-emerald-700">{message}</p> : null}

      {loading ? <p className="text-sm text-slate-500">공급사 목록을 불러오는 중...</p> : null}

      {!loading ? (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <select
              className="rounded border border-slate-300 px-2 py-1 text-sm"
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
              className="w-64 rounded border border-slate-300 px-2 py-1 text-sm"
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              placeholder="폼 이름"
            />
            <button
              type="button"
              className="rounded border border-slate-300 px-3 py-1 text-sm"
              onClick={addField}
            >
              필드 추가
            </button>
            <button
              type="button"
              className="rounded bg-slate-900 px-3 py-1 text-sm text-white disabled:opacity-60"
              onClick={saveForm}
              disabled={saving}
            >
              {saving ? "저장 중..." : "폼 저장"}
            </button>
          </div>
          <div className="overflow-auto">
            <table className="min-w-full border-collapse text-sm">
              <thead>
                <tr className="bg-slate-50">
                  <th className="border border-slate-200 px-2 py-1 text-left">내부키</th>
                  <th className="border border-slate-200 px-2 py-1 text-left">표시명</th>
                  <th className="border border-slate-200 px-2 py-1 text-left">타입</th>
                  <th className="border border-slate-200 px-2 py-1 text-left">필수</th>
                  <th className="border border-slate-200 px-2 py-1 text-left">활성</th>
                  <th className="border border-slate-200 px-2 py-1 text-left">순서</th>
                  <th className="border border-slate-200 px-2 py-1 text-left">placeholder</th>
                  <th className="border border-slate-200 px-2 py-1 text-left">help</th>
                  <th className="border border-slate-200 px-2 py-1 text-left">validation(json)</th>
                  <th className="border border-slate-200 px-2 py-1 text-left">삭제</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => (
                  <tr key={`${row.id ?? "new"}-${index}`}>
                    {showAdvanced ? (
                      <td className="border border-slate-200 px-2 py-1">
                        <span className="inline-block w-36 truncate rounded border border-slate-200 bg-slate-50 px-2 py-1 text-xs text-slate-500" title={row.fieldKey || "(신규 저장 시 부여)"}>
                          {row.fieldKey || "(신규 저장 시 부여)"}
                        </span>
                      </td>
                    ) : null}
                    <td className="border border-slate-200 px-2 py-1">
                      <input
                        className="w-36 rounded border border-slate-300 px-2 py-1 text-xs"
                        value={row.fieldLabel}
                        onChange={(e) => updateField(index, { fieldLabel: e.target.value })}
                      />
                    </td>
                    <td className="border border-slate-200 px-2 py-1">
                      <select
                        className="rounded border border-slate-300 px-2 py-1 text-xs"
                        value={row.fieldType}
                        onChange={(e) =>
                          updateField(index, { fieldType: e.target.value as FormFieldRow["fieldType"] })
                        }
                      >
                        {FIELD_TYPE_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="border border-slate-200 px-2 py-1">
                      <input
                        type="checkbox"
                        checked={row.isRequired}
                        onChange={(e) => updateField(index, { isRequired: e.target.checked })}
                      />
                    </td>
                    <td className="border border-slate-200 px-2 py-1">
                      <input
                        type="checkbox"
                        checked={row.isEnabled}
                        onChange={(e) => updateField(index, { isEnabled: e.target.checked })}
                      />
                    </td>
                    <td className="border border-slate-200 px-2 py-1">
                      <input
                        type="number"
                        className="w-20 rounded border border-slate-300 px-2 py-1 text-xs"
                        value={row.sortOrder}
                        onChange={(e) => updateField(index, { sortOrder: Number(e.target.value) })}
                      />
                    </td>
                    <td className="border border-slate-200 px-2 py-1">
                      <input
                        className="w-32 rounded border border-slate-300 px-2 py-1 text-xs"
                        value={row.placeholderText}
                        onChange={(e) => updateField(index, { placeholderText: e.target.value })}
                      />
                    </td>
                    <td className="border border-slate-200 px-2 py-1">
                      <input
                        className="w-32 rounded border border-slate-300 px-2 py-1 text-xs"
                        value={row.helpText}
                        onChange={(e) => updateField(index, { helpText: e.target.value })}
                      />
                    </td>
                    <td className="border border-slate-200 px-2 py-1">
                      <input
                        className="w-40 rounded border border-slate-300 px-2 py-1 text-xs"
                        value={row.validationJson}
                        onChange={(e) => updateField(index, { validationJson: e.target.value })}
                      />
                    </td>
                    <td className="border border-slate-200 px-2 py-1">
                      <button
                        type="button"
                        className="rounded border border-red-300 px-2 py-1 text-xs text-red-700"
                        onClick={() => removeField(index)}
                      >
                        삭제
                      </button>
                    </td>
                  </tr>
                ))}
                {rows.length === 0 ? (
                  <tr>
                    <td className="border border-slate-200 px-2 py-2 text-center text-slate-500" colSpan={showAdvanced ? 11 : 10}>
                      등록된 필드가 없습니다.
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
