import {
  CollabAuthorPartyType,
  CollabProjectStatus,
  CollabUploadStatus,
  Prisma,
} from "@prisma/client";

import { HttpError } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import {
  createPresignedGetObjectUrl,
  createPresignedPutObjectUrl,
  deleteFile,
  existsFile,
  isR2Configured,
} from "@/server/services/storage-service";

import { logCollabAudit } from "./collab-audit";
import {
  buildCollabProjectFileStorageKey,
  buildCollabReplyFileStorageKey,
} from "./collab-keys";
import {
  fileExtFromName,
  getCollabPresignGetExpiresSec,
  getCollabPresignPutExpiresSec,
  getCollabProjectFileMaxBytes,
  getCollabReplyFileMaxBytes,
  sanitizeOriginalFilename,
} from "./collab-policy";

const collabProjectInclude = {
  files: {
    where: { deleted_at: null },
    orderBy: { created_at: "desc" as const },
  },
} satisfies Prisma.CollabProjectInclude;

export const collabReplyIncludeBuyer = {
  author: { select: { id: true, name: true } },
  author_supplier: { select: { id: true, company_name: true, supplier_name: true } },
  files: {
    where: { deleted_at: null },
    orderBy: { created_at: "desc" as const },
  },
} satisfies Prisma.CollabProjectReplyInclude;

export async function assertBuyerOwnsCollabProject(projectId: number, buyerUserId: number) {
  const row = await prisma.collabProject.findFirst({
    where: { id: projectId, buyer_id: buyerUserId, deleted_at: null },
  });
  if (!row) {
    throw new HttpError(404, "프로젝트를 찾을 수 없습니다.");
  }
  return row;
}

export async function assertSupplierCanViewCollabProject(projectId: number) {
  const row = await prisma.collabProject.findFirst({
    where: { id: projectId, status: CollabProjectStatus.OPEN, deleted_at: null },
  });
  if (!row) {
    throw new HttpError(404, "프로젝트를 찾을 수 없습니다.");
  }
  return row;
}

export function mapCollabFile(row: {
  id: number;
  original_filename: string;
  mime_type: string;
  size_bytes: bigint;
  upload_status: CollabUploadStatus;
  created_at: Date;
}) {
  return {
    id: row.id,
    originalFilename: row.original_filename,
    mimeType: row.mime_type,
    sizeBytes: row.size_bytes.toString(),
    uploadStatus: row.upload_status,
    createdAt: row.created_at.toISOString(),
  };
}

export function mapCollabReplyForBuyer(
  row: Prisma.CollabProjectReplyGetPayload<{ include: typeof collabReplyIncludeBuyer }>,
) {
  return {
    id: row.id,
    body: row.body,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
    author: row.author,
    authorSupplier: row.author_supplier
      ? {
          id: row.author_supplier.id,
          companyName: row.author_supplier.company_name,
          supplierName: row.author_supplier.supplier_name,
        }
      : null,
    authorPartyType: row.author_party_type,
    files: row.files
      .filter((f) => f.upload_status === CollabUploadStatus.COMPLETED)
      .map(mapCollabFile),
  };
}

export async function createCollabProject(input: {
  buyerUserId: number;
  createdByUserId: number;
  title: string;
  description: string;
  status: CollabProjectStatus;
  legacyProjectId?: number | null;
}) {
  const row = await prisma.collabProject.create({
    data: {
      buyer_id: input.buyerUserId,
      title: input.title.trim(),
      description: input.description,
      status: input.status,
      created_by_user_id: input.createdByUserId,
      legacy_project_id: input.legacyProjectId ?? null,
    },
  });
  await logCollabAudit({
    actorId: input.createdByUserId,
    actionType: "project.create",
    targetType: "COLLAB_PROJECT",
    targetId: row.id,
    afterData: row,
  });
  return row;
}

export async function listCollabProjectsForBuyer(buyerUserId: number) {
  return prisma.collabProject.findMany({
    where: { buyer_id: buyerUserId, deleted_at: null },
    orderBy: { created_at: "desc" },
    include: { files: { where: { deleted_at: null, upload_status: CollabUploadStatus.COMPLETED } } },
  });
}

