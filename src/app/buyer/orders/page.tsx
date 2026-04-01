"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useTranslation } from "@/hooks/useTranslation";

type BuyerOrderRow = {
  id: number;
  order_no: string;
  status: string;
  created_at: string;
  buyer: { name: string };
  country: { country_name: string };
};

export default function BuyerOrdersPage() {
  const { t } = useTranslation();
  const [rows, setRows] = useState<BuyerOrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch("/api/buyer/orders");
        const result = await response.json();
        if (!response.ok || !result.success) {
          throw new Error(result.message ?? t("error"));
        }
        setRows(result.data as BuyerOrderRow[]);
      } catch (err) {
        setError(err instanceof Error ? err.message : t("error"));
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [t]);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-white">{t("my_orders")}</h1>
      {loading ? <p className="text-sm text-gray-400">{t("loading")}</p> : null}
      {error ? <p className="rounded bg-red-950/30 p-3 text-sm text-red-400">{error}</p> : null}
      {!loading && !error ? (
        <section className="rounded border border-[#2d333d] bg-[#1a1d23] p-4">
          <div className="overflow-auto">
            <table className="min-w-full border-collapse text-sm">
              <thead>
                <tr className="bg-[#111318]">
                  <th className="border border-[#2d333d] px-2 py-1 text-left">{t("order_number")}</th>
                  <th className="border border-[#2d333d] px-2 py-1 text-left">{t("status")}</th>
                  <th className="border border-[#2d333d] px-2 py-1 text-left">{t("buyer")}</th>
                  <th className="border border-[#2d333d] px-2 py-1 text-left">{t("country")}</th>
                  <th className="border border-[#2d333d] px-2 py-1 text-left">{t("created_at")}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td className="border border-[#2d333d] px-2 py-1">
                      <Link className="text-blue-400 underline" href={`/buyer/orders/${row.id}`}>
                        {row.order_no}
                      </Link>
                    </td>
                    <td className="border border-[#2d333d] px-2 py-1">{row.status}</td>
                    <td className="border border-[#2d333d] px-2 py-1">{row.buyer.name}</td>
                    <td className="border border-[#2d333d] px-2 py-1">{row.country.country_name}</td>
                    <td className="border border-[#2d333d] px-2 py-1">
                      {new Date(row.created_at).toLocaleString()}
                    </td>
                  </tr>
                ))}
                {rows.length === 0 ? (
                  <tr>
                    <td className="border border-[#2d333d] px-2 py-3 text-center text-gray-400" colSpan={5}>
                      {t("no_data")}
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </div>
  );
}
