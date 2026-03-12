import { Prisma, ProjectFileType, ProjectStatus, Role } from "@prisma/client";

import { HttpError } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { createAuditLog } from "@/server/services/audit-log";

type ProjectFilterInput = {
  countryId?: number;
  buyerId?: number;
  status?: ProjectStatus;
  keyword?: string;
  dateFrom?: Date;
  dateTo?: Date;
};

type CreateProjectInput = {
  projectName: string;
  buyerId: number;
  countryId: number;
  memo?: string | null;
  location?: string | null;
  startDate?: Date | null;
  endDate?: Date | null;
  status?: ProjectStatus;
};

type UpdateProjectInput = {
  projectName?: string;
  buyerId?: number;
  countryId?: number;
  memo?: string | null;
  location?: string | null;
  startDate?: Date | null;
  endDate?: Date | null;
  status?: ProjectStatus;
};

type ProjectFileCreateInput = {
  projectId: number;
  fileName: string;
  originalName: string;
  fileUrl: string;
  fileSize: number;
  fileType: ProjectFileType;
  uploadedBy: number;
};

const PROJECT_STATUS_FLOW: ProjectStatus[] = [
  ProjectStatus.DRAFT,
  ProjectStatus.QUOTING,
  ProjectStatus.QUOTED,
  ProjectStatus.ORDERING,
  ProjectStatus.ACTIVE,
  ProjectStatus.COMPLETED,
];

function buildProjectWhere(filters: ProjectFilterInput): Prisma.ProjectWhereInput {
  return {
    ...(filters.countryId ? { country_id: filters.countryId } : {}),
    ...(filters.buyerId ? { buyer_id: filters.buyerId } : {}),
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.keyword
      ? {
          project_name: {
            contains: filters.keyword,
            mode: Prisma.QueryMode.insensitive,
          },
        }
      : {}),
    ...(filters.dateFrom || filters.dateTo
      ? {
          created_at: {
            ...(filters.dateFrom ? { gte: filters.dateFrom } : {}),
            ...(filters.dateTo ? { lte: filters.dateTo } : {}),
          },
        }
      : {}),
  };
}

function canTransitionProjectStatus(current: ProjectStatus, next: ProjectStatus) {
  if (current === next) {
    return true;
  }
  if (current === ProjectStatus.COMPLETED) {
    return false;
  }
  if (next === ProjectStatus.CANCELLED) {
    return true;
  }

  const currentIndex = PROJECT_STATUS_FLOW.indexOf(current);
  const nextIndex = PROJECT_STATUS_FLOW.indexOf(next);
  if (currentIndex < 0 || nextIndex < 0) {
    return false;
  }
  return nextIndex >= currentIndex;
}

async function getBuyerForProject(buyerId: number) {
  const buyer = await prisma.user.findUnique({
    where: { id: buyerId },
    select: { id: true, role: true, country_id: true, is_active: true },
  });

  if (!buyer || !buyer.is_active || buyer.role !== Role.BUYER) {
    throw new HttpError(400, "유효한 바이어가 아닙니다.");
  }
  return buyer;
}

export async function assertProjectForBuyer(projectId: number, buyerId: number) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
  });
  if (!project || project.buyer_id !== buyerId) {
    throw new HttpError(404, "프로젝트를 찾을 수 없습니다.");
  }
  return project;
}

export async function listAdminProjects(filters: ProjectFilterInput) {
  return prisma.project.findMany({
    where: buildProjectWhere(filters),
    include: {
      buyer: true,
      country: true,
      creator: {
        select: { id: true, name: true, login_id: true },
      },
      _count: {
        select: { quotes: true, orders: true, files: true },
      },
    },
    orderBy: [{ created_at: "desc" }],
  });
}

export async function listBuyerProjects(buyerId: number, filters: Omit<ProjectFilterInput, "buyerId">) {
  return prisma.project.findMany({
    where: buildProjectWhere({
      ...filters,
      buyerId,
    }),
    include: {
      country: true,
      _count: {
        select: { quotes: true, orders: true, files: true },
      },
    },
    orderBy: [{ created_at: "desc" }],
  });
}

