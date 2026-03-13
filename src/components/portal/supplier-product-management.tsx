"use client";

import { useEffect, useState } from "react";

type Category = {
  id: number;
  category_name: string;
};

type ProductStatus = "DRAFT" | "PENDING" | "APPROVED" | "REJECTED";

type ProductRow = {
  id: number;
  category_id: number;
  name: string | null;
  sku: string | null;
  description: string | null;
  specification: string | null;
  price: string;
  currency: string;
  status: ProductStatus;
  rejection_reason: string | null;
  thumbnail_url: string | null;
  product_image_url: string | null;
  category?: Category | null;
  product_name: string;
  product_code: string;
  spec: string;
  created_at: string;
  updated_at: string;
};

type FormState = {
  categoryId: string;
  name: string;
  sku: string;
  description: string;
  specification: string;
  price: string;
  currency: string;
  thumbnailUrl: string;
};

const INITIAL_FORM: FormState = {
  categoryId: "",
  name: "",
  sku: "",
  description: "",
  specification: "",
  price: "",
  currency: "KRW",
  thumbnailUrl: "",
};

const STATUS_LABEL: Record<ProductStatus, string> = {
  DRAFT: "임시저장",
  PENDING: "승인 대기",
  APPROVED: "승인 완료",
  REJECTED: "반려",
};

