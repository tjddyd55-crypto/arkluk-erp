"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type Category = {
  id: number;
  category_name: string;
};

type ProductStatus = "DRAFT" | "PENDING" | "APPROVED" | "REJECTED";
type SupportedLanguage = "ko" | "en" | "mn" | "ar";

type ProductRow = {
  id: number;
  category_id: number;
  name_original: string;
  description_original: string | null;
  source_language: SupportedLanguage;
  name: string | null;
  sku: string | null;
  description: string | null;
  specification: string | null;
  price: string;
  currency: string;
  status: ProductStatus;
  rejection_reason: string | null;
  thumbnail_url: string | null;
  image_url: string | null;
  product_image_url: string | null;
  category?: Category | null;
  product_name: string;
  product_code: string;
  spec: string;
  dynamic_values?: Record<string, string | null>;
  created_at: string;
  updated_at: string;
};

type ProductFormField = {
  id: number;
  fieldKey: string;
  label: string;
  type: "TEXT" | "TEXTAREA" | "NUMBER" | "SELECT" | "BOOLEAN" | "DATE";
  required: boolean;
  placeholder?: string | null;
  helpText?: string | null;
  sortOrder: number;
  validation?: {
    options?: string[];
    min?: number;
    max?: number;
    pattern?: string;
  } | null;
};

type ProductFormSchema = {
  id: number;
  supplierId: number;
  name: string;
  fields: ProductFormField[];
};

type FormState = {
  categoryId: string;
  sourceLanguage: SupportedLanguage;
  imageUrl: string;
  formValues: Record<string, string>;
};

const INITIAL_FORM: FormState = {
  categoryId: "",
  sourceLanguage: "ko",
  imageUrl: "",
  formValues: {},
};

const LANGUAGE_OPTIONS: Array<{ value: SupportedLanguage; label: string }> = [
  { value: "ko", label: "한국어" },
  { value: "en", label: "English" },
  { value: "mn", label: "Монгол" },
  { value: "ar", label: "العربية" },
];

const STATUS_LABEL: Record<ProductStatus, string> = {
  DRAFT: "임시저장",
  PENDING: "승인 대기",
  APPROVED: "승인 완료",
  REJECTED: "반려",
};

type FieldRequest = {
  id: number;
  request_title: string;
  requested_field_label: string;
  requested_field_type: "TEXT" | "TEXTAREA" | "NUMBER" | "SELECT" | "BOOLEAN" | "DATE";
  request_reason: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  reviewed_at: string | null;
  created_at: string;
};

const FIELD_TYPE_OPTIONS: Array<{ value: FieldRequest["requested_field_type"]; label: string }> = [
  { value: "TEXT", label: "텍스트" },
  { value: "TEXTAREA", label: "긴 텍스트" },
  { value: "NUMBER", label: "숫자" },
  { value: "SELECT", label: "선택" },
  { value: "BOOLEAN", label: "참/거짓" },
  { value: "DATE", label: "날짜" },
];

