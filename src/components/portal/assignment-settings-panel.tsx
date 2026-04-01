"use client";

import { useEffect, useState } from "react";

type AssignmentSettings = {
  modes: {
    manual: boolean;
    autoProduct: boolean;
    autoTimeout: boolean;
  };
  timeoutHours: number;
  notifications: {
    email: boolean;
    slack: boolean;
    sms: boolean;
    webhook: boolean;
  };
  webhookUrl: string | null;
  automationActorUserId: number | null;
};

const DEFAULT_SETTINGS: AssignmentSettings = {
  modes: {
    manual: true,
    autoProduct: true,
    autoTimeout: true,
  },
  timeoutHours: 24,
  notifications: {
    email: true,
    slack: false,
    sms: false,
    webhook: false,
  },
  webhookUrl: null,
  automationActorUserId: null,
};

export function AssignmentSettingsPanel() {
  const [form, setForm] = useState<AssignmentSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [runningSweep, setRunningSweep] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function loadSettings() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/system-settings/assignment");
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.message ?? "배정 설정 조회 실패");
      }
      setForm(result.data as AssignmentSettings);
    } catch (err) {
      setError(err instanceof Error ? err.message : "배정 설정 조회 실패");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadSettings();
  }, []);

  async function saveSettings() {
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      const response = await fetch("/api/admin/system-settings/assignment", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.message ?? "배정 설정 저장 실패");
      }
      setForm(result.data as AssignmentSettings);
      setMessage("배정 설정이 저장되었습니다.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "배정 설정 저장 실패");
    } finally {
      setSaving(false);
    }
  }

  async function runTimeoutSweep() {
    setRunningSweep(true);
    setMessage(null);
    setError(null);
    try {
      const response = await fetch("/api/admin/orders/assignment/timeout/sweep", {
        method: "POST",
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.message ?? "타임아웃 자동 배정 실행 실패");
      }
      const payload = result.data as {
        scannedOrders: number;
        assignedOrders: number;
        assignedItems: number;
        skipped: string | null;
      };
      setMessage(
        `실행 완료: 스캔 ${payload.scannedOrders}건 / 배정 ${payload.assignedOrders}건 / 품목 ${payload.assignedItems}건`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "타임아웃 자동 배정 실행 실패");
    } finally {
      setRunningSweep(false);
    }
  }

  return (
    <section className="space-y-3 rounded border border-[#2d333d] bg-[#1a1d23] p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-white">배정 시스템 설정</h2>
        <button
          type="button"
          className="rounded border border-[#2d333d] px-3 py-1 text-sm"
          onClick={loadSettings}
          disabled={loading}
        >
          새로고침
        </button>
      </div>

      {loading ? <p className="text-sm text-gray-400">설정을 불러오는 중...</p> : null}
      {message ? <p className="rounded bg-emerald-50 p-2 text-sm text-emerald-700">{message}</p> : null}
      {error ? <p className="rounded bg-red-950/30 p-2 text-sm text-red-400">{error}</p> : null}

      {!loading ? (
        <div className="grid gap-3 md:grid-cols-2">
          <div className="rounded border border-[#2d333d] p-3">
            <p className="text-sm font-semibold text-white">배정 모드</p>
            <label className="mt-2 flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.modes.manual}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, modes: { ...prev.modes, manual: e.target.checked } }))
                }
              />
              수동 배정 (Korea Supply Admin)
            </label>
            <label className="mt-2 flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.modes.autoProduct}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    modes: { ...prev.modes, autoProduct: e.target.checked },
                  }))
                }
              />
              자동 배정 (상품 supplier 기준)
            </label>
            <label className="mt-2 flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.modes.autoTimeout}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    modes: { ...prev.modes, autoTimeout: e.target.checked },
                  }))
                }
              />
              타임아웃 자동 배정
            </label>
            <label className="mt-3 block text-sm">
              타임아웃 시간(시간)
              <input
                type="number"
                min={1}
                max={168}
                className="mt-1 w-full rounded border border-[#2d333d] px-2 py-1"
                value={form.timeoutHours}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, timeoutHours: Number(e.target.value || 24) }))
                }
              />
            </label>
          </div>

          <div className="rounded border border-[#2d333d] p-3">
            <p className="text-sm font-semibold text-white">알림 채널</p>
            <label className="mt-2 flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.notifications.email}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    notifications: { ...prev.notifications, email: e.target.checked },
                  }))
                }
              />
              이메일
            </label>
            <label className="mt-2 flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.notifications.slack}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    notifications: { ...prev.notifications, slack: e.target.checked },
                  }))
                }
              />
              Slack (확장 예정)
            </label>
            <label className="mt-2 flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.notifications.sms}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    notifications: { ...prev.notifications, sms: e.target.checked },
                  }))
                }
              />
              SMS (확장 예정)
            </label>
            <label className="mt-2 flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.notifications.webhook}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    notifications: { ...prev.notifications, webhook: e.target.checked },
                  }))
                }
              />
              Webhook (확장 예정)
            </label>
            <label className="mt-3 block text-sm">
              Webhook URL (선택)
              <input
                type="text"
                className="mt-1 w-full rounded border border-[#2d333d] px-2 py-1"
                value={form.webhookUrl ?? ""}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    webhookUrl: e.target.value.trim() === "" ? null : e.target.value.trim(),
                  }))
                }
              />
            </label>
            <label className="mt-3 block text-sm">
              자동 배정 실행 계정 ID (선택)
              <input
                type="number"
                min={1}
                className="mt-1 w-full rounded border border-[#2d333d] px-2 py-1"
                value={form.automationActorUserId ?? ""}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    automationActorUserId: e.target.value ? Number(e.target.value) : null,
                  }))
                }
              />
            </label>
          </div>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          className="rounded bg-blue-600 px-3 py-2 text-sm text-white disabled:opacity-60"
          disabled={saving || loading}
          onClick={saveSettings}
        >
          {saving ? "저장 중..." : "설정 저장"}
        </button>
        <button
          type="button"
          className="rounded border border-indigo-300 px-3 py-2 text-sm text-indigo-700 disabled:opacity-60"
          disabled={runningSweep || loading}
          onClick={runTimeoutSweep}
        >
          {runningSweep ? "실행 중..." : "타임아웃 자동 배정 즉시 실행"}
        </button>
      </div>
    </section>
  );
}
