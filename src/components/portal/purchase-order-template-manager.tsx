"use client";

import { FormEvent, useEffect, useState } from "react";

type Supplier = {
  id: number;
  supplier_name: string;
};

type TemplateRow = {
  id: number;
  supplier_id: number | null;
  template_name: string;
  title_ko: string;
  title_en: string;
  buyer_name: string | null;
  footer_note: string | null;
  is_default: boolean;
  is_active: boolean;
  supplier: { supplier_name: string } | null;
};

type TemplateForm = {
  supplierId: string;
  templateName: string;
  titleKo: string;
  titleEn: string;
  buyerName: string;
  footerNote: string;
  isDefault: boolean;
  isActive: boolean;
};

const initialForm: TemplateForm = {
  supplierId: "",
  templateName: "",
  titleKo: "발주서",
  titleEn: "Purchase Order",
  buyerName: "우리 회사명",
  footerNote: "",
  isDefault: false,
  isActive: true,
};

export function PurchaseOrderTemplateManager() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [templates, setTemplates] = useState<TemplateRow[]>([]);
  const [form, setForm] = useState<TemplateForm>(initialForm);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function loadData() {
    setLoading(true);
    setError(null);
    try {
      const [suppliersResponse, templatesResponse] = await Promise.all([
        fetch("/api/admin/suppliers"),
        fetch("/api/admin/purchase-order-templates"),
      ]);
      const suppliersResult = await suppliersResponse.json();
      const templatesResult = await templatesResponse.json();

      if (!suppliersResponse.ok || !suppliersResult.success) {
        throw new Error(suppliersResult.message ?? "공급사 조회 실패");
      }
      if (!templatesResponse.ok || !templatesResult.success) {
        throw new Error(templatesResult.message ?? "템플릿 조회 실패");
      }

      setSuppliers(suppliersResult.data as Supplier[]);
      setTemplates(templatesResult.data as TemplateRow[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "데이터 조회 실패");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  async function submitTemplate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setMessage(null);
    setError(null);
    try {
      const payload = {
        supplierId: form.supplierId ? Number(form.supplierId) : null,
        templateName: form.templateName,
        titleKo: form.titleKo,
        titleEn: form.titleEn,
        buyerName: form.buyerName || null,
        footerNote: form.footerNote || null,
        isDefault: form.isDefault,
        isActive: form.isActive,
      };
      const response = await fetch("/api/admin/purchase-order-templates", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.message ?? "템플릿 생성 실패");
      }
      setMessage("템플릿 생성 완료");
      setForm(initialForm);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "템플릿 생성 실패");
    } finally {
      setPending(false);
    }
  }

  async function toggleTemplate(row: TemplateRow, active: boolean) {
    setPending(true);
    setMessage(null);
    setError(null);
    try {
      const response = await fetch(`/api/admin/purchase-order-templates/${row.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ isActive: active }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.message ?? "템플릿 상태 변경 실패");
      }
      setMessage("템플릿 상태 변경 완료");
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "템플릿 상태 변경 실패");
    } finally {
      setPending(false);
    }
  }

  async function setDefaultTemplate(row: TemplateRow) {
    setPending(true);
    setMessage(null);
    setError(null);
    try {
      const response = await fetch(`/api/admin/purchase-order-templates/${row.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ isDefault: true, isActive: true }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.message ?? "기본 템플릿 지정 실패");
      }
      setMessage("기본 템플릿 지정 완료");
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "기본 템플릿 지정 실패");
    } finally {
      setPending(false);
    }
  }

  if (loading) {
    return <p className="text-sm text-gray-400">템플릿 정보를 불러오는 중...</p>;
  }

  return (
    <div className="space-y-4">
      <form
        className="rounded border border-[#2d333d] bg-[#1a1d23] p-4"
        onSubmit={submitTemplate}
      >
        <h2 className="text-lg font-semibold text-white">템플릿 생성</h2>
        <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
          <label className="text-sm">
            <span className="mb-1 block text-gray-400">공급사(비워두면 공통)</span>
            <select
              value={form.supplierId}
              onChange={(e) => setForm((prev) => ({ ...prev, supplierId: e.target.value }))}
              className="w-full rounded border border-[#2d333d] px-2 py-1"
            >
              <option value="">공통 템플릿</option>
              {suppliers.map((supplier) => (
                <option key={supplier.id} value={supplier.id}>
                  {supplier.supplier_name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-gray-400">템플릿명</span>
            <input
              value={form.templateName}
              onChange={(e) => setForm((prev) => ({ ...prev, templateName: e.target.value }))}
              className="w-full rounded border border-[#2d333d] px-2 py-1"
              required
            />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-gray-400">한글 제목</span>
            <input
              value={form.titleKo}
              onChange={(e) => setForm((prev) => ({ ...prev, titleKo: e.target.value }))}
              className="w-full rounded border border-[#2d333d] px-2 py-1"
              required
            />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-gray-400">영문 제목</span>
            <input
              value={form.titleEn}
              onChange={(e) => setForm((prev) => ({ ...prev, titleEn: e.target.value }))}
              className="w-full rounded border border-[#2d333d] px-2 py-1"
              required
            />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-gray-400">발주처 표시명</span>
            <input
              value={form.buyerName}
              onChange={(e) => setForm((prev) => ({ ...prev, buyerName: e.target.value }))}
              className="w-full rounded border border-[#2d333d] px-2 py-1"
            />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-gray-400">하단 문구</span>
            <input
              value={form.footerNote}
              onChange={(e) => setForm((prev) => ({ ...prev, footerNote: e.target.value }))}
              className="w-full rounded border border-[#2d333d] px-2 py-1"
            />
          </label>
        </div>
        <div className="mt-3 flex items-center gap-4 text-sm">
          <label className="flex items-center gap-1">
            <input
              type="checkbox"
              checked={form.isDefault}
              onChange={(e) => setForm((prev) => ({ ...prev, isDefault: e.target.checked }))}
            />
            기본 템플릿
          </label>
          <label className="flex items-center gap-1">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(e) => setForm((prev) => ({ ...prev, isActive: e.target.checked }))}
            />
            활성화
          </label>
          <button
            type="submit"
            disabled={pending}
            className="rounded bg-blue-600 px-3 py-1 text-white disabled:opacity-60"
          >
            {pending ? "처리 중..." : "템플릿 생성"}
          </button>
        </div>
      </form>

      {message ? (
        <p className="rounded bg-emerald-50 p-3 text-sm text-emerald-700">{message}</p>
      ) : null}
      {error ? <p className="rounded bg-red-950/30 p-3 text-sm text-red-400">{error}</p> : null}

      <section className="overflow-auto rounded border border-[#2d333d] bg-[#1a1d23] p-4">
        <h2 className="text-lg font-semibold text-white">템플릿 목록</h2>
        <table className="mt-3 min-w-full border-collapse text-sm">
          <thead>
            <tr className="bg-[#111318]">
              <th className="border border-[#2d333d] px-2 py-1 text-left">템플릿명</th>
              <th className="border border-[#2d333d] px-2 py-1 text-left">대상 공급사</th>
              <th className="border border-[#2d333d] px-2 py-1 text-left">기본 여부</th>
              <th className="border border-[#2d333d] px-2 py-1 text-left">활성</th>
              <th className="border border-[#2d333d] px-2 py-1 text-left">작업</th>
            </tr>
          </thead>
          <tbody>
            {templates.map((row) => (
              <tr key={row.id}>
                <td className="border border-[#2d333d] px-2 py-1">
                  {row.template_name}
                  <p className="text-xs text-gray-400">
                    {row.title_ko} / {row.title_en}
                  </p>
                </td>
                <td className="border border-[#2d333d] px-2 py-1">
                  {row.supplier?.supplier_name ?? "공통"}
                </td>
                <td className="border border-[#2d333d] px-2 py-1">{row.is_default ? "Y" : "N"}</td>
                <td className="border border-[#2d333d] px-2 py-1">{row.is_active ? "Y" : "N"}</td>
                <td className="border border-[#2d333d] px-2 py-1">
                  <div className="flex gap-1">
                    <button
                      type="button"
                      className="rounded border border-[#2d333d] px-2 py-1 text-xs"
                      disabled={pending}
                      onClick={() => setDefaultTemplate(row)}
                    >
                      기본 지정
                    </button>
                    <button
                      type="button"
                      className="rounded border border-[#2d333d] px-2 py-1 text-xs"
                      disabled={pending}
                      onClick={() => toggleTemplate(row, !row.is_active)}
                    >
                      {row.is_active ? "비활성화" : "활성화"}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
