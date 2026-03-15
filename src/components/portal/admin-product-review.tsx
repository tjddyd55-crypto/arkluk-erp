"use client";

import { Fragment, useEffect, useState } from "react";
import Link from "next/link";

type PendingProduct = {
  id: number;
  name_original: string;
  source_language: "ko" | "en" | "mn" | "ar";
  specification: string | null;
  price: string;
  currency: string;
  status: "DRAFT" | "PENDING" | "APPROVED" | "REJECTED";
  supplier: { supplier_name: string; company_name: string | null };
  category: { category_name: string };
};

type SupplierOption = {
  supplierName: string;
};

type ApprovalHistoryEntry = {
  timestamp: string;
  action: "SUBMIT" | "APPROVE" | "REJECT";
  user: string;
  reason: string | null;
};

const STATUS_LABEL: Record<PendingProduct["status"], string> = {
  DRAFT: "임시저장",
  PENDING: "대기",
  APPROVED: "승인",
  REJECTED: "반려",
};

const SOURCE_LANGUAGE_LABEL: Record<PendingProduct["source_language"], string> = {
  ko: "한국어",
  en: "English",
  mn: "Монгол",
  ar: "العربية",
};

const APPROVAL_ACTION_LABEL: Record<ApprovalHistoryEntry["action"], string> = {
  SUBMIT: "등록",
  APPROVE: "승인",
  REJECT: "반려",
};

function formatTimestamp(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return parsed.toLocaleString("ko-KR", { hour12: false });
}

