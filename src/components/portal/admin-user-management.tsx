"use client";

import { useEffect, useMemo, useState } from "react";

type SupplierOption = {
  id: number;
  supplier_name: string;
  company_name: string;
  is_active: boolean;
};

type UserRow = {
  id: number;
  login_id: string;
  name: string;
  email: string | null;
  role:
    | "SUPER_ADMIN"
    | "KOREA_SUPPLY_ADMIN"
    | "COUNTRY_ADMIN"
    | "ADMIN"
    | "BUYER"
    | "SUPPLIER";
  is_active: boolean;
  supplier: { supplier_name: string; company_name: string } | null;
  created_at: string;
};

type CreateSupplierUserForm = {
  name: string;
  email: string;
  password: string;
  role: "SUPPLIER";
  supplierId: string;
};

const INITIAL_FORM: CreateSupplierUserForm = {
  name: "",
  email: "",
  password: "",
  role: "SUPPLIER",
  supplierId: "",
};

export function AdminUserManagement() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [suppliers, setSuppliers] = useState<SupplierOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState<CreateSupplierUserForm>(INITIAL_FORM);

  const activeSuppliers = useMemo(
    () => suppliers.filter((supplier) => supplier.is_active),
    [suppliers],
  );

  async function loadData() {
    setLoading(true);
    setError(null);
    try {
      const [usersResponse, suppliersResponse] = await Promise.all([
        fetch("/api/admin/users"),
        fetch("/api/admin/suppliers"),
      ]);
      const [usersResult, suppliersResult] = await Promise.all([
        usersResponse.json(),
        suppliersResponse.json(),
      ]);

      if (!usersResponse.ok || !usersResult.success) {
        throw new Error(usersResult.message ?? "사용자 목록 조회 실패");
      }
      if (!suppliersResponse.ok || !suppliersResult.success) {
        throw new Error(suppliersResult.message ?? "공급사 목록 조회 실패");
      }

      setUsers(usersResult.data as UserRow[]);
      setSuppliers(suppliersResult.data as SupplierOption[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "데이터 조회 실패");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  async function handleCreateUser() {
    setError(null);
    setMessage(null);
    if (!form.name.trim() || !form.email.trim() || !form.password || !form.supplierId) {
      setError("Name, Email, Password, Supplier는 필수입니다.");
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          email: form.email.trim().toLowerCase(),
          loginId: form.email.trim().toLowerCase(),
          password: form.password,
          role: form.role,
          supplierId: Number(form.supplierId),
          isActive: true,
        }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.message ?? "사용자 생성 실패");
      }

      setMessage("SUPPLIER 계정이 생성되었습니다. (로그인 ID: 이메일)");
      setForm(INITIAL_FORM);
      setFormOpen(false);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "사용자 생성 실패");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="space-y-3 rounded border border-[#2d333d] bg-[#1a1d23] p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-white">사용자 목록</h2>
        <button
          type="button"
          className="rounded bg-blue-600 px-3 py-2 text-sm text-white"
          onClick={() => {
            setFormOpen((prev) => !prev);
            setError(null);
            setMessage(null);
          }}
        >
          Add User
        </button>
      </div>

      {message ? <p className="rounded bg-emerald-50 p-2 text-sm text-emerald-700">{message}</p> : null}
      {error ? <p className="rounded bg-red-950/30 p-2 text-sm text-red-400">{error}</p> : null}

      {formOpen ? (
        <div className="rounded border border-[#2d333d] bg-[#111318] p-3">
          <h3 className="text-sm font-semibold text-white">공급사 계정 추가</h3>
          <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-2">
            <input
              className="rounded border border-[#2d333d] px-2 py-1 text-sm"
              placeholder="Name"
              value={form.name}
              onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
            />
            <input
              className="rounded border border-[#2d333d] px-2 py-1 text-sm"
              placeholder="Email"
              value={form.email}
              onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
            />
            <input
              type="password"
              className="rounded border border-[#2d333d] px-2 py-1 text-sm"
              placeholder="Password"
              value={form.password}
              onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))}
            />
            <select
              className="rounded border border-[#2d333d] px-2 py-1 text-sm"
              value={form.role}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, role: e.target.value as "SUPPLIER" }))
              }
            >
              <option value="SUPPLIER">SUPPLIER</option>
            </select>
            <select
              className="rounded border border-[#2d333d] px-2 py-1 text-sm md:col-span-2"
              value={form.supplierId}
              onChange={(e) => setForm((prev) => ({ ...prev, supplierId: e.target.value }))}
            >
              <option value="">Supplier 선택</option>
              {activeSuppliers.map((supplier) => (
                <option key={supplier.id} value={String(supplier.id)}>
                  {supplier.company_name || supplier.supplier_name}
                </option>
              ))}
            </select>
          </div>
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              className="rounded bg-blue-600 px-3 py-1 text-sm text-white disabled:opacity-60"
              disabled={submitting}
              onClick={handleCreateUser}
            >
              {submitting ? "생성 중..." : "생성"}
            </button>
            <button
              type="button"
              className="rounded border border-[#2d333d] px-3 py-1 text-sm"
              onClick={() => {
                setFormOpen(false);
                setForm(INITIAL_FORM);
              }}
            >
              취소
            </button>
          </div>
        </div>
      ) : null}

      {loading ? (
        <p className="text-sm text-gray-400">사용자 목록을 불러오는 중...</p>
      ) : (
        <div className="overflow-auto">
          <table className="min-w-full border-collapse text-sm">
            <thead>
              <tr className="bg-[#111318]">
                <th className="border border-[#2d333d] px-2 py-1 text-left">Name</th>
                <th className="border border-[#2d333d] px-2 py-1 text-left">Email</th>
                <th className="border border-[#2d333d] px-2 py-1 text-left">Role</th>
                <th className="border border-[#2d333d] px-2 py-1 text-left">Supplier</th>
                <th className="border border-[#2d333d] px-2 py-1 text-left">Status</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id}>
                  <td className="border border-[#2d333d] px-2 py-1">{user.name}</td>
                  <td className="border border-[#2d333d] px-2 py-1">{user.email ?? user.login_id}</td>
                  <td className="border border-[#2d333d] px-2 py-1">{user.role}</td>
                  <td className="border border-[#2d333d] px-2 py-1">
                    {user.supplier?.company_name ?? user.supplier?.supplier_name ?? "-"}
                  </td>
                  <td className="border border-[#2d333d] px-2 py-1">
                    {user.is_active ? "ACTIVE" : "INACTIVE"}
                  </td>
                </tr>
              ))}
              {users.length === 0 ? (
                <tr>
                  <td className="border border-[#2d333d] px-2 py-3 text-center text-gray-400" colSpan={5}>
                    등록된 사용자가 없습니다.
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
