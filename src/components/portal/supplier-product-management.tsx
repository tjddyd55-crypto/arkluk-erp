"use client";

import { FormEvent, Fragment, useEffect, useMemo, useState } from "react";

import { mergeProductImageGallery } from "@/lib/product-image-urls";

type Category = {
  id: number;
  category_name: string;
};

type ProductStatus = "DRAFT" | "PENDING" | "APPROVED" | "REJECTED";
type SupportedLanguage = "ko" | "en" | "mn" | "ar";
type ProductLine = "CONSTRUCTION" | "GENERAL";

const PRODUCT_LINE_LABEL: Record<ProductLine, string> = {
  CONSTRUCTION: "건축자재",
  GENERAL: "기타상품",
};

type ProductRow = {
  id: number;
  category_id: number;
  productCategory: ProductLine;
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
  image_url: string | null;
  /** Prisma Json — 클라이언트에서는 문자열 배열로 직렬화되어 온다고 가정 */
  image_urls?: unknown;
  category?: Category | null;
  product_name: string;
  product_code: string;
  spec: string;
  memo?: string | null;
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
  supplierProductCategory: ProductLine;
  name: string;
  fields: ProductFormField[];
};

type FormState = {
  categoryId: string;
  sourceLanguage: SupportedLanguage;
  /** DB에 저장된 공개 이미지 URL(표시·전송 시 그대로 사용) */
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

/** 다크 리스트 UI 토큰 — 배경 #0f1115 / 행 #1a1d23 / hover #23272f / 펼침 #111318 */
const spm = {
  page: "space-y-3 rounded border border-[#2d333d] bg-transparent p-4 text-gray-300",
  panel: "rounded border border-[#2d333d] bg-[#1a1d23] p-3",
  muted: "text-gray-400",
  border: "border-[#2d333d]",
  heading: "font-semibold text-white",
  listGrid:
    "grid grid-cols-[64px_minmax(0,1fr)_minmax(104px,auto)_minmax(88px,auto)_minmax(200px,auto)] items-center gap-3",
  listHead:
    "grid grid-cols-[64px_minmax(0,1fr)_minmax(104px,auto)_minmax(88px,auto)_minmax(200px,auto)] items-center gap-3 border-b border-[#2d333d] bg-[#14171c] px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-gray-400",
  listRow:
    "relative z-0 cursor-pointer border-b border-[#2d333d] bg-[#1a1d23] transition-colors hover:bg-[#23272f]",
  expand: "border-b border-[#2d333d] bg-[#111318]",
  btnPrimary:
    "rounded px-3 py-2 text-sm font-medium bg-blue-600 text-white transition-colors hover:bg-blue-500 disabled:opacity-50",
  btnSecondary:
    "rounded border border-[#3d4450] bg-[#2a3038] px-3 py-1.5 text-sm text-gray-300 transition-colors hover:bg-[#323842] disabled:opacity-50",
  btnDanger:
    "rounded border border-red-900/60 bg-red-950/25 px-2 py-1 text-xs text-red-400 transition-colors hover:bg-red-950/45",
  input:
    "rounded border border-[#2d333d] bg-[#14171c] px-2 py-1.5 text-sm text-white placeholder:text-gray-500",
  select:
    "rounded border border-[#2d333d] bg-[#14171c] px-2 py-1.5 text-sm text-white",
  galleryScroll: "flex flex-nowrap gap-3 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:thin]",
  /** 썸네일 슬롯: 행 높이·그리드에 영향 없음 */
  thumbSlot: "relative h-[60px] w-[60px] shrink-0 overflow-visible",
  /** 썸네일: group-hover 기준, isolate로 스택 안정화 · 호버 시 행 위로 */
  thumbWrap: "group relative isolate z-0 h-full w-full overflow-visible group-hover:z-[55]",
  thumbImg:
    "product-thumbnail border border-[#2d333d] transition-transform duration-200 ease-out will-change-transform group-hover:relative group-hover:z-[1] group-hover:scale-110 group-hover:shadow-lg group-hover:shadow-black/60 group-hover:ring-2 group-hover:ring-blue-500/35",
  /** absolute + z≥50 + pointer-events-none, -ml로 썸네일과 살짝 겹쳐 hover 끊김 완화 */
  thumbPreview:
    "pointer-events-none absolute left-full top-1/2 z-[60] -ml-1 hidden w-[min(280px,calc(100vw-8rem))] -translate-y-1/2 rounded border border-[#2d333d] bg-[#111318] p-1.5 shadow-2xl shadow-black/60 group-hover:block",
  thumbPreviewImg: "pointer-events-none max-h-52 max-w-full object-contain",
  /** 상품 상태 pill — 배경 + 글자색 (rounded-full) */
  statusPillBase: "inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium",
  statusDraft: "bg-yellow-500/20 text-yellow-200 ring-1 ring-inset ring-yellow-500/30",
  statusApproved: "bg-emerald-500/20 text-emerald-200 ring-1 ring-inset ring-emerald-500/35",
  statusRejected: "bg-red-500/20 text-red-200 ring-1 ring-inset ring-red-500/35",
  statusPending: "bg-sky-500/20 text-sky-200 ring-1 ring-inset ring-sky-500/30",
  /** 필드 요청 상태 pill */
  fieldReqApproved: "bg-emerald-500/20 text-emerald-200 ring-1 ring-inset ring-emerald-500/35",
  fieldReqRejected: "bg-red-500/20 text-red-200 ring-1 ring-inset ring-red-500/35",
  fieldReqPending: "bg-amber-500/20 text-amber-200 ring-1 ring-inset ring-amber-500/30",
} as const;

/** APPROVED=ACTIVE(녹색), DRAFT=노랑, REJECTED=빨강, PENDING=sky */
function productStatusSpmClasses(status: ProductStatus): string {
  if (status === "DRAFT") {
    return spm.statusDraft;
  }
  if (status === "APPROVED") {
    return spm.statusApproved;
  }
  if (status === "REJECTED") {
    return spm.statusRejected;
  }
  return spm.statusPending;
}

function fieldRequestStatusSpmClasses(status: FieldRequest["status"]): string {
  if (status === "APPROVED") {
    return spm.fieldReqApproved;
  }
  if (status === "REJECTED") {
    return spm.fieldReqRejected;
  }
  return spm.fieldReqPending;
}

function productListDisplayName(p: ProductRow): string {
  const v = (p.dynamic_values?.name ?? p.name ?? p.product_name ?? "").trim();
  return v || "-";
}

function productListDisplayPrice(p: ProductRow): string {
  const dynamicPrice = p.dynamic_values?.price;
  const priceStr =
    dynamicPrice !== undefined && dynamicPrice !== null && String(dynamicPrice).trim() !== ""
      ? String(dynamicPrice)
      : String(p.price ?? "");
  const num = Number(priceStr);
  const formatted = Number.isFinite(num) ? num.toLocaleString() : priceStr;
  return `${formatted} ${p.currency}`;
}

function productDescriptionForDetail(p: ProductRow): string {
  return String(
    p.dynamic_values?.description ?? p.description_original ?? p.description ?? p.memo ?? "",
  ).trim();
}

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
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [settingPrimaryProductId, setSettingPrimaryProductId] = useState<number | null>(null);
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
      const pf = productFormResult.data as ProductFormSchema;
      setProductForm({
        ...pf,
        supplierProductCategory: pf.supplierProductCategory ?? "CONSTRUCTION",
      });
      setFieldRequests(fieldRequestResult.data as FieldRequest[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "데이터 조회 실패");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
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
      imageUrl: product.image_url ?? "",
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
      const payload: Record<string, unknown> = {
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

      if (editingId !== null && result.unchanged === true) {
        setMessage("변경된 내용이 없습니다.");
        return;
      }

      const originStatus =
        editingId === null ? null : products.find((p) => p.id === editingId)?.status ?? null;

      if (editingId === null) {
        const created = result.data as {
          id: number;
          image_url?: string | null;
        };
        setEditingId(created.id);
        setForm((prev) => ({
          ...prev,
          imageUrl: created.image_url ?? prev.imageUrl,
        }));
        setMessage("상품 초안이 생성되었습니다. 이제 이미지를 업로드할 수 있습니다.");
        await loadData();
        return;
      }

      setMessage(
        originStatus === "APPROVED"
          ? "수정이 반영되었으며, 승인 대기(PENDING) 상태로 변경되었습니다."
          : "상품이 수정되었습니다.",
      );
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
      setMessage("상품이 제출되어 자동 승인되었습니다.");
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
    if (editingId === null) {
      setError("먼저 [저장]으로 상품 초안을 만든 뒤 이미지를 올려 주세요.");
      return;
    }
    setUploadingImage(true);
    try {
      const data = new FormData();
      data.append("file", file);
      data.append("productId", String(editingId));
      const response = await fetch("/api/supplier/products/image-upload", {
        method: "POST",
        body: data,
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.message ?? "이미지 업로드 실패");
      }
      const url = result.data.url as string;
      setForm((prev) => ({
        ...prev,
        imageUrl: url,
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "이미지 업로드 실패");
    } finally {
      setUploadingImage(false);
    }
  }

  async function handleClearImage() {
    setError(null);
    setMessage(null);
    if (editingId === null) {
      setForm((prev) => ({ ...prev, imageUrl: "" }));
      return;
    }
    setUploadingImage(true);
    try {
      const response = await fetch(`/api/supplier/products/${editingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageUrl: null }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.message ?? "이미지 초기화 실패");
      }
      setForm((prev) => ({ ...prev, imageUrl: "" }));
      if (result.unchanged !== true) {
        await loadData();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "이미지 초기화 실패");
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

  async function handleSetPrimaryImage(productId: number, imageUrl: string) {
    setError(null);
    setMessage(null);
    setSettingPrimaryProductId(productId);
    try {
      const response = await fetch(`/api/supplier/products/${productId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageUrl }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.message ?? "대표 이미지 변경 실패");
      }
      if (result.unchanged === true) {
        setMessage("이미 대표 이미지입니다.");
      } else {
        setMessage("대표 이미지가 변경되었습니다.");
      }
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "대표 이미지 변경 실패");
    } finally {
      setSettingPrimaryProductId(null);
    }
  }

  return (
    <section className={spm.page}>
      <div className="flex items-center justify-between">
        <h2 className={`text-lg ${spm.heading}`}>My Products</h2>
        <button type="button" className={spm.btnPrimary} onClick={openCreate}>
          Add Product
        </button>
      </div>

      {productForm ? (
        <p className={`rounded border ${spm.border} bg-[#14171c] p-2 text-xs ${spm.muted}`}>
          현재 적용 폼: {productForm.name} ·{" "}
          <span className="font-medium text-gray-300">
            현재 사업자 유형: {PRODUCT_LINE_LABEL[productForm.supplierProductCategory]}
          </span>
          . 등록·수정되는 모든 상품은 이 유형으로 자동 저장되며, 화면에서 선택할 수 없습니다. 유형 변경은 관리자에게
          요청하세요.
        </p>
      ) : null}

      {message ? (
        <p className="whitespace-pre-line rounded border border-emerald-800/40 bg-emerald-950/35 p-2 text-sm text-emerald-300">
          {message}
        </p>
      ) : null}
      {error ? (
        <p className="rounded border border-red-800/40 bg-red-950/35 p-2 text-sm text-red-300">{error}</p>
      ) : null}

      <div className={spm.panel}>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className={spm.btnSecondary}
            onClick={() => {
              window.location.href = "/api/supplier/products/excel-template";
            }}
          >
            샘플 다운로드
          </button>
          <form className="flex flex-wrap items-center gap-2" onSubmit={handleExcelImport}>
            <input
              name="excelFile"
              type="file"
              accept=".xlsx,.xls"
              className="max-w-[200px] text-xs text-gray-400 file:mr-2 file:rounded file:border file:border-[#3d4450] file:bg-[#2a3038] file:px-2 file:py-1 file:text-gray-300"
            />
            <button type="submit" className={spm.btnSecondary} disabled={excelImporting}>
              {excelImporting ? "업로드 중..." : "엑셀 업로드"}
            </button>
          </form>
        </div>
        <p className={`mt-2 text-xs ${spm.muted}`}>
          현재 귀사의 상품 등록 필드 구조에 맞는 샘플 파일을 다운로드하여 작성 후 업로드하세요.
        </p>
      </div>

      {formOpen ? (
        <div className={spm.panel}>
          <h3 className={`text-sm ${spm.heading}`}>
            {editingId === null ? "상품 초안 등록" : "상품 수정"}
          </h3>
          {editingId !== null && products.find((p) => p.id === editingId)?.status === "APPROVED" ? (
            <p className="mt-1 text-xs text-amber-400/90">수정 시 재승인 상태로 변경됩니다.</p>
          ) : null}
          <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-[1fr_120px_100px]">
            <input
              className={spm.input}
              placeholder="카테고리명"
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              disabled={creatingCategory}
            />
            <input
              className={spm.input}
              placeholder="정렬"
              value={newCategorySortOrder}
              onChange={(e) => setNewCategorySortOrder(e.target.value)}
              disabled={creatingCategory}
            />
            <button
              type="button"
              className={spm.btnSecondary}
              onClick={handleCreateCategory}
              disabled={creatingCategory}
            >
              {creatingCategory ? "추가 중..." : "카테고리 추가"}
            </button>
          </div>
          <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-2">
            <select
              className={spm.select}
              value={form.categoryId}
              onChange={(e) => setForm((prev) => ({ ...prev, categoryId: e.target.value }))}
              title="귀사 내부 분류(건축자재/기타 사업자 유형과 별개)"
            >
              <option value="">사내 카테고리 선택</option>
              {categories.map((category) => (
                <option key={category.id} value={String(category.id)}>
                  {category.category_name}
                </option>
              ))}
            </select>
            <select
              className={spm.select}
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
                    className={`w-full ${spm.input}`}
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
                    className={`w-full ${spm.select}`}
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
                    className={`w-full ${spm.select}`}
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
                    className={`w-full ${spm.input}`}
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
                {field.helpText ? <p className={`mt-1 text-xs ${spm.muted}`}>{field.helpText}</p> : null}
              </div>
            ))}
            <div className="md:col-span-2">
              <p className={`mb-2 text-xs ${spm.muted}`}>
                {editingId === null
                  ? "신규 등록: 먼저 [저장]으로 상품(ID)을 만든 뒤 이미지를 업로드할 수 있습니다."
                  : "이미지는 R2에 저장되며, DB에는 공개 URL이 그대로 저장됩니다."}
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="file"
                  accept=".jpg,.jpeg,.png,.webp"
                  disabled={editingId === null || uploadingImage}
                  title={
                    editingId === null
                      ? "상품 저장 후 이미지를 선택할 수 있습니다."
                      : "상품 이미지 파일 선택"
                  }
                  className="text-xs text-gray-400 file:mr-2 file:rounded file:border file:border-[#3d4450] file:bg-[#2a3038] file:px-2 file:py-1 file:text-gray-300"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      void handleUploadImage(file);
                    }
                    e.target.value = "";
                  }}
                />
                <button
                  type="button"
                  className={spm.btnSecondary}
                  disabled={uploadingImage}
                  onClick={() => void handleClearImage()}
                >
                  {uploadingImage ? "처리 중..." : "이미지 초기화"}
                </button>
              </div>
              {form.imageUrl ? (
                <div className="mt-2 flex items-center gap-2">
                  <img
                    src={form.imageUrl}
                    alt="상품 이미지 미리보기"
                    className="product-thumbnail border border-[#2d333d]"
                  />
                  <span className="break-all text-xs text-gray-400">{form.imageUrl}</span>
                </div>
              ) : (
                <p className={`mt-2 text-xs ${spm.muted}`}>이미지는 선택값입니다.</p>
              )}
            </div>
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            <button type="button" className={spm.btnPrimary} disabled={submitting} onClick={handleSave}>
              {submitting ? "저장 중..." : "저장"}
            </button>
            <button
              type="button"
              className={spm.btnSecondary}
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
        <p className={`text-sm ${spm.muted}`}>상품 목록을 불러오는 중...</p>
      ) : (
        <div className="rounded border border-[#2d333d] text-sm">
          <div className={spm.listHead}>
            <span>썸네일</span>
            <span>상품명</span>
            <span>가격</span>
            <span>상태</span>
            <span>액션</span>
          </div>
          {products.length === 0 ? (
            <div className={`border-b border-[#2d333d] bg-[#1a1d23] px-3 py-6 text-center ${spm.muted}`}>
              등록된 상품이 없습니다.
            </div>
          ) : null}
          {products.map((product) => {
            const galleryUrls = mergeProductImageGallery(product.image_url, product.image_urls);
            const descriptionText = productDescriptionForDetail(product);
            const primary = product.image_url?.trim() ?? "";

            return (
              <Fragment key={product.id}>
                <div
                  role="button"
                  tabIndex={0}
                  className={`${spm.listGrid} ${spm.listRow} px-3 py-2.5`}
                  onClick={() => setExpandedId((id) => (id === product.id ? null : product.id))}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setExpandedId((id) => (id === product.id ? null : product.id));
                    }
                  }}
                >
                  <div className={spm.thumbSlot}>
                    {primary ? (
                      <div className={spm.thumbWrap}>
                        <img src={primary} alt="" className={spm.thumbImg} />
                        <div className={spm.thumbPreview} aria-hidden>
                          <img src={primary} alt="" className={spm.thumbPreviewImg} />
                        </div>
                      </div>
                    ) : (
                      <span className="inline-flex h-[60px] w-[60px] items-center justify-center rounded-md border border-dashed border-[#3d4450] text-xs text-gray-400">
                        없음
                      </span>
                    )}
                  </div>
                  <div className="min-w-0 truncate font-medium text-white">
                    {productListDisplayName(product)}
                  </div>
                  <div className="whitespace-nowrap text-gray-300">{productListDisplayPrice(product)}</div>
                  <div className="flex min-w-0 items-center">
                    <span className={`${spm.statusPillBase} ${productStatusSpmClasses(product.status)}`}>
                      {STATUS_LABEL[product.status]}
                    </span>
                  </div>
                  <div className="min-w-0" onClick={(e) => e.stopPropagation()}>
                    <div className="flex flex-wrap gap-1.5">
                      <button
                        type="button"
                        className={`${spm.btnSecondary} px-2 py-1 text-xs`}
                        onClick={() => openEdit(product)}
                      >
                        수정
                      </button>
                      <button
                        type="button"
                        className={spm.btnDanger}
                        onClick={() => handleDeleteProduct(product.id)}
                      >
                        삭제
                      </button>
                      <button
                        type="button"
                        className={`${spm.btnSecondary} px-2 py-1 text-xs`}
                        disabled={
                          (product.status !== "DRAFT" && product.status !== "REJECTED") ||
                          submittingProductId === product.id
                        }
                        onClick={() => handleSubmitProduct(product.id)}
                      >
                        {submittingProductId === product.id ? "제출 중..." : "제출"}
                      </button>
                    </div>
                  </div>
                </div>
                {expandedId === product.id ? (
                  <div className={spm.expand}>
                    <div className="space-y-3 text-sm text-gray-300">
                      <div>
                        <p className="text-xs font-semibold text-gray-400">상품 설명</p>
                        {descriptionText ? (
                          <p className="mt-1 whitespace-pre-wrap text-gray-300">{descriptionText}</p>
                        ) : (
                          <p className={`mt-1 ${spm.muted}`}>등록된 설명이 없습니다.</p>
                        )}
                      </div>
                      {product.status === "REJECTED" && product.rejection_reason ? (
                        <div className="rounded border border-amber-800/50 bg-amber-950/30 px-2 py-2 text-xs text-amber-200">
                          <span className="font-medium text-amber-100">반려 사유: </span>
                          {product.rejection_reason}
                        </div>
                      ) : null}
                      <div>
                        <p className="text-xs font-semibold text-gray-400">추가 이미지</p>
                        {galleryUrls.length > 0 ? (
                          <div className={`mt-2 ${spm.galleryScroll}`}>
                            <ul className="flex list-none flex-nowrap gap-3 p-0">
                              {galleryUrls.map((url) => {
                                const isPrimary = primary === url.trim();
                                return (
                                  <li key={url} className="flex w-[72px] shrink-0 flex-col items-center gap-1">
                                    <button
                                      type="button"
                                      title="대표 이미지로 설정"
                                      className="group/ga rounded border border-[#2d333d] p-0.5 transition-colors hover:border-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-60"
                                      disabled={isPrimary || settingPrimaryProductId === product.id}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        void handleSetPrimaryImage(product.id, url);
                                      }}
                                    >
                                      <img
                                        src={url}
                                        alt=""
                                        className="product-thumbnail w-[60px] max-w-none transition-transform duration-200 ease-out group-hover/ga:scale-105"
                                      />
                                    </button>
                                    {isPrimary ? (
                                      <span className="text-[10px] font-medium text-blue-400">대표</span>
                                    ) : (
                                      <button
                                        type="button"
                                        className="text-[10px] text-blue-400 underline hover:text-blue-300 disabled:opacity-50"
                                        disabled={settingPrimaryProductId === product.id}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          void handleSetPrimaryImage(product.id, url);
                                        }}
                                      >
                                        대표 설정
                                      </button>
                                    )}
                                  </li>
                                );
                              })}
                            </ul>
                          </div>
                        ) : (
                          <p className={`mt-1 ${spm.muted}`}>
                            등록된 이미지가 없습니다. 상품 수정 화면에서 업로드하세요.
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ) : null}
              </Fragment>
            );
          })}
        </div>
      )}

      <div className={spm.panel}>
        <h3 className={`text-sm ${spm.heading}`}>필드 추가 요청</h3>
        <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-2">
          <input
            className={spm.input}
            placeholder="요청 제목"
            value={requestTitle}
            onChange={(e) => setRequestTitle(e.target.value)}
          />
          <input
            className={spm.input}
            placeholder="요청 필드명"
            value={requestFieldLabel}
            onChange={(e) => setRequestFieldLabel(e.target.value)}
          />
          <select
            className={spm.select}
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
            className={spm.input}
            placeholder="요청 사유"
            value={requestReason}
            onChange={(e) => setRequestReason(e.target.value)}
          />
        </div>
        <button
          type="button"
          className={`mt-2 ${spm.btnPrimary}`}
          disabled={requestSubmitting}
          onClick={handleCreateFieldRequest}
        >
          {requestSubmitting ? "등록 중..." : "필드 추가 요청"}
        </button>
        <div className="mt-3 overflow-hidden rounded border border-[#2d333d] text-xs">
          <div className="grid grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_72px_minmax(0,72px)_minmax(120px,auto)] gap-2 border-b border-[#2d333d] bg-[#14171c] px-3 py-2 font-semibold uppercase tracking-wide text-gray-400">
            <span>요청 제목</span>
            <span>필드명</span>
            <span>타입</span>
            <span>상태</span>
            <span>요청일</span>
          </div>
          {fieldRequests.length === 0 ? (
            <div className={`border-b border-[#2d333d] bg-[#1a1d23] px-3 py-4 text-center ${spm.muted}`}>
              등록된 요청이 없습니다.
            </div>
          ) : null}
          {fieldRequests.map((request) => (
            <div
              key={request.id}
              className="grid grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_72px_minmax(0,72px)_minmax(120px,auto)] gap-2 border-b border-[#2d333d] bg-[#1a1d23] px-3 py-2 text-gray-300 transition-colors hover:bg-[#23272f]"
            >
              <span className="min-w-0 truncate">{request.request_title}</span>
              <span className="min-w-0 truncate">{request.requested_field_label}</span>
              <span className="text-gray-400">{request.requested_field_type}</span>
              <span className="flex items-center">
                <span className={`${spm.statusPillBase} ${fieldRequestStatusSpmClasses(request.status)}`}>
                  {request.status}
                </span>
              </span>
              <span className="whitespace-nowrap text-gray-400">
                {new Date(request.created_at).toLocaleString()}
              </span>
            </div>
          ))}
        </div>
      </div>

    </section>
  );
}
