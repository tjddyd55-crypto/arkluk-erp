"use client";

import { useEffect, useMemo, useState } from "react";

type ProjectDetail = {
  id: number;
  project_name: string;
  status: "DRAFT" | "QUOTING" | "QUOTED" | "ORDERING" | "ACTIVE" | "COMPLETED" | "CANCELLED";
  memo: string | null;
  location: string | null;
  start_date: string | null;
  end_date: string | null;
  created_at: string;
  buyer: { id: number; name: string };
  country: { id: number; country_name: string };
};

type ProjectFileRow = {
  id: number;
  original_name: string;
  file_type: "PDF" | "DWG" | "ZIP" | "PNG" | "JPG" | "JPEG";
  file_size: number;
  created_at: string;
  uploader: { name: string };
};

type ProjectQuoteRow = {
  id: number;
  quote_no: string;
  status: "DRAFT" | "SENT" | "VIEWED" | "ACCEPTED" | "REJECTED";
  created_at: string;
  item_count: number;
  total_amount: string;
};

type ProjectOrderRow = {
  id: number;
  order_no: string;
  status: string;
  created_at: string;
  supplier_count: number;
  suppliers: Array<{
    id: number;
    status: string;
    supplier: { supplier_name: string };
  }>;
};

type SummaryResponse = {
  order_supplier_status_count: Record<string, number>;
  order_suppliers: Array<{
    id: number;
    status: string;
    expected_delivery_date: string | null;
    supplier_note: string | null;
    supplier: { supplier_name: string };
    order: { id: number; order_no: string };
  }>;
  tax_invoices: Array<{
    id: number;
    attachment_count: number;
    from_email: string;
    received_at: string;
    supplier: { supplier_name: string } | null;
    order: { id: number; order_no: string } | null;
      files: Array<{ id: number; file_type: "PDF" | "XML"; file_name: string }>;
  }>;
};

type Product = {
  id: number;
  product_code: string;
  product_name: string;
  spec: string;
  unit: string;
  price: string;
};

type QuoteItemInput = {
  productId: number;
  qty: number;
};

const projectStatusOptions: Array<ProjectDetail["status"]> = [
  "DRAFT",
  "QUOTING",
  "QUOTED",
  "ORDERING",
  "ACTIVE",
  "COMPLETED",
  "CANCELLED",
];

const projectStatusLabel: Record<ProjectDetail["status"], string> = {
  DRAFT: "초안",
  QUOTING: "견적 작성중",
  QUOTED: "견적 발송",
  ORDERING: "주문 진행",
  ACTIVE: "발주 진행",
  COMPLETED: "완료",
  CANCELLED: "취소",
};

