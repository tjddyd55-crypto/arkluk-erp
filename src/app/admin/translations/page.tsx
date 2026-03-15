"use client";

import { useEffect, useMemo, useState } from "react";

import { useTranslation } from "@/hooks/useTranslation";

type SupportedLanguage = "ko" | "en" | "mn" | "ar";
type I18nNamespace =
  | "common"
  | "dashboard"
  | "orders"
  | "products"
  | "suppliers"
  | "profile";

type TranslationRow = {
  namespace: I18nNamespace;
  key: string;
  translations: Record<SupportedLanguage, string>;
};

type TranslationListResponse = {
  success: boolean;
  data?: {
    languages: SupportedLanguage[];
    namespaces: I18nNamespace[];
    rows: TranslationRow[];
  };
  message?: string;
};

export default function AdminTranslationsPage() {
  const { t } = useTranslation();
  const [rows, setRows] = useState<TranslationRow[]>([]);
  const [namespaces, setNamespaces] = useState<I18nNamespace[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [selectedNamespace, setSelectedNamespace] = useState<"all" | I18nNamespace>("all");
  const [keyword, setKeyword] = useState("");
  const [draftMap, setDraftMap] = useState<Record<string, Record<SupportedLanguage, string>>>({});

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch("/api/admin/translations");
        const result = (await response.json()) as TranslationListResponse;
        if (!response.ok || !result.success || !result.data) {
          throw new Error(result.message ?? t("error"));
        }
        setRows(result.data.rows);
        setNamespaces(result.data.namespaces);
      } catch (err) {
        setError(err instanceof Error ? err.message : t("error"));
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [t]);

  const filteredRows = useMemo(() => {
    return rows.filter((row) => {
      const namespaceMatch = selectedNamespace === "all" || row.namespace === selectedNamespace;
      const keywordMatch = !keyword.trim() || row.key.toLowerCase().includes(keyword.trim().toLowerCase());
      return namespaceMatch && keywordMatch;
    });
  }, [keyword, rows, selectedNamespace]);

  function getRowDraft(row: TranslationRow) {
    return draftMap[`${row.namespace}:${row.key}`] ?? row.translations;
  }

  function updateDraft(row: TranslationRow, language: SupportedLanguage, value: string) {
    const rowKey = `${row.namespace}:${row.key}`;
    setDraftMap((prev) => ({
      ...prev,
      [rowKey]: {
        ...getRowDraft(row),
        [language]: value,
      },
    }));
  }

  async function saveRow(row: TranslationRow) {
    const rowKey = `${row.namespace}:${row.key}`;
    const payload = getRowDraft(row);
    setSavingKey(rowKey);
    setError(null);
    try {
      const response = await fetch("/api/admin/translations", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          namespace: row.namespace,
          key: row.key,
          translations: payload,
        }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.message ?? t("error"));
      }
      setRows((prev) =>
        prev.map((current) =>
          current.namespace === row.namespace && current.key === row.key
            ? { ...current, translations: payload }
            : current,
        ),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : t("error"));
    } finally {
      setSavingKey(null);
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-slate-900">{t("translation_management")}</h1>
      <p className="text-sm text-slate-600">{t("translations")}</p>

      <section className="rounded border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap items-center gap-2">
          <select
            className="rounded border border-slate-300 px-2 py-1 text-sm"
            value={selectedNamespace}
            onChange={(event) =>
              setSelectedNamespace((event.target.value as "all" | I18nNamespace) ?? "all")
            }
          >
            <option value="all">{t("all")}</option>
            {namespaces.map((namespace) => (
              <option key={namespace} value={namespace}>
                {namespace}
              </option>
            ))}
          </select>
          <input
            className="rounded border border-slate-300 px-2 py-1 text-sm"
            placeholder={t("search")}
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
          />
        </div>
      </section>

      {loading ? <p className="text-sm text-slate-500">{t("loading")}</p> : null}
      {error ? <p className="rounded bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}

      {!loading ? (
        <section className="overflow-auto rounded border border-slate-200 bg-white p-4">
          <table className="min-w-full border-collapse text-sm">
            <thead>
              <tr className="bg-slate-50">
                <th className="border border-slate-200 px-2 py-1 text-left">{t("namespace")}</th>
                <th className="border border-slate-200 px-2 py-1 text-left">{t("key")}</th>
                <th className="border border-slate-200 px-2 py-1 text-left">ko</th>
                <th className="border border-slate-200 px-2 py-1 text-left">en</th>
                <th className="border border-slate-200 px-2 py-1 text-left">mn</th>
                <th className="border border-slate-200 px-2 py-1 text-left">ar</th>
                <th className="border border-slate-200 px-2 py-1 text-left">{t("actions")}</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((row) => {
                const rowKey = `${row.namespace}:${row.key}`;
                const draft = getRowDraft(row);
                return (
                  <tr key={rowKey}>
                    <td className="border border-slate-200 px-2 py-1">{row.namespace}</td>
                    <td className="border border-slate-200 px-2 py-1">{row.key}</td>
                    <td className="border border-slate-200 px-2 py-1">
                      <input
                        className="w-56 rounded border border-slate-300 px-2 py-1"
                        value={draft.ko}
                        onChange={(event) => updateDraft(row, "ko", event.target.value)}
                      />
                    </td>
                    <td className="border border-slate-200 px-2 py-1">
                      <input
                        className="w-56 rounded border border-slate-300 px-2 py-1"
                        value={draft.en}
                        onChange={(event) => updateDraft(row, "en", event.target.value)}
                      />
                    </td>
                    <td className="border border-slate-200 px-2 py-1">
                      <input
                        className="w-56 rounded border border-slate-300 px-2 py-1"
                        value={draft.mn}
                        onChange={(event) => updateDraft(row, "mn", event.target.value)}
                      />
                    </td>
                    <td className="border border-slate-200 px-2 py-1">
                      <input
                        className="w-56 rounded border border-slate-300 px-2 py-1"
                        value={draft.ar}
                        onChange={(event) => updateDraft(row, "ar", event.target.value)}
                      />
                    </td>
                    <td className="border border-slate-200 px-2 py-1">
                      <button
                        type="button"
                        className="rounded border border-slate-300 px-3 py-1 text-xs disabled:opacity-60"
                        onClick={() => saveRow(row)}
                        disabled={savingKey === rowKey}
                      >
                        {savingKey === rowKey ? t("loading") : t("save")}
                      </button>
                    </td>
                  </tr>
                );
              })}
              {filteredRows.length === 0 ? (
                <tr>
                  <td className="border border-slate-200 px-2 py-4 text-center text-slate-500" colSpan={7}>
                    {t("no_data")}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </section>
      ) : null}
    </div>
  );
}