export function AdminProductReview() {
  const [rows, setRows] = useState<PendingProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [processingIds, setProcessingIds] = useState<number[]>([]);
  const [bulkPending, setBulkPending] = useState(false);
  const [supplierFilter, setSupplierFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [bulkRejectReason, setBulkRejectReason] = useState("");
  const [rejectReasonMap, setRejectReasonMap] = useState<Record<number, string>>({});
  const [historyOpenId, setHistoryOpenId] = useState<number | null>(null);
  const [historyLoadingId, setHistoryLoadingId] = useState<number | null>(null);
  const [historyMap, setHistoryMap] = useState<Record<number, ApprovalHistoryEntry[]>>({});
  const [historyErrorMap, setHistoryErrorMap] = useState<Record<number, string>>({});

  async function loadPendingProducts() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/products?status=PENDING");
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.message ?? "승인 대기 상품 조회 실패");
      }
      setRows(result.data as PendingProduct[]);
      setSelectedIds([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "데이터 조회 실패");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadPendingProducts();
  }, []);

  async function review(productId: number, status: "APPROVED" | "REJECTED", reason?: string) {
    setError(null);
    setMessage(null);

    const rejectReason = reason?.trim() ?? "";
    if (status === "REJECTED" && rejectReason.length === 0) {
      setError("반려 시에는 사유를 입력해야 합니다.");
      return;
    }

    setProcessingIds((prev) => [...prev, productId]);
    try {
      const response = await fetch(`/api/admin/products/${productId}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status,
          reason: status === "REJECTED" ? rejectReason : null,
        }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.message ?? "상품 검토 실패");
      }

      setMessage(status === "APPROVED" ? "상품을 승인했습니다." : "상품을 반려했습니다.");
      setRejectReasonMap((prev) => ({ ...prev, [productId]: "" }));
      await loadPendingProducts();
    } catch (err) {
      setError(err instanceof Error ? err.message : "상품 검토 실패");
    } finally {
      setProcessingIds((prev) => prev.filter((id) => id !== productId));
    }
  }

  async function bulkApprove() {
    if (selectedIds.length === 0) {
      setError("승인할 상품을 먼저 선택해 주세요.");
      return;
    }

    setError(null);
    setMessage(null);
    setBulkPending(true);
    try {
      const response = await fetch("/api/admin/products/bulk-approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productIds: selectedIds }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.message ?? "일괄 승인 실패");
      }
      setMessage(`선택한 상품 ${result.data.approvedCount as number}건을 승인했습니다.`);
      await loadPendingProducts();
    } catch (err) {
      setError(err instanceof Error ? err.message : "일괄 승인 실패");
    } finally {
      setBulkPending(false);
    }
  }

  async function bulkReject() {
    if (selectedIds.length === 0) {
      setError("반려할 상품을 먼저 선택해 주세요.");
      return;
    }

    const reason = bulkRejectReason.trim();
    if (!reason) {
      setError("선택 반려 시 반려 사유를 입력해야 합니다.");
      return;
    }

    setError(null);
    setMessage(null);
    setBulkPending(true);
    try {
      const response = await fetch("/api/admin/products/bulk-reject", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productIds: selectedIds, rejectReason: reason }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.message ?? "일괄 반려 실패");
      }
      setMessage(`선택한 상품 ${result.data.rejectedCount as number}건을 반려했습니다.`);
      setBulkRejectReason("");
      await loadPendingProducts();
    } catch (err) {
      setError(err instanceof Error ? err.message : "일괄 반려 실패");
    } finally {
      setBulkPending(false);
    }
  }

  async function toggleHistory(productId: number) {
    if (historyOpenId === productId) {
      setHistoryOpenId(null);
      return;
    }
    setHistoryOpenId(productId);

    if (historyMap[productId] || historyLoadingId === productId) {
      return;
    }

    setHistoryErrorMap((prev) => ({ ...prev, [productId]: "" }));
    setHistoryLoadingId(productId);
    try {
      const response = await fetch(`/api/admin/products/${productId}/approval-history`);
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.message ?? "승인 이력 조회 실패");
      }
      setHistoryMap((prev) => ({
        ...prev,
        [productId]: (result.data ?? []) as ApprovalHistoryEntry[],
      }));
    } catch (err) {
      setHistoryErrorMap((prev) => ({
        ...prev,
        [productId]: err instanceof Error ? err.message : "승인 이력 조회 실패",
      }));
    } finally {
      setHistoryLoadingId(null);
    }
  }

  const supplierOptions: SupplierOption[] = Array.from(
    rows.reduce((map, row) => {
      if (!map.has(row.supplier.supplier_name)) {
        map.set(row.supplier.supplier_name, {
          supplierName: row.supplier.company_name ?? row.supplier.supplier_name,
        });
      }
      return map;
    }, new Map<string, SupplierOption>()),
  ).map((entry) => entry[1]);

  const filteredRows = rows.filter((row) => {
    const supplierName = row.supplier.company_name ?? row.supplier.supplier_name;
    const passSupplier =
      supplierFilter === "all" || supplierName === supplierFilter;
    const keyword = search.trim().toLowerCase();
    if (!keyword) {
      return passSupplier;
    }
    return (
      passSupplier &&
      (row.name_original.toLowerCase().includes(keyword) || supplierName.toLowerCase().includes(keyword))
    );
  });

  const groupedRows = filteredRows.reduce(
    (acc, row) => {
      const supplierName = row.supplier.company_name ?? row.supplier.supplier_name;
      if (!acc[supplierName]) {
        acc[supplierName] = [];
      }
      acc[supplierName].push(row);
      return acc;
    },
    {} as Record<string, PendingProduct[]>,
  );

  const selectedSet = new Set(selectedIds);

  return (
    <section className="space-y-3 rounded border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold text-slate-900">상품 승인 대기 ({rows.length})</h2>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="rounded border border-slate-300 px-3 py-1 text-sm"
            onClick={loadPendingProducts}
            disabled={bulkPending}
          >
            새로고침
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded border border-slate-200 bg-slate-50 p-2">
        <select
          className="rounded border border-slate-300 px-2 py-1 text-sm"
          value={supplierFilter}
          onChange={(event) => setSupplierFilter(event.target.value)}
          disabled={bulkPending}
        >
          <option value="all">전체 공급사</option>
          {supplierOptions.map((option) => (
            <option key={option.supplierName} value={option.supplierName}>
              {option.supplierName}
            </option>
          ))}
        </select>
        <input
          className="w-72 rounded border border-slate-300 px-2 py-1 text-sm"
          placeholder="상품명 또는 공급사명 검색"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          disabled={bulkPending}
        />
        <input
          className="w-72 rounded border border-slate-300 px-2 py-1 text-sm"
          placeholder="선택 반려 사유"
          value={bulkRejectReason}
          onChange={(event) => setBulkRejectReason(event.target.value)}
          disabled={bulkPending}
        />
        <button
          type="button"
          className="rounded bg-emerald-600 px-3 py-1 text-sm text-white disabled:opacity-60"
          onClick={bulkApprove}
          disabled={bulkPending || selectedIds.length === 0}
        >
          선택 승인
        </button>
        <button
          type="button"
          className="rounded bg-red-600 px-3 py-1 text-sm text-white disabled:opacity-60"
          onClick={bulkReject}
          disabled={bulkPending || selectedIds.length === 0}
        >
          선택 반려
        </button>
      </div>

      {message ? <p className="rounded bg-emerald-50 p-2 text-sm text-emerald-700">{message}</p> : null}
      {error ? <p className="rounded bg-red-50 p-2 text-sm text-red-700">{error}</p> : null}

      {loading ? (
        <p className="text-sm text-slate-500">승인 대기 상품을 불러오는 중...</p>
      ) : (
        <>
          {Object.entries(groupedRows).map(([supplierName, group]) => {
            const groupIds = group.map((row) => row.id);
            const groupAllSelected = groupIds.length > 0 && groupIds.every((id) => selectedSet.has(id));
            return (
              <div key={supplierName} className="mb-4 overflow-auto rounded border border-slate-200">
                <div className="border-b border-slate-200 bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-900">
                  {supplierName}
                </div>
                <table className="min-w-full border-collapse text-sm">
                  <thead>
                    <tr className="bg-slate-50">
                      <th className="border border-slate-200 px-2 py-1 text-left">
                        <input
                          type="checkbox"
                          checked={groupAllSelected}
                          onChange={(event) => {
                            if (event.target.checked) {
                              setSelectedIds((prev) => Array.from(new Set([...prev, ...groupIds])));
                            } else {
                              setSelectedIds((prev) => prev.filter((id) => !groupIds.includes(id)));
                            }
                          }}
                        />
                      </th>
                      <th className="border border-slate-200 px-2 py-1 text-left">공급사</th>
                      <th className="border border-slate-200 px-2 py-1 text-left">카테고리</th>
                      <th className="border border-slate-200 px-2 py-1 text-left">상품명</th>
                      <th className="border border-slate-200 px-2 py-1 text-left">규격</th>
                      <th className="border border-slate-200 px-2 py-1 text-left">가격</th>
                      <th className="border border-slate-200 px-2 py-1 text-left">등록 언어</th>
                      <th className="border border-slate-200 px-2 py-1 text-left">상태</th>
                      <th className="border border-slate-200 px-2 py-1 text-left">처리</th>
                    </tr>
                  </thead>
                  <tbody>
                    {group.map((row) => (
                      <Fragment key={row.id}>
                        <tr>
                          <td className="border border-slate-200 px-2 py-1">
                            <input
                              type="checkbox"
                              checked={selectedSet.has(row.id)}
                              onChange={(event) => {
                                if (event.target.checked) {
                                  setSelectedIds((prev) => Array.from(new Set([...prev, row.id])));
                                } else {
                                  setSelectedIds((prev) => prev.filter((id) => id !== row.id));
                                }
                              }}
                            />
                          </td>
                          <td className="border border-slate-200 px-2 py-1">{supplierName}</td>
                          <td className="border border-slate-200 px-2 py-1">{row.category.category_name}</td>
                          <td className="border border-slate-200 px-2 py-1">{row.name_original || "-"}</td>
                          <td className="border border-slate-200 px-2 py-1">{row.specification ?? "-"}</td>
                          <td className="border border-slate-200 px-2 py-1">
                            {Number(row.price).toLocaleString()} {row.currency}
                          </td>
                          <td className="border border-slate-200 px-2 py-1">
                            {SOURCE_LANGUAGE_LABEL[row.source_language]}
                          </td>
                          <td className="border border-slate-200 px-2 py-1">{STATUS_LABEL[row.status]}</td>
                          <td className="border border-slate-200 px-2 py-1">
                            <div className="flex flex-wrap gap-2">
                              <input
                                type="text"
                                className="w-52 rounded border border-slate-300 px-2 py-1 text-xs"
                                placeholder="반려 사유 입력"
                                value={rejectReasonMap[row.id] ?? ""}
                                onChange={(event) =>
                                  setRejectReasonMap((prev) => ({
                                    ...prev,
                                    [row.id]: event.target.value,
                                  }))
                                }
                              />
                              <button
                                type="button"
                                className="rounded border border-slate-300 px-2 py-1 text-xs"
                                onClick={() => toggleHistory(row.id)}
                              >
                                {historyOpenId === row.id ? "이력 닫기" : "이력 보기"}
                              </button>
                              <Link
                                href={`/admin/products/${row.id}`}
                                className="rounded border border-slate-300 px-2 py-1 text-xs"
                              >
                                번역 수정
                              </Link>
                              <button
                                type="button"
                                className="rounded bg-emerald-600 px-2 py-1 text-xs text-white disabled:opacity-50"
                                onClick={() => review(row.id, "APPROVED")}
                                disabled={processingIds.includes(row.id)}
                              >
                                승인
                              </button>
                              <button
                                type="button"
                                className="rounded bg-red-600 px-2 py-1 text-xs text-white disabled:opacity-50"
                                onClick={() => review(row.id, "REJECTED", rejectReasonMap[row.id])}
                                disabled={processingIds.includes(row.id)}
                              >
                                반려
                              </button>
                            </div>
                          </td>
                        </tr>
                        {historyOpenId === row.id ? (
                          <tr>
                            <td className="border border-slate-200 px-3 py-2" colSpan={9}>
                              <div className="rounded bg-slate-50 p-3">
                                <p className="mb-2 text-sm font-semibold text-slate-900">승인 이력 타임라인</p>
                                {historyLoadingId === row.id ? (
                                  <p className="text-sm text-slate-500">이력을 불러오는 중...</p>
                                ) : historyErrorMap[row.id] ? (
                                  <p className="text-sm text-red-600">{historyErrorMap[row.id]}</p>
                                ) : (historyMap[row.id] ?? []).length === 0 ? (
                                  <p className="text-sm text-slate-500">등록된 이력이 없습니다.</p>
                                ) : (
                                  <ul className="space-y-1 text-sm text-slate-700">
                                    {(historyMap[row.id] ?? []).map((entry, index) => (
                                      <li key={`${row.id}-${index}`}>
                                        {formatTimestamp(entry.timestamp)} -{" "}
                                        {APPROVAL_ACTION_LABEL[entry.action] ?? entry.action}
                                        {" · "}
                                        {entry.user}
                                        {entry.reason ? ` · 사유: ${entry.reason}` : ""}
                                      </li>
                                    ))}
                                  </ul>
                                )}
                              </div>
                            </td>
                          </tr>
                        ) : null}
                      </Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          })}
          {filteredRows.length === 0 ? (
            <p className="text-sm text-slate-500">조건에 맞는 승인 대기 상품이 없습니다.</p>
          ) : null}
        </>
      )}
    </section>
  );
}
