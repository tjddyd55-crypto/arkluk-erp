import nodemailer from "nodemailer";

import { env } from "@/lib/env";

type SendMailInput = {
  to: string;
  cc?: string | null;
  subject: string;
  text: string;
  attachments?: Array<{
    filename: string;
    path: string;
    contentType?: string;
  }>;
};

type SendMailResult = {
  success: boolean;
  errorMessage: string | null;
  mocked: boolean;
};

function hasSmtpConfig() {
  return Boolean(
    env.SMTP_HOST &&
      env.SMTP_PORT &&
      env.SMTP_USER &&
      env.SMTP_PASSWORD &&
      env.SMTP_FROM_EMAIL,
  );
}

function createTransporter() {
  if (hasSmtpConfig()) {
    return {
      mocked: false,
      transporter: nodemailer.createTransport({
        host: env.SMTP_HOST!,
        port: env.SMTP_PORT!,
        secure: env.SMTP_SECURE ?? false,
        auth: {
          user: env.SMTP_USER!,
          pass: env.SMTP_PASSWORD!,
        },
      }),
    };
  }

  // 개발/테스트 환경에서는 SMTP 미설정 시 모의 발송으로 처리합니다.
  return {
    mocked: true,
    transporter: nodemailer.createTransport({
      jsonTransport: true,
    }),
  };
}

export async function sendMail(input: SendMailInput): Promise<SendMailResult> {
  const { mocked, transporter } = createTransporter();
  try {
    await transporter.sendMail({
      from: env.SMTP_FROM_EMAIL ?? "no-reply@arkluk.local",
      to: input.to,
      cc: input.cc ?? undefined,
      subject: input.subject,
      text: input.text,
      attachments: input.attachments ?? [],
    });
    return {
      success: true,
      errorMessage: null,
      mocked,
    };
  } catch (error) {
    return {
      success: false,
      errorMessage: error instanceof Error ? error.message : "메일 발송 실패",
      mocked,
    };
  }
}
