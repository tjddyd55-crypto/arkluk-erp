"use client";

import { useEffect, useMemo, useState } from "react";

type SupplierStatus = "PENDING" | "ACTIVE" | "INACTIVE" | "SUSPENDED";

type Supplier = {
  id: number;
  company_name: string;
  company_code: string | null;
  country_code: string;
  business_number: string | null;
  representative_name: string | null;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  address: string | null;
  status: SupplierStatus;
  order_email: string;
  created_at: string;
  updated_at: string;
};

type FormState = {
  companyName: string;
  companyCode: string;
  countryCode: string;
  businessNumber: string;
  representativeName: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  address: string;
  status: SupplierStatus;
  orderEmail: string;
};

const INITIAL_FORM: FormState = {
  companyName: "",
  companyCode: "",
  countryCode: "KR",
  businessNumber: "",
  representativeName: "",
  contactName: "",
  contactEmail: "",
  contactPhone: "",
  address: "",
  status: "PENDING",
  orderEmail: "",
};

const statusLabel: Record<SupplierStatus, string> = {
  PENDING: "승인 대기",
  ACTIVE: "활성",
  INACTIVE: "비활성",
  SUSPENDED: "정지",
};

function normalizeOptional(value: string) {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function SupplierManagement() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [actionSupplierId, setActionSupplierId] = useState<number | null>(null);

  const sortedSuppliers = useMemo(
    () =>
      [...suppliers].sort((a, b) =>
        a.company_name.localeCompare(b.company_name, "ko-KR", { sensitivity: "base" }),
      ),
    [suppliers],
  );

  async function loadSuppliers() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/suppliers");
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.message ?? "공급사 목록 조회 실패");
      }
      setSuppliers(result.data as Supplier[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "공급사 목록 조회 실패");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadSuppliers();
  }, []);

  function openCreateForm() {
    setEditingId(null);
    setForm(INITIAL_FORM);
    setFormOpen(true);
    setError(null);
    setMessage(null);
  }

  function openEditForm(supplier: Supplier) {
    setEditingId(supplier.id);
    setForm({
      companyName: supplier.company_name,
      companyCode: supplier.company_code ?? "",
      countryCode: supplier.country_code,
      businessNumber: supplier.business_number ?? "",
      representativeName: supplier.representative_name ?? "",
      contactName: supplier.contact_name ?? "",
      contactEmail: supplier.contact_email ?? "",
      contactPhone: supplier.contact_phone ?? "",
      address: supplier.address ?? "",
      status: supplier.status,
      orderEmail: supplier.order_email,
    });
    setFormOpen(true);
    setError(null);
    setMessage(null);
  }

  async function submitForm() {
    setError(null);
    setMessage(null);

    if (!form.companyName.trim() || !form.companyCode.trim() || !form.contactEmail.trim()) {
      setError("회사명, 회사코드, 담당자 이메일은 필수입니다.");
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        companyName: form.companyName.trim(),
        companyCode: form.companyCode.trim(),
        countryCode: form.countryCode.trim().toUpperCase(),
        businessNumber: normalizeOptional(form.businessNumber),
        representativeName: normalizeOptional(form.representativeName),
        contactName: normalizeOptional(form.contactName),
        contactEmail: form.contactEmail.trim(),
        contactPhone: normalizeOptional(form.contactPhone),
        address: normalizeOptional(form.address),
        status: form.status,
        orderEmail: normalizeOptional(form.orderEmail) ?? form.contactEmail.trim(),
      };

      const targetUrl =
        editingId === null ? "/api/admin/suppliers" : `/api/admin/suppliers/${editingId}`;
      const method = editingId === null ? "POST" : "PATCH";
      const response = await fetch(targetUrl, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.message ?? "공급사 저장 실패");
      }

      setMessage(editingId === null ? "공급사가 생성되었습니다." : "공급사 정보가 수정되었습니다.");
      setFormOpen(false);
      setEditingId(null);
      setForm(INITIAL_FORM);
      await loadSuppliers();
    } catch (err) {
      setError(err instanceof Error ? err.message : "공급사 저장 실패");
    } finally {
      setSubmitting(false);
    }
  }

  async function updateSupplierStatus(supplierId: number, status: SupplierStatus) {
    setActionSupplierId(supplierId);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch(`/api/admin/suppliers/${supplierId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.message ?? "공급사 상태 변경 실패");
      }
      setMessage(status === "SUSPENDED" ? "공급사가 정지되었습니다." : "공급사가 활성화되었습니다.");
      await loadSuppliers();
    } catch (err) {
      setError(err instanceof Error ? err.message : "공급사 상태 변경 실패");
    } finally {
      setActionSupplierId(null);
    }
  }

  return (
    <section className="space-y-3 rounded border border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-900">공급사 목록</h2>
        <button
          type="button"
          className="rounded bg-slate-900 px-3 py-2 text-sm text-white"
          onClick={openCreateForm}
        >
          Add Supplier
        </button>
      </div>

      {message ? <p className="rounded bg-emerald-50 p-2 text-sm text-emerald-700">{message}</p> : null}
      {error ? <p className="rounded bg-red-50 p-2 text-sm text-red-700">{error}</p> : null}

      {formOpen ? (
        <div className="rounded border border-slate-200 bg-slate-50 p-3">
          <h3 className="text-sm font-semibold text-slate-900">
            {editingId === null ? "공급사 추가" : "공급사 수정"}
          </h3>
          <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-2">
            <input
              value={form.companyName}
              onChange={(e) => setForm((prev) => ({ ...prev, companyName: e.target.value }))}
              className="rounded border border-slate-300 px-2 py-1 text-sm"
              placeholder="회사명"
            />
            <input
              value={form.companyCode}
              onChange={(e) => setForm((prev) => ({ ...prev, companyCode: e.target.value }))}
              className="rounded border border-slate-300 px-2 py-1 text-sm"
              placeholder="회사코드"
            />
            <input
              value={form.countryCode}
              onChange={(e) => setForm((prev) => ({ ...prev, countryCode: e.target.value }))}
              className="rounded border border-slate-300 px-2 py-1 text-sm"
              placeholder="국가코드 (KR)"
            />
            <input
              value={form.businessNumber}
              onChange={(e) => setForm((prev) => ({ ...prev, businessNumber: e.target.value }))}
              className="rounded border border-slate-300 px-2 py-1 text-sm"
              placeholder="사업자번호"
            />
            <input
              value={form.representativeName}
              onChange={(e) => setForm((prev) => ({ ...prev, representativeName: e.target.value }))}
              className="rounded border border-slate-300 px-2 py-1 text-sm"
              placeholder="대표자명"
            />
            <input
              value={form.contactName}
              onChange={(e) => setForm((prev) => ({ ...prev, contactName: e.target.value }))}
              className="rounded border border-slate-300 px-2 py-1 text-sm"
              placeholder="담당자명"
            />
            <input
              value={form.contactEmail}
              onChange={(e) => setForm((prev) => ({ ...prev, contactEmail: e.target.value }))}
              className="rounded border border-slate-300 px-2 py-1 text-sm"
              placeholder="담당자 이메일"
            />
            <input
              value={form.contactPhone}
              onChange={(e) => setForm((prev) => ({ ...prev, contactPhone: e.target.value }))}
              className="rounded border border-slate-300 px-2 py-1 text-sm"
              placeholder="담당자 전화번호"
            />
            <input
              value={form.orderEmail}
              onChange={(e) => setForm((prev) => ({ ...prev, orderEmail: e.target.value }))}
              className="rounded border border-slate-300 px-2 py-1 text-sm"
              placeholder="주문 수신 이메일 (미입력 시 담당자 이메일 사용)"
            />
            <select
              value={form.status}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, status: e.target.value as SupplierStatus }))
              }
              className="rounded border border-slate-300 px-2 py-1 text-sm"
            >
              <option value="PENDING">PENDING</option>
              <option value="ACTIVE">ACTIVE</option>
              <option value="INACTIVE">INACTIVE</option>
              <option value="SUSPENDED">SUSPENDED</option>
            </select>
          </div>
          <textarea
            value={form.address}
            onChange={(e) => setForm((prev) => ({ ...prev, address: e.target.value }))}
            className="mt-2 w-full rounded border border-slate-300 px-2 py-1 text-sm"
            rows={2}
            placeholder="주소"
          />
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              className="rounded bg-slate-900 px-3 py-1 text-sm text-white disabled:opacity-60"
              disabled={submitting}
              onClick={submitForm}
            >
              {submitting ? "저장 중..." : editingId === null ? "추가" : "수정"}
            </button>
            <button
              type="button"
              className="rounded border border-slate-300 px-3 py-1 text-sm"
              onClick={() => {
                setFormOpen(false);
                setEditingId(null);
                setForm(INITIAL_FORM);
              }}
            >
              취소
            </button>
          </div>
        </div>
      ) : null}

      {loading ? (
        <p className="text-sm text-slate-500">공급사 목록을 불러오는 중...</p>
      ) : (
        <div className="overflow-auto">
          <table className="min-w-full border-collapse text-sm">
            <thead>
              <tr className="bg-slate-50">
                <th className="border border-slate-200 px-2 py-1 text-left">회사명</th>
                <th className="border border-slate-200 px-2 py-1 text-left">회사코드</th>
                <th className="border border-slate-200 px-2 py-1 text-left">국가</th>
                <th className="border border-slate-200 px-2 py-1 text-left">담당자</th>
                <th className="border border-slate-200 px-2 py-1 text-left">연락처</th>
                <th className="border border-slate-200 px-2 py-1 text-left">상태</th>
                <th className="border border-slate-200 px-2 py-1 text-left">작업</th>
              </tr>
            </thead>
            <tbody>
              {sortedSuppliers.map((supplier) => (
                <tr key={supplier.id}>
                  <td className="border border-slate-200 px-2 py-1">{supplier.company_name}</td>
                  <td className="border border-slate-200 px-2 py-1">{supplier.company_code ?? "-"}</td>
                  <td className="border border-slate-200 px-2 py-1">{supplier.country_code}</td>
                  <td className="border border-slate-200 px-2 py-1">{supplier.contact_name ?? "-"}</td>
                  <td className="border border-slate-200 px-2 py-1">
                    {supplier.contact_email ?? "-"}
                    {supplier.contact_phone ? ` / ${supplier.contact_phone}` : ""}
                  </td>
                  <td className="border border-slate-200 px-2 py-1">{statusLabel[supplier.status]}</td>
                  <td className="border border-slate-200 px-2 py-1">
                    <div className="flex gap-1">
                      <button
                        type="button"
                        className="rounded border border-slate-300 px-2 py-1 text-xs"
                        onClick={() => openEditForm(supplier)}
                      >
                        Edit
                      </button>
                      {supplier.status === "SUSPENDED" || supplier.status === "INACTIVE" ? (
                        <button
                          type="button"
                          className="rounded border border-emerald-300 px-2 py-1 text-xs text-emerald-700 disabled:opacity-60"
                          disabled={actionSupplierId === supplier.id}
                          onClick={() => updateSupplierStatus(supplier.id, "ACTIVE")}
                        >
                          {actionSupplierId === supplier.id ? "처리 중..." : "Activate"}
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="rounded border border-red-300 px-2 py-1 text-xs text-red-700 disabled:opacity-60"
                          disabled={actionSupplierId === supplier.id}
                          onClick={() => updateSupplierStatus(supplier.id, "SUSPENDED")}
                        >
                          {actionSupplierId === supplier.id ? "처리 중..." : "Suspend"}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {sortedSuppliers.length === 0 ? (
                <tr>
                  <td className="border border-slate-200 px-2 py-3 text-center text-slate-500" colSpan={7}>
                    등록된 공급사가 없습니다.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
