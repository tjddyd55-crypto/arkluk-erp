import { createHash } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import path from "path";

import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";
import { PDFParse } from "pdf-parse";
import { InvoiceFileType } from "@prisma/client";

import { INVOICE_DUPLICATE_WINDOW_MINUTES, ORDER_NO_REGEX } from "@/lib/constants";
import { env } from "@/lib/env";
import { HttpError } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { createAuditLog } from "@/server/services/audit-log";

const INVOICE_STORAGE_DIR = path.join(process.cwd(), "storage", "invoices");
const MAX_ATTACHMENT_SIZE = 10 * 1024 * 1024;

type SyncResult = {
  fetched: number;
  created: number;
  linkedOrder: number;
  skippedDuplicate: number;
  unknownSupplier: number;
};

function normalizeEmail(value?: string | null) {
  return (value ?? "").trim().toLowerCase();
}

function firstAddress(address: unknown) {
  if (!address) {
    return null;
  }
  if (Array.isArray(address)) {
    const first = address[0] as
      | {
          address?: string;
          value?: Array<{ address?: string }>;
        }
      | undefined;
    return first?.address ?? first?.value?.[0]?.address ?? null;
  }
  if (typeof address === "object" && "value" in address) {
    const value = (address as { value?: Array<{ address?: string }> }).value;
    return value?.[0]?.address ?? null;
  }
  return null;
}

function inferFileType(fileName: string, contentType?: string | null): InvoiceFileType | null {
  const lowerName = fileName.toLowerCase();
  const lowerType = (contentType ?? "").toLowerCase();
  if (lowerName.endsWith(".pdf") || lowerType.includes("pdf")) {
    return "PDF";
  }
  if (lowerName.endsWith(".xml") || lowerType.includes("xml")) {
    return "XML";
  }
  return null;
}

function sanitizeFilename(fileName: string) {
  return fileName.replace(/[^\w.\-]/g, "_");
}

function extractOrderNoCandidates(text: string) {
  const matches = text.match(ORDER_NO_REGEX) ?? [];
  return [...new Set(matches.map((match) => match.toUpperCase()))];
}

async function ensureStorageDir() {
  await mkdir(INVOICE_STORAGE_DIR, { recursive: true });
}

async function extractAttachmentText(buffer: Buffer, type: InvoiceFileType) {
  try {
    if (type === "PDF") {
      const parser = new PDFParse({ data: buffer });
      const result = await parser.getText();
      await parser.destroy();
      return result.text ?? "";
    }
    return buffer.toString("utf8");
  } catch {
    return "";
  }
}

function buildMessageId(input: {
  messageId?: string | null;
  fromEmail: string;
  toEmail: string;
  subject: string;
  receivedAt: Date;
}) {
  if (input.messageId && input.messageId.trim()) {
    return input.messageId.trim();
  }

  return createHash("sha1")
    .update(
      `${input.fromEmail}|${input.toEmail}|${input.subject}|${input.receivedAt.toISOString()}`,
    )
    .digest("hex");
}

async function findAutoMatchedOrderId(
  subject: string,
  body: string,
  attachmentTexts: string[],
) {
  const searchPool = [subject, body, ...attachmentTexts];
  const candidates = new Set<string>();
  for (const text of searchPool) {
    for (const orderNo of extractOrderNoCandidates(text)) {
      candidates.add(orderNo);
    }
  }

  for (const orderNo of candidates) {
    const order = await prisma.order.findUnique({
      where: { order_no: orderNo },
      select: { id: true },
    });
    if (order) {
      return order.id;
    }
  }

  return null;
}

async function getSystemActorId() {
  const actor =
    (await prisma.user.findFirst({
      where: {
        role: { in: ["SUPER_ADMIN", "ADMIN"] },
        is_active: true,
      },
      orderBy: { id: "asc" },
      select: { id: true },
    })) ??
    (await prisma.user.findFirst({
      where: { is_active: true },
      orderBy: { id: "asc" },
      select: { id: true },
    }));

  return actor?.id ?? null;
}

