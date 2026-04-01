"use client";

import { useEffect, useState } from "react";

type DashboardData = {
  todayOrders: number;
  waitingOrders: number;
  partialOrders: number;
  recentQuotes: number;
  countries: number;
  suppliers: number;
  buyers: number;
};

export function DashboardSummary() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function run() {
      try {
        const response = await fetch("/api/admin/dashboard");
        const result = await response.json();
        if (!response.ok || !result.success) {
          throw new Error(result.message ?? "대시보드 조회 실패");
        }
        setData(result.data as DashboardData);
      } catch (err) {
        setError(err instanceof Error ? err.message : "대시보드 조회 실패");
      }
    }
    run();
  }, []);

  if (error) {
    return <p className="rounded bg-red-950/30 p-3 text-sm text-red-400">{error}</p>;
  }
  if (!data) {
    return <p className="text-sm text-gray-400">대시보드 로딩 중...</p>;
  }

  const cards = [
    { label: "오늘 주문 수", value: data.todayOrders },
    { label: "중앙 검토 주문 수", value: data.waitingOrders },
    { label: "배정 진행 주문 수", value: data.partialOrders },
    { label: "최근 견적 수", value: data.recentQuotes },
    { label: "활성 국가 수", value: data.countries },
    { label: "활성 공급사 수", value: data.suppliers },
    { label: "활성 국가/바이어 계정 수", value: data.buyers },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {cards.map((card) => (
        <article key={card.label} className="rounded border border-[#2d333d] bg-[#1a1d23] p-4">
          <p className="text-xs text-gray-400">{card.label}</p>
          <p className="mt-1 text-2xl font-bold text-white">{card.value}</p>
        </article>
      ))}
    </div>
  );
}