export async function createProject(actorId: number, input: CreateProjectInput) {
  const buyer = await getBuyerForProject(input.buyerId);
  if (buyer.country_id !== input.countryId) {
    throw new HttpError(400, "바이어 국가와 프로젝트 국가가 일치해야 합니다.");
  }

  const status = input.status ?? ProjectStatus.DRAFT;
  if (status === ProjectStatus.CANCELLED || status === ProjectStatus.COMPLETED) {
    throw new HttpError(400, "초기 프로젝트 상태로 사용할 수 없습니다.");
  }

  return prisma.$transaction(async (tx) => {
    const project = await tx.project.create({
      data: {
        project_name: input.projectName.trim(),
        buyer_id: input.buyerId,
        country_id: input.countryId,
        status,
        memo: input.memo ?? null,
        location: input.location ?? null,
        start_date: input.startDate ?? null,
        end_date: input.endDate ?? null,
        created_by: actorId,
      },
      include: {
        buyer: true,
        country: true,
        creator: true,
      },
    });

    await createAuditLog(
      {
        actorId,
        actionType: "CREATE_PROJECT",
        targetType: "PROJECT",
        targetId: project.id,
        afterData: {
          projectName: project.project_name,
          status: project.status,
          buyerId: project.buyer_id,
          countryId: project.country_id,
        },
      },
      tx,
    );

    return project;
  });
}

export async function getAdminProjectDetail(projectId: number) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      buyer: true,
      country: true,
      creator: {
        select: { id: true, name: true, login_id: true },
      },
      _count: {
        select: { files: true, orders: true, quotes: true },
      },
    },
  });
  if (!project) {
    throw new HttpError(404, "프로젝트를 찾을 수 없습니다.");
  }
  return project;
}

export async function getBuyerProjectDetail(projectId: number, buyerId: number) {
  const project = await prisma.project.findFirst({
    where: { id: projectId, buyer_id: buyerId },
    include: {
      country: true,
      _count: {
        select: { files: true, orders: true, quotes: true },
      },
    },
  });
  if (!project) {
    throw new HttpError(404, "프로젝트를 찾을 수 없습니다.");
  }
  return project;
}

export async function updateProject(projectId: number, actorId: number, input: UpdateProjectInput) {
  const current = await prisma.project.findUnique({
    where: { id: projectId },
  });
  if (!current) {
    throw new HttpError(404, "프로젝트를 찾을 수 없습니다.");
  }

  let nextBuyerId = current.buyer_id;
  let nextCountryId = current.country_id;
  if (input.buyerId || input.countryId) {
    const buyer = await getBuyerForProject(input.buyerId ?? current.buyer_id);
    nextBuyerId = buyer.id;
    nextCountryId = input.countryId ?? current.country_id;
    if (buyer.country_id !== nextCountryId) {
      throw new HttpError(400, "바이어 국가와 프로젝트 국가가 일치해야 합니다.");
    }
  }

  if (input.status && !canTransitionProjectStatus(current.status, input.status)) {
    throw new HttpError(400, `프로젝트 상태 전이가 허용되지 않습니다. (${current.status} -> ${input.status})`);
  }

  return prisma.$transaction(async (tx) => {
    const updated = await tx.project.update({
      where: { id: projectId },
      data: {
        ...(input.projectName !== undefined ? { project_name: input.projectName.trim() } : {}),
        ...(input.memo !== undefined ? { memo: input.memo ?? null } : {}),
        ...(input.location !== undefined ? { location: input.location ?? null } : {}),
        ...(input.startDate !== undefined ? { start_date: input.startDate ?? null } : {}),
        ...(input.endDate !== undefined ? { end_date: input.endDate ?? null } : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
        ...(nextBuyerId !== current.buyer_id ? { buyer_id: nextBuyerId } : {}),
        ...(nextCountryId !== current.country_id ? { country_id: nextCountryId } : {}),
      },
    });

    await createAuditLog(
      {
        actorId,
        actionType: "UPDATE_PROJECT",
        targetType: "PROJECT",
        targetId: projectId,
        beforeData: {
          projectName: current.project_name,
          status: current.status,
          buyerId: current.buyer_id,
          countryId: current.country_id,
        },
        afterData: {
          projectName: updated.project_name,
          status: updated.status,
          buyerId: updated.buyer_id,
          countryId: updated.country_id,
        },
      },
      tx,
    );

    if (input.status && input.status !== current.status) {
      await createAuditLog(
        {
          actorId,
          actionType: "PROJECT_STATUS_CHANGE",
          targetType: "PROJECT",
          targetId: projectId,
          beforeData: { status: current.status },
          afterData: { status: input.status },
        },
        tx,
      );
    }

    return updated;
  });
}

export async function setProjectStatus(
  input: {
    projectId: number;
    nextStatus: ProjectStatus;
    actorId: number;
    reason?: string;
  },
  tx: Prisma.TransactionClient | typeof prisma = prisma,
) {
  const project = await tx.project.findUnique({
    where: { id: input.projectId },
  });
  if (!project) {
    throw new HttpError(404, "프로젝트를 찾을 수 없습니다.");
  }
  if (project.status === input.nextStatus) {
    return project;
  }
  if (!canTransitionProjectStatus(project.status, input.nextStatus)) {
    throw new HttpError(400, `프로젝트 상태 전이가 허용되지 않습니다. (${project.status} -> ${input.nextStatus})`);
  }

  const updated = await tx.project.update({
    where: { id: input.projectId },
    data: { status: input.nextStatus },
  });

  await createAuditLog(
    {
      actorId: input.actorId,
      actionType: "PROJECT_STATUS_CHANGE",
      targetType: "PROJECT",
      targetId: input.projectId,
      beforeData: { status: project.status },
      afterData: { status: input.nextStatus, reason: input.reason ?? null },
    },
    tx,
  );

  return updated;
}

export async function listProjectFilesForAdmin(projectId: number) {
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) {
    throw new HttpError(404, "프로젝트를 찾을 수 없습니다.");
  }
  return prisma.projectFile.findMany({
    where: { project_id: projectId },
    include: {
      uploader: {
        select: { id: true, name: true, login_id: true },
      },
    },
    orderBy: [{ created_at: "desc" }],
  });
}