async function findSupplierIdBySenderEmail(fromEmail: string) {
  const sender = await prisma.supplierInvoiceSender.findFirst({
    where: {
      sender_email: {
        equals: fromEmail,
        mode: "insensitive",
      },
      is_active: true,
    },
    select: { supplier_id: true },
  });

  if (sender) {
    return sender.supplier_id;
  }

  // Backward compatibility for legacy single sender field.
  const legacySupplier = await prisma.supplier.findFirst({
    where: {
      invoice_sender_email: {
        equals: fromEmail,
        mode: "insensitive",
      },
      is_active: true,
    },
    select: { id: true },
  });

  return legacySupplier?.id ?? null;
}

async function isNearDuplicateInbox(input: {
  fromEmail: string;
  subject: string;
  receivedAt: Date;
  attachmentCount: number;
}) {
  const windowMs = INVOICE_DUPLICATE_WINDOW_MINUTES * 60 * 1000;
  const from = new Date(input.receivedAt.getTime() - windowMs);
  const to = new Date(input.receivedAt.getTime() + windowMs);

  const duplicate = await prisma.emailInbox.findFirst({
    where: {
      from_email: input.fromEmail,
      subject: input.subject,
      attachment_count: input.attachmentCount,
      received_at: {
        gte: from,
        lte: to,
      },
    },
    select: { id: true },
  });

  return Boolean(duplicate);
}

function validateImapConfig() {
  if (!env.IMAP_HOST || !env.IMAP_USER || !env.IMAP_PASSWORD || !env.IMAP_PORT) {
    throw new HttpError(
      400,
      "IMAP 환경변수가 설정되지 않았습니다. IMAP_HOST/IMAP_USER/IMAP_PASSWORD/IMAP_PORT를 확인하세요.",
    );
  }
}

