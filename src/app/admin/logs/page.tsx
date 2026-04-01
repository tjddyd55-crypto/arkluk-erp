"use client";

import { ApiTable } from "@/components/portal/api-table";
import { useTranslation } from "@/hooks/useTranslation";

export default function AdminLogsPage() {
  const { t } = useTranslation();
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-white">{t("logs")}</h1>
      <p className="text-sm text-gray-400">{t("logs")}</p>
      <ApiTable endpoint="/api/admin/logs?type=audit" title={t("logs")} />
      <ApiTable endpoint="/api/admin/logs?type=email" title={t("logs")} />
      <ApiTable endpoint="/api/admin/logs?type=order-change" title={t("orders")} />
    </div>
  );
}
