-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('SUPER_ADMIN', 'ADMIN', 'BUYER', 'SUPPLIER');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('PENDING', 'REVIEWING', 'PARTIAL_SENT', 'SENT', 'CANCELLED');

-- CreateEnum
CREATE TYPE "OrderSupplierStatus" AS ENUM ('WAITING', 'SENT', 'SUPPLIER_CONFIRMED', 'DELIVERING', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "QuoteCreatorRole" AS ENUM ('ADMIN', 'SUPPLIER');

-- CreateEnum
CREATE TYPE "QuoteStatus" AS ENUM ('DRAFT', 'SENT', 'VIEWED', 'ACCEPTED', 'REJECTED');

-- CreateEnum
CREATE TYPE "EmailRelatedType" AS ENUM ('ORDER', 'QUOTE');

-- CreateEnum
CREATE TYPE "EmailStatus" AS ENUM ('SUCCESS', 'FAILED', 'PENDING');

-- CreateEnum
CREATE TYPE "InvoiceFileType" AS ENUM ('PDF', 'XML');

-- CreateEnum
CREATE TYPE "InvoiceOrderLinkType" AS ENUM ('AUTO', 'MANUAL');

-- CreateEnum
CREATE TYPE "ProjectStatus" AS ENUM ('DRAFT', 'QUOTING', 'QUOTED', 'ORDERING', 'ACTIVE', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ProjectFileType" AS ENUM ('PDF', 'DWG', 'ZIP', 'PNG', 'JPG', 'JPEG');

-- CreateTable
CREATE TABLE "Country" (
    "id" SERIAL NOT NULL,
    "country_code" TEXT NOT NULL,
    "country_name" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Country_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Supplier" (
    "id" SERIAL NOT NULL,
    "supplier_code" TEXT,
    "supplier_name" TEXT NOT NULL,
    "order_email" TEXT NOT NULL,
    "cc_email" TEXT,
    "invoice_sender_email" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "allow_supplier_product_edit" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Supplier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupplierInvoiceSender" (
    "id" SERIAL NOT NULL,
    "supplier_id" INTEGER NOT NULL,
    "sender_email" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupplierInvoiceSender_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Category" (
    "id" SERIAL NOT NULL,
    "supplier_id" INTEGER NOT NULL,
    "category_name" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Product" (
    "id" SERIAL NOT NULL,
    "supplier_id" INTEGER NOT NULL,
    "category_id" INTEGER NOT NULL,
    "product_code" TEXT NOT NULL,
    "product_name" TEXT NOT NULL,
    "product_image_url" TEXT,
    "spec" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "price" DECIMAL(18,2) NOT NULL,
    "memo" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" SERIAL NOT NULL,
    "login_id" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "role" "Role" NOT NULL,
    "country_id" INTEGER,
    "supplier_id" INTEGER,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Project" (
    "id" SERIAL NOT NULL,
    "project_name" TEXT NOT NULL,
    "buyer_id" INTEGER NOT NULL,
    "country_id" INTEGER NOT NULL,
    "status" "ProjectStatus" NOT NULL DEFAULT 'DRAFT',
    "memo" TEXT,
    "location" TEXT,
    "start_date" TIMESTAMP(3),
    "end_date" TIMESTAMP(3),
    "created_by" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectFile" (
    "id" SERIAL NOT NULL,
    "project_id" INTEGER NOT NULL,
    "file_name" TEXT NOT NULL,
    "original_name" TEXT NOT NULL,
    "file_size" INTEGER NOT NULL,
    "file_type" "ProjectFileType" NOT NULL,
    "file_url" TEXT NOT NULL,
    "uploaded_by" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectFile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Order" (
    "id" SERIAL NOT NULL,
    "order_no" TEXT NOT NULL,
    "buyer_id" INTEGER NOT NULL,
    "country_id" INTEGER NOT NULL,
    "project_id" INTEGER,
    "status" "OrderStatus" NOT NULL DEFAULT 'PENDING',
    "memo" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderItem" (
    "id" SERIAL NOT NULL,
    "order_id" INTEGER NOT NULL,
    "supplier_id" INTEGER NOT NULL,
    "category_id" INTEGER,
    "product_id" INTEGER NOT NULL,
    "product_code_snapshot" TEXT NOT NULL,
    "product_name_snapshot" TEXT NOT NULL,
    "spec_snapshot" TEXT NOT NULL,
    "unit_snapshot" TEXT NOT NULL,
    "price_snapshot" DECIMAL(18,2) NOT NULL,
    "qty" DECIMAL(18,3) NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "memo" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderSupplier" (
    "id" SERIAL NOT NULL,
    "order_id" INTEGER NOT NULL,
    "supplier_id" INTEGER NOT NULL,
    "status" "OrderSupplierStatus" NOT NULL DEFAULT 'WAITING',
    "sent_at" TIMESTAMP(3),
    "sent_by" INTEGER,
    "email_sent" BOOLEAN NOT NULL DEFAULT false,
    "portal_visible" BOOLEAN NOT NULL DEFAULT false,
    "supplier_checked" BOOLEAN NOT NULL DEFAULT false,
    "supplier_checked_at" TIMESTAMP(3),
    "supplier_checked_by" INTEGER,
    "supplier_confirmed_at" TIMESTAMP(3),
    "expected_delivery_date" TIMESTAMP(3),
    "supplier_note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrderSupplier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Quote" (
    "id" SERIAL NOT NULL,
    "quote_no" TEXT NOT NULL,
    "buyer_id" INTEGER NOT NULL,
    "country_id" INTEGER NOT NULL,
    "project_id" INTEGER,
    "created_by" INTEGER NOT NULL,
    "creator_role" "QuoteCreatorRole" NOT NULL,
    "supplier_id" INTEGER,
    "status" "QuoteStatus" NOT NULL DEFAULT 'DRAFT',
    "memo" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Quote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuoteItem" (
    "id" SERIAL NOT NULL,
    "quote_id" INTEGER NOT NULL,
    "supplier_id" INTEGER NOT NULL,
    "category_id" INTEGER,
    "product_id" INTEGER NOT NULL,
    "product_code_snapshot" TEXT NOT NULL,
    "product_name_snapshot" TEXT NOT NULL,
    "spec_snapshot" TEXT NOT NULL,
    "unit_snapshot" TEXT NOT NULL,
    "price_snapshot" DECIMAL(18,2) NOT NULL,
    "qty" DECIMAL(18,3) NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QuoteItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailLog" (
    "id" SERIAL NOT NULL,
    "related_type" "EmailRelatedType" NOT NULL,
    "related_id" INTEGER NOT NULL,
    "supplier_id" INTEGER,
    "to_email" TEXT NOT NULL,
    "cc_email" TEXT,
    "subject" TEXT NOT NULL,
    "body_preview" TEXT,
    "status" "EmailStatus" NOT NULL DEFAULT 'PENDING',
    "error_message" TEXT,
    "sent_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailInbox" (
    "id" SERIAL NOT NULL,
    "message_id" TEXT,
    "from_email" TEXT NOT NULL,
    "to_email" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT,
    "supplier_id" INTEGER,
    "received_at" TIMESTAMP(3) NOT NULL,
    "attachment_count" INTEGER NOT NULL DEFAULT 0,
    "processed" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailInbox_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaxInvoice" (
    "id" SERIAL NOT NULL,
    "supplier_id" INTEGER,
    "order_id" INTEGER,
    "order_link_type" "InvoiceOrderLinkType",
    "invoice_number" TEXT,
    "email_inbox_id" INTEGER NOT NULL,
    "issue_date" TIMESTAMP(3),
    "amount" DECIMAL(18,2),
    "vat" DECIMAL(18,2),
    "total" DECIMAL(18,2),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TaxInvoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvoiceFile" (
    "id" SERIAL NOT NULL,
    "invoice_id" INTEGER NOT NULL,
    "file_name" TEXT NOT NULL,
    "file_url" TEXT NOT NULL,
    "file_type" "InvoiceFileType" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InvoiceFile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseOrder" (
    "id" SERIAL NOT NULL,
    "order_id" INTEGER NOT NULL,
    "supplier_id" INTEGER NOT NULL,
    "file_name" TEXT NOT NULL,
    "file_url" TEXT NOT NULL,
    "created_by" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PurchaseOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseOrderTemplate" (
    "id" SERIAL NOT NULL,
    "supplier_id" INTEGER,
    "template_name" TEXT NOT NULL,
    "title_ko" TEXT NOT NULL DEFAULT '발주서',
    "title_en" TEXT NOT NULL DEFAULT 'Purchase Order',
    "buyer_name" TEXT,
    "footer_note" TEXT,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PurchaseOrderTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" SERIAL NOT NULL,
    "actor_id" INTEGER NOT NULL,
    "action_type" TEXT NOT NULL,
    "target_type" TEXT NOT NULL,
    "target_id" INTEGER NOT NULL,
    "before_data" JSONB,
    "after_data" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderChangeLog" (
    "id" SERIAL NOT NULL,
    "order_id" INTEGER NOT NULL,
    "order_item_id" INTEGER,
    "action_type" TEXT NOT NULL,
    "before_data" JSONB,
    "after_data" JSONB,
    "changed_by" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderChangeLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Country_country_code_key" ON "Country"("country_code");

-- CreateIndex
CREATE UNIQUE INDEX "Supplier_supplier_code_key" ON "Supplier"("supplier_code");

-- CreateIndex
CREATE INDEX "SupplierInvoiceSender_supplier_id_is_active_idx" ON "SupplierInvoiceSender"("supplier_id", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "SupplierInvoiceSender_sender_email_key" ON "SupplierInvoiceSender"("sender_email");

-- CreateIndex
CREATE INDEX "Category_supplier_id_is_active_idx" ON "Category"("supplier_id", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "Category_supplier_id_category_name_key" ON "Category"("supplier_id", "category_name");

-- CreateIndex
CREATE INDEX "Product_supplier_id_category_id_is_active_idx" ON "Product"("supplier_id", "category_id", "is_active");

-- CreateIndex
CREATE INDEX "Product_product_name_idx" ON "Product"("product_name");

-- CreateIndex
CREATE UNIQUE INDEX "Product_supplier_id_product_code_key" ON "Product"("supplier_id", "product_code");

-- CreateIndex
CREATE UNIQUE INDEX "User_login_id_key" ON "User"("login_id");

-- CreateIndex
CREATE INDEX "User_role_is_active_idx" ON "User"("role", "is_active");

-- CreateIndex
CREATE INDEX "User_country_id_idx" ON "User"("country_id");

-- CreateIndex
CREATE INDEX "User_supplier_id_idx" ON "User"("supplier_id");

-- CreateIndex
CREATE INDEX "Project_buyer_id_country_id_status_idx" ON "Project"("buyer_id", "country_id", "status");

-- CreateIndex
CREATE INDEX "Project_created_by_created_at_idx" ON "Project"("created_by", "created_at");

-- CreateIndex
CREATE INDEX "ProjectFile_project_id_created_at_idx" ON "ProjectFile"("project_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "Order_order_no_key" ON "Order"("order_no");

-- CreateIndex
CREATE INDEX "Order_buyer_id_country_id_status_idx" ON "Order"("buyer_id", "country_id", "status");

-- CreateIndex
CREATE INDEX "Order_project_id_idx" ON "Order"("project_id");

-- CreateIndex
CREATE INDEX "OrderItem_order_id_supplier_id_idx" ON "OrderItem"("order_id", "supplier_id");

-- CreateIndex
CREATE INDEX "OrderItem_product_id_idx" ON "OrderItem"("product_id");

-- CreateIndex
CREATE INDEX "OrderSupplier_status_idx" ON "OrderSupplier"("status");

-- CreateIndex
CREATE UNIQUE INDEX "OrderSupplier_order_id_supplier_id_key" ON "OrderSupplier"("order_id", "supplier_id");

-- CreateIndex
CREATE UNIQUE INDEX "Quote_quote_no_key" ON "Quote"("quote_no");

-- CreateIndex
CREATE INDEX "Quote_buyer_id_country_id_status_idx" ON "Quote"("buyer_id", "country_id", "status");

-- CreateIndex
CREATE INDEX "Quote_project_id_idx" ON "Quote"("project_id");

-- CreateIndex
CREATE INDEX "QuoteItem_quote_id_supplier_id_idx" ON "QuoteItem"("quote_id", "supplier_id");

-- CreateIndex
CREATE INDEX "EmailLog_related_type_related_id_idx" ON "EmailLog"("related_type", "related_id");

-- CreateIndex
CREATE UNIQUE INDEX "EmailInbox_message_id_key" ON "EmailInbox"("message_id");

-- CreateIndex
CREATE INDEX "EmailInbox_from_email_received_at_idx" ON "EmailInbox"("from_email", "received_at");

-- CreateIndex
CREATE INDEX "EmailInbox_supplier_id_received_at_idx" ON "EmailInbox"("supplier_id", "received_at");

-- CreateIndex
CREATE UNIQUE INDEX "TaxInvoice_email_inbox_id_key" ON "TaxInvoice"("email_inbox_id");

-- CreateIndex
CREATE INDEX "TaxInvoice_supplier_id_created_at_idx" ON "TaxInvoice"("supplier_id", "created_at");

-- CreateIndex
CREATE INDEX "TaxInvoice_order_id_idx" ON "TaxInvoice"("order_id");

-- CreateIndex
CREATE INDEX "InvoiceFile_invoice_id_file_type_idx" ON "InvoiceFile"("invoice_id", "file_type");

-- CreateIndex
CREATE INDEX "PurchaseOrder_supplier_id_created_at_idx" ON "PurchaseOrder"("supplier_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "PurchaseOrder_order_id_supplier_id_key" ON "PurchaseOrder"("order_id", "supplier_id");

-- CreateIndex
CREATE INDEX "PurchaseOrderTemplate_supplier_id_is_active_idx" ON "PurchaseOrderTemplate"("supplier_id", "is_active");

-- CreateIndex
CREATE INDEX "PurchaseOrderTemplate_is_default_is_active_idx" ON "PurchaseOrderTemplate"("is_default", "is_active");

-- CreateIndex
CREATE INDEX "AuditLog_target_type_target_id_idx" ON "AuditLog"("target_type", "target_id");

-- CreateIndex
CREATE INDEX "AuditLog_actor_id_created_at_idx" ON "AuditLog"("actor_id", "created_at");

-- CreateIndex
CREATE INDEX "OrderChangeLog_order_id_created_at_idx" ON "OrderChangeLog"("order_id", "created_at");

-- AddForeignKey
ALTER TABLE "SupplierInvoiceSender" ADD CONSTRAINT "SupplierInvoiceSender_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Category" ADD CONSTRAINT "Category_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_country_id_fkey" FOREIGN KEY ("country_id") REFERENCES "Country"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_buyer_id_fkey" FOREIGN KEY ("buyer_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_country_id_fkey" FOREIGN KEY ("country_id") REFERENCES "Country"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectFile" ADD CONSTRAINT "ProjectFile_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectFile" ADD CONSTRAINT "ProjectFile_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_buyer_id_fkey" FOREIGN KEY ("buyer_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_country_id_fkey" FOREIGN KEY ("country_id") REFERENCES "Country"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderSupplier" ADD CONSTRAINT "OrderSupplier_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderSupplier" ADD CONSTRAINT "OrderSupplier_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderSupplier" ADD CONSTRAINT "OrderSupplier_sent_by_fkey" FOREIGN KEY ("sent_by") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderSupplier" ADD CONSTRAINT "OrderSupplier_supplier_checked_by_fkey" FOREIGN KEY ("supplier_checked_by") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Quote" ADD CONSTRAINT "Quote_buyer_id_fkey" FOREIGN KEY ("buyer_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Quote" ADD CONSTRAINT "Quote_country_id_fkey" FOREIGN KEY ("country_id") REFERENCES "Country"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Quote" ADD CONSTRAINT "Quote_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Quote" ADD CONSTRAINT "Quote_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Quote" ADD CONSTRAINT "Quote_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuoteItem" ADD CONSTRAINT "QuoteItem_quote_id_fkey" FOREIGN KEY ("quote_id") REFERENCES "Quote"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuoteItem" ADD CONSTRAINT "QuoteItem_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuoteItem" ADD CONSTRAINT "QuoteItem_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuoteItem" ADD CONSTRAINT "QuoteItem_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailLog" ADD CONSTRAINT "EmailLog_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailInbox" ADD CONSTRAINT "EmailInbox_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaxInvoice" ADD CONSTRAINT "TaxInvoice_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaxInvoice" ADD CONSTRAINT "TaxInvoice_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaxInvoice" ADD CONSTRAINT "TaxInvoice_email_inbox_id_fkey" FOREIGN KEY ("email_inbox_id") REFERENCES "EmailInbox"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceFile" ADD CONSTRAINT "InvoiceFile_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "TaxInvoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrderTemplate" ADD CONSTRAINT "PurchaseOrderTemplate_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderChangeLog" ADD CONSTRAINT "OrderChangeLog_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderChangeLog" ADD CONSTRAINT "OrderChangeLog_order_item_id_fkey" FOREIGN KEY ("order_item_id") REFERENCES "OrderItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderChangeLog" ADD CONSTRAINT "OrderChangeLog_changed_by_fkey" FOREIGN KEY ("changed_by") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

