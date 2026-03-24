"use client";

import { useEffect, useMemo, useState } from "react";

type SupplierStatus = "PENDING" | "ACTIVE" | "INACTIVE" | "SUSPENDED";

type SupplierUserRow = { login_id: string; id: number };

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
  users?: SupplierUserRow[];
};

type FormState = {
  companyName: string;
  countryCode: string;
  businessNumber: string;
  representativeName: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  address: string;
  status: SupplierStatus;
  orderEmail: string;
  loginId: string;
  password: string;
};

const INITIAL_FORM: FormState = {
  companyName: "",
  countryCode: "KR",
  businessNumber: "",
  representativeName: "",
  contactName: "",
  contactEmail: "",
  contactPhone: "",
  address: "",
  status: "PENDING",
  orderEmail: "",
  loginId: "",
  password: "",
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

async function copyText(label: string, text: string) {
  try {
    await navigator.clipboard.writeText(text);
    window.alert(`${label}을(를) 클립보드에 복사했습니다.`);
  } catch {
    window.prompt("복사해 주세요:", text);
  }
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
  const [showCompanyCodes, setShowCompanyCodes] = useState(false);
  /** 수정 시 중복 검사에서 제외할 User.id (해당 공급사 대표 계정) */
  const [editingSupplierUserId, setEditingSupplierUserId] = useState<number | null>(null);
  const [loginIdCheckState, setLoginIdCheckState] = useState<
    "idle" | "checking" | "available" | "taken" | "invalid"
  >("idle");
  /** 생성 직후 복사용(서버에 다시 안 나옴) */
  const [lastCreatedCredentials, setLastCreatedCredentials] = useState<{
    loginId: string;
    password: string;
    companyCode: string | null;
  } | null>(null);

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
    setEditingSupplierUserId(null);
    setLoginIdCheckState("idle");
    setForm(INITIAL_FORM);
    setFormOpen(true);
    setError(null);
    setMessage(null);
    setLastCreatedCredentials(null);
  }

  function openEditForm(supplier: Supplier) {
    setEditingId(supplier.id);
    setEditingSupplierUserId(supplier.users?.[0]?.id ?? null);
    setLoginIdCheckState("idle");
    setForm({
      companyName: supplier.company_name,
      countryCode: supplier.country_code,
      businessNumber: supplier.business_number ?? "",
      representativeName: supplier.representative_name ?? "",
      contactName: supplier.contact_name ?? "",
      contactEmail: supplier.contact_email ?? "",
      contactPhone: supplier.contact_phone ?? "",
      address: supplier.address ?? "",
      status: supplier.status,
      orderEmail: supplier.order_email,
      loginId: supplier.users?.[0]?.login_id ?? "",
      password: "",
    });
    setFormOpen(true);
    setError(null);
    setMessage(null);
    setLastCreatedCredentials(null);
  }

  async function checkLoginIdDuplicate() {
    if (/\s/.test(form.loginId)) {
      setLoginIdCheckState("invalid");
      return;
    }
    const raw = form.loginId.trim();
    if (raw.length < 3) {
      setLoginIdCheckState("invalid");
      return;
    }
    setLoginIdCheckState("checking");
    try {
      const params = new URLSearchParams({ loginId: raw });
      if (editingSupplierUserId != null) {
        params.set("excludeUserId", String(editingSupplierUserId));
      }
      const response = await fetch(`/api/admin/users/check-login-id?${params.toString()}`);
      const result = await response.json();
      if (!response.ok || !result.success) {
        setLoginIdCheckState("invalid");
        return;
      }
      const data = result.data as { available: boolean; reason?: string };
      if (data.available) {
        setLoginIdCheckState("available");
      } else if (data.reason === "SHORT" || data.reason === "WHITESPACE") {
        setLoginIdCheckState("invalid");
      } else {
        setLoginIdCheckState("taken");
      }
    } catch {
      setLoginIdCheckState("invalid");
    }
  }

  async function submitForm() {
    setError(null);
    setMessage(null);

    if (!form.companyName.trim() || !form.contactEmail.trim()) {
      setError("회사명과 담당자 이메일은 필수입니다.");
      return;
    }

    if (!form.loginId.trim()) {
      setError("로그인 아이디는 필수입니다.");
      return;
    }
    if (editingId === null && form.password.length < 8) {
      setError("비밀번호는 8자 이상이어야 합니다.");
      return;
    }
    if (editingId !== null && form.password.trim() !== "" && form.password.length < 8) {
      setError("비밀번호를 변경할 경우 8자 이상이어야 합니다.");
      return;
    }

    setSubmitting(true);
    try {
      const basePayload = {
        companyName: form.companyName.trim(),
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
      const payload =
        editingId === null
          ? {
              ...basePayload,
              loginId: form.loginId.trim(),
              password: form.password,
            }
          : {
              ...basePayload,
              loginId: form.loginId.trim(),
              ...(form.password.trim().length >= 8 ? { password: form.password } : {}),
            };

      const response = await fetch(targetUrl, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.message ?? "공급사 저장 실패");
      }

      if (editingId === null) {
        const data = result.data as Supplier & { supplierLoginId?: string };
        setLastCreatedCredentials({
          loginId: data.supplierLoginId ?? form.loginId.trim(),
          password: form.password,
          companyCode: data.company_code ?? null,
        });
        setMessage(
          "공급사와 로그인 계정이 생성되었습니다. 아래 정보를 복사해 공급사에 전달해 주세요.",
        );
      } else {
        setMessage("공급사 정보가 수정되었습니다.");
        setFormOpen(false);
        setEditingId(null);
        setEditingSupplierUserId(null);
        setLoginIdCheckState("idle");
        setForm(INITIAL_FORM);
      }
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

  const tableColSpan = showCompanyCodes ? 8 : 7;

  return (
    <section className="space-y-3 rounded border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold text-slate-900">공급사 목록</h2>
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex cursor-pointer items-center gap-1.5 text-sm text-slate-600">
            <input
              type="checkbox"
              checked={showCompanyCodes}
              onChange={(e) => setShowCompanyCodes(e.target.checked)}
            />
            회사코드 표시
          </label>
          <button
            type="button"
            className="rounded bg-slate-900 px-3 py-2 text-sm text-white"
            onClick={openCreateForm}
          >
            공급사 추가
          </button>
        </div>
      </div>

      <p className="text-xs text-slate-500">
        회사코드는 시스템이 자동 부여하며 수정할 수 없습니다. 공급사 생성 시 로그인 계정이 함께
        만들어지며, 해당 계정으로 상품 등록·엑셀 업로드가 가능합니다.
      </p>

      {message ? <p className="rounded bg-emerald-50 p-2 text-sm text-emerald-700">{message}</p> : null}
      {error ? <p className="rounded bg-red-50 p-2 text-sm text-red-700">{error}</p> : null}

      {lastCreatedCredentials ? (
        <div className="rounded border border-amber-200 bg-amber-50 p-3 text-sm">
          <p className="font-medium text-amber-950">생성된 로그인 정보 (한 번만 표시)</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="text-slate-700">
              아이디: <code className="rounded bg-white px-1">{lastCreatedCredentials.loginId}</code>
            </span>
            <button
              type="button"
              className="rounded border border-amber-300 bg-white px-2 py-0.5 text-xs"
              onClick={() => copyText("아이디", lastCreatedCredentials.loginId)}
            >
              아이디 복사
            </button>
            <button
              type="button"
              className="rounded border border-amber-300 bg-white px-2 py-0.5 text-xs"
              onClick={() => copyText("비밀번호", lastCreatedCredentials.password)}
            >
              비밀번호 복사
            </button>
            {lastCreatedCredentials.companyCode ? (
              <button
                type="button"
                className="rounded border border-amber-300 bg-white px-2 py-0.5 text-xs"
                onClick={() => copyText("회사코드", lastCreatedCredentials.companyCode!)}
              >
                회사코드 복사
              </button>
            ) : null}
          </div>
          <button
            type="button"
            className="mt-2 text-xs text-amber-800 underline"
            onClick={() => setLastCreatedCredentials(null)}
          >
            닫기
          </button>
        </div>
      ) : null}

      {formOpen ? (
        <div className="rounded border border-slate-200 bg-slate-50 p-3">
          <h3 className="text-sm font-semibold text-slate-900">
            {editingId === null ? "공급사 추가" : "공급사 수정"}
          </h3>
          <div className="mt-2 space-y-2 rounded border border-slate-200 bg-white p-2">
            <p className="text-xs font-medium text-slate-700">로그인 계정</p>
            <p className="text-xs text-slate-500">
              {editingId === null
                ? "아이디·비밀번호는 필수입니다."
                : "아이디를 변경할 수 있습니다. 비밀번호는 변경할 때만 입력(8자 이상)하면 됩니다."}
            </p>
            <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
              <div className="flex flex-col gap-1">
                <div className="flex gap-1.5">
                  <input
                    value={form.loginId}
                    onChange={(e) => {
                      setLoginIdCheckState("idle");
                      setForm((prev) => ({ ...prev, loginId: e.target.value }));
                    }}
                    className="min-w-0 flex-1 rounded border border-slate-300 px-2 py-1 text-sm"
                    placeholder="로그인 아이디 (이메일 또는 사용자명)"
                    autoComplete="off"
                  />
                  <button
                    type="button"
                    className="shrink-0 rounded border border-slate-400 bg-white px-2.5 py-1 text-xs font-medium text-slate-800 hover:bg-slate-50 disabled:opacity-50"
                    disabled={
                      loginIdCheckState === "checking" ||
                      form.loginId.trim().length < 3 ||
                      /\s/.test(form.loginId)
                    }
                    onClick={() => void checkLoginIdDuplicate()}
                  >
                    {loginIdCheckState === "checking" ? "확인 중…" : "중복 확인"}
                  </button>
                </div>
                {loginIdCheckState === "available" ? (
                  <span className="text-xs text-emerald-600">사용 가능한 아이디입니다.</span>
                ) : null}
                {loginIdCheckState === "taken" ? (
                  <span className="text-xs text-red-600">이미 사용 중인 아이디입니다.</span>
                ) : null}
                {loginIdCheckState === "invalid" ? (
                  <span className="text-xs text-amber-700">
                    {/\s/.test(form.loginId)
                      ? "아이디에 공백을 사용할 수 없습니다."
                      : "3자 이상 입력한 뒤 확인해 주세요."}
                  </span>
                ) : null}
              </div>
              <input
                type="password"
                value={form.password}
                onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))}
                className="rounded border border-slate-300 px-2 py-1 text-sm"
                placeholder={
                  editingId === null
                    ? "비밀번호 (8자 이상)"
                    : "비밀번호 (변경 시만 입력, 8자 이상)"
                }
                autoComplete="new-password"
              />
            </div>
          </div>
          <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-2">
            <input
              value={form.companyName}
              onChange={(e) => setForm((prev) => ({ ...prev, companyName: e.target.value }))}
              className="rounded border border-slate-300 px-2 py-1 text-sm"
              placeholder="회사명"
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
          <div className="mt-2 flex flex-wrap gap-2">
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
                setEditingSupplierUserId(null);
                setLoginIdCheckState("idle");
                setForm(INITIAL_FORM);
                setLastCreatedCredentials(null);
              }}
            >
              취소
            </button>
            {editingId === null && lastCreatedCredentials ? (
              <button
                type="button"
                className="rounded border border-slate-300 px-3 py-1 text-sm"
                onClick={() => {
                  setFormOpen(false);
                  setEditingSupplierUserId(null);
                  setLoginIdCheckState("idle");
                  setForm(INITIAL_FORM);
                }}
              >
                폼 닫기
              </button>
            ) : null}
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
                {showCompanyCodes ? (
                  <th className="border border-slate-200 px-2 py-1 text-left">회사코드</th>
                ) : null}
                <th className="border border-slate-200 px-2 py-1 text-left">로그인 아이디</th>
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
                  {showCompanyCodes ? (
                    <td className="border border-slate-200 px-2 py-1 font-mono text-xs text-slate-600">
                      {supplier.company_code ?? "—"}
                    </td>
                  ) : null}
                  <td className="border border-slate-200 px-2 py-1 font-mono text-xs">
                    {supplier.users?.[0]?.login_id ?? "—"}
                  </td>
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
                        수정
                      </button>
                      {supplier.status === "SUSPENDED" || supplier.status === "INACTIVE" ? (
                        <button
                          type="button"
                          className="rounded border border-emerald-300 px-2 py-1 text-xs text-emerald-700 disabled:opacity-60"
                          disabled={actionSupplierId === supplier.id}
                          onClick={() => updateSupplierStatus(supplier.id, "ACTIVE")}
                        >
                          {actionSupplierId === supplier.id ? "처리 중..." : "활성화"}
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="rounded border border-red-300 px-2 py-1 text-xs text-red-700 disabled:opacity-60"
                          disabled={actionSupplierId === supplier.id}
                          onClick={() => updateSupplierStatus(supplier.id, "SUSPENDED")}
                        >
                          {actionSupplierId === supplier.id ? "처리 중..." : "정지"}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {sortedSuppliers.length === 0 ? (
                <tr>
                  <td
                    className="border border-slate-200 px-2 py-3 text-center text-slate-500"
                    colSpan={tableColSpan}
                  >
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