export async function listProjectFilesForBuyer(projectId: number, buyerId: number) {
  await assertProjectForBuyer(projectId, buyerId);
  return prisma.projectFile.findMany({
    where: { project_id: projectId },
    include: {
      uploader: {
        select: { id: true, name: true, login_id: true },
      },
    },
    orderBy: [{ created_at: "desc" }],
  });
}

export async function createProjectFileRecord(input: ProjectFileCreateInput) {
  const project = await prisma.project.findUnique({
    where: { id: input.projectId },
  });
  if (!project) {
    throw new HttpError(404, "프로젝트를 찾을 수 없습니다.");
  }

  return prisma.$transaction(async (tx) => {
    const created = await tx.projectFile.create({
      data: {
        project_id: input.projectId,
        file_name: input.fileName,
        original_name: input.originalName,
        file_url: input.fileUrl,
        file_size: input.fileSize,
        file_type: input.fileType,
        uploaded_by: input.uploadedBy,
      },
      include: {
        uploader: {
          select: { id: true, name: true, login_id: true },
        },
      },
    });

    await createAuditLog(
      {
        actorId: input.uploadedBy,
        actionType: "UPLOAD_PROJECT_FILE",
        targetType: "PROJECT",
        targetId: input.projectId,
        afterData: {
          fileId: created.id,
          fileName: created.file_name,
          originalName: created.original_name,
          fileType: created.file_type,
          fileSize: created.file_size,
        },
      },
      tx,
    );

    return created;
  });
}

export async function listProjectQuotesForAdmin(projectId: number) {
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) {
    throw new HttpError(404, "프로젝트를 찾을 수 없습니다.");
  }

  const quotes = await prisma.quote.findMany({
    where: { project_id: projectId },
    include: {
      supplier: true,
      quote_items: {
        select: { id: true, amount: true },
      },
    },
    orderBy: [{ created_at: "desc" }],
  });

  return quotes.map((quote) => {
    const totalAmount = quote.quote_items.reduce((sum, item) => sum.add(item.amount), new Prisma.Decimal(0));
    return {
      ...quote,
      item_count: quote.quote_items.length,
      total_amount: totalAmount.toString(),
    };
  });
}

export async function listProjectQuotesForBuyer(projectId: number, buyerId: number) {
  await assertProjectForBuyer(projectId, buyerId);

  const quotes = await prisma.quote.findMany({
    where: { project_id: projectId, buyer_id: buyerId },
    include: {
      supplier: true,
      quote_items: {
        include: {
          supplier: true,
        },
      },
    },
    orderBy: [{ created_at: "desc" }],
  });

  return quotes.map((quote) => {
    const totalAmount = quote.quote_items.reduce((sum, item) => sum.add(item.amount), new Prisma.Decimal(0));
    return {
      ...quote,
      item_count: quote.quote_items.length,
      total_amount: totalAmount.toString(),
    };
  });
}

