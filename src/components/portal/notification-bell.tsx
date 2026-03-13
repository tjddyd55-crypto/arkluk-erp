"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

type NotificationRow = {
  recipientId: number;
  isRead: boolean;
  createdAt: string;
  eventType:
    | "ORDER_CREATED"
    | "ORDER_ASSIGNED"
    | "SUPPLIER_CONFIRMED"
    | "SHIPMENT_SHIPPED"
    | "SHIPMENT_DELIVERED"
    | "ORDER_DELAYED"
    | "SHIPMENT_DELAYED";
  entityType: string;
  entityId: number;
  message: string;
};

type NotificationResponse = {
  success: boolean;
  data?: {
    unreadCount: number;
    notifications: NotificationRow[];
  };
  message?: string;
};

function getEntityLink(pathname: string, row: NotificationRow) {
  if (row.entityType !== "ORDER") {
    return null;
  }
  if (pathname.startsWith("/supplier")) {
    return `/supplier/orders/${row.entityId}`;
  }
  if (pathname.startsWith("/buyer")) {
    return `/buyer/orders/${row.entityId}`;
  }
  return `/admin/orders/${row.entityId}`;
}

export function NotificationBell() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<NotificationRow[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try {
      setError(null);
      const response = await fetch("/api/notifications?limit=20");
      const result = (await response.json()) as NotificationResponse;
      if (!response.ok || !result.success || !result.data) {
        throw new Error(result.message ?? "알림 조회 실패");
      }
      setRows(result.data.notifications);
      setUnreadCount(result.data.unreadCount);
    } catch (err) {
      setError(err instanceof Error ? err.message : "알림 조회 실패");
    }
  }

  useEffect(() => {
    load();
    const timer = window.setInterval(load, 30000);
    return () => window.clearInterval(timer);
  }, []);

  const sortedRows = useMemo(
    () =>
      [...rows].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      ),
    [rows],
  );

  async function handleMarkRead(recipientId: number) {
    try {
      const response = await fetch(`/api/notifications/${recipientId}/read`, {
        method: "POST",
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.message ?? "알림 읽음 처리 실패");
      }
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "알림 읽음 처리 실패");
    }
  }

  return (
    <div className="relative">
      <button
        type="button"
        className="relative rounded border border-slate-300 bg-white px-3 py-2 text-sm"
        onClick={() => setOpen((value) => !value)}
      >
        🔔
        {unreadCount > 0 ? (
          <span className="absolute -right-1 -top-1 rounded-full bg-red-600 px-1.5 text-xs text-white">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="absolute right-0 z-20 mt-2 w-[360px] rounded border border-slate-200 bg-white p-3 shadow">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-semibold text-slate-900">알림</p>
            <button
              type="button"
              className="text-xs text-slate-500"
              onClick={() => setOpen(false)}
            >
              닫기
            </button>
          </div>
          {error ? <p className="mb-2 rounded bg-red-50 p-2 text-xs text-red-700">{error}</p> : null}
          <ul className="max-h-96 space-y-2 overflow-auto">
            {sortedRows.map((row) => {
              const link = getEntityLink(pathname, row);
              return (
                <li
                  key={row.recipientId}
                  className={`rounded border px-2 py-2 text-xs ${
                    row.isRead ? "border-slate-200 bg-slate-50" : "border-blue-200 bg-blue-50"
                  }`}
                >
                  <p className="text-[11px] text-slate-500">
                    {new Date(row.createdAt).toLocaleString()}
                  </p>
                  <p className="mt-1 text-slate-800">{row.message}</p>
                  <div className="mt-2 flex items-center gap-2">
                    {!row.isRead ? (
                      <button
                        type="button"
                        className="rounded border border-slate-300 px-2 py-1"
                        onClick={() => handleMarkRead(row.recipientId)}
                      >
                        읽음
                      </button>
                    ) : null}
                    {link ? (
                      <Link href={link} className="text-blue-700 underline">
                        이동
                      </Link>
                    ) : null}
                  </div>
                </li>
              );
            })}
            {sortedRows.length === 0 ? (
              <li className="rounded border border-slate-200 px-2 py-3 text-center text-xs text-slate-500">
                알림이 없습니다.
              </li>
            ) : null}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
