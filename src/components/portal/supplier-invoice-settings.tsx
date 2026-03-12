"use client";

import { useEffect, useState } from "react";

type Supplier = {
  id: number;
  supplier_name: string;
  order_email: string;
  invoice_senders: Array<{
    sender_email: string;
    is_active: boolean;
  }>;
};

type SupplierRowState = {
  senderEmailsText: string;
  pending: boolean;
  message: string | null;
  error: string | null;
};

export function SupplierInvoiceSettings() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [rowState, setRowState] = useState<Record<number, SupplierRowState>>({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchSuppliers() {
      try {
        setLoading(true);
        const response = await fetch("/api/admin/suppliers");
        const result = await response.json();
        if (!response.ok || !result.success) {
          throw new Error(result.message ?? "공급사 조회 실패");
        }
        const rows = result.data as Supplier[];
        setSuppliers(rows);
        setRowState(
          Object.fromEntries(
            rows.map((supplier) => [
              supplier.id,
              {
                senderEmailsText: supplier.invoice_senders
                  .filter((sender) => sender.is_active)
                  .map((sender) => sender.sender_email)
                  .join("\n"),
                pending: false,
                message: null,
                error: null,
              },
            ]),
          ),
        );
      } catch (error) {
        setLoadError(error instanceof Error ? error.message : "공급사 조회 실패");
      } finally {
        setLoading(false);
      }
    }

    fetchSuppliers();
  }, []);

  function updateRowState(id: number, patch: Partial<SupplierRowState>) {
    setRowState((prev) => ({
      ...prev,
      [id]: {
        ...(prev[id] ?? {
          senderEmailsText: "",
          pending: false,
          message: null,
          error: null,
        }),
        ...patch,
      },
    }));
  }

  async function saveInvoiceSenderEmail(supplier: Supplier) {
    const state = rowState[supplier.id];
    if (!state) return;

    updateRowState(supplier.id, { pending: true, message: null, error: null });
    try {
      const senderEmails = [...new Set(
        state.senderEmailsText
          .split(/[\n,;]/)
          .map((email) => email.trim().toLowerCase())
          .filter(Boolean),
      )];

      const response = await fetch(`/api/admin/suppliers/${supplier.id}/invoice-senders`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ senderEmails }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.message ?? "저장 실패");
      }

      setSuppliers((prev) =>
        prev.map((row) =>
          row.id === supplier.id
            ? {
                ...row,
                invoice_senders: senderEmails.map((email) => ({
                  sender_email: email,
                  is_active: true,
                })),
              }
            : row,
        ),
      );
      updateRowState(supplier.id, {
        pending: false,
        message: "저장됨",
        error: null,
      });
    } catch (error) {
      updateRowState(supplier.id, {
        pending: false,
        message: null,
        error: error instanceof Error ? error.message : "저장 실패",
      });
    }
  }

  if (loading) {
    return <p className="text-sm text-slate-500">공급사 정보를 불러오는 중...</p>;
  }

  if (loadError) {
    return <p className="rounded bg-red-50 p-3 text-sm text-red-700">{loadError}</p>;
  }

  return (
    <div className="overflow-auto rounded border border-slate-200 bg-white p-4">
      <table className="min-w-full border-collapse text-sm">
        <thead>
          <tr className="bg-slate-50">
            <th className="border border-slate-200 px-2 py-1 text-left">공급사</th>
            <th className="border border-slate-200 px-2 py-1 text-left">주문 수신 메일</th>
            <th className="border border-slate-200 px-2 py-1 text-left">
              세금계산서 발신 메일(from, 다중)
            </th>
            <th className="border border-slate-200 px-2 py-1 text-left">저장</th>
          </tr>
        </thead>
        <tbody>
          {suppliers.map((supplier) => {
            const state = rowState[supplier.id];
            return (
              <tr key={supplier.id}>
                <td className="border border-slate-200 px-2 py-1">{supplier.supplier_name}</td>
                <td className="border border-slate-200 px-2 py-1">{supplier.order_email}</td>
                <td className="border border-slate-200 px-2 py-1">
                  <textarea
                    value={state?.senderEmailsText ?? ""}
                    onChange={(e) =>
                      updateRowState(supplier.id, {
                        senderEmailsText: e.target.value,
                        message: null,
                        error: null,
                      })
                    }
                    placeholder={"invoice@acompany.com\ntax@acompany.com"}
                    className="min-h-20 w-full min-w-64 rounded border border-slate-300 px-2 py-1"
                  />
                  <p className="mt-1 text-xs text-slate-500">
                    줄바꿈 또는 콤마로 여러 발신 메일을 등록할 수 있습니다.
                  </p>
                  {state?.error ? (
                    <p className="mt-1 text-xs text-red-600">{state.error}</p>
                  ) : null}
                  {state?.message ? (
                    <p className="mt-1 text-xs text-emerald-700">{state.message}</p>
                  ) : null}
                </td>
                <td className="border border-slate-200 px-2 py-1">
                  <button
                    type="button"
                    className="rounded border border-slate-300 px-2 py-1"
                    disabled={state?.pending}
                    onClick={() => saveInvoiceSenderEmail(supplier)}
                  >
                    {state?.pending ? "저장 중..." : "저장"}
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