export function SupplierProductManagement() {
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [productForm, setProductForm] = useState<ProductFormSchema | null>(null);
  const [fieldRequests, setFieldRequests] = useState<FieldRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submittingProductId, setSubmittingProductId] = useState<number | null>(null);
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newCategorySortOrder, setNewCategorySortOrder] = useState("0");
  const [creatingCategory, setCreatingCategory] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);
  const [excelImporting, setExcelImporting] = useState(false);
  const [requestTitle, setRequestTitle] = useState("");
  const [requestFieldLabel, setRequestFieldLabel] = useState("");
  const [requestFieldType, setRequestFieldType] = useState<FieldRequest["requested_field_type"]>("TEXT");
  const [requestReason, setRequestReason] = useState("");
  const [requestSubmitting, setRequestSubmitting] = useState(false);

  async function loadData() {
    setLoading(true);
    setError(null);
    try {
      const [productsResponse, categoriesResponse, productFormResponse, fieldRequestResponse] = await Promise.all([
        fetch("/api/supplier/products"),
        fetch("/api/supplier/products/categories"),
        fetch("/api/supplier/product-form"),
        fetch("/api/supplier/product-field-requests"),
      ]);
      const [productsResult, categoriesResult, productFormResult, fieldRequestResult] = await Promise.all([
        productsResponse.json(),
        categoriesResponse.json(),
        productFormResponse.json(),
        fieldRequestResponse.json(),
      ]);

      if (!productsResponse.ok || !productsResult.success) {
        throw new Error(productsResult.message ?? "상품 목록 조회 실패");
      }
      if (!categoriesResponse.ok || !categoriesResult.success) {
        throw new Error(categoriesResult.message ?? "카테고리 목록 조회 실패");
      }
      if (!productFormResponse.ok || !productFormResult.success) {
        throw new Error(productFormResult.message ?? "상품 폼 조회 실패");
      }
      if (!fieldRequestResponse.ok || !fieldRequestResult.success) {
        throw new Error(fieldRequestResult.message ?? "필드 요청 목록 조회 실패");
      }

      setProducts(productsResult.data as ProductRow[]);
      setCategories(categoriesResult.data as Category[]);
      setProductForm(productFormResult.data as ProductFormSchema);
      setFieldRequests(fieldRequestResult.data as FieldRequest[]);
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
    const nextFormValues =
      productForm?.fields.reduce<Record<string, string>>((acc, field) => {
        acc[field.fieldKey] = field.fieldKey === "currency" ? "KRW" : "";
        return acc;
      }, {}) ?? {};
    setForm({ ...INITIAL_FORM, formValues: nextFormValues });
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
    const nextFormValues =
      productForm?.fields.reduce<Record<string, string>>((acc, field) => {
        const dynamicValue = product.dynamic_values?.[field.fieldKey];
        acc[field.fieldKey] = dynamicValue ?? "";
        return acc;
      }, {}) ?? {};
    if (!nextFormValues.sku) {
      nextFormValues.sku = product.sku ?? product.product_code;
    }
    if (!nextFormValues.name) {
      nextFormValues.name = product.name_original ?? product.product_name;
    }
    if (!nextFormValues.specification) {
      nextFormValues.specification = product.specification ?? product.spec;
    }
    if (!nextFormValues.price) {
      nextFormValues.price = String(product.price ?? "");
    }
    if (!nextFormValues.currency) {
      nextFormValues.currency = product.currency ?? "KRW";
    }
    if (!nextFormValues.description) {
      nextFormValues.description = product.description_original ?? product.description ?? "";
    }

    setForm({
      categoryId: String(product.category_id),
      sourceLanguage: product.source_language ?? "ko",
      imageUrl: product.image_url ?? product.thumbnail_url ?? product.product_image_url ?? "",
      formValues: nextFormValues,
    });
    setEditingId(product.id);
    setFormOpen(true);
    setError(null);
    setMessage(null);
  }

  const requiredFields = useMemo(
    () => (productForm?.fields ?? []).filter((field) => field.required && field.type !== "BOOLEAN"),
    [productForm],
  );

  async function handleSave() {
    setError(null);
    setMessage(null);

    if (!form.categoryId) {
      setError("카테고리는 필수입니다.");
      return;
    }
    for (const field of requiredFields) {
      const value = (form.formValues[field.fieldKey] ?? "").trim();
      if (!value) {
        setError(`${field.label}은(는) 필수입니다.`);
        return;
      }
    }
    const priceValue = form.formValues.price;
    if (priceValue !== undefined && Number(priceValue) <= 0) {
      setError("가격은 0보다 커야 합니다.");
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        categoryId: Number(form.categoryId),
        sourceLanguage: form.sourceLanguage,
        imageUrl: form.imageUrl.trim() || null,
        formValues: form.formValues,
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
      setForm({ ...INITIAL_FORM, formValues: {} });
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "상품 저장 실패");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCreateCategory() {
    setError(null);
    setMessage(null);
    const categoryName = newCategoryName.trim();
    if (!categoryName) {
      setError("카테고리명을 입력해 주세요.");
      return;
    }
    setCreatingCategory(true);
    try {
      const response = await fetch("/api/supplier/products/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          categoryName,
          sortOrder: Number(newCategorySortOrder || "0"),
        }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.message ?? "카테고리 생성 실패");
      }
      const created = result.data as Category;
      setMessage("카테고리가 생성되었습니다.");
      setNewCategoryName("");
      setNewCategorySortOrder("0");
      setForm((prev) => ({ ...prev, categoryId: String(created.id) }));
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "카테고리 생성 실패");
    } finally {
      setCreatingCategory(false);
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

  async function handleDeleteProduct(productId: number) {
    if (!confirm("정말 삭제하시겠습니까?")) {
      return;
    }
    setError(null);
    setMessage(null);
    try {
      const response = await fetch(`/api/supplier/products/${productId}`, {
        method: "DELETE",
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.message ?? "상품 삭제 실패");
      }
      setMessage("상품이 삭제되었습니다.");
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "상품 삭제 실패");
    }
  }

  async function handleUploadImage(file: File) {
    setError(null);
    setUploadingImage(true);
    try {
      const data = new FormData();
      data.append("image", file);
      const response = await fetch("/api/supplier/products/image-upload", {
        method: "POST",
        body: data,
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.message ?? "이미지 업로드 실패");
      }
      setForm((prev) => ({ ...prev, imageUrl: result.data.imageUrl as string }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "이미지 업로드 실패");
    } finally {
      setUploadingImage(false);
    }
  }

  async function handleExcelImport(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    const fileInput = e.currentTarget.elements.namedItem("excelFile") as HTMLInputElement | null;
    const file = fileInput?.files?.[0];
    if (!file) {
      setError("업로드할 파일을 선택해 주세요.");
      return;
    }

    setExcelImporting(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const response = await fetch("/api/supplier/products/excel-import", {
        method: "POST",
        body: formData,
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.message ?? "엑셀 업로드 실패");
      }
      const data = result.data as {
        totalRows: number;
        successCount: number;
        failCount: number;
        errors: string[];
      };
      setMessage(
        `엑셀 처리 완료 (총 ${data.totalRows}건 / 성공 ${data.successCount}건 / 실패 ${data.failCount}건)${
          data.errors.length > 0 ? `\n${data.errors.slice(0, 5).join("\n")}` : ""
        }`,
      );
      e.currentTarget.reset();
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "엑셀 업로드 실패");
    } finally {
      setExcelImporting(false);
    }
  }

  async function handleCreateFieldRequest() {
    setError(null);
    setMessage(null);
    if (!requestTitle.trim() || !requestFieldLabel.trim() || !requestReason.trim()) {
      setError("요청 제목, 필드명, 요청 사유는 필수입니다.");
      return;
    }
    setRequestSubmitting(true);
    try {
      const response = await fetch("/api/supplier/product-field-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestTitle: requestTitle.trim(),
          requestedFieldLabel: requestFieldLabel.trim(),
          requestedFieldType: requestFieldType,
          requestReason: requestReason.trim(),
        }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.message ?? "필드 요청 등록 실패");
      }
      setRequestTitle("");
      setRequestFieldLabel("");
      setRequestFieldType("TEXT");
      setRequestReason("");
      setMessage("필드 추가 요청이 등록되었습니다.");
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "필드 요청 등록 실패");
    } finally {
      setRequestSubmitting(false);
    }
  }

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setPreviewImageUrl(null);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const listMainFields = useMemo(() => {
    const prioritized = ["name", "sku", "specification", "price"];
    const fields = productForm?.fields ?? [];
    const selected: ProductFormField[] = [];
    for (const key of prioritized) {
      const found = fields.find((field) => field.fieldKey === key);
      if (found) selected.push(found);
    }
    for (const field of fields) {
      if (selected.length >= 4) break;
      if (!selected.find((row) => row.fieldKey === field.fieldKey)) {
        selected.push(field);
      }
    }
    return selected.slice(0, 4);
  }, [productForm]);

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

      {productForm ? (
        <p className="rounded bg-slate-50 p-2 text-xs text-slate-600">
          현재 적용 폼: {productForm.name}
        </p>
      ) : null}
      {message ? (
        <p className="whitespace-pre-line rounded bg-emerald-50 p-2 text-sm text-emerald-700">{message}</p>
      ) : null}
      {error ? <p className="rounded bg-red-50 p-2 text-sm text-red-700">{error}</p> : null}

      <div className="rounded border border-slate-200 bg-slate-50 p-3">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="rounded border border-slate-300 px-3 py-1 text-sm"
            onClick={() => {
              window.location.href = "/api/supplier/products/excel-template";
            }}
          >
            샘플 다운로드
          </button>
          <form className="flex items-center gap-2" onSubmit={handleExcelImport}>
            <input name="excelFile" type="file" accept=".xlsx,.xls" />
            <button
              type="submit"
              className="rounded border border-slate-300 px-3 py-1 text-sm disabled:opacity-60"
              disabled={excelImporting}
            >
              {excelImporting ? "업로드 중..." : "엑셀 업로드"}
            </button>
          </form>
        </div>
        <p className="mt-2 text-xs text-slate-500">
          현재 귀사의 상품 등록 필드 구조에 맞는 샘플 파일을 다운로드하여 작성 후 업로드하세요.
        </p>
      </div>

      {formOpen ? (
        <div className="rounded border border-slate-200 bg-slate-50 p-3">
          <h3 className="text-sm font-semibold text-slate-900">
            {editingId === null ? "상품 초안 등록" : "상품 초안 수정"}
          </h3>
          <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-[1fr_120px_100px]">
            <input
              className="rounded border border-slate-300 px-2 py-1 text-sm"
              placeholder="카테고리명"
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              disabled={creatingCategory}
            />
            <input
              className="rounded border border-slate-300 px-2 py-1 text-sm"
              placeholder="정렬"
              value={newCategorySortOrder}
              onChange={(e) => setNewCategorySortOrder(e.target.value)}
              disabled={creatingCategory}
            />
            <button
              type="button"
              className="rounded border border-slate-300 px-3 py-1 text-sm disabled:opacity-60"
              onClick={handleCreateCategory}
              disabled={creatingCategory}
            >
              {creatingCategory ? "추가 중..." : "카테고리 추가"}
            </button>
          </div>
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
            <select
              className="rounded border border-slate-300 px-2 py-1 text-sm"
              value={form.sourceLanguage}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, sourceLanguage: e.target.value as SupportedLanguage }))
              }
            >
              {LANGUAGE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  원문 언어: {option.label}
                </option>
              ))}
            </select>
            {(productForm?.fields ?? []).map((field) => (
              <div key={field.id} className={field.type === "TEXTAREA" ? "md:col-span-2" : ""}>
                {field.type === "TEXTAREA" ? (
                  <textarea
                    className="w-full rounded border border-slate-300 px-2 py-1 text-sm"
                    rows={3}
                    placeholder={field.placeholder ?? field.label}
                    value={form.formValues[field.fieldKey] ?? ""}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        formValues: { ...prev.formValues, [field.fieldKey]: e.target.value },
                      }))
                    }
                  />
                ) : field.type === "SELECT" ? (
                  <select
                    className="w-full rounded border border-slate-300 px-2 py-1 text-sm"
                    value={form.formValues[field.fieldKey] ?? ""}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        formValues: { ...prev.formValues, [field.fieldKey]: e.target.value },
                      }))
                    }
                  >
                    <option value="">{field.label}</option>
                    {(field.validation?.options ?? []).map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                ) : field.type === "BOOLEAN" ? (
                  <select
                    className="w-full rounded border border-slate-300 px-2 py-1 text-sm"
                    value={form.formValues[field.fieldKey] ?? ""}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        formValues: { ...prev.formValues, [field.fieldKey]: e.target.value },
                      }))
                    }
                  >
                    <option value="">{field.label}</option>
                    <option value="true">true</option>
                    <option value="false">false</option>
                  </select>
                ) : (
                  <input
                    type={field.type === "NUMBER" ? "number" : field.type === "DATE" ? "date" : "text"}
                    className="w-full rounded border border-slate-300 px-2 py-1 text-sm"
                    placeholder={`${field.label}${field.required ? " *" : ""}`}
                    value={form.formValues[field.fieldKey] ?? ""}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        formValues: { ...prev.formValues, [field.fieldKey]: e.target.value },
                      }))
                    }
                  />
                )}
                {field.helpText ? <p className="mt-1 text-xs text-slate-500">{field.helpText}</p> : null}
              </div>
            ))}
            <div className="md:col-span-2">
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="file"
                  accept=".jpg,.jpeg,.png,.webp"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      void handleUploadImage(file);
                    }
                  }}
                />
                <button
                  type="button"
                  className="rounded border border-slate-300 px-3 py-1 text-sm disabled:opacity-60"
                  disabled={uploadingImage}
                  onClick={() => setForm((prev) => ({ ...prev, imageUrl: "" }))}
                >
                  {uploadingImage ? "업로드 중..." : "이미지 초기화"}
                </button>
              </div>
              {form.imageUrl ? (
                <div className="mt-2 flex items-center gap-2">
                  <img
                    src={form.imageUrl}
                    alt="상품 이미지 미리보기"
                    className="h-12 w-12 rounded border border-slate-200 object-cover"
                  />
                  <span className="text-xs text-slate-500">{form.imageUrl}</span>
                </div>
              ) : (
                <p className="mt-2 text-xs text-slate-500">이미지는 선택값입니다.</p>
              )}
            </div>
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
                setForm({ ...INITIAL_FORM, formValues: {} });
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
                <th className="border border-slate-200 px-2 py-1 text-left">이미지</th>
                <th className="border border-slate-200 px-2 py-1 text-left">카테고리</th>
                {listMainFields.map((field) => (
                  <th key={field.id} className="border border-slate-200 px-2 py-1 text-left">
                    {field.label}
                  </th>
                ))}
                <th className="border border-slate-200 px-2 py-1 text-left">상태</th>
                <th className="border border-slate-200 px-2 py-1 text-left">반려 사유</th>
                <th className="border border-slate-200 px-2 py-1 text-left">작업</th>
              </tr>
            </thead>
            <tbody>
              {products.map((product) => (
                <tr key={product.id}>
                  <td className="border border-slate-200 px-2 py-1">
                    {product.image_url || product.thumbnail_url || product.product_image_url ? (
                      <button
                        type="button"
                        onClick={() =>
                          setPreviewImageUrl(
                            product.image_url ?? product.thumbnail_url ?? product.product_image_url ?? null,
                          )
                        }
                      >
                        <img
                          src={product.image_url ?? product.thumbnail_url ?? product.product_image_url ?? ""}
                          alt="상품 썸네일"
                          className="h-10 w-10 rounded border border-slate-200 object-cover"
                        />
                      </button>
                    ) : (
                      <span className="text-xs text-slate-400">-</span>
                    )}
                  </td>
                  <td className="border border-slate-200 px-2 py-1">
                    {product.category?.category_name ?? "-"}
                  </td>
                  {listMainFields.map((field) => (
                    <td key={field.id} className="border border-slate-200 px-2 py-1">
                      {product.dynamic_values?.[field.fieldKey] ??
                        (field.fieldKey === "name"
                          ? (product.name ?? product.product_name)
                          : field.fieldKey === "sku"
                            ? (product.sku ?? product.product_code)
                            : field.fieldKey === "specification"
                              ? (product.specification ?? product.spec)
                              : field.fieldKey === "price"
                                ? `${Number(product.price).toLocaleString()} ${product.currency}`
                                : "-")}
                    </td>
                  ))}
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
                        className="rounded border border-red-300 px-2 py-1 text-xs text-red-700"
                        onClick={() => handleDeleteProduct(product.id)}
                      >
                        삭제
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
                  <td className="border border-slate-200 px-2 py-3 text-center text-slate-500" colSpan={9 + listMainFields.length}>
                    등록된 상품이 없습니다.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      )}

      <div className="rounded border border-slate-200 bg-slate-50 p-3">
        <h3 className="text-sm font-semibold text-slate-900">필드 추가 요청</h3>
        <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-2">
          <input
            className="rounded border border-slate-300 px-2 py-1 text-sm"
            placeholder="요청 제목"
            value={requestTitle}
            onChange={(e) => setRequestTitle(e.target.value)}
          />
          <input
            className="rounded border border-slate-300 px-2 py-1 text-sm"
            placeholder="요청 필드명"
            value={requestFieldLabel}
            onChange={(e) => setRequestFieldLabel(e.target.value)}
          />
          <select
            className="rounded border border-slate-300 px-2 py-1 text-sm"
            value={requestFieldType}
            onChange={(e) => setRequestFieldType(e.target.value as FieldRequest["requested_field_type"])}
          >
            {FIELD_TYPE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <input
            className="rounded border border-slate-300 px-2 py-1 text-sm"
            placeholder="요청 사유"
            value={requestReason}
            onChange={(e) => setRequestReason(e.target.value)}
          />
        </div>
        <button
          type="button"
          className="mt-2 rounded border border-slate-300 px-3 py-1 text-sm disabled:opacity-60"
          disabled={requestSubmitting}
          onClick={handleCreateFieldRequest}
        >
          {requestSubmitting ? "등록 중..." : "필드 추가 요청"}
        </button>
        <div className="mt-3 overflow-auto">
          <table className="min-w-full border-collapse text-xs">
            <thead>
              <tr className="bg-white">
                <th className="border border-slate-200 px-2 py-1 text-left">요청 제목</th>
                <th className="border border-slate-200 px-2 py-1 text-left">필드명</th>
                <th className="border border-slate-200 px-2 py-1 text-left">타입</th>
                <th className="border border-slate-200 px-2 py-1 text-left">상태</th>
                <th className="border border-slate-200 px-2 py-1 text-left">요청일</th>
              </tr>
            </thead>
            <tbody>
              {fieldRequests.map((request) => (
                <tr key={request.id}>
                  <td className="border border-slate-200 px-2 py-1">{request.request_title}</td>
                  <td className="border border-slate-200 px-2 py-1">{request.requested_field_label}</td>
                  <td className="border border-slate-200 px-2 py-1">{request.requested_field_type}</td>
                  <td className="border border-slate-200 px-2 py-1">{request.status}</td>
                  <td className="border border-slate-200 px-2 py-1">
                    {new Date(request.created_at).toLocaleString()}
                  </td>
                </tr>
              ))}
              {fieldRequests.length === 0 ? (
                <tr>
                  <td className="border border-slate-200 px-2 py-2 text-center text-slate-500" colSpan={5}>
                    등록된 요청이 없습니다.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      {previewImageUrl ? (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 p-4"
          onClick={() => setPreviewImageUrl(null)}
        >
          <div className="relative max-h-[90vh] max-w-[90vw]" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className="absolute -right-3 -top-3 rounded-full bg-white px-2 py-1 text-xs"
              onClick={() => setPreviewImageUrl(null)}
            >
              X
            </button>
            <img src={previewImageUrl} alt="상품 이미지 확대" className="max-h-[85vh] rounded object-contain" />
          </div>
        </div>
      ) : null}
    </section>
  );
}