export async function listProjectOrdersForAdmin(projectId: number) {
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) {
    throw new HttpError(404, "프로젝트를 찾을 수 없습니다.");
  }

  const orders = await prisma.order.findMany({
    where: { project_id: projectId },
    include: {
      suppliers: {
        include: { supplier: true },
      },
    },
    orderBy: [{ created_at: "desc" }],
  });

  return orders.map((order) => ({
    ...order,
    supplier_count: order.suppliers.length,
  }));
}

export async function listProjectOrdersForBuyer(projectId: number, buyerId: number) {
  await assertProjectForBuyer(projectId, buyerId);

  const orders = await prisma.order.findMany({
    where: { project_id: projectId, buyer_id: buyerId },
    include: {
      suppliers: {
        include: { supplier: true },
      },
    },
    orderBy: [{ created_at: "desc" }],
  });

  return orders.map((order) => ({
    ...order,
    supplier_count: order.suppliers.length,
  }));
}

export async function getProjectSummaryForAdmin(projectId: number) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
  });
  if (!project) {
    throw new HttpError(404, "프로젝트를 찾을 수 없습니다.");
  }

  const [orderSuppliers, invoices, quoteCount, orderCount] = await Promise.all([
    prisma.orderSupplier.findMany({
      where: {
        order: { project_id: projectId },
      },
      include: {
        order: {
          select: {
            id: true,
            order_no: true,
            created_at: true,
            status: true,
          },
        },
        supplier: {
          select: {
            id: true,
            supplier_name: true,
          },
        },
      },
      orderBy: [{ updated_at: "desc" }],
    }),
    prisma.taxInvoice.findMany({
      where: {
        order: { project_id: projectId },
      },
      include: {
        supplier: true,
        order: {
          select: { id: true, order_no: true },
        },
        files: true,
        email_inbox: true,
      },
      orderBy: [{ created_at: "desc" }],
    }),
    prisma.quote.count({ where: { project_id: projectId } }),
    prisma.order.count({ where: { project_id: projectId } }),
  ]);

  const statusCount = orderSuppliers.reduce<Record<string, number>>((acc, row) => {
    acc[row.status] = (acc[row.status] ?? 0) + 1;
    return acc;
  }, {});

  return {
    quote_count: quoteCount,
    order_count: orderCount,
    order_supplier_status_count: statusCount,
    order_suppliers: orderSuppliers,
    tax_invoices: invoices.map((invoice) => ({
      ...invoice,
      attachment_count: invoice.files.length,
      received_at: invoice.email_inbox.received_at,
      from_email: invoice.email_inbox.from_email,
    })),
  };
}

export async function getProjectSummaryForBuyer(projectId: number, buyerId: number) {
  await assertProjectForBuyer(projectId, buyerId);
  return getProjectSummaryForAdmin(projectId);
}

export async function syncProjectStatusByOrderSuppliers(
  input: { projectId: number; actorId: number },
  tx: Prisma.TransactionClient | typeof prisma = prisma,
) {
  const project = await tx.project.findUnique({
    where: { id: input.projectId },
  });
  if (!project) {
    return;
  }

  const suppliers = await tx.orderSupplier.findMany({
    where: { order: { project_id: input.projectId } },
    select: { status: true },
  });
  if (suppliers.length === 0) {
    return;
  }

  const hasDispatched = suppliers.some((supplier) =>
    [
      "SENT",
      "SUPPLIER_CONFIRMED",
      "DELIVERING",
      "COMPLETED",
    ].includes(supplier.status),
  );
  const allCompleted = suppliers.every((supplier) => supplier.status === "COMPLETED");

  if (allCompleted && project.status !== ProjectStatus.COMPLETED) {
    await setProjectStatus(
      {
        projectId: input.projectId,
        nextStatus: ProjectStatus.COMPLETED,
        actorId: input.actorId,
        reason: "모든 공급사 발주 완료",
      },
      tx,
    );
    return;
  }

  if (
    hasDispatched &&
    (project.status === ProjectStatus.ORDERING ||
      project.status === ProjectStatus.QUOTED ||
      project.status === ProjectStatus.QUOTING)
  ) {
    await setProjectStatus(
      {
        projectId: input.projectId,
        nextStatus: ProjectStatus.ACTIVE,
        actorId: input.actorId,
        reason: "프로젝트 발주 진행 시작",
      },
      tx,
    );
  }
}