export function AdminProjectDetail({ projectId }: { projectId: number }) {
  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [files, setFiles] = useState<ProjectFileRow[]>([]);
  const [quotes, setQuotes] = useState<ProjectQuoteRow[]>([]);
  const [orders, setOrders] = useState<ProjectOrderRow[]>([]);
  const [summary, setSummary] = useState<SummaryResponse | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [productKeyword, setProductKeyword] = useState("");
  const [selectedProductId, setSelectedProductId] = useState("");
  const [selectedQty, setSelectedQty] = useState("1");
  const [quoteItems, setQuoteItems] = useState<QuoteItemInput[]>([]);
  const [quoteMemo, setQuoteMemo] = useState("");
  const [uploadingFile, setUploadingFile] = useState(false);
  const [savingProject, setSavingProject] = useState(false);
  const [creatingQuote, setCreatingQuote] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [editName, setEditName] = useState("");
  const [editStatus, setEditStatus] = useState<ProjectDetail["status"]>("DRAFT");
  const [editMemo, setEditMemo] = useState("");
  const [editLocation, setEditLocation] = useState("");
  const [editStartDate, setEditStartDate] = useState("");
  const [editEndDate, setEditEndDate] = useState("");

  const totalDraftAmount = useMemo(() => {
    const selected = products.filter((product) =>
      quoteItems.some((item) => item.productId === product.id),
    );
    return selected.reduce((sum, product) => {
      const item = quoteItems.find((current) => current.productId === product.id);
      if (!item) return sum;
      return sum + Number(product.price) * item.qty;
    }, 0);
  }, [products, quoteItems]);

  async function loadProject() {
    const response = await fetch(`/api/admin/projects/${projectId}`);
    const result = await response.json();
    if (!response.ok || !result.success) {
      throw new Error(result.message ?? "프로젝트 조회 실패");
    }
    const data = result.data as ProjectDetail;
    setProject(data);
    setEditName(data.project_name);
    setEditStatus(data.status);
    setEditMemo(data.memo ?? "");
    setEditLocation(data.location ?? "");
    setEditStartDate(data.start_date ? data.start_date.slice(0, 10) : "");
    setEditEndDate(data.end_date ? data.end_date.slice(0, 10) : "");
  }

  async function loadFiles() {
    const response = await fetch(`/api/admin/projects/${projectId}/files`);
    const result = await response.json();
    if (!response.ok || !result.success) {
      throw new Error(result.message ?? "프로젝트 파일 조회 실패");
    }
    setFiles(result.data as ProjectFileRow[]);
  }

  async function loadQuotes() {
    const response = await fetch(`/api/admin/projects/${projectId}/quotes`);
    const result = await response.json();
    if (!response.ok || !result.success) {
      throw new Error(result.message ?? "프로젝트 견적 조회 실패");
    }
    setQuotes(result.data as ProjectQuoteRow[]);
  }

  async function loadOrders() {
    const response = await fetch(`/api/admin/projects/${projectId}/orders`);
    const result = await response.json();
    if (!response.ok || !result.success) {
      throw new Error(result.message ?? "프로젝트 주문 조회 실패");
    }
    setOrders(result.data as ProjectOrderRow[]);
  }

  async function loadSummary() {
    const response = await fetch(`/api/admin/projects/${projectId}/summary`);
    const result = await response.json();
    if (!response.ok || !result.success) {
      throw new Error(result.message ?? "프로젝트 요약 조회 실패");
    }
    setSummary(result.data as SummaryResponse);
  }

  async function loadProducts() {
    const params = new URLSearchParams({ isActive: "true" });
    if (productKeyword.trim()) {
      params.set("keyword", productKeyword.trim());
    }
    const response = await fetch(`/api/admin/products?${params.toString()}`);
    const result = await response.json();
    if (!response.ok || !result.success) {
      throw new Error(result.message ?? "상품 조회 실패");
    }
    setProducts((result.data as Product[]).slice(0, 100));
  }

  async function loadAll() {
    setLoading(true);
    setActionError(null);
    try {
      await Promise.all([loadProject(), loadFiles(), loadQuotes(), loadOrders(), loadSummary()]);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "프로젝트 상세 로드 실패");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  useEffect(() => {
    loadProducts().catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productKeyword]);

  function addQuoteItem() {
    const productId = Number(selectedProductId);
    const qty = Number(selectedQty);
    if (Number.isNaN(productId) || Number.isNaN(qty) || qty <= 0) {
      setActionError("견적 품목/수량을 확인해 주세요.");
      return;
    }
    setQuoteItems((prev) => {
      const existing = prev.find((item) => item.productId === productId);
      if (existing) {
        return prev.map((item) => (item.productId === productId ? { ...item, qty } : item));
      }
      return [...prev, { productId, qty }];
    });
    setActionError(null);
  }

  function removeQuoteItem(productId: number) {
    setQuoteItems((prev) => prev.filter((item) => item.productId !== productId));
  }

  async function saveProject() {
    setSavingProject(true);
    setActionError(null);
    setActionMessage(null);
    try {
      const response = await fetch(`/api/admin/projects/${projectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectName: editName.trim(),
          status: editStatus,
          memo: editMemo.trim() || null,
          location: editLocation.trim() || null,
          startDate: editStartDate || null,
          endDate: editEndDate || null,
        }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.message ?? "프로젝트 저장 실패");
      }
      setActionMessage("프로젝트 정보를 저장했습니다.");
      await loadAll();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "프로젝트 저장 실패");
    } finally {
      setSavingProject(false);
    }
  }

  async function uploadFile(formData: FormData) {
    setUploadingFile(true);
    setActionError(null);
    setActionMessage(null);
    try {
      const response = await fetch(`/api/admin/projects/${projectId}/files`, {
        method: "POST",
        body: formData,
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.message ?? "파일 업로드 실패");
      }
      setActionMessage("프로젝트 파일 업로드를 완료했습니다.");
      await Promise.all([loadFiles(), loadSummary()]);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "파일 업로드 실패");
    } finally {
      setUploadingFile(false);
    }
  }

  async function createProjectQuote() {
    if (quoteItems.length === 0) {
      setActionError("견적 품목을 1개 이상 추가하세요.");
      return;
    }
    setCreatingQuote(true);
    setActionError(null);
    setActionMessage(null);
    try {
      const response = await fetch(`/api/admin/projects/${projectId}/quotes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          memo: quoteMemo.trim() || null,
          items: quoteItems,
        }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.message ?? "프로젝트 견적 생성 실패");
      }
      setActionMessage("프로젝트 견적을 생성했습니다.");
      setQuoteItems([]);
      setQuoteMemo("");
      await Promise.all([loadProject(), loadQuotes(), loadSummary()]);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "프로젝트 견적 생성 실패");
    } finally {
      setCreatingQuote(false);
    }
  }

  async function sendProjectQuote(quoteId: number) {
    setActionError(null);
    setActionMessage(null);
    try {
      const response = await fetch(`/api/admin/quotes/${quoteId}`, {
        method: "POST",
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.message ?? "견적 발송 실패");
      }
      setActionMessage("견적 발송을 완료했습니다.");
      await Promise.all([loadProject(), loadQuotes(), loadSummary()]);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "견적 발송 실패");
    }
  }

  if (loading) {
    return <p className="text-sm text-slate-500">프로젝트 상세를 불러오는 중...</p>;
  }
  if (!project) {
    return <p className="rounded bg-red-50 p-3 text-sm text-red-700">프로젝트 정보를 찾을 수 없습니다.</p>;
  }

  return (
    <div className="space-y-4">
      <header className="rounded border border-slate-200 bg-white p-4">
        <h1 className="text-2xl font-bold text-slate-900">{project.project_name}</h1>
        <p className="mt-1 text-sm text-slate-600">
          바이어: {project.buyer.name} / 국가: {project.country.country_name} / 상태:{" "}
          {projectStatusLabel[project.status]}
        </p>
      </header>

      {actionMessage ? (
        <p className="rounded bg-emerald-50 p-3 text-sm text-emerald-700">{actionMessage}</p>
      ) : null}
      {actionError ? (
        <p className="rounded bg-red-50 p-3 text-sm text-red-700">{actionError}</p>
      ) : null}

      <section className="rounded border border-slate-200 bg-white p-4">
        <h2 className="text-lg font-semibold">프로젝트 기본 정보</h2>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <label className="text-sm text-slate-700">
            프로젝트명
            <input
              className="mt-1 w-full rounded border border-slate-300 px-2 py-1"
              value={editName}
              onChange={(event) => setEditName(event.target.value)}
            />
          </label>
          <label className="text-sm text-slate-700">
            상태
            <select
              className="mt-1 w-full rounded border border-slate-300 px-2 py-1"
              value={editStatus}
              onChange={(event) =>
                setEditStatus(event.target.value as ProjectDetail["status"])
              }
            >
              {projectStatusOptions.map((status) => (
                <option key={status} value={status}>
                  {projectStatusLabel[status]}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm text-slate-700">
            현장 위치
            <input
              className="mt-1 w-full rounded border border-slate-300 px-2 py-1"
              value={editLocation}
              onChange={(event) => setEditLocation(event.target.value)}
            />
          </label>
          <label className="text-sm text-slate-700">
            시작일
            <input
              type="date"
              className="mt-1 w-full rounded border border-slate-300 px-2 py-1"
              value={editStartDate}
              onChange={(event) => setEditStartDate(event.target.value)}
            />
          </label>
          <label className="text-sm text-slate-700">
            종료일
            <input
              type="date"
              className="mt-1 w-full rounded border border-slate-300 px-2 py-1"
              value={editEndDate}
              onChange={(event) => setEditEndDate(event.target.value)}
            />
          </label>
          <label className="text-sm text-slate-700 md:col-span-2">
            메모
            <textarea
              className="mt-1 w-full rounded border border-slate-300 px-2 py-1"
              rows={3}
              value={editMemo}
              onChange={(event) => setEditMemo(event.target.value)}
            />
          </label>
          <div className="md:col-span-2">
            <button
              type="button"
              className="rounded bg-slate-900 px-3 py-2 text-sm text-white disabled:opacity-60"
              onClick={saveProject}
              disabled={savingProject}
            >
              {savingProject ? "저장 중..." : "프로젝트 수정"}
            </button>
          </div>
        </div>
      </section>

      <section className="rounded border border-slate-200 bg-white p-4">
        <h2 className="text-lg font-semibold">첨부파일</h2>
        <form
          className="mt-3 flex items-center gap-2"
          onSubmit={async (event) => {
            event.preventDefault();
            const form = event.currentTarget;
            const fileInput = form.elements.namedItem("file") as HTMLInputElement | null;
            const file = fileInput?.files?.[0];
            if (!file) {
              setActionError("업로드할 파일을 선택하세요.");
              return;
            }
            const formData = new FormData();
            formData.append("file", file);
            await uploadFile(formData);
            form.reset();
          }}
        >
          <input name="file" type="file" accept=".pdf,.dwg,.zip,.png,.jpg,.jpeg" />
          <button
            type="submit"
            className="rounded border border-slate-300 px-3 py-1 text-sm disabled:opacity-60"
            disabled={uploadingFile}
          >
            {uploadingFile ? "업로드 중..." : "파일 업로드"}
          </button>
        </form>

        <div className="mt-3 overflow-auto">
          <table className="min-w-full border-collapse text-sm">
            <thead>
              <tr className="bg-slate-50">
                <th className="border border-slate-200 px-2 py-1 text-left">파일명</th>
                <th className="border border-slate-200 px-2 py-1 text-left">형식</th>
                <th className="border border-slate-200 px-2 py-1 text-left">크기</th>
                <th className="border border-slate-200 px-2 py-1 text-left">업로드일</th>
                <th className="border border-slate-200 px-2 py-1 text-left">다운로드</th>
              </tr>
            </thead>
            <tbody>
              {files.map((file) => (
                <tr key={file.id}>
                  <td className="border border-slate-200 px-2 py-1">{file.original_name}</td>
                  <td className="border border-slate-200 px-2 py-1">{file.file_type}</td>
                  <td className="border border-slate-200 px-2 py-1">
                    {(file.file_size / 1024).toFixed(1)} KB
                  </td>
                  <td className="border border-slate-200 px-2 py-1">
                    {new Date(file.created_at).toLocaleString()}
                  </td>
                  <td className="border border-slate-200 px-2 py-1">
                    <a
                      href={`/api/admin/projects/files/${file.id}/download`}
                      className="text-blue-700 underline"
                    >
                      다운로드
                    </a>
                  </td>
                </tr>
              ))}
              {files.length === 0 ? (
                <tr>
                  <td colSpan={5} className="border border-slate-200 px-2 py-3 text-center text-slate-500">
                    업로드된 파일이 없습니다.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded border border-slate-200 bg-white p-4">
        <h2 className="text-lg font-semibold">프로젝트 견적 생성</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          <input
            className="rounded border border-slate-300 px-2 py-1 text-sm"
            placeholder="상품 검색 (코드/명/규격)"
            value={productKeyword}
            onChange={(event) => setProductKeyword(event.target.value)}
          />
          <select
            className="rounded border border-slate-300 px-2 py-1 text-sm"
            value={selectedProductId}
            onChange={(event) => setSelectedProductId(event.target.value)}
          >
            <option value="">상품 선택</option>
            {products.map((product) => (
              <option key={product.id} value={product.id}>
                {product.product_code} / {product.product_name} / {product.spec}
              </option>
            ))}
          </select>
          <input
            type="number"
            min={0.001}
            step={0.001}
            className="w-24 rounded border border-slate-300 px-2 py-1 text-sm"
            value={selectedQty}
            onChange={(event) => setSelectedQty(event.target.value)}
          />
          <button
            type="button"
            className="rounded border border-slate-300 px-3 py-1 text-sm"
            onClick={addQuoteItem}
          >
            품목 추가
          </button>
        </div>

        <label className="mt-3 block text-sm text-slate-700">
          견적 메모
          <textarea
            className="mt-1 w-full rounded border border-slate-300 px-2 py-1"
            rows={2}
            value={quoteMemo}
            onChange={(event) => setQuoteMemo(event.target.value)}
          />
        </label>

        <div className="mt-3 overflow-auto">
          <table className="min-w-full border-collapse text-sm">
            <thead>
              <tr className="bg-slate-50">
                <th className="border border-slate-200 px-2 py-1 text-left">상품코드</th>
                <th className="border border-slate-200 px-2 py-1 text-left">상품명</th>
                <th className="border border-slate-200 px-2 py-1 text-left">규격</th>
                <th className="border border-slate-200 px-2 py-1 text-left">단위</th>
                <th className="border border-slate-200 px-2 py-1 text-left">수량</th>
                <th className="border border-slate-200 px-2 py-1 text-left">단가</th>
                <th className="border border-slate-200 px-2 py-1 text-left">제거</th>
              </tr>
            </thead>
            <tbody>
              {quoteItems.map((item) => {
                const product = products.find((value) => value.id === item.productId);
                if (!product) return null;
                return (
                  <tr key={item.productId}>
                    <td className="border border-slate-200 px-2 py-1">{product.product_code}</td>
                    <td className="border border-slate-200 px-2 py-1">{product.product_name}</td>
                    <td className="border border-slate-200 px-2 py-1">{product.spec}</td>
                    <td className="border border-slate-200 px-2 py-1">{product.unit}</td>
                    <td className="border border-slate-200 px-2 py-1">{item.qty}</td>
                    <td className="border border-slate-200 px-2 py-1">
                      {Number(product.price).toLocaleString()}
                    </td>
                    <td className="border border-slate-200 px-2 py-1">
                      <button
                        type="button"
                        className="text-red-700 underline"
                        onClick={() => removeQuoteItem(item.productId)}
                      >
                        제거
                      </button>
                    </td>
                  </tr>
                );
              })}
              {quoteItems.length === 0 ? (
                <tr>
                  <td colSpan={7} className="border border-slate-200 px-2 py-3 text-center text-slate-500">
                    추가된 견적 품목이 없습니다.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        <div className="mt-3 flex items-center justify-between">
          <p className="text-sm text-slate-600">선택 품목 수: {quoteItems.length}</p>
          <div className="flex items-center gap-3">
            <p className="text-sm text-slate-700">예상 합계: {totalDraftAmount.toLocaleString()}</p>
            <button
              type="button"
              className="rounded bg-slate-900 px-3 py-2 text-sm text-white disabled:opacity-60"
              onClick={createProjectQuote}
              disabled={creatingQuote}
            >
              {creatingQuote ? "생성 중..." : "프로젝트 견적 생성"}
            </button>
          </div>
        </div>
      </section>

      <section className="rounded border border-slate-200 bg-white p-4">
        <h2 className="text-lg font-semibold">프로젝트 견적 목록</h2>
        <div className="mt-3 overflow-auto">
          <table className="min-w-full border-collapse text-sm">
            <thead>
              <tr className="bg-slate-50">
                <th className="border border-slate-200 px-2 py-1 text-left">견적번호</th>
                <th className="border border-slate-200 px-2 py-1 text-left">상태</th>
                <th className="border border-slate-200 px-2 py-1 text-left">품목 수</th>
                <th className="border border-slate-200 px-2 py-1 text-left">총액</th>
                <th className="border border-slate-200 px-2 py-1 text-left">생성일</th>
                <th className="border border-slate-200 px-2 py-1 text-left">액션</th>
              </tr>
            </thead>
            <tbody>
              {quotes.map((quote) => (
                <tr key={quote.id}>
                  <td className="border border-slate-200 px-2 py-1">{quote.quote_no}</td>
                  <td className="border border-slate-200 px-2 py-1">{quote.status}</td>
                  <td className="border border-slate-200 px-2 py-1">{quote.item_count}</td>
                  <td className="border border-slate-200 px-2 py-1">
                    {Number(quote.total_amount).toLocaleString()}
                  </td>
                  <td className="border border-slate-200 px-2 py-1">
                    {new Date(quote.created_at).toLocaleString()}
                  </td>
                  <td className="border border-slate-200 px-2 py-1">
                    <button
                      type="button"
                      className="rounded border border-slate-300 px-2 py-1 text-xs disabled:opacity-60"
                      disabled={quote.status === "SENT" || quote.status === "ACCEPTED" || quote.status === "REJECTED"}
                      onClick={() => sendProjectQuote(quote.id)}
                    >
                      발송
                    </button>
                  </td>
                </tr>
              ))}
              {quotes.length === 0 ? (
                <tr>
                  <td colSpan={6} className="border border-slate-200 px-2 py-3 text-center text-slate-500">
                    생성된 프로젝트 견적이 없습니다.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded border border-slate-200 bg-white p-4">
        <h2 className="text-lg font-semibold">프로젝트 주문 목록</h2>
        <div className="mt-3 overflow-auto">
          <table className="min-w-full border-collapse text-sm">
            <thead>
              <tr className="bg-slate-50">
                <th className="border border-slate-200 px-2 py-1 text-left">주문번호</th>
                <th className="border border-slate-200 px-2 py-1 text-left">상태</th>
                <th className="border border-slate-200 px-2 py-1 text-left">공급사 수</th>
                <th className="border border-slate-200 px-2 py-1 text-left">생성일</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr key={order.id}>
                  <td className="border border-slate-200 px-2 py-1">
                    <a className="text-blue-700 underline" href={`/admin/orders/${order.id}`}>
                      {order.order_no}
                    </a>
                  </td>
                  <td className="border border-slate-200 px-2 py-1">{order.status}</td>
                  <td className="border border-slate-200 px-2 py-1">{order.supplier_count}</td>
                  <td className="border border-slate-200 px-2 py-1">
                    {new Date(order.created_at).toLocaleString()}
                  </td>
                </tr>
              ))}
              {orders.length === 0 ? (
                <tr>
                  <td colSpan={4} className="border border-slate-200 px-2 py-3 text-center text-slate-500">
                    생성된 프로젝트 주문이 없습니다.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded border border-slate-200 bg-white p-4">
        <h2 className="text-lg font-semibold">발주/세금계산서 요약</h2>
        {summary ? (
          <div className="mt-3 space-y-4">
            <div className="rounded border border-slate-200 p-3">
              <h3 className="text-sm font-semibold text-slate-900">발주 상태 집계</h3>
              <p className="mt-2 text-sm text-slate-700">
                {Object.entries(summary.order_supplier_status_count)
                  .map(([key, value]) => `${key}:${value}`)
                  .join(", ") || "집계 없음"}
              </p>
            </div>

            <div className="overflow-auto">
              <table className="min-w-full border-collapse text-sm">
                <thead>
                  <tr className="bg-slate-50">
                    <th className="border border-slate-200 px-2 py-1 text-left">주문번호</th>
                    <th className="border border-slate-200 px-2 py-1 text-left">공급사</th>
                    <th className="border border-slate-200 px-2 py-1 text-left">발주 상태</th>
                    <th className="border border-slate-200 px-2 py-1 text-left">납기예정</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.order_suppliers.map((row) => (
                    <tr key={row.id}>
                      <td className="border border-slate-200 px-2 py-1">{row.order.order_no}</td>
                      <td className="border border-slate-200 px-2 py-1">{row.supplier.supplier_name}</td>
                      <td className="border border-slate-200 px-2 py-1">{row.status}</td>
                      <td className="border border-slate-200 px-2 py-1">
                        {row.expected_delivery_date
                          ? new Date(row.expected_delivery_date).toLocaleDateString()
                          : "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="overflow-auto">
              <table className="min-w-full border-collapse text-sm">
                <thead>
                  <tr className="bg-slate-50">
                    <th className="border border-slate-200 px-2 py-1 text-left">주문번호</th>
                    <th className="border border-slate-200 px-2 py-1 text-left">공급사</th>
                    <th className="border border-slate-200 px-2 py-1 text-left">수신</th>
                    <th className="border border-slate-200 px-2 py-1 text-left">첨부 수</th>
                    <th className="border border-slate-200 px-2 py-1 text-left">첨부 다운로드</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.tax_invoices.map((invoice) => (
                    <tr key={invoice.id}>
                      <td className="border border-slate-200 px-2 py-1">
                        {invoice.order?.order_no ?? "-"}
                      </td>
                      <td className="border border-slate-200 px-2 py-1">
                        {invoice.supplier?.supplier_name ?? "미분류"}
                      </td>
                      <td className="border border-slate-200 px-2 py-1">
                        {new Date(invoice.received_at).toLocaleString()}
                      </td>
                      <td className="border border-slate-200 px-2 py-1">{invoice.attachment_count}</td>
                      <td className="border border-slate-200 px-2 py-1">
                        <div className="flex flex-wrap gap-1">
                          {invoice.files.map((file) => (
                            <a
                              key={file.id}
                              className="text-blue-700 underline"
                              href={`/api/admin/tax-invoices/files/${file.id}/download`}
                            >
                              {file.file_type}
                            </a>
                          ))}
                          {invoice.files.length === 0 ? (
                            <span className="text-slate-400">없음</span>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {summary.tax_invoices.length === 0 ? (
                    <tr>
                      <td
                        colSpan={5}
                        className="border border-slate-200 px-2 py-3 text-center text-slate-500"
                      >
                        연결된 세금계산서가 없습니다.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
}