export async function syncInvoiceEmails(options?: { actorId?: number; limit?: number }) {
  validateImapConfig();
  await ensureStorageDir();

  const result: SyncResult = {
    fetched: 0,
    created: 0,
    linkedOrder: 0,
    skippedDuplicate: 0,
    unknownSupplier: 0,
  };

  const client = new ImapFlow({
    host: env.IMAP_HOST!,
    port: env.IMAP_PORT!,
    secure: env.IMAP_SECURE ?? true,
    auth: {
      user: env.IMAP_USER!,
      pass: env.IMAP_PASSWORD!,
    },
  });

  const actorId = options?.actorId ?? (await getSystemActorId());
  const inboxToEmail = normalizeEmail(env.TAX_INVOICE_INBOX_EMAIL ?? env.IMAP_USER ?? "");

  try {
    await client.connect();
    const mailboxLock = await client.getMailboxLock("INBOX");
    try {
      const searched = await client.search({ seen: false });
      const uids = Array.isArray(searched) ? searched : [];
      const targetUids = uids.slice(0, options?.limit ?? 100);

      for (const uid of targetUids) {
        const fetched = await client.fetchOne(uid, {
          uid: true,
          source: true,
          envelope: true,
          internalDate: true,
        });
        if (fetched === false) {
          continue;
        }
        if (!fetched.source) {
          continue;
        }
        result.fetched += 1;

        const parsed = await simpleParser(fetched.source);
        const fromEmail = normalizeEmail(firstAddress(parsed.from) ?? "");
        const toEmail = normalizeEmail(firstAddress(parsed.to) ?? inboxToEmail);
        const subject = (parsed.subject ?? "").trim();
        const body = (parsed.text ?? "").trim();
        const parsedDate =
          parsed.date instanceof Date
            ? parsed.date
            : parsed.date
              ? new Date(parsed.date)
              : null;
        const internalDate =
          fetched.internalDate instanceof Date
            ? fetched.internalDate
            : fetched.internalDate
              ? new Date(fetched.internalDate)
              : null;
        const receivedAt = parsedDate ?? internalDate ?? new Date();
        const messageId = buildMessageId({
          messageId: parsed.messageId,
          fromEmail,
          toEmail,
          subject,
          receivedAt,
        });

        const existingInbox = await prisma.emailInbox.findUnique({
          where: { message_id: messageId },
          select: { id: true },
        });
        if (existingInbox) {
          result.skippedDuplicate += 1;
          await client.messageFlagsAdd(uid, ["\\Seen"], { uid: true });
          continue;
        }

        // Secondary duplicate guard for mails missing message-id or re-send bursts.
        const nearDuplicate = await isNearDuplicateInbox({
          fromEmail,
          subject,
          receivedAt,
          attachmentCount: parsed.attachments.length,
        });
        if (nearDuplicate) {
          result.skippedDuplicate += 1;
          await client.messageFlagsAdd(uid, ["\\Seen"], { uid: true });
          continue;
        }

        const matchedSupplierId = await findSupplierIdBySenderEmail(fromEmail);
        if (!matchedSupplierId) {
          result.unknownSupplier += 1;
        }

        const invoice = await prisma.$transaction(async (tx) => {
          const inbox = await tx.emailInbox.create({
            data: {
              message_id: messageId,
              from_email: fromEmail,
              to_email: toEmail,
              subject,
              body,
              supplier_id: matchedSupplierId,
              received_at: receivedAt,
              attachment_count: parsed.attachments.length,
              processed: false,
            },
          });

          const createdInvoice = await tx.taxInvoice.create({
            data: {
              supplier_id: matchedSupplierId,
              email_inbox_id: inbox.id,
            },
          });

          // Policy: even without attachments, inbox and tax invoice are both created.
          const attachmentTexts: string[] = [];

          for (const attachment of parsed.attachments) {
            const fileType = inferFileType(
              attachment.filename ?? attachment.contentId ?? "attachment",
              attachment.contentType,
            );
            if (!fileType) {
              continue;
            }
            if (attachment.size > MAX_ATTACHMENT_SIZE) {
              continue;
            }

            const safeOriginal = sanitizeFilename(
              attachment.filename ?? `${fileType.toLowerCase()}_file`,
            );
            const fileName = `${matchedSupplierId ?? 0}_${Date.now()}_${safeOriginal}`;
            const fullPath = path.join(INVOICE_STORAGE_DIR, fileName);
            await writeFile(fullPath, attachment.content);

            await tx.invoiceFile.create({
              data: {
                invoice_id: createdInvoice.id,
                file_name: safeOriginal,
                file_url: path.join("storage", "invoices", fileName).replaceAll("\\", "/"),
                file_type: fileType,
              },
            });

            const text = await extractAttachmentText(attachment.content, fileType);
            if (text) {
              attachmentTexts.push(text);
            }
          }

          const autoOrderId = await findAutoMatchedOrderId(subject, body, attachmentTexts);
          if (autoOrderId) {
            await tx.taxInvoice.update({
              where: { id: createdInvoice.id },
              data: {
                order_id: autoOrderId,
                order_link_type: "AUTO",
              },
            });
            result.linkedOrder += 1;
          }

          await tx.emailInbox.update({
            where: { id: inbox.id },
            data: { processed: true },
          });

          if (actorId) {
            await createAuditLog(
              {
                actorId,
                actionType: "RECEIVE_INVOICE_EMAIL",
                targetType: "TAX_INVOICE",
                targetId: createdInvoice.id,
                afterData: {
                  fromEmail,
                  supplierId: matchedSupplierId,
                  orderId: autoOrderId,
                },
              },
              tx,
            );
          }

          return createdInvoice;
        });

        if (invoice) {
          result.created += 1;
        }

        await client.messageFlagsAdd(uid, ["\\Seen"], { uid: true });
      }
    } finally {
      mailboxLock.release();
    }
  } finally {
    try {
      if (client.usable) {
        await client.logout();
      }
    } catch {
      // no-op: we do not want logout failures to hide processing result
    }
  }

  return result;
}