export function SupplierProductManagement() {
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submittingProductId, setSubmittingProductId] = useState<number | null>(null);
  const [form, setForm] = useState<FormState>(INITIAL_FORM);

  async function loadData() {
    setLoading(true);
    setError(null);
    try {
      const [productsResponse, categoriesResponse] = await Promise.all([
        fetch("/api/supplier/products"),
        fetch("/api/supplier/products/categories"),
      ]);
      const [productsResult, categoriesResult] = await Promise.all([
        productsResponse.json(),
        categoriesResponse.json(),
      ]);

      if (!productsResponse.ok || !productsResult.success) {
        throw new Error(productsResult.message ?? "상품 목록 조회 실패");
      }
      if (!categoriesResponse.ok || !categoriesResult.success) {
        throw new Error(categoriesResult.message ?? "카테고리 목록 조회 실패");
      }

      setProducts(productsResult.data as ProductRow[]);
      setCategories(categoriesResult.data as Category[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "데이터 조회 실패");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  function openCreate() {
    setForm(INITIAL_FORM);
    setEditingId(null);
    setFormOpen(true);
    setError(null);
    setMessage(null);
  }

  function openEdit(product: ProductRow) {
    if (product.status !== "DRAFT" && product.status !== "REJECTED") {
      setError("DRAFT 또는 REJECTED 상태 상품만 수정할 수 있습니다.");
      return;
    }
    setForm({
      categoryId: String(product.category_id),
      name: product.name ?? product.product_name,
      sku: product.sku ?? product.product_code,
      description: product.description ?? "",
      specification: product.specification ?? product.spec,
      price: String(product.price ?? ""),
      currency: product.currency ?? "KRW",
      thumbnailUrl: product.thumbnail_url ?? product.product_image_url ?? "",
    });
    setEditingId(product.id);
    setFormOpen(true);
    setError(null);
    setMessage(null);
  }

  async function handleSave() {
    setError(null);
    setMessage(null);

    if (!form.categoryId || !form.name.trim() || !form.sku.trim() || !form.specification.trim()) {
      setError("카테고리, 상품명, SKU, 규격은 필수입니다.");
      return;
    }
    if (!form.price || Number(form.price) <= 0) {
      setError("가격은 0보다 커야 합니다.");
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        categoryId: Number(form.categoryId),
        name: form.name.trim(),
        sku: form.sku.trim(),
        description: form.description.trim() || null,
        specification: form.specification.trim(),
        price: Number(form.price),
        currency: form.currency.trim().toUpperCase(),
        thumbnailUrl: form.thumbnailUrl.trim() || null,
      };
      const endpoint =
        editingId === null ? "/api/supplier/products" : `/api/supplier/products/${editingId}`;
      const method = editingId === null ? "POST" : "PATCH";

      const response = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.message ?? "상품 저장 실패");
      }

      setMessage(editingId === null ? "상품 초안이 생성되었습니다." : "상품 초안이 수정되었습니다.");
      setFormOpen(false);
      setEditingId(null);
      setForm(INITIAL_FORM);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "상품 저장 실패");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSubmitProduct(productId: number) {
    setError(null);
    setMessage(null);
    setSubmittingProductId(productId);
    try {
      const response = await fetch(`/api/supplier/products/${productId}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ submit: true }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.message ?? "상품 제출 실패");
      }
      setMessage("상품이 승인 대기 상태로 제출되었습니다.");
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "상품 제출 실패");
    } finally {
      setSubmittingProductId(null);
    }
  }

  return (
    <section className="space-y-3 rounded border border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-900">My Products</h2>
        <button
          type="button"
          className="rounded bg-slate-900 px-3 py-2 text-sm text-white"
          onClick={openCreate}
        >
          Add Product
        </button>
      </div>

      {message ? <p className="rounded bg-emerald-50 p-2 text-sm text-emerald-700">{message}</p> : null}
      {error ? <p className="rounded bg-red-50 p-2 text-sm text-red-700">{error}</p> : null}

      {formOpen ? (
        <div className="rounded border border-slate-200 bg-slate-50 p-3">
          <h3 className="text-sm font-semibold text-slate-900">
            {editingId === null ? "상품 초안 등록" : "상품 초안 수정"}
          </h3>
          <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-2">
            <select
              className="rounded border border-slate-300 px-2 py-1 text-sm"
              value={form.categoryId}
              onChange={(e) => setForm((prev) => ({ ...prev, categoryId: e.target.value }))}
            >
              <option value="">카테고리 선택</option>
              {categories.map((category) => (
                <option key={category.id} value={String(category.id)}>
                  {category.category_name}
                </option>
              ))}
            </select>
            <input
              className="rounded border border-slate-300 px-2 py-1 text-sm"
              placeholder="SKU"
              value={form.sku}
              onChange={(e) => setForm((prev) => ({ ...prev, sku: e.target.value }))}
            />
            <input
              className="rounded border border-slate-300 px-2 py-1 text-sm"
              placeholder="상품명"
              value={form.name}
              onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
            />
            <input
              className="rounded border border-slate-300 px-2 py-1 text-sm"
              placeholder="규격"
              value={form.specification}
              onChange={(e) => setForm((prev) => ({ ...prev, specification: e.target.value }))}
            />
            <input
              className="rounded border border-slate-300 px-2 py-1 text-sm"
              placeholder="가격"
              value={form.price}
              onChange={(e) => setForm((prev) => ({ ...prev, price: e.target.value }))}
            />
            <input
              className="rounded border border-slate-300 px-2 py-1 text-sm"
              placeholder="통화 (예: KRW)"
              value={form.currency}
              onChange={(e) => setForm((prev) => ({ ...prev, currency: e.target.value }))}
            />
            <input
              className="rounded border border-slate-300 px-2 py-1 text-sm md:col-span-2"
              placeholder="설명"
              value={form.description}
              onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
            />
            <input
              className="rounded border border-slate-300 px-2 py-1 text-sm md:col-span-2"
              placeholder="썸네일 URL (선택)"
              value={form.thumbnailUrl}
              onChange={(e) => setForm((prev) => ({ ...prev, thumbnailUrl: e.target.value }))}
            />
          </div>
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              className="rounded bg-slate-900 px-3 py-1 text-sm text-white disabled:opacity-60"
              disabled={submitting}
              onClick={handleSave}
            >
              {submitting ? "저장 중..." : "저장"}
            </button>
            <button
              type="button"
              className="rounded border border-slate-300 px-3 py-1 text-sm"
              onClick={() => {
                setFormOpen(false);
                setForm(INITIAL_FORM);
                setEditingId(null);
              }}
            >
              취소
            </button>
          </div>
        </div>
      ) : null}

      {loading ? (
        <p className="text-sm text-slate-500">상품 목록을 불러오는 중...</p>
      ) : (
        <div className="overflow-auto">
          <table className="min-w-full border-collapse text-sm">
            <thead>
              <tr className="bg-slate-50">
                <th className="border border-slate-200 px-2 py-1 text-left">카테고리</th>
                <th className="border border-slate-200 px-2 py-1 text-left">상품명</th>
                <th className="border border-slate-200 px-2 py-1 text-left">SKU</th>
                <th className="border border-slate-200 px-2 py-1 text-left">규격</th>
                <th className="border border-slate-200 px-2 py-1 text-left">가격</th>
                <th className="border border-slate-200 px-2 py-1 text-left">상태</th>
                <th className="border border-slate-200 px-2 py-1 text-left">반려 사유</th>
                <th className="border border-slate-200 px-2 py-1 text-left">작업</th>
              </tr>
            </thead>
            <tbody>
              {products.map((product) => (
                <tr key={product.id}>
                  <td className="border border-slate-200 px-2 py-1">
                    {product.category?.category_name ?? "-"}
                  </td>
                  <td className="border border-slate-200 px-2 py-1">
                    {product.name ?? product.product_name}
                  </td>
                  <td className="border border-slate-200 px-2 py-1">
                    {product.sku ?? product.product_code}
                  </td>
                  <td className="border border-slate-200 px-2 py-1">
                    {product.specification ?? product.spec}
                  </td>
                  <td className="border border-slate-200 px-2 py-1">
                    {Number(product.price).toLocaleString()} {product.currency}
                  </td>
                  <td className="border border-slate-200 px-2 py-1">{STATUS_LABEL[product.status]}</td>
                  <td className="border border-slate-200 px-2 py-1">
                    {product.status === "REJECTED" ? product.rejection_reason ?? "-" : "-"}
                  </td>
                  <td className="border border-slate-200 px-2 py-1">
                    <div className="flex gap-2">
                      <button
                        type="button"
                        className="rounded border border-slate-300 px-2 py-1 text-xs disabled:opacity-50"
                        onClick={() => openEdit(product)}
                        disabled={product.status !== "DRAFT" && product.status !== "REJECTED"}
                      >
                        수정
                      </button>
                      <button
                        type="button"
                        className="rounded border border-slate-300 px-2 py-1 text-xs disabled:opacity-50"
                        disabled={
                          (product.status !== "DRAFT" && product.status !== "REJECTED") ||
                          submittingProductId === product.id
                        }
                        onClick={() => handleSubmitProduct(product.id)}
                      >
                        {submittingProductId === product.id ? "제출 중..." : "제출"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {products.length === 0 ? (
                <tr>
                  <td className="border border-slate-200 px-2 py-3 text-center text-slate-500" colSpan={8}>
                    등록된 상품이 없습니다.
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
