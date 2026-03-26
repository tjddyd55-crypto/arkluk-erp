import { PrismaClient, ProductCategory, Role, SupplierStatus } from "@prisma/client";
import bcrypt from "bcryptjs";
import { mkdir, writeFile } from "fs/promises";
import path from "path";

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash("ChangeMe123!", 12);

  const countries = await Promise.all([
    prisma.country.upsert({
      where: { country_code: "MN" },
      update: { country_name: "Mongolia", is_active: true },
      create: { country_code: "MN", country_name: "Mongolia", is_active: true },
    }),
    prisma.country.upsert({
      where: { country_code: "KZ" },
      update: { country_name: "Kazakhstan", is_active: true },
      create: { country_code: "KZ", country_name: "Kazakhstan", is_active: true },
    }),
    prisma.country.upsert({
      where: { country_code: "SA" },
      update: { country_name: "Saudi Arabia", is_active: true },
      create: { country_code: "SA", country_name: "Saudi Arabia", is_active: true },
    }),
  ]);

  const supplierA = await prisma.supplier.upsert({
    where: { supplier_code: "SUP-A" },
    update: {
      company_name: "A 건축자재",
      company_code: "SUP-A",
      country_code: "KR",
      business_number: "100-01-00001",
      representative_name: "홍길동",
      contact_name: "A담당자",
      contact_email: "supplier-a@example.com",
      contact_phone: "010-1111-1111",
      address: "서울시 공급구 A로 1",
      status: SupplierStatus.ACTIVE,
      supplier_name: "A 건축자재",
      order_email: "supplier-a@example.com",
      invoice_sender_email: "invoice@acompany.com",
      is_active: true,
    },
    create: {
      company_name: "A 건축자재",
      company_code: "SUP-A",
      country_code: "KR",
      business_number: "100-01-00001",
      representative_name: "홍길동",
      contact_name: "A담당자",
      contact_email: "supplier-a@example.com",
      contact_phone: "010-1111-1111",
      address: "서울시 공급구 A로 1",
      status: SupplierStatus.ACTIVE,
      supplier_code: "SUP-A",
      supplier_name: "A 건축자재",
      order_email: "supplier-a@example.com",
      cc_email: "supplier-a-cc@example.com",
      invoice_sender_email: "invoice@acompany.com",
      is_active: true,
    },
  });

  const supplierB = await prisma.supplier.upsert({
    where: { supplier_code: "SUP-B" },
    update: {
      company_name: "B 건축자재",
      company_code: "SUP-B",
      country_code: "KR",
      business_number: "200-02-00002",
      representative_name: "김철수",
      contact_name: "B담당자",
      contact_email: "supplier-b@example.com",
      contact_phone: "010-2222-2222",
      address: "경기도 자재시 B길 2",
      status: SupplierStatus.ACTIVE,
      supplier_name: "B 건축자재",
      order_email: "supplier-b@example.com",
      invoice_sender_email: "tax@bcompany.com",
      is_active: true,
    },
    create: {
      company_name: "B 건축자재",
      company_code: "SUP-B",
      country_code: "KR",
      business_number: "200-02-00002",
      representative_name: "김철수",
      contact_name: "B담당자",
      contact_email: "supplier-b@example.com",
      contact_phone: "010-2222-2222",
      address: "경기도 자재시 B길 2",
      status: SupplierStatus.ACTIVE,
      supplier_code: "SUP-B",
      supplier_name: "B 건축자재",
      order_email: "supplier-b@example.com",
      cc_email: "supplier-b-cc@example.com",
      invoice_sender_email: "tax@bcompany.com",
      is_active: true,
    },
  });

  await Promise.all([
    prisma.supplierInvoiceSender.upsert({
      where: { sender_email: "invoice@acompany.com" },
      update: {
        supplier_id: supplierA.id,
        is_active: true,
      },
      create: {
        supplier_id: supplierA.id,
        sender_email: "invoice@acompany.com",
        is_active: true,
      },
    }),
    prisma.supplierInvoiceSender.upsert({
      where: { sender_email: "tax@acompany.com" },
      update: {
        supplier_id: supplierA.id,
        is_active: true,
      },
      create: {
        supplier_id: supplierA.id,
        sender_email: "tax@acompany.com",
        is_active: true,
      },
    }),
    prisma.supplierInvoiceSender.upsert({
      where: { sender_email: "tax@bcompany.com" },
      update: {
        supplier_id: supplierB.id,
        is_active: true,
      },
      create: {
        supplier_id: supplierB.id,
        sender_email: "tax@bcompany.com",
        is_active: true,
      },
    }),
  ]);

  const existingDefaultTemplate = await prisma.purchaseOrderTemplate.findFirst({
    where: { is_default: true },
    orderBy: { id: "asc" },
  });
  const defaultTemplate = existingDefaultTemplate
    ? await prisma.purchaseOrderTemplate.update({
        where: { id: existingDefaultTemplate.id },
        data: {
          template_name: "기본 발주 템플릿",
          title_ko: "발주서",
          title_en: "Purchase Order",
          buyer_name: "우리 회사명",
          footer_note: "본 발주서는 시스템에서 자동 생성되었습니다.",
          is_default: true,
          is_active: true,
          supplier_id: null,
        },
      })
    : await prisma.purchaseOrderTemplate.create({
        data: {
          template_name: "기본 발주 템플릿",
          title_ko: "발주서",
          title_en: "Purchase Order",
          buyer_name: "우리 회사명",
          footer_note: "본 발주서는 시스템에서 자동 생성되었습니다.",
          is_default: true,
          is_active: true,
          supplier_id: null,
        },
      });

  const existingSupplierATemplate = await prisma.purchaseOrderTemplate.findFirst({
    where: {
      supplier_id: supplierA.id,
      template_name: "A회사 전용 발주 템플릿",
    },
    orderBy: { id: "asc" },
  });
  if (existingSupplierATemplate) {
    await prisma.purchaseOrderTemplate.update({
      where: { id: existingSupplierATemplate.id },
      data: {
        supplier_id: supplierA.id,
        template_name: "A회사 전용 발주 템플릿",
        title_ko: "A회사 전용 발주서",
        title_en: "A Supplier Purchase Order",
        buyer_name: "ARKLUX KOREA",
        footer_note: "A회사 전용 발주 안내 문구",
        is_default: false,
        is_active: true,
      },
    });
  } else {
    await prisma.purchaseOrderTemplate.create({
      data: {
        supplier_id: supplierA.id,
        template_name: "A회사 전용 발주 템플릿",
        title_ko: "A회사 전용 발주서",
        title_en: "A Supplier Purchase Order",
        buyer_name: "ARKLUX KOREA",
        footer_note: "A회사 전용 발주 안내 문구",
        is_default: false,
        is_active: true,
      },
    });
  }

  await prisma.purchaseOrderTemplate.updateMany({
    where: {
      id: { not: defaultTemplate.id },
      is_default: true,
    },
    data: { is_default: false },
  });

  const categories = await Promise.all([
    prisma.category.upsert({
      where: {
        supplier_id_category_name: {
          supplier_id: supplierA.id,
          category_name: "배관",
        },
      },
      update: { sort_order: 1, is_active: true },
      create: {
        supplier_id: supplierA.id,
        category_name: "배관",
        sort_order: 1,
        is_active: true,
      },
    }),
    prisma.category.upsert({
      where: {
        supplier_id_category_name: {
          supplier_id: supplierA.id,
          category_name: "타일",
        },
      },
      update: { sort_order: 2, is_active: true },
      create: {
        supplier_id: supplierA.id,
        category_name: "타일",
        sort_order: 2,
        is_active: true,
      },
    }),
    prisma.category.upsert({
      where: {
        supplier_id_category_name: {
          supplier_id: supplierB.id,
          category_name: "위생도기",
        },
      },
      update: { sort_order: 1, is_active: true },
      create: {
        supplier_id: supplierB.id,
        category_name: "위생도기",
        sort_order: 1,
        is_active: true,
      },
    }),
  ]);

  const [aPipe, aTile, bSanitary] = categories;

  await Promise.all([
    prisma.product.upsert({
      where: {
        supplier_id_product_code: {
          supplier_id: supplierA.id,
          product_code: "A-PIPE-50",
        },
      },
      update: {
        category_id: aPipe.id,
        productCategory: ProductCategory.CONSTRUCTION,
        country_code: supplierA.country_code,
        name_original: "PVC 배관 50mm",
        source_language: "ko",
        name: "PVC 배관 50mm",
        product_name: "PVC 배관 50mm",
        spec: "50mm",
        unit: "EA",
        price: 12000,
      },
      create: {
        supplier_id: supplierA.id,
        category_id: aPipe.id,
        productCategory: ProductCategory.CONSTRUCTION,
        country_code: supplierA.country_code,
        name_original: "PVC 배관 50mm",
        source_language: "ko",
        name: "PVC 배관 50mm",
        product_code: "A-PIPE-50",
        product_name: "PVC 배관 50mm",
        spec: "50mm",
        unit: "EA",
        price: 12000,
      },
    }),
    prisma.product.upsert({
      where: {
        supplier_id_product_code: {
          supplier_id: supplierA.id,
          product_code: "A-TILE-WHT",
        },
      },
      update: {
        category_id: aTile.id,
        productCategory: ProductCategory.CONSTRUCTION,
        country_code: supplierA.country_code,
        name_original: "세라믹 타일 화이트",
        source_language: "ko",
        name: "세라믹 타일 화이트",
        product_name: "세라믹 타일 화이트",
        spec: "300x300",
        unit: "BOX",
        price: 45000,
      },
      create: {
        supplier_id: supplierA.id,
        category_id: aTile.id,
        productCategory: ProductCategory.CONSTRUCTION,
        country_code: supplierA.country_code,
        name_original: "세라믹 타일 화이트",
        source_language: "ko",
        name: "세라믹 타일 화이트",
        product_code: "A-TILE-WHT",
        product_name: "세라믹 타일 화이트",
        spec: "300x300",
        unit: "BOX",
        price: 45000,
      },
    }),
    prisma.product.upsert({
      where: {
        supplier_id_product_code: {
          supplier_id: supplierB.id,
          product_code: "B-SAN-BASIC",
        },
      },
      update: {
        category_id: bSanitary.id,
        productCategory: ProductCategory.CONSTRUCTION,
        country_code: supplierB.country_code,
        name_original: "기본형 세면기",
        source_language: "ko",
        name: "기본형 세면기",
        product_name: "기본형 세면기",
        spec: "일반형",
        unit: "EA",
        price: 98000,
      },
      create: {
        supplier_id: supplierB.id,
        category_id: bSanitary.id,
        productCategory: ProductCategory.CONSTRUCTION,
        country_code: supplierB.country_code,
        name_original: "기본형 세면기",
        source_language: "ko",
        name: "기본형 세면기",
        product_code: "B-SAN-BASIC",
        product_name: "기본형 세면기",
        spec: "일반형",
        unit: "EA",
        price: 98000,
      },
    }),
  ]);

  const mnCountry = countries[0];

  const buyerUser = await prisma.user.upsert({
    where: { login_id: "superadmin" },
    update: {
      name: "Super Admin",
      role: Role.SUPER_ADMIN,
      password_hash: passwordHash,
      is_active: true,
    },
    create: {
      login_id: "superadmin",
      password_hash: passwordHash,
      name: "Super Admin",
      role: Role.SUPER_ADMIN,
      is_active: true,
    },
  });

  const superAdminUser = await prisma.user.upsert({
    where: { login_id: "admin01" },
    update: {
      name: "Admin One",
      role: Role.ADMIN,
      password_hash: passwordHash,
      is_active: true,
    },
    create: {
      login_id: "admin01",
      password_hash: passwordHash,
      name: "Admin One",
      role: Role.ADMIN,
      is_active: true,
    },
  });

  await prisma.user.upsert({
    where: { login_id: "korea.supply.01" },
    update: {
      name: "Korea Supply Admin",
      role: Role.KOREA_SUPPLY_ADMIN,
      password_hash: passwordHash,
      is_active: true,
    },
    create: {
      login_id: "korea.supply.01",
      password_hash: passwordHash,
      name: "Korea Supply Admin",
      role: Role.KOREA_SUPPLY_ADMIN,
      is_active: true,
    },
  });

  await prisma.user.upsert({
    where: { login_id: "country.mn.admin" },
    update: {
      name: "Country Admin MN",
      role: Role.COUNTRY_ADMIN,
      country_id: mnCountry.id,
      password_hash: passwordHash,
      is_active: true,
    },
    create: {
      login_id: "country.mn.admin",
      password_hash: passwordHash,
      name: "Country Admin MN",
      role: Role.COUNTRY_ADMIN,
      country_id: mnCountry.id,
      email: "country-admin-mn@example.com",
      is_active: true,
    },
  });

  await prisma.user.upsert({
    where: { login_id: "buyer.mn.01" },
    update: {
      name: "Buyer Mongolia 01",
      role: Role.BUYER,
      country_id: mnCountry.id,
      password_hash: passwordHash,
      is_active: true,
    },
    create: {
      login_id: "buyer.mn.01",
      password_hash: passwordHash,
      name: "Buyer Mongolia 01",
      role: Role.BUYER,
      country_id: mnCountry.id,
      email: "buyer-mn-01@example.com",
      is_active: true,
    },
  });

  await prisma.user.upsert({
    where: { login_id: "supplier.a.01" },
    update: {
      name: "Supplier A",
      role: Role.SUPPLIER,
      supplier_id: supplierA.id,
      password_hash: passwordHash,
      is_active: true,
    },
    create: {
      login_id: "supplier.a.01",
      password_hash: passwordHash,
      name: "Supplier A",
      role: Role.SUPPLIER,
      supplier_id: supplierA.id,
      email: "supplier-a-user@example.com",
      is_active: true,
    },
  });

  await prisma.user.upsert({
    where: { login_id: "supplier.b.01" },
    update: {
      name: "Supplier B",
      role: Role.SUPPLIER,
      supplier_id: supplierB.id,
      password_hash: passwordHash,
      is_active: true,
    },
    create: {
      login_id: "supplier.b.01",
      password_hash: passwordHash,
      name: "Supplier B",
      role: Role.SUPPLIER,
      supplier_id: supplierB.id,
      email: "supplier-b-user@example.com",
      is_active: true,
    },
  });

  const invoiceStorageDir = path.join(process.cwd(), "storage", "invoices");
  await mkdir(invoiceStorageDir, { recursive: true });

  const samplePdfFile = "seed_1001_invoice-a.pdf";
  const sampleXmlFile = "seed_1002_invoice-b.xml";

  await writeFile(
    path.join(invoiceStorageDir, samplePdfFile),
    Buffer.from("%PDF-1.1\n1 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer\n<<>>\n%%EOF"),
  );
  await writeFile(
    path.join(invoiceStorageDir, sampleXmlFile),
    Buffer.from(
      `<?xml version="1.0" encoding="UTF-8"?><invoice><orderNo>ORD-20260312-001</orderNo></invoice>`,
    ),
  );

  const sampleOrder = await prisma.order.upsert({
    where: { order_no: "ORD-20260312-001" },
    update: {
      buyer_id: buyerUser.id,
      country_id: mnCountry.id,
      country_code: mnCountry.country_code,
      status: "REVIEWING",
      memo: "세금계산서 시드 주문",
    },
    create: {
      order_no: "ORD-20260312-001",
      buyer_id: buyerUser.id,
      country_id: mnCountry.id,
      country_code: mnCountry.country_code,
      status: "REVIEWING",
      memo: "세금계산서 시드 주문",
    },
  });

  await prisma.orderSupplier.upsert({
    where: {
      order_id_supplier_id: {
        order_id: sampleOrder.id,
        supplier_id: supplierA.id,
      },
    },
    update: {},
    create: {
      order_id: sampleOrder.id,
      supplier_id: supplierA.id,
      status: "PENDING",
    },
  });

  await prisma.orderSupplier.upsert({
    where: {
      order_id_supplier_id: {
        order_id: sampleOrder.id,
        supplier_id: supplierB.id,
      },
    },
    update: {},
    create: {
      order_id: sampleOrder.id,
      supplier_id: supplierB.id,
      status: "PENDING",
    },
  });

  await prisma.orderItem.deleteMany({
    where: { order_id: sampleOrder.id },
  });

  await prisma.orderItem.createMany({
    data: [
      {
        order_id: sampleOrder.id,
        supplier_id: supplierA.id,
        category_id: aPipe.id,
        product_id: (
          await prisma.product.findUniqueOrThrow({
            where: {
              supplier_id_product_code: {
                supplier_id: supplierA.id,
                product_code: "A-PIPE-50",
              },
            },
            select: { id: true },
          })
        ).id,
        product_code_snapshot: "A-PIPE-50",
        product_name_snapshot: "PVC 배관 50mm",
        spec_snapshot: "50mm",
        unit_snapshot: "EA",
        price_snapshot: 12000,
        qty: 5,
        amount: 60000,
        memo: "시드 주문 A",
      },
      {
        order_id: sampleOrder.id,
        supplier_id: supplierB.id,
        category_id: bSanitary.id,
        product_id: (
          await prisma.product.findUniqueOrThrow({
            where: {
              supplier_id_product_code: {
                supplier_id: supplierB.id,
                product_code: "B-SAN-BASIC",
              },
            },
            select: { id: true },
          })
        ).id,
        product_code_snapshot: "B-SAN-BASIC",
        product_name_snapshot: "기본형 세면기",
        spec_snapshot: "일반형",
        unit_snapshot: "EA",
        price_snapshot: 98000,
        qty: 2,
        amount: 196000,
        memo: "시드 주문 B",
      },
    ],
  });

  const inboxA = await prisma.emailInbox.upsert({
    where: { message_id: "seed-mail-a-001" },
    update: {
      from_email: "invoice@acompany.com",
      to_email: "tax@ourcompany.com",
      subject: "세금계산서 ORD-20260312-001",
      body: "A회사 세금계산서 메일",
      supplier_id: supplierA.id,
      received_at: new Date("2026-03-12T10:00:00Z"),
      attachment_count: 1,
      processed: true,
    },
    create: {
      message_id: "seed-mail-a-001",
      from_email: "invoice@acompany.com",
      to_email: "tax@ourcompany.com",
      subject: "세금계산서 ORD-20260312-001",
      body: "A회사 세금계산서 메일",
      supplier_id: supplierA.id,
      received_at: new Date("2026-03-12T10:00:00Z"),
      attachment_count: 1,
      processed: true,
    },
  });

  const inboxB = await prisma.emailInbox.upsert({
    where: { message_id: "seed-mail-b-001" },
    update: {
      from_email: "tax@bcompany.com",
      to_email: "tax@ourcompany.com",
      subject: "세금계산서 샘플",
      body: "B회사 세금계산서 메일",
      supplier_id: supplierB.id,
      received_at: new Date("2026-03-12T10:05:00Z"),
      attachment_count: 1,
      processed: true,
    },
    create: {
      message_id: "seed-mail-b-001",
      from_email: "tax@bcompany.com",
      to_email: "tax@ourcompany.com",
      subject: "세금계산서 샘플",
      body: "B회사 세금계산서 메일",
      supplier_id: supplierB.id,
      received_at: new Date("2026-03-12T10:05:00Z"),
      attachment_count: 1,
      processed: true,
    },
  });

  const taxInvoiceA = await prisma.taxInvoice.upsert({
    where: { email_inbox_id: inboxA.id },
    update: {
      supplier_id: supplierA.id,
      order_id: sampleOrder.id,
      order_link_type: "MANUAL",
      invoice_number: "SEED-INV-A-001",
    },
    create: {
      supplier_id: supplierA.id,
      order_id: sampleOrder.id,
      order_link_type: "MANUAL",
      invoice_number: "SEED-INV-A-001",
      email_inbox_id: inboxA.id,
    },
  });

  const taxInvoiceB = await prisma.taxInvoice.upsert({
    where: { email_inbox_id: inboxB.id },
    update: {
      supplier_id: supplierB.id,
      order_id: null,
      order_link_type: null,
      invoice_number: "SEED-INV-B-001",
    },
    create: {
      supplier_id: supplierB.id,
      order_id: null,
      order_link_type: null,
      invoice_number: "SEED-INV-B-001",
      email_inbox_id: inboxB.id,
    },
  });

  await prisma.invoiceFile.deleteMany({
    where: {
      invoice_id: {
        in: [taxInvoiceA.id, taxInvoiceB.id],
      },
    },
  });

  await prisma.invoiceFile.createMany({
    data: [
      {
        invoice_id: taxInvoiceA.id,
        file_name: "invoice-a.pdf",
        file_url: `storage/invoices/${samplePdfFile}`,
        file_type: "PDF",
      },
      {
        invoice_id: taxInvoiceB.id,
        file_name: "invoice-b.xml",
        file_url: `storage/invoices/${sampleXmlFile}`,
        file_type: "XML",
      },
    ],
  });

  const purchaseOrderStorageDir = path.join(process.cwd(), "storage", "purchase-orders");
  await mkdir(purchaseOrderStorageDir, { recursive: true });
  const purchaseOrderAFile = `PO_${supplierA.id}_${sampleOrder.order_no}.pdf`;
  const purchaseOrderBFile = `PO_${supplierB.id}_${sampleOrder.order_no}.pdf`;

  await writeFile(
    path.join(purchaseOrderStorageDir, purchaseOrderAFile),
    Buffer.from("%PDF-1.1\n1 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer\n<<>>\n%%EOF"),
  );
  await writeFile(
    path.join(purchaseOrderStorageDir, purchaseOrderBFile),
    Buffer.from("%PDF-1.1\n1 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer\n<<>>\n%%EOF"),
  );

  await prisma.purchaseOrder.upsert({
    where: {
      order_id_supplier_id: {
        order_id: sampleOrder.id,
        supplier_id: supplierA.id,
      },
    },
    update: {
      file_name: purchaseOrderAFile,
      file_url: `storage/purchase-orders/${purchaseOrderAFile}`,
      created_by: superAdminUser.id,
      created_at: new Date("2026-03-12T11:00:00Z"),
    },
    create: {
      order_id: sampleOrder.id,
      supplier_id: supplierA.id,
      file_name: purchaseOrderAFile,
      file_url: `storage/purchase-orders/${purchaseOrderAFile}`,
      created_by: superAdminUser.id,
      created_at: new Date("2026-03-12T11:00:00Z"),
    },
  });

  await prisma.purchaseOrder.upsert({
    where: {
      order_id_supplier_id: {
        order_id: sampleOrder.id,
        supplier_id: supplierB.id,
      },
    },
    update: {
      file_name: purchaseOrderBFile,
      file_url: `storage/purchase-orders/${purchaseOrderBFile}`,
      created_by: superAdminUser.id,
      created_at: new Date("2026-03-12T11:03:00Z"),
    },
    create: {
      order_id: sampleOrder.id,
      supplier_id: supplierB.id,
      file_name: purchaseOrderBFile,
      file_url: `storage/purchase-orders/${purchaseOrderBFile}`,
      created_by: superAdminUser.id,
      created_at: new Date("2026-03-12T11:03:00Z"),
    },
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
