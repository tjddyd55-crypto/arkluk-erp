"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type SupportedLanguage = "ko" | "en" | "mn" | "ar";

type TranslationRow = {
  language: SupportedLanguage;
  isSource: boolean;
  isAuto: boolean;
  name: string;
  description: string | null;
};

type TranslationResponse = {
  success: boolean;
  data?: {
    product: {
      id: number;
      productCode: string;
      productName: string;
      sourceLanguage: SupportedLanguage;
    };
    translations: TranslationRow[];
  };
  message?: string;
};

const LANGUAGE_LABEL: Record<SupportedLanguage, string> = {
  ko: "한국어",
  en: "English",
  mn: "Монгол",
  ar: "العربية",
};

export function AdminProductTranslationEditor({ productId }: { productId: number }) {
  const [loading, setLoading] = useState(true);
  const [savingLanguage, setSavingLanguage] = useState<SupportedLanguage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [productCode, setProductCode] = useState("");
  const [productName, setProductName] = useState("");
  const [rows, setRows] = useState<TranslationRow[]>([]);

  const rowMap = useMemo(() => {
    return rows.reduce<Record<SupportedLanguage, TranslationRow>>((acc, row) => {
      acc[row.language] = row;
      return acc;
    }, {} as Record<SupportedLanguage, TranslationRow>);
  }, [rows]);

  const loadTranslations = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/products/${productId}/translations`);
      const result = (await response.json()) as TranslationResponse;
      if (!response.ok || !result.success || !result.data) {
        throw new Error(result.message ?? "번역 정보를 불러오지 못했습니다.");
      }
      setProductCode(result.data.product.productCode);
      setProductName(result.data.product.productName);
      setRows(result.data.translations);
    } catch (err) {
      setError(err instanceof Error ? err.message : "번역 정보 조회 실패");
    } finally {
      setLoading(false);
    }
  }, [productId]);

  useEffect(() => {
    loadTranslations();
  }, [loadTranslations]);

  function updateRow(language: SupportedLanguage, patch: Partial<TranslationRow>) {
    setRows((prev) => prev.map((row) => (row.language === language ? { ...row, ...patch } : row)));
  }

  async function saveRow(language: SupportedLanguage) {
    setSavingLanguage(language);
    setError(null);
    setMessage(null);
    try {
      const row = rowMap[language];
      if (!row) {
        throw new Error("저장할 번역 행을 찾을 수 없습니다.");
      }
      if (!row.name.trim()) {
        throw new Error("상품명 번역은 비워둘 수 없습니다.");
      }

      const response = await fetch(`/api/admin/products/${productId}/translations`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          language,
          name: row.name.trim(),
          description: row.description?.trim() || null,
        }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.message ?? "번역 저장 실패");
      }

      setMessage(`${LANGUAGE_LABEL[language]} 번역을 저장했습니다.`);
      await loadTranslations();
    } catch (err) {
      setError(err instanceof Error ? err.message : "번역 저장 실패");
    } finally {
      setSavingLanguage(null);
    }
  }

  return (
    <section className="space-y-4 rounded border border-[#2d333d] bg-[#1a1d23] p-4">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold text-white">상품 번역 관리</h1>
        <p className="text-sm text-gray-400">
          상품코드: <span className="font-medium">{productCode || "-"}</span> / 기본명:{" "}
          <span className="font-medium">{productName || "-"}</span>
        </p>
      </div>

      {message ? <p className="rounded bg-emerald-50 p-2 text-sm text-emerald-700">{message}</p> : null}
      {error ? <p className="rounded bg-red-950/30 p-2 text-sm text-red-400">{error}</p> : null}

      {loading ? (
        <p className="text-sm text-gray-400">번역 정보를 불러오는 중...</p>
      ) : (
        <div className="overflow-auto">
          <table className="min-w-full border-collapse text-sm">
            <thead>
              <tr className="bg-[#111318]">
                <th className="border border-[#2d333d] px-2 py-1 text-left">언어</th>
                <th className="border border-[#2d333d] px-2 py-1 text-left">상품명</th>
                <th className="border border-[#2d333d] px-2 py-1 text-left">설명</th>
                <th className="border border-[#2d333d] px-2 py-1 text-left">유형</th>
                <th className="border border-[#2d333d] px-2 py-1 text-left">저장</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.language}>
                  <td className="border border-[#2d333d] px-2 py-1">{LANGUAGE_LABEL[row.language]}</td>
                  <td className="border border-[#2d333d] px-2 py-1">
                    <input
                      className="w-full rounded border border-[#2d333d] px-2 py-1"
                      value={row.name}
                      onChange={(event) => updateRow(row.language, { name: event.target.value })}
                    />
                  </td>
                  <td className="border border-[#2d333d] px-2 py-1">
                    <input
                      className="w-full rounded border border-[#2d333d] px-2 py-1"
                      value={row.description ?? ""}
                      onChange={(event) =>
                        updateRow(row.language, { description: event.target.value || null })
                      }
                    />
                  </td>
                  <td className="border border-[#2d333d] px-2 py-1">
                    {row.isSource ? "원문" : row.isAuto ? "자동 번역" : "관리자 수정"}
                  </td>
                  <td className="border border-[#2d333d] px-2 py-1">
                    <button
                      type="button"
                      className="rounded border border-[#2d333d] px-2 py-1 text-xs disabled:opacity-60"
                      disabled={savingLanguage === row.language}
                      onClick={() => saveRow(row.language)}
                    >
                      {savingLanguage === row.language ? "저장 중..." : "저장"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