export async function getCollabProjectDetailForBuyer(projectId: number, buyerUserId: number) {
  await assertBuyerOwnsCollabProject(projectId, buyerUserId);
  const project = await prisma.collabProject.findFirst({
    where: { id: projectId, buyer_id: buyerUserId, deleted_at: null },
    include: {
      ...collabProjectInclude,
      replies: {
        where: { deleted_at: null },
        orderBy: { created_at: "desc" },
        include: collabReplyIncludeBuyer,
      },
    },
  });
  if (!project) {
    throw new HttpError(404, "프로젝트를 찾을 수 없습니다.");
  }
  return project;
}

export async function patchCollabProject(input: {
  projectId: number;
  buyerUserId: number;
  actorId: number;
  title?: string;
  description?: string;
  status?: CollabProjectStatus;
}) {
  const before = await assertBuyerOwnsCollabProject(input.projectId, input.buyerUserId);
  const row = await prisma.collabProject.update({
    where: { id: input.projectId },
    data: {
      ...(input.title !== undefined ? { title: input.title.trim() } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
    },
  });
  await logCollabAudit({
    actorId: input.actorId,
    actionType: "project.update",
    targetType: "COLLAB_PROJECT",
    targetId: row.id,
    beforeData: before,
    afterData: row,
  });
  return row;
}

export async function softDeleteCollabProject(projectId: number, buyerUserId: number, actorId: number) {
  const before = await assertBuyerOwnsCollabProject(projectId, buyerUserId);
  const now = new Date();
  await prisma.$transaction([
    prisma.collabProjectFile.updateMany({
      where: { project_id: projectId, deleted_at: null },
      data: { upload_status: CollabUploadStatus.DELETED, deleted_at: now },
    }),
    prisma.collabProjectReplyFile.updateMany({
      where: { reply: { project_id: projectId }, deleted_at: null },
      data: { upload_status: CollabUploadStatus.DELETED, deleted_at: now },
    }),
    prisma.collabProject.update({
      where: { id: projectId },
      data: { deleted_at: now },
    }),
  ]);
  await logCollabAudit({
    actorId,
    actionType: "project.delete",
    targetType: "COLLAB_PROJECT",
    targetId: projectId,
    beforeData: before,
    afterData: { deletedAt: now.toISOString() },
  });
}

export async function listCollabProjectsForSupplier() {
  return prisma.collabProject.findMany({
    where: { status: CollabProjectStatus.OPEN, deleted_at: null },
    orderBy: { created_at: "desc" },
    include: {
      files: {
        where: { deleted_at: null, upload_status: CollabUploadStatus.COMPLETED },
        take: 5,
        orderBy: { created_at: "desc" },
      },
    },
  });
}

export async function getCollabProjectDetailForSupplier(projectId: number) {
  await assertSupplierCanViewCollabProject(projectId);
  return prisma.collabProject.findFirst({
    where: { id: projectId, status: CollabProjectStatus.OPEN, deleted_at: null },
    include: collabProjectInclude,
  });
}

export async function presignCollabProjectFile(params: {
  projectId: number;
  buyerUserId: number;
  actorId: number;
  filename: string;
  sizeBytes: bigint;
  mimeType: string;
}) {
  if (!isR2Configured()) {
    throw new HttpError(503, "파일 스토리지가 설정되지 않았습니다.");
  }
  const max = BigInt(getCollabProjectFileMaxBytes());
  if (params.sizeBytes <= BigInt(0) || params.sizeBytes > max) {
    throw new HttpError(400, `파일 크기는 1바이트 ~ ${max.toString()}바이트 여야 합니다.`);
  }
  await assertBuyerOwnsCollabProject(params.projectId, params.buyerUserId);
  const originalFilename = sanitizeOriginalFilename(params.filename);
  const ext = fileExtFromName(originalFilename);
  const mimeType = (params.mimeType || "application/octet-stream").slice(0, 256);

  const draft = await prisma.collabProjectFile.create({
    data: {
      project_id: params.projectId,
      original_filename: originalFilename,
      mime_type: mimeType,
      size_bytes: params.sizeBytes,
      ext,
      upload_status: CollabUploadStatus.UPLOADING,
      uploaded_by_user_id: params.actorId,
    },
  });
  const storageKey = buildCollabProjectFileStorageKey(params.projectId, draft.id);
  await prisma.collabProjectFile.update({
    where: { id: draft.id },
    data: { storage_key: storageKey },
  });

  await logCollabAudit({
    actorId: params.actorId,
    actionType: "project.file.presign",
    targetType: "COLLAB_PROJECT_FILE",
    targetId: draft.id,
    afterData: { projectId: params.projectId, storageKey },
  });

  const expires = getCollabPresignPutExpiresSec();
  const { uploadUrl } = await createPresignedPutObjectUrl({
    key: storageKey,
    contentType: mimeType,
    expiresInSeconds: expires,
  });

  return { fileId: draft.id, storageKey, uploadUrl, expiresIn: expires };
}

export async function completeCollabProjectFile(input: {
  projectId: number;
  fileId: number;
  buyerUserId: number;
  actorId: number;
  etag?: string | null;
  checksumSha256?: string | null;
}) {
  await assertBuyerOwnsCollabProject(input.projectId, input.buyerUserId);
  const file = await prisma.collabProjectFile.findFirst({
    where: {
      id: input.fileId,
      project_id: input.projectId,
      deleted_at: null,
    },
  });
  if (!file || file.upload_status !== CollabUploadStatus.UPLOADING) {
    throw new HttpError(404, "업로드 중인 파일을 찾을 수 없습니다.");
  }
  if (!file.storage_key) {
    throw new HttpError(500, "스토리지 키가 없습니다.");
  }
  if (!isR2Configured()) {
    throw new HttpError(503, "파일 스토리지가 설정되지 않았습니다.");
  }
  const exists = await existsFile(file.storage_key);
  if (!exists) {
    await prisma.collabProjectFile.update({
      where: { id: file.id },
      data: { upload_status: CollabUploadStatus.FAILED },
    });
    throw new HttpError(400, "스토리지에 객체가 없습니다. 업로드를 다시 시도하세요.");
  }
  const updated = await prisma.collabProjectFile.update({
    where: { id: file.id },
    data: {
      upload_status: CollabUploadStatus.COMPLETED,
      r2_etag: input.etag?.trim() || null,
      checksum_sha256: input.checksumSha256?.trim() || null,
    },
  });
  await logCollabAudit({
    actorId: input.actorId,
    actionType: "project.file.complete",
    targetType: "COLLAB_PROJECT_FILE",
    targetId: file.id,
    afterData: { status: updated.upload_status },
  });
  return updated;
}

export async function downloadCollabProjectFile(input: {
  projectId: number;
  fileId: number;
  buyerUserId?: number;
  supplierId?: number;
}) {
  let file: Prisma.CollabProjectFileGetPayload<object> | null = null;
  if (input.buyerUserId !== undefined) {
    await assertBuyerOwnsCollabProject(input.projectId, input.buyerUserId);
    file = await prisma.collabProjectFile.findFirst({
      where: {
        id: input.fileId,
        project_id: input.projectId,
        upload_status: CollabUploadStatus.COMPLETED,
        deleted_at: null,
      },
    });
  } else if (input.supplierId !== undefined) {
    await assertSupplierCanViewCollabProject(input.projectId);
    file = await prisma.collabProjectFile.findFirst({
      where: {
        id: input.fileId,
        project_id: input.projectId,
        upload_status: CollabUploadStatus.COMPLETED,
        deleted_at: null,
      },
    });
  }
  if (!file || !file.storage_key) {
    throw new HttpError(404, "파일을 찾을 수 없습니다.");
  }
  if (!isR2Configured()) {
    throw new HttpError(503, "파일 스토리지가 설정되지 않았습니다.");
  }
  const expires = getCollabPresignGetExpiresSec();
  const { downloadUrl, expiresIn } = await createPresignedGetObjectUrl({
    key: file.storage_key,
    expiresInSeconds: expires,
  });
  return { downloadUrl, expiresIn, file };
}

export async function softDeleteCollabProjectFile(input: {
  projectId: number;
  fileId: number;
  buyerUserId: number;
  actorId: number;
}) {
  await assertBuyerOwnsCollabProject(input.projectId, input.buyerUserId);
  const file = await prisma.collabProjectFile.findFirst({
    where: { id: input.fileId, project_id: input.projectId, deleted_at: null },
  });
  if (!file) {
    throw new HttpError(404, "파일을 찾을 수 없습니다.");
  }
  const now = new Date();
  await prisma.collabProjectFile.update({
    where: { id: file.id },
    data: { upload_status: CollabUploadStatus.DELETED, deleted_at: now },
  });
  await logCollabAudit({
    actorId: input.actorId,
    actionType: "project.file.delete",
    targetType: "COLLAB_PROJECT_FILE",
    targetId: file.id,
    beforeData: file,
  });
}

/** 공급사: 본인 supplier_id 로 작성된 답글만 (목록) */
export async function listCollabRepliesForSupplier(projectId: number, supplierId: number) {
  await assertSupplierCanViewCollabProject(projectId);
  return prisma.collabProjectReply.findMany({
    where: {
      project_id: projectId,
      author_supplier_id: supplierId,
      deleted_at: null,
    },
    orderBy: { created_at: "desc" },
    include: collabReplyIncludeBuyer,
  });
}

export async function getCollabReplyForBuyer(projectId: number, replyId: number, buyerUserId: number) {
  await assertBuyerOwnsCollabProject(projectId, buyerUserId);
  const reply = await prisma.collabProjectReply.findFirst({
    where: { id: replyId, project_id: projectId, deleted_at: null },
    include: collabReplyIncludeBuyer,
  });
  if (!reply) {
    throw new HttpError(404, "답글을 찾을 수 없습니다.");
  }
  return reply;
}

export async function getCollabReplyForSupplier(projectId: number, replyId: number, supplierId: number) {
  await assertSupplierCanViewCollabProject(projectId);
  const reply = await prisma.collabProjectReply.findFirst({
    where: {
      id: replyId,
      project_id: projectId,
      author_supplier_id: supplierId,
      deleted_at: null,
    },
    include: collabReplyIncludeBuyer,
  });
  if (!reply) {
    throw new HttpError(404, "답글을 찾을 수 없습니다.");
  }
  return reply;
}

export async function createCollabReplyForSupplier(input: {
  projectId: number;
  supplierId: number;
  authorUserId: number;
  body: string;
  partyType?: CollabAuthorPartyType | null;
}) {
  await assertSupplierCanViewCollabProject(input.projectId);
  const reply = await prisma.collabProjectReply.create({
    data: {
      project_id: input.projectId,
      body: input.body,
      author_user_id: input.authorUserId,
      author_supplier_id: input.supplierId,
      author_party_type: input.partyType ?? CollabAuthorPartyType.SUPPLIER,
    },
  });
  await logCollabAudit({
    actorId: input.authorUserId,
    actionType: "project.reply.create",
    targetType: "COLLAB_PROJECT_REPLY",
    targetId: reply.id,
    afterData: { projectId: input.projectId, supplierId: input.supplierId },
  });
  return reply;
}

export async function presignCollabReplyFile(params: {
  projectId: number;
  replyId: number;
  supplierId: number;
  actorId: number;
  filename: string;
  sizeBytes: bigint;
  mimeType: string;
}) {
  if (!isR2Configured()) {
    throw new HttpError(503, "파일 스토리지가 설정되지 않았습니다.");
  }
  const max = BigInt(getCollabReplyFileMaxBytes());
  if (params.sizeBytes <= BigInt(0) || params.sizeBytes > max) {
    throw new HttpError(400, `파일 크기는 1바이트 ~ ${max.toString()}바이트 여야 합니다.`);
  }
  await getCollabReplyForSupplier(params.projectId, params.replyId, params.supplierId);
  const originalFilename = sanitizeOriginalFilename(params.filename);
  const ext = fileExtFromName(originalFilename);
  const mimeType = (params.mimeType || "application/octet-stream").slice(0, 256);

  const draft = await prisma.collabProjectReplyFile.create({
    data: {
      reply_id: params.replyId,
      original_filename: originalFilename,
      mime_type: mimeType,
      size_bytes: params.sizeBytes,
      ext,
      upload_status: CollabUploadStatus.UPLOADING,
      uploaded_by_user_id: params.actorId,
    },
  });
  const storageKey = buildCollabReplyFileStorageKey(params.projectId, params.replyId, draft.id);
  await prisma.collabProjectReplyFile.update({
    where: { id: draft.id },
    data: { storage_key: storageKey },
  });

  await logCollabAudit({
    actorId: params.actorId,
    actionType: "project.reply.file.presign",
    targetType: "COLLAB_PROJECT_REPLY_FILE",
    targetId: draft.id,
    afterData: { storageKey },
  });

  const expires = getCollabPresignPutExpiresSec();
  const { uploadUrl } = await createPresignedPutObjectUrl({
    key: storageKey,
    contentType: mimeType,
    expiresInSeconds: expires,
  });
  return { fileId: draft.id, storageKey, uploadUrl, expiresIn: expires };
}

export async function completeCollabReplyFile(input: {
  projectId: number;
  replyId: number;
  fileId: number;
  supplierId: number;
  actorId: number;
  etag?: string | null;
  checksumSha256?: string | null;
}) {
  await getCollabReplyForSupplier(input.projectId, input.replyId, input.supplierId);
  const file = await prisma.collabProjectReplyFile.findFirst({
    where: {
      id: input.fileId,
      reply_id: input.replyId,
      deleted_at: null,
    },
  });
  if (!file || file.upload_status !== CollabUploadStatus.UPLOADING) {
    throw new HttpError(404, "업로드 중인 파일을 찾을 수 없습니다.");
  }
  if (!file.storage_key) {
    throw new HttpError(500, "스토리지 키가 없습니다.");
  }
  if (!isR2Configured()) {
    throw new HttpError(503, "파일 스토리지가 설정되지 않았습니다.");
  }
  const exists = await existsFile(file.storage_key);
  if (!exists) {
    await prisma.collabProjectReplyFile.update({
      where: { id: file.id },
      data: { upload_status: CollabUploadStatus.FAILED },
    });
    throw new HttpError(400, "스토리지에 객체가 없습니다. 업로드를 다시 시도하세요.");
  }
  const updated = await prisma.collabProjectReplyFile.update({
    where: { id: file.id },
    data: {
      upload_status: CollabUploadStatus.COMPLETED,
      r2_etag: input.etag?.trim() || null,
      checksum_sha256: input.checksumSha256?.trim() || null,
    },
  });
  await logCollabAudit({
    actorId: input.actorId,
    actionType: "project.reply.file.complete",
    targetType: "COLLAB_PROJECT_REPLY_FILE",
    targetId: file.id,
    afterData: { status: updated.upload_status },
  });
  return updated;
}

export async function downloadCollabReplyFile(input: {
  projectId: number;
  replyId: number;
  fileId: number;
  buyerUserId?: number;
  supplierId?: number;
}) {
  let reply:
    | Prisma.CollabProjectReplyGetPayload<{ select: { id: true; author_supplier_id: true } }>
    | null = null;
  if (input.buyerUserId !== undefined) {
    await assertBuyerOwnsCollabProject(input.projectId, input.buyerUserId);
    reply = await prisma.collabProjectReply.findFirst({
      where: { id: input.replyId, project_id: input.projectId, deleted_at: null },
      select: { id: true, author_supplier_id: true },
    });
  } else if (input.supplierId !== undefined) {
    reply = await prisma.collabProjectReply.findFirst({
      where: {
        id: input.replyId,
        project_id: input.projectId,
        author_supplier_id: input.supplierId,
        deleted_at: null,
      },
      select: { id: true, author_supplier_id: true },
    });
  }
  if (!reply) {
    throw new HttpError(404, "답글을 찾을 수 없습니다.");
  }

  const file = await prisma.collabProjectReplyFile.findFirst({
    where: {
      id: input.fileId,
      reply_id: reply.id,
      upload_status: CollabUploadStatus.COMPLETED,
      deleted_at: null,
    },
  });
  if (!file || !file.storage_key) {
    throw new HttpError(404, "파일을 찾을 수 없습니다.");
  }
  if (!isR2Configured()) {
    throw new HttpError(503, "파일 스토리지가 설정되지 않았습니다.");
  }
  const expires = getCollabPresignGetExpiresSec();
  const { downloadUrl, expiresIn } = await createPresignedGetObjectUrl({
    key: file.storage_key,
    expiresInSeconds: expires,
  });
  return { downloadUrl, expiresIn, file };
}

export async function softDeleteCollabReplyFile(input: {
  projectId: number;
  replyId: number;
  fileId: number;
  supplierId: number;
  actorId: number;
}) {
  await getCollabReplyForSupplier(input.projectId, input.replyId, input.supplierId);
  const file = await prisma.collabProjectReplyFile.findFirst({
    where: { id: input.fileId, reply_id: input.replyId, deleted_at: null },
  });
  if (!file) {
    throw new HttpError(404, "파일을 찾을 수 없습니다.");
  }
  const now = new Date();
  await prisma.collabProjectReplyFile.update({
    where: { id: file.id },
    data: { upload_status: CollabUploadStatus.DELETED, deleted_at: now },
  });
  await logCollabAudit({
    actorId: input.actorId,
    actionType: "project.reply.file.delete",
    targetType: "COLLAB_PROJECT_REPLY_FILE",
    targetId: file.id,
    beforeData: file,
  });
}

/** 비동기 작업: DELETED 상태 파일의 R2 객체 제거 시도 */
export async function purgeCollabDeletedStorageObjects(limit = 50): Promise<number> {
  let n = 0;
  const projectFiles = await prisma.collabProjectFile.findMany({
    where: { upload_status: CollabUploadStatus.DELETED, deleted_at: { not: null } },
    take: limit,
  });
  for (const f of projectFiles) {
    if (f.storage_key) {
      try {
        await deleteFile(f.storage_key);
      } catch {
        /* 재시도는 다음 실행 */
      }
    }
    await prisma.collabProjectFile.delete({ where: { id: f.id } });
    n += 1;
  }
  const replyFiles = await prisma.collabProjectReplyFile.findMany({
    where: { upload_status: CollabUploadStatus.DELETED, deleted_at: { not: null } },
    take: limit,
  });
  for (const f of replyFiles) {
    if (f.storage_key) {
      try {
        await deleteFile(f.storage_key);
      } catch {
        /* no-op */
      }
    }
    await prisma.collabProjectReplyFile.delete({ where: { id: f.id } });
    n += 1;
  }
  return n;
}

/** 오래된 UPLOADING → FAILED */
export async function failStaleCollabUploads(olderThanMs: number): Promise<number> {
  const cutoff = new Date(Date.now() - olderThanMs);
  const [a, b] = await prisma.$transaction([
    prisma.collabProjectFile.updateMany({
      where: {
        upload_status: CollabUploadStatus.UPLOADING,
        created_at: { lt: cutoff },
      },
      data: { upload_status: CollabUploadStatus.FAILED },
    }),
    prisma.collabProjectReplyFile.updateMany({
      where: {
        upload_status: CollabUploadStatus.UPLOADING,
        created_at: { lt: cutoff },
      },
      data: { upload_status: CollabUploadStatus.FAILED },
    }),
  ]);
  return a.count + b.count;
}
