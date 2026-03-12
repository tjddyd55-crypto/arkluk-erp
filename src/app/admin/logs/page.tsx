import { ApiTable } from "@/components/portal/api-table";

export default function AdminLogsPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-slate-900">로그 관리</h1>
      <p className="text-sm text-slate-600">
        감사 로그, 이메일 발송 로그, 주문 변경 이력을 조회합니다.
      </p>
      <ApiTable endpoint="/api/admin/logs?type=audit" title="감사 로그" />
      <ApiTable endpoint="/api/admin/logs?type=email" title="이메일 로그" />
      <ApiTable endpoint="/api/admin/logs?type=order-change" title="주문 변경 로그" />
    </div>
  );
}
