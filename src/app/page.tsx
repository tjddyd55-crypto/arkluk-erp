import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen bg-slate-100 p-10">
      <main className="mx-auto max-w-5xl rounded-lg bg-white p-10 shadow-sm">
        <h1 className="text-3xl font-bold text-slate-900">ARKLUK ERP</h1>
        <p className="mt-2 text-slate-600">
          국가 확장형 건축자재 B2B 주문/견적 운영 시스템 MVP
        </p>

        <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="rounded border border-slate-200 p-4">
            <h2 className="font-semibold">관리자 포털</h2>
            <p className="mt-2 text-sm text-slate-600">
              공급사/카테고리/상품/주문/견적/로그 운영
            </p>
            <Link
              href="/admin"
              className="mt-4 inline-block rounded bg-slate-900 px-4 py-2 text-sm text-white"
            >
              바로가기
            </Link>
          </div>

          <div className="rounded border border-slate-200 p-4">
            <h2 className="font-semibold">바이어 포털</h2>
            <p className="mt-2 text-sm text-slate-600">
              회사 선택 주문, 엑셀 업로드, 받은 견적 확인
            </p>
            <Link
              href="/buyer"
              className="mt-4 inline-block rounded bg-slate-900 px-4 py-2 text-sm text-white"
            >
              바로가기
            </Link>
          </div>

          <div className="rounded border border-slate-200 p-4">
            <h2 className="font-semibold">공급사 포털</h2>
            <p className="mt-2 text-sm text-slate-600">
              자기 주문 확인, 주문 확인 처리, 자기 견적 관리
            </p>
            <Link
              href="/supplier"
              className="mt-4 inline-block rounded bg-slate-900 px-4 py-2 text-sm text-white"
            >
              바로가기
            </Link>
          </div>
        </div>

        <div className="mt-8">
          <Link href="/login" className="text-sm font-medium text-blue-700 underline">
            로그인 화면으로 이동
          </Link>
        </div>
      </main>
    </div>
  );
}
