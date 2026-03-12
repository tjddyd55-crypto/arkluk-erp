# ARKLUK ERP MVP

국가 확장형 건축자재 B2B 유통 주문/견적 관리 1차 MVP 프로젝트입니다.

## 아키텍처 요약

- 프레임워크: Next.js(App Router) + TypeScript
- 데이터 계층: Prisma + PostgreSQL
- 인증: JWT(HttpOnly Cookie) + Role 기반 API 접근 통제
- 도메인: 국가/공급사/카테고리/상품/주문/견적/로그/프로젝트(2차 구조)

## 실행 방법

1) 환경 변수 설정 (`.env`)

```env
DATABASE_URL="postgresql://..."
JWT_SECRET="32자 이상 비밀키"
IMAP_HOST="imap.your-mail.com"
IMAP_PORT="993"
IMAP_USER="tax@ourcompany.com"
IMAP_PASSWORD="your-imap-password"
IMAP_SECURE="true"
TAX_INVOICE_INBOX_EMAIL="tax@ourcompany.com"
SMTP_HOST="smtp.your-mail.com"
SMTP_PORT="587"
SMTP_USER="noreply@ourcompany.com"
SMTP_PASSWORD="your-smtp-password"
SMTP_SECURE="false"
SMTP_FROM_EMAIL="noreply@ourcompany.com"
OUR_COMPANY_NAME="우리 회사명"
```

2) 의존성 설치

```bash
npm install
```

3) Prisma 스키마 반영

```bash
npm run prisma:generate
npm run prisma:migrate
```

4) 시드 데이터 생성

```bash
npm run prisma:seed
```

5) 개발 서버 실행

```bash
npm run dev
```

6) 세금계산서 메일 동기화(선택)

```bash
npm run invoice:cron
```

## 기본 계정 (seed 기준)

- SUPER_ADMIN: `superadmin` / `ChangeMe123!`
- ADMIN: `admin01` / `ChangeMe123!`
- BUYER: `buyer.mn.01` / `ChangeMe123!`
- SUPPLIER A: `supplier.a.01` / `ChangeMe123!`
- SUPPLIER B: `supplier.b.01` / `ChangeMe123!`

## 주요 API 그룹

- 인증: `/api/auth/*`
- 관리자: `/api/admin/*`
- 바이어: `/api/buyer/*`
- 공급사: `/api/supplier/*`
- 세금계산서: `/api/admin/tax-invoices*`
- 발주서: `/api/admin/purchase-orders*`

## 세금계산서 수집 정책

- 발신 메일 분류는 `supplier_invoice_senders` 테이블(다중 발신 메일) 기준으로 수행
- 미등록 발신 메일은 버리지 않고 `supplier_id = null`로 저장되어 미분류함에서 수동 분류 가능
- 첨부가 없어도 `email_inbox`와 `tax_invoices`는 생성되며 UI에서 `첨부 없음`으로 표시
- 주문번호 자동 연결은 `ORDER_NO_REGEX` 상수(`src/lib/constants.ts`)로 관리
- 중복 정책:
  - 1차: `message_id` 고유값 기반 스킵
  - 2차: 발신자/제목/수신시각(2분 윈도우)/첨부 개수 기반 근접 중복 스킵
  - 한계: 완전히 다른 제목/시간으로 재전송된 동일 메일은 중복으로 인식하지 못할 수 있음

## 2차 대비 구조(스키마만 반영)

- `projects`
- `project_files`

## 발주서(Purchase Order) 정책

- 발주서는 공급사별로 생성되며 파일명은 `PO_{supplierId}_{orderNo}.pdf`
- PDF 데이터는 `order_items` snapshot(`product_name/spec/unit/qty/memo`) 기준으로 작성
- 발주 시점에 `storage/purchase-orders/`에 저장 후 이메일 첨부 발송
- 발송 결과는 `email_logs`에 남고, 발주 파일 메타는 `purchase_orders`에 저장
- SMTP 미설정 환경에서는 모의 발송(`jsonTransport`)으로 처리되어 개발 검증 가능
