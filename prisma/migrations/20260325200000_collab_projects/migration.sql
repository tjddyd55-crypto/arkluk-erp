-- 바이어 협업 프로젝트(제안/파일) — 기존 "Project" 견적 도메인과 별도

CREATE TYPE "CollabProjectStatus" AS ENUM ('DRAFT', 'OPEN', 'CLOSED', 'ARCHIVED');
CREATE TYPE "CollabUploadStatus" AS ENUM ('UPLOADING', 'COMPLETED', 'FAILED', 'DELETED');
CREATE TYPE "CollabReplyVisibility" AS ENUM ('PRIVATE');
CREATE TYPE "CollabAuthorPartyType" AS ENUM ('SUPPLIER', 'INTERIOR', 'LIGHTING', 'OTHER');
CREATE TYPE "CollabParticipantStatus" AS ENUM ('INVITED', 'ACCEPTED', 'REJECTED');

CREATE TABLE "collab_projects" (
    "id" SERIAL NOT NULL,
    "buyer_id" INTEGER NOT NULL,
    "organization_id" INTEGER,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "status" "CollabProjectStatus" NOT NULL DEFAULT 'DRAFT',
    "created_by_user_id" INTEGER NOT NULL,
    "legacy_project_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "collab_projects_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "collab_project_files" (
    "id" SERIAL NOT NULL,
    "project_id" INTEGER NOT NULL,
    "storage_key" TEXT,
    "original_filename" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "size_bytes" BIGINT NOT NULL,
    "ext" TEXT,
    "checksum_sha256" TEXT,
    "r2_etag" TEXT,
    "upload_status" "CollabUploadStatus" NOT NULL DEFAULT 'UPLOADING',
    "uploaded_by_user_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "collab_project_files_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "collab_project_files_storage_key_key" ON "collab_project_files"("storage_key");

CREATE TABLE "collab_project_replies" (
    "id" SERIAL NOT NULL,
    "project_id" INTEGER NOT NULL,
    "body" TEXT NOT NULL,
    "author_user_id" INTEGER NOT NULL,
    "author_supplier_id" INTEGER,
    "author_party_type" "CollabAuthorPartyType",
    "visibility" "CollabReplyVisibility" NOT NULL DEFAULT 'PRIVATE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "collab_project_replies_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "collab_project_reply_files" (
    "id" SERIAL NOT NULL,
    "reply_id" INTEGER NOT NULL,
    "storage_key" TEXT,
    "original_filename" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "size_bytes" BIGINT NOT NULL,
    "ext" TEXT,
    "checksum_sha256" TEXT,
    "r2_etag" TEXT,
    "upload_status" "CollabUploadStatus" NOT NULL DEFAULT 'UPLOADING',
    "uploaded_by_user_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "collab_project_reply_files_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "collab_project_reply_files_storage_key_key" ON "collab_project_reply_files"("storage_key");

CREATE TABLE "collab_project_participants" (
    "id" SERIAL NOT NULL,
    "project_id" INTEGER NOT NULL,
    "supplier_id" INTEGER NOT NULL,
    "status" "CollabParticipantStatus" NOT NULL DEFAULT 'INVITED',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "collab_project_participants_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "collab_project_participants_project_id_supplier_id_key" ON "collab_project_participants"("project_id", "supplier_id");

ALTER TABLE "collab_projects" ADD CONSTRAINT "collab_projects_buyer_id_fkey" FOREIGN KEY ("buyer_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "collab_projects" ADD CONSTRAINT "collab_projects_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "collab_projects" ADD CONSTRAINT "collab_projects_legacy_project_id_fkey" FOREIGN KEY ("legacy_project_id") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "collab_project_files" ADD CONSTRAINT "collab_project_files_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "collab_projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "collab_project_files" ADD CONSTRAINT "collab_project_files_uploaded_by_user_id_fkey" FOREIGN KEY ("uploaded_by_user_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "collab_project_replies" ADD CONSTRAINT "collab_project_replies_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "collab_projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "collab_project_replies" ADD CONSTRAINT "collab_project_replies_author_user_id_fkey" FOREIGN KEY ("author_user_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "collab_project_replies" ADD CONSTRAINT "collab_project_replies_author_supplier_id_fkey" FOREIGN KEY ("author_supplier_id") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "collab_project_reply_files" ADD CONSTRAINT "collab_project_reply_files_reply_id_fkey" FOREIGN KEY ("reply_id") REFERENCES "collab_project_replies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "collab_project_reply_files" ADD CONSTRAINT "collab_project_reply_files_uploaded_by_user_id_fkey" FOREIGN KEY ("uploaded_by_user_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "collab_project_participants" ADD CONSTRAINT "collab_project_participants_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "collab_projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "collab_project_participants" ADD CONSTRAINT "collab_project_participants_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "collab_projects_buyer_id_created_at_idx" ON "collab_projects"("buyer_id", "created_at" DESC);
CREATE INDEX "collab_projects_status_created_at_idx" ON "collab_projects"("status", "created_at" DESC);
CREATE INDEX "collab_projects_organization_id_created_at_idx" ON "collab_projects"("organization_id", "created_at" DESC);

CREATE INDEX "collab_project_files_project_id_created_at_idx" ON "collab_project_files"("project_id", "created_at" DESC);
CREATE INDEX "collab_project_files_project_id_upload_status_idx" ON "collab_project_files"("project_id", "upload_status");

CREATE INDEX "collab_project_replies_project_id_created_at_idx" ON "collab_project_replies"("project_id", "created_at" DESC);
CREATE INDEX "collab_project_replies_author_supplier_id_project_id_created_idx" ON "collab_project_replies"("author_supplier_id", "project_id", "created_at" DESC);
CREATE INDEX "collab_project_replies_project_id_author_supplier_id_idx" ON "collab_project_replies"("project_id", "author_supplier_id");

CREATE INDEX "collab_project_reply_files_reply_id_created_at_idx" ON "collab_project_reply_files"("reply_id", "created_at" DESC);
CREATE INDEX "collab_project_reply_files_reply_id_upload_status_idx" ON "collab_project_reply_files"("reply_id", "upload_status");
