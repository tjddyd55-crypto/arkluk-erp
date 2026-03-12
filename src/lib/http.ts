import { NextResponse } from "next/server";

export class HttpError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export function ok<T>(data: T, init?: ResponseInit) {
  return NextResponse.json({ success: true, data }, init);
}

export function fail(message: string, status = 400, extra?: unknown) {
  return NextResponse.json(
    { success: false, message, ...(extra ? { extra } : {}) },
    { status },
  );
}

export function handleRouteError(error: unknown) {
  if (error instanceof HttpError) {
    return fail(error.message, error.status);
  }

  if (error instanceof Error) {
    return fail(error.message, 500);
  }

  return fail("알 수 없는 오류가 발생했습니다.", 500);
}
