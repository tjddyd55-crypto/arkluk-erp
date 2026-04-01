"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "@/hooks/useTranslation";

type ApiResponse = {
  success: boolean;
  data?: unknown;
  message?: string;
};

export function ApiTable({ endpoint, title }: { endpoint: string; title: string }) {
  const { t } = useTranslation();
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(true);

  useEffect(() => {
    let ignore = false;

    async function run() {
      setPending(true);
      setError(null);
      try {
        const response = await fetch(endpoint);
        const result = (await response.json()) as ApiResponse;
        if (!response.ok || !result.success) {
          throw new Error(result.message ?? t("error"));
        }
        const payload = result.data;
        if (Array.isArray(payload)) {
          if (!ignore) setRows(payload as Record<string, unknown>[]);
          return;
        }
        if (payload && typeof payload === "object") {
          if (!ignore) setRows([payload as Record<string, unknown>]);
          return;
        }
        if (!ignore) setRows([]);
      } catch (err) {
        if (!ignore) setError(err instanceof Error ? err.message : t("error"));
      } finally {
        if (!ignore) setPending(false);
      }
    }

    run();
    return () => {
      ignore = true;
    };
  }, [endpoint, t]);

  const columns = useMemo(() => {
    const first = rows[0];
    if (!first) return [];
    return Object.keys(first).slice(0, 8);
  }, [rows]);

  return (
    <section className="rounded border border-[#2d333d] bg-[#1a1d23] p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-white">{title}</h2>
        <button
          onClick={() => window.location.reload()}
          className="rounded border border-[#2d333d] px-2 py-1 text-xs"
        >
          {t("search")}
        </button>
      </div>

      {pending ? <p className="text-sm text-gray-400">{t("loading")}</p> : null}
      {error ? <p className="text-sm text-red-400">{error}</p> : null}
      {!pending && !error && rows.length === 0 ? (
        <p className="text-sm text-gray-400">{t("no_data")}</p>
      ) : null}

      {!pending && !error && rows.length > 0 ? (
        <div className="overflow-auto">
          <table className="min-w-full border-collapse text-sm">
            <thead>
              <tr className="bg-[#111318]">
                {columns.map((column) => (
                  <th key={column} className="border border-[#2d333d] px-2 py-1 text-left">
                    {column}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, idx) => (
                <tr key={idx} className="bg-[#1a1d23] hover:bg-[#23272f]">
                  {columns.map((column) => (
                    <td key={column} className="border border-[#2d333d] px-2 py-1">
                      {typeof row[column] === "object"
                        ? JSON.stringify(row[column])
                        : String(row[column] ?? "")}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}
