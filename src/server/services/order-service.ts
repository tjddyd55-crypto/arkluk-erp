import {
  AssignmentMode,
  BuyerOrderStatus,
  NotificationEvent,
  OrderEventType,
  OrderItemStatus,
  OrderStatus,
  OrderSupplierStatus,
  Prisma,
  ProductStatus,
  ProjectStatus,
  Role,
} from "@prisma/client";

import { HttpError } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { buildDocumentNo } from "@/lib/utils";
import { createAuditLog } from "@/server/services/audit-log";
import { notifyOrderAssignment } from "@/server/services/assignment-notification-service";
import {
  assertAssignmentModeEnabled,
  getAssignmentSettings,
} from "@/server/services/assignment-settings-service";
import { sendMail } from "@/server/services/mail-service";
import {
  createNotification,
  listActiveUserIdsByRoles,
  listActiveUserIdsBySupplier,
} from "@/server/services/notification-service";
import { createOrderEventLog } from "@/server/services/order-event-log-service";
import { setProjectStatus, syncProjectStatusByOrderSuppliers } from "@/server/services/project-service";
import {
  generatePurchaseOrderPDF,
  upsertPurchaseOrderRecord,
} from "@/server/services/purchase-order-service";

type OrderLineSnapshots = {
  productCode: string;
  productName: string;
  spec: string;
  unit: string;
  unitPrice: Prisma.Decimal | string | number;
};

type CreateOrderInput = {
  buyerId: number;
  projectId?: number | null;
  memo?: string | null;
  items: Array<{
    productId: number;
    qty: number;
    memo?: string | null;
    /** 동적 필드 기반 스냅샷(장바구니 등). 없으면 기존 Product 컬럼 사용 */
    lineSnapshots?: OrderLineSnapshots;
  }>;
};

type CreateCountryOrderDraftInput = {
  actorId: number;
  projectId?: number | null;
  memo?: string | null;
};

type CountryOrderItemsInput = {
  actorId: number;
  items: Array<{
    productId: number;
    qty: number;
    memo?: string | null;
  }>;
};

type UpdateOrderInput = {
  actorId: number;
  status?: "CREATED" | "UNDER_REVIEW" | "ASSIGNED" | "PENDING" | "REVIEWING";
  operations: Array<
    | {
        actionType: "UPDATE_QTY";
        orderItemId: number;
        qty: number;
      }
    | {
        actionType: "DELETE_ITEM";
        orderItemId: number;
      }
    | {
        actionType: "ADD_ITEM";
        productId: number;
        qty: number;
        memo?: string | null;
      }
  >;
};

const ADMIN_NOTIFICATION_ROLES: Role[] = [Role.SUPER_ADMIN, Role.ADMIN, Role.KOREA_SUPPLY_ADMIN];

function calcAmount(price: Prisma.Decimal, qty: number) {
  return price.mul(new Prisma.Decimal(qty));
}

function isSupplierSectionLocked(status: OrderSupplierStatus) {
  return (
    status === OrderSupplierStatus.SENT ||
    status === OrderSupplierStatus.SUPPLIER_CONFIRMED ||
    status === OrderSupplierStatus.DELIVERING ||
    status === OrderSupplierStatus.COMPLETED
  );
}

function isSupplierSectionDispatched(status: OrderSupplierStatus) {
  return (
    status === OrderSupplierStatus.SENT ||
    status === OrderSupplierStatus.SUPPLIER_CONFIRMED ||
    status === OrderSupplierStatus.DELIVERING ||
    status === OrderSupplierStatus.COMPLETED
  );
}

function canCancelOrderSupplier(status: OrderSupplierStatus) {
  return status === OrderSupplierStatus.SENT || status === OrderSupplierStatus.SUPPLIER_CONFIRMED;
}

function normalizeSupplierNote(note?: string | null) {
  if (typeof note !== "string") {
    return null;
  }
  const trimmed = note.trim();
  return trimmed.length > 0 ? trimmed : null;
}

async function requireCountryAdminActor(actorId: number) {
  const actor = await prisma.user.findUnique({
    where: { id: actorId },
    select: {
      id: true,
      role: true,
      is_active: true,
      country_id: true,
    },
  });

  if (
    !actor ||
    !actor.is_active ||
    actor.role !== Role.COUNTRY_ADMIN ||
    !actor.country_id
  ) {
    throw new HttpError(403, "COUNTRY_ADMIN 권한이 필요합니다.");
  }

  return actor;
}

export async function createOrder(input: CreateOrderInput) {
  const buyer = await prisma.user.findUnique({
    where: { id: input.buyerId },
    include: {
      country: {
        select: {
          country_code: true,
        },
      },
    },
  });

  if (
    !buyer ||
    !buyer.is_active ||
    (buyer.role !== Role.BUYER && buyer.role !== Role.COUNTRY_ADMIN) ||
    !buyer.country_id ||
    !buyer.country
  ) {
    throw new HttpError(400, "유효한 바이어 계정이 아닙니다.");
  }
  const buyerCountryCode = buyer.country.country_code;

  const project =
    input.projectId !== undefined && input.projectId !== null
      ? await prisma.project.findUnique({
          where: { id: input.projectId },
          select: { id: true, buyer_id: true, country_id: true, status: true },
        })
      : null;
  if (input.projectId !== undefined && input.projectId !== null) {
    if (!project) {
      throw new HttpError(404, "프로젝트를 찾을 수 없습니다.");
    }
    if (project.buyer_id !== buyer.id || project.country_id !== buyer.country_id) {
      throw new HttpError(400, "프로젝트의 바이어/국가와 주문 정보가 일치하지 않습니다.");
    }
    if (
      project.status === ProjectStatus.CANCELLED ||
      project.status === ProjectStatus.COMPLETED
    ) {
      throw new HttpError(400, "종료된 프로젝트에는 주문을 생성할 수 없습니다.");
    }
  }

  const productIds = [...new Set(input.items.map((item) => item.productId))];
  const products = await prisma.product.findMany({
    where: {
      id: { in: productIds },
      is_active: true,
      status: ProductStatus.APPROVED,
      country_code: buyerCountryCode,
    },
    include: { category: true, supplier: true },
  });
  const productMap = new Map(products.map((product) => [product.id, product]));

  if (products.length !== productIds.length) {
    throw new HttpError(400, "주문 대상 상품 중 유효하지 않은 상품이 있습니다.");
  }

  const orderNo = buildDocumentNo("ORD");

  const updatedItem = await prisma.$transaction(async (tx) => {
    const order = await tx.order.create({
      data: {
        order_no: orderNo,
        buyer_id: buyer.id,
        country_id: buyer.country_id!,
        country_code: buyerCountryCode,
        project_id: input.projectId ?? null,
        memo: input.memo ?? null,
        status: OrderStatus.CREATED,
      },
    });

    const supplierIds = new Set<number>();

    for (const item of input.items) {
      const product = productMap.get(item.productId);
      if (!product) {
        throw new HttpError(400, `상품을 찾을 수 없습니다. (${item.productId})`);
      }

      supplierIds.add(product.supplier_id);

      const snap = item.lineSnapshots;
      const unitPriceDec = snap
        ? new Prisma.Decimal(snap.unitPrice)
        : product.price;

      await tx.orderItem.create({
        data: {
          order_id: order.id,
          supplier_id: product.supplier_id,
          status: OrderItemStatus.CREATED,
          category_id: product.category_id,
          product_id: product.id,
          product_code_snapshot: snap?.productCode ?? product.product_code,
          product_name_snapshot: snap?.productName ?? product.product_name,
          spec_snapshot: snap?.spec ?? product.spec,
          unit_snapshot: snap?.unit ?? product.unit,
          price_snapshot: unitPriceDec,
          qty: new Prisma.Decimal(item.qty),
          amount: calcAmount(unitPriceDec, item.qty),
          memo: item.memo ?? null,
        },
      });
    }

    await tx.orderSupplier.createMany({
      data: [...supplierIds].map((supplierId) => ({
        order_id: order.id,
        supplier_id: supplierId,
        status: OrderSupplierStatus.WAITING,
      })),
      skipDuplicates: true,
    });

    await createAuditLog(
      {
        actorId: buyer.id,
        actionType: "CREATE_ORDER",
        targetType: "ORDER",
        targetId: order.id,
        afterData: {
          orderNo: order.order_no,
          itemCount: input.items.length,
          supplierCount: supplierIds.size,
        },
      },
      tx,
    );
    await createOrderEventLog(
      {
        orderId: order.id,
        eventType: OrderEventType.ORDER_CREATED,
        message: "주문 생성",
        createdBy: buyer.id,
      },
      tx,
    );

    if (
      project &&
      (project.status === ProjectStatus.DRAFT ||
        project.status === ProjectStatus.QUOTING ||
        project.status === ProjectStatus.QUOTED)
    ) {
      await setProjectStatus(
        {
          projectId: project.id,
          nextStatus: ProjectStatus.ORDERING,
          actorId: buyer.id,
          reason: "프로젝트 주문 생성",
        },
        tx,
      );
    }

    return order;
  });

  const adminUserIds = await listActiveUserIdsByRoles(ADMIN_NOTIFICATION_ROLES);
  await createNotification({
    eventType: NotificationEvent.ORDER_CREATED,
    entityType: "ORDER",
    entityId: updatedItem.id,
    message: `신규 주문이 생성되었습니다. (${updatedItem.order_no})`,
    recipientUserIds: adminUserIds,
  });

  return updatedItem;
}

export async function createCountryOrderDraft(input: CreateCountryOrderDraftInput) {
  const actor = await requireCountryAdminActor(input.actorId);
  const actorCountry = await prisma.country.findUnique({
    where: { id: actor.country_id! },
    select: { country_code: true },
  });
  if (!actorCountry) {
    throw new HttpError(400, "COUNTRY_ADMIN 국가 정보가 올바르지 않습니다.");
  }

  const project =
    input.projectId !== undefined && input.projectId !== null
      ? await prisma.project.findUnique({
          where: { id: input.projectId },
          select: { id: true, country_id: true, status: true },
        })
      : null;
  if (input.projectId !== undefined && input.projectId !== null) {
    if (!project) {
      throw new HttpError(404, "프로젝트를 찾을 수 없습니다.");
    }
    if (project.country_id !== actor.country_id) {
      throw new HttpError(400, "국가가 다른 프로젝트에는 주문을 생성할 수 없습니다.");
    }
    if (
      project.status === ProjectStatus.CANCELLED ||
      project.status === ProjectStatus.COMPLETED
    ) {
      throw new HttpError(400, "종료된 프로젝트에는 주문을 생성할 수 없습니다.");
    }
  }

  const orderNo = buildDocumentNo("ORD");
  const updatedItem = await prisma.$transaction(async (tx) => {
    const order = await tx.order.create({
      data: {
        order_no: orderNo,
        buyer_id: actor.id,
        country_id: actor.country_id!,
        country_code: actorCountry.country_code,
        project_id: input.projectId ?? null,
        memo: input.memo ?? null,
        status: OrderStatus.CREATED,
      },
    });

    await createAuditLog(
      {
        actorId: actor.id,
        actionType: "CREATE_COUNTRY_ORDER_DRAFT",
        targetType: "ORDER",
        targetId: order.id,
        afterData: {
          orderNo: order.order_no,
          status: order.status,
        },
      },
      tx,
    );
    await createOrderEventLog(
      {
        orderId: order.id,
        eventType: OrderEventType.ORDER_CREATED,
        message: "주문 초안 생성",
        createdBy: actor.id,
      },
      tx,
    );

    return order;
  });

  const adminUserIds = await listActiveUserIdsByRoles(ADMIN_NOTIFICATION_ROLES);
  await createNotification({
    eventType: NotificationEvent.ORDER_CREATED,
    entityType: "ORDER",
    entityId: updatedItem.id,
    message: `국가 주문 초안이 생성되었습니다. (${updatedItem.order_no})`,
    recipientUserIds: adminUserIds,
  });

  return updatedItem;
}

export async function addCountryOrderItems(orderId: number, input: CountryOrderItemsInput) {
  const actor = await requireCountryAdminActor(input.actorId);
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      buyer_id: true,
      country_id: true,
      country_code: true,
      status: true,
    },
  });
  if (!order) {
    throw new HttpError(404, "주문을 찾을 수 없습니다.");
  }
  if (order.buyer_id !== actor.id || order.country_id !== actor.country_id) {
    throw new HttpError(403, "자신이 생성한 국가 주문만 수정할 수 있습니다.");
  }
  if (order.status !== OrderStatus.CREATED) {
    throw new HttpError(400, "CREATED 상태 주문만 품목 추가가 가능합니다.");
  }

  const productIds = [...new Set(input.items.map((item) => item.productId))];
  const products = await prisma.product.findMany({
    where: {
      id: { in: productIds },
      is_active: true,
      status: ProductStatus.APPROVED,
      country_code: order.country_code,
    },
  });
  if (products.length !== productIds.length) {
    throw new HttpError(400, "추가 대상 상품 중 유효하지 않은 항목이 있습니다.");
  }
  const productMap = new Map(products.map((product) => [product.id, product]));

  const updatedItem = await prisma.$transaction(async (tx) => {
    const touchedSupplierIds = new Set<number>();

    for (const item of input.items) {
      const product = productMap.get(item.productId);
      if (!product) {
        throw new HttpError(400, `상품을 찾을 수 없습니다. (${item.productId})`);
      }
      touchedSupplierIds.add(product.supplier_id);

      const existing = await tx.orderItem.findFirst({
        where: {
          order_id: orderId,
          product_id: product.id,
        },
      });

      if (!existing) {
        const qty = new Prisma.Decimal(item.qty);
        const created = await tx.orderItem.create({
          data: {
            order_id: orderId,
            supplier_id: product.supplier_id,
            status: OrderItemStatus.CREATED,
            category_id: product.category_id,
            product_id: product.id,
            product_code_snapshot: product.product_code,
            product_name_snapshot: product.product_name,
            spec_snapshot: product.spec,
            unit_snapshot: product.unit,
            price_snapshot: product.price,
            qty,
            amount: product.price.mul(qty),
            memo: item.memo ?? null,
          },
        });

        await tx.orderChangeLog.create({
          data: {
            order_id: orderId,
            order_item_id: created.id,
            action_type: "ADD_ITEM",
            before_data: {},
            after_data: {
              productId: product.id,
              qty: qty.toString(),
            },
            changed_by: actor.id,
          },
        });
        continue;
      }

      const beforeQty = existing.qty;
      const nextQty = beforeQty.add(new Prisma.Decimal(item.qty));
      const nextAmount = existing.price_snapshot.mul(nextQty);
      await tx.orderItem.update({
        where: { id: existing.id },
        data: {
          qty: nextQty,
          amount: nextAmount,
          memo: item.memo ?? existing.memo,
        },
      });
      await tx.orderChangeLog.create({
        data: {
          order_id: orderId,
          order_item_id: existing.id,
          action_type: "UPDATE_QTY",
          before_data: {
            qty: beforeQty.toString(),
          },
          after_data: {
            qty: nextQty.toString(),
          },
          changed_by: actor.id,
        },
      });
    }

    for (const supplierId of touchedSupplierIds) {
      await tx.orderSupplier.upsert({
        where: {
          order_id_supplier_id: {
            order_id: orderId,
            supplier_id: supplierId,
          },
        },
        update: {},
        create: {
          order_id: orderId,
          supplier_id: supplierId,
          status: OrderSupplierStatus.WAITING,
        },
      });
    }

    await createAuditLog(
      {
        actorId: actor.id,
        actionType: "COUNTRY_ADMIN_ADD_ORDER_ITEMS",
        targetType: "ORDER",
        targetId: orderId,
        afterData: {
          addedItemCount: input.items.length,
          supplierCount: touchedSupplierIds.size,
        },
      },
      tx,
    );

    const updated = await tx.order.findUnique({
      where: { id: orderId },
      include: {
        order_items: true,
        suppliers: true,
      },
    });
    if (!updated) {
      throw new HttpError(404, "주문을 찾을 수 없습니다.");
    }
    return updated;
  });

  return updatedItem;
}

export async function submitCountryOrder(orderId: number, actorId: number) {
  const actor = await requireCountryAdminActor(actorId);
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      order_items: {
        select: { id: true },
      },
    },
  });
  if (!order) {
    throw new HttpError(404, "주문을 찾을 수 없습니다.");
  }
  if (order.buyer_id !== actor.id || order.country_id !== actor.country_id) {
    throw new HttpError(403, "자신이 생성한 국가 주문만 제출할 수 있습니다.");
  }
  if (order.status !== OrderStatus.CREATED) {
    throw new HttpError(400, "CREATED 상태 주문만 제출할 수 있습니다.");
  }
  if (order.order_items.length === 0) {
    throw new HttpError(400, "주문에 최소 1개 이상의 품목이 필요합니다.");
  }

  return prisma.$transaction(async (tx) => {
    const updated = await tx.order.update({
      where: { id: orderId },
      data: {
        status: OrderStatus.UNDER_REVIEW,
      },
    });

    await createAuditLog(
      {
        actorId: actor.id,
        actionType: "COUNTRY_ADMIN_SUBMIT_ORDER",
        targetType: "ORDER",
        targetId: orderId,
        beforeData: { status: order.status },
        afterData: { status: updated.status },
      },
      tx,
    );
    await createOrderEventLog(
      {
        orderId,
        eventType: OrderEventType.ORDER_REVIEWED,
        message: "주문 검토 단계로 제출",
        createdBy: actor.id,
      },
      tx,
    );

    return updated;
  });
}

function isAllowedBuyerStatusTransition(
  currentStatus: BuyerOrderStatus,
  nextStatus: BuyerOrderStatus,
) {
  if (currentStatus === nextStatus) {
    return true;
  }
  if (currentStatus === BuyerOrderStatus.ORDER_CREATED) {
    return (
      nextStatus === BuyerOrderStatus.PAYMENT_PENDING ||
      nextStatus === BuyerOrderStatus.ORDER_CANCELLED
    );
  }
  if (currentStatus === BuyerOrderStatus.PAYMENT_PENDING) {
    return (
      nextStatus === BuyerOrderStatus.PAYMENT_COMPLETED ||
      nextStatus === BuyerOrderStatus.ORDER_CANCELLED
    );
  }
  return false;
}

export async function buyerUpdateOrderStatus(
  orderId: number,
  buyerId: number,
  nextStatus: BuyerOrderStatus,
) {
  const order = await prisma.order.findFirst({
    where: {
      id: orderId,
      buyer_id: buyerId,
    },
    select: {
      id: true,
      status: true,
      buyer_status: true,
      order_no: true,
    },
  });
  if (!order) {
    throw new HttpError(404, "주문을 찾을 수 없습니다.");
  }
  if (!isAllowedBuyerStatusTransition(order.buyer_status, nextStatus)) {
    throw new HttpError(
      400,
      `허용되지 않은 주문 상태 전이입니다. (${order.buyer_status} -> ${nextStatus})`,
    );
  }
  if (order.status === OrderStatus.DELIVERED && nextStatus === BuyerOrderStatus.ORDER_CANCELLED) {
    throw new HttpError(400, "배송 완료된 주문은 취소할 수 없습니다.");
  }

  return prisma.$transaction(async (tx) => {
    const updated = await tx.order.update({
      where: { id: order.id },
      data: {
        buyer_status: nextStatus,
        buyer_status_updated_by: buyerId,
        buyer_status_updated_at: new Date(),
      },
    });

    await createAuditLog(
      {
        actorId: buyerId,
        actionType: "BUYER_UPDATE_ORDER_STATUS",
        targetType: "ORDER",
        targetId: order.id,
        beforeData: {
          buyerStatus: order.buyer_status,
        },
        afterData: {
          buyerStatus: nextStatus,
          orderNo: order.order_no,
        },
      },
      tx,
    );

    return updated;
  });
}

function ensureEditableBySupplierStatus(
  supplierStatusMap: Map<number, { status: OrderSupplierStatus }>,
  supplierId: number,
) {
  const supplierStatus = supplierStatusMap.get(supplierId);
  if (!supplierStatus) {
    throw new HttpError(400, "공급사 발송 상태를 확인할 수 없습니다.");
  }

  if (isSupplierSectionLocked(supplierStatus.status)) {
    throw new HttpError(400, "이미 발송된 공급사 항목은 수정할 수 없습니다.");
  }
}

export async function updateOrder(orderId: number, input: UpdateOrderInput) {
  const currentOrder = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      order_items: true,
      suppliers: true,
    },
  });

  if (!currentOrder) {
    throw new HttpError(404, "주문을 찾을 수 없습니다.");
  }

  if (
    currentOrder.status === OrderStatus.SENT ||
    currentOrder.status === OrderStatus.DELIVERED ||
    currentOrder.status === OrderStatus.CANCELLED
  ) {
    throw new HttpError(400, "완료/취소된 주문은 수정할 수 없습니다.");
  }

  return prisma.$transaction(async (tx) => {
    const supplierStatusMap = new Map(
      currentOrder.suppliers.map((supplier) => [supplier.supplier_id, supplier]),
    );

    for (const operation of input.operations) {
      if (operation.actionType === "UPDATE_QTY") {
        const orderItem = await tx.orderItem.findUnique({
          where: { id: operation.orderItemId },
        });
        if (!orderItem || orderItem.order_id !== orderId) {
          throw new HttpError(404, "수정 대상 주문 품목을 찾을 수 없습니다.");
        }
        ensureEditableBySupplierStatus(supplierStatusMap, orderItem.supplier_id);

        const beforeQty = orderItem.qty;
        const beforeAmount = orderItem.amount;
        const qty = new Prisma.Decimal(operation.qty);
        const amount = orderItem.price_snapshot.mul(qty);

        await tx.orderItem.update({
          where: { id: orderItem.id },
          data: { qty, amount },
        });
        await tx.orderChangeLog.create({
          data: {
            order_id: orderId,
            order_item_id: orderItem.id,
            action_type: "UPDATE_QTY",
            before_data: {
              qty: beforeQty.toString(),
              amount: beforeAmount.toString(),
            },
            after_data: {
              qty: qty.toString(),
              amount: amount.toString(),
            },
            changed_by: input.actorId,
          },
        });
      }

      if (operation.actionType === "DELETE_ITEM") {
        const orderItem = await tx.orderItem.findUnique({
          where: { id: operation.orderItemId },
        });
        if (!orderItem || orderItem.order_id !== orderId) {
          throw new HttpError(404, "삭제 대상 주문 품목을 찾을 수 없습니다.");
        }
        ensureEditableBySupplierStatus(supplierStatusMap, orderItem.supplier_id);

        await tx.orderItem.delete({ where: { id: orderItem.id } });
        await tx.orderChangeLog.create({
          data: {
            order_id: orderId,
            order_item_id: orderItem.id,
            action_type: "DELETE_ITEM",
            before_data: {
              productId: orderItem.product_id,
              qty: orderItem.qty.toString(),
            },
            after_data: {},
            changed_by: input.actorId,
          },
        });
      }

      if (operation.actionType === "ADD_ITEM") {
        const product = await tx.product.findUnique({
          where: { id: operation.productId },
        });
        if (
          !product ||
          !product.is_active ||
          product.status !== ProductStatus.APPROVED ||
          product.country_code !== currentOrder.country_code
        ) {
          throw new HttpError(400, "추가 대상 상품이 유효하지 않습니다.");
        }
        ensureEditableBySupplierStatus(supplierStatusMap, product.supplier_id);

        const qty = new Prisma.Decimal(operation.qty);
        const created = await tx.orderItem.create({
          data: {
            order_id: orderId,
            supplier_id: product.supplier_id,
            status: OrderItemStatus.CREATED,
            category_id: product.category_id,
            product_id: product.id,
            product_code_snapshot: product.product_code,
            product_name_snapshot: product.product_name,
            spec_snapshot: product.spec,
            unit_snapshot: product.unit,
            price_snapshot: product.price,
            qty,
            amount: product.price.mul(qty),
            memo: operation.memo ?? null,
          },
        });

        await tx.orderChangeLog.create({
          data: {
            order_id: orderId,
            order_item_id: created.id,
            action_type: "ADD_ITEM",
            before_data: {},
            after_data: {
              productId: product.id,
              qty: qty.toString(),
            },
            changed_by: input.actorId,
          },
        });
      }
    }

    const latestItems = await tx.orderItem.findMany({
      where: { order_id: orderId },
      select: { supplier_id: true },
    });

    if (latestItems.length === 0) {
      throw new HttpError(400, "주문에는 최소 1개 이상의 품목이 필요합니다.");
    }

    const latestSupplierIds = new Set(latestItems.map((item) => item.supplier_id));

    const existingSuppliers = await tx.orderSupplier.findMany({
      where: { order_id: orderId },
    });

    for (const orderSupplier of existingSuppliers) {
      if (!latestSupplierIds.has(orderSupplier.supplier_id)) {
        if (isSupplierSectionLocked(orderSupplier.status)) {
          throw new HttpError(400, "이미 발송된 공급사 섹션은 삭제할 수 없습니다.");
        }
        await tx.orderSupplier.delete({ where: { id: orderSupplier.id } });
      }
    }

    for (const supplierId of latestSupplierIds) {
      const exists = existingSuppliers.some((supplier) => supplier.supplier_id === supplierId);
      if (!exists) {
        await tx.orderSupplier.create({
          data: {
            order_id: orderId,
            supplier_id: supplierId,
            status: OrderSupplierStatus.WAITING,
          },
        });
      }
    }

    const nextStatus = input.status ? OrderStatus[input.status] : currentOrder.status;
    const updated = await tx.order.update({
      where: { id: orderId },
      data: { status: nextStatus },
    });

    await createAuditLog(
      {
        actorId: input.actorId,
        actionType: "UPDATE_ORDER",
        targetType: "ORDER",
        targetId: orderId,
        beforeData: { status: currentOrder.status },
        afterData: { status: updated.status },
      },
      tx,
    );

    return updated;
  });
}

async function syncOrderStatus(orderId: number, tx: Prisma.TransactionClient) {
  const suppliers = await tx.orderSupplier.findMany({
    where: { order_id: orderId },
    select: { status: true },
  });

  if (suppliers.length === 0) {
    await tx.order.update({
      where: { id: orderId },
      data: { status: OrderStatus.CREATED },
    });
    return;
  }

  const allDelivered = suppliers.every((supplier) => supplier.status === OrderSupplierStatus.COMPLETED);
  const hasShipped = suppliers.some(
    (supplier) =>
      supplier.status === OrderSupplierStatus.DELIVERING ||
      supplier.status === OrderSupplierStatus.COMPLETED,
  );
  const hasSupplierConfirmed = suppliers.some(
    (supplier) => supplier.status === OrderSupplierStatus.SUPPLIER_CONFIRMED,
  );
  const hasAssigned = suppliers.some((supplier) => isSupplierSectionDispatched(supplier.status));

  const nextStatus = allDelivered
    ? OrderStatus.DELIVERED
    : hasShipped
      ? OrderStatus.SHIPPED
      : hasSupplierConfirmed
        ? OrderStatus.SUPPLIER_CONFIRMED
        : hasAssigned
          ? OrderStatus.ASSIGNED
          : OrderStatus.UNDER_REVIEW;

  await tx.order.update({
    where: { id: orderId },
    data: { status: nextStatus },
  });
}

export async function sendOrderToSupplier(orderId: number, supplierId: number, actorId: number) {
  const result = await sendPurchaseOrderToSingleSupplier(orderId, supplierId, actorId);
  if (!result.success) {
    throw new HttpError(500, result.errorMessage ?? "발주 메일 발송에 실패했습니다.");
  }
}

export async function sendOrderToAll(orderId: number, actorId: number) {
  const waitingSuppliers = await prisma.orderSupplier.findMany({
    where: {
      order_id: orderId,
      status: OrderSupplierStatus.WAITING,
    },
    select: { supplier_id: true },
  });
  if (waitingSuppliers.length === 0) {
    throw new HttpError(400, "발주 가능한 공급사가 없습니다.");
  }

  const failedSuppliers: Array<{ supplierId: number; message: string }> = [];
  for (const supplier of waitingSuppliers) {
    const result = await sendPurchaseOrderToSingleSupplier(
      orderId,
      supplier.supplier_id,
      actorId,
    );
    if (!result.success) {
      failedSuppliers.push({
        supplierId: supplier.supplier_id,
        message: result.errorMessage ?? "알 수 없는 오류",
      });
    }
  }

  if (failedSuppliers.length > 0) {
    const errorText = failedSuppliers
      .map((failed) => `${failed.supplierId}:${failed.message}`)
      .join(", ");
    throw new HttpError(500, `일부 공급사 발주 실패 - ${errorText}`);
  }
}

async function sendPurchaseOrderToSingleSupplier(
  orderId: number,
  supplierId: number,
  actorId: number,
) {
  const orderSupplier = await prisma.orderSupplier.findUnique({
    where: {
      order_id_supplier_id: { order_id: orderId, supplier_id: supplierId },
    },
    include: {
      supplier: true,
      order: {
        select: {
          id: true,
          order_no: true,
          project_id: true,
        },
      },
    },
  });

  if (!orderSupplier) {
    throw new HttpError(404, "발송 대상 공급사 주문을 찾을 수 없습니다.");
  }
  if (
    orderSupplier.status !== OrderSupplierStatus.WAITING &&
    orderSupplier.status !== OrderSupplierStatus.CANCELLED
  ) {
    throw new HttpError(400, "이미 발송 처리된 공급사입니다.");
  }

  const purchaseOrderFile = await generatePurchaseOrderPDF(orderId, supplierId);
  const subject = `[발주서] ${orderSupplier.order.order_no}`;
  const body = "발주서를 확인해주시기 바랍니다.\n첨부된 발주서를 확인 후 회신 부탁드립니다.";

  const mailResult = await sendMail({
    to: orderSupplier.supplier.order_email,
    cc: orderSupplier.supplier.cc_email,
    subject,
    text: body,
    attachments: [
      {
        filename: purchaseOrderFile.fileName,
        path: purchaseOrderFile.filePath,
        contentType: "application/pdf",
      },
    ],
  });

  const txResult = await prisma.$transaction(async (tx) => {
    const purchaseOrder = await upsertPurchaseOrderRecord(
      {
        orderId,
        supplierId,
        fileName: purchaseOrderFile.fileName,
        fileUrl: purchaseOrderFile.fileUrl,
        createdBy: actorId,
      },
      tx,
    );

    await createAuditLog(
      {
        actorId,
        actionType: "GENERATE_PURCHASE_ORDER",
        targetType: "PURCHASE_ORDER",
        targetId: purchaseOrder.id,
        afterData: {
          orderId,
          supplierId,
          fileName: purchaseOrder.file_name,
        },
      },
      tx,
    );

    await tx.emailLog.create({
      data: {
        related_type: "ORDER",
        related_id: orderId,
        supplier_id: supplierId,
        to_email: orderSupplier.supplier.order_email,
        cc_email: orderSupplier.supplier.cc_email,
        subject,
        body_preview: body,
        status: mailResult.success ? "SUCCESS" : "FAILED",
        error_message: mailResult.errorMessage,
        sent_at: mailResult.success ? new Date() : null,
      },
    });

    if (mailResult.success) {
      await tx.orderSupplier.update({
        where: { id: orderSupplier.id },
        data: {
          status: OrderSupplierStatus.SENT,
          sent_at: new Date(),
          sent_by: actorId,
          email_sent: true,
          portal_visible: true,
          supplier_checked: false,
          supplier_checked_at: null,
          supplier_checked_by: null,
          supplier_confirmed_at: null,
          expected_delivery_date: null,
          supplier_note: null,
        },
      });

      await tx.orderItem.updateMany({
        where: {
          order_id: orderId,
          supplier_id: supplierId,
          status: OrderItemStatus.CREATED,
        },
        data: {
          status: OrderItemStatus.ASSIGNED,
          assigned_by: actorId,
          assigned_at: new Date(),
          assignment_mode: AssignmentMode.AUTO_PRODUCT,
        },
      });

      await createAuditLog(
        {
          actorId,
          actionType: "SEND_PURCHASE_ORDER",
          targetType: "ORDER",
          targetId: orderId,
          afterData: { supplierId, purchaseOrderId: purchaseOrder.id },
        },
        tx,
      );
    }

    await syncOrderStatus(orderId, tx);
    if (orderSupplier.order.project_id) {
      await syncProjectStatusByOrderSuppliers(
        {
          projectId: orderSupplier.order.project_id,
          actorId,
        },
        tx,
      );
    }

    return {
      success: mailResult.success,
      errorMessage: mailResult.errorMessage,
      purchaseOrderId: purchaseOrder.id,
    };
  });

  return txResult;
}

export async function supplierCheckOrder(
  orderId: number,
  supplierId: number,
  actorId: number,
  input?: {
    expectedDeliveryDate?: Date | null;
    supplierNote?: string | null;
  },
) {
  const orderSupplier = await prisma.orderSupplier.findUnique({
    where: { order_id_supplier_id: { order_id: orderId, supplier_id: supplierId } },
    include: {
      order: {
        select: {
          id: true,
          order_no: true,
          buyer_id: true,
          project_id: true,
        },
      },
    },
  });

  if (!orderSupplier) {
    throw new HttpError(404, "주문 공급사 상태를 찾을 수 없습니다.");
  }

  if (orderSupplier.status === OrderSupplierStatus.WAITING) {
    const assignedItemCount = await prisma.orderItem.count({
      where: {
        order_id: orderId,
        supplier_id: supplierId,
        status: OrderItemStatus.ASSIGNED,
      },
    });
    if (assignedItemCount === 0) {
      throw new HttpError(400, "아직 배정되지 않은 주문입니다.");
    }
  }
  if (orderSupplier.status === OrderSupplierStatus.CANCELLED) {
    throw new HttpError(400, "취소된 주문입니다.");
  }
  if (
    orderSupplier.status === OrderSupplierStatus.SUPPLIER_CONFIRMED ||
    orderSupplier.status === OrderSupplierStatus.DELIVERING ||
    orderSupplier.status === OrderSupplierStatus.COMPLETED
  ) {
    throw new HttpError(400, "이미 주문 확인 처리되었습니다.");
  }

  const expectedDeliveryDate = input?.expectedDeliveryDate ?? null;
  const supplierNote = normalizeSupplierNote(input?.supplierNote);

  await prisma.$transaction(async (tx) => {
    await tx.orderSupplier.update({
      where: { id: orderSupplier.id },
      data: {
        status: OrderSupplierStatus.SUPPLIER_CONFIRMED,
        portal_visible: true,
        supplier_checked: true,
        supplier_checked_at: new Date(),
        supplier_checked_by: actorId,
        supplier_confirmed_at: new Date(),
        sent_at: orderSupplier.sent_at ?? new Date(),
        expected_delivery_date: expectedDeliveryDate,
        supplier_note: supplierNote,
      },
    });

    await tx.orderItem.updateMany({
      where: {
        order_id: orderId,
        supplier_id: supplierId,
      },
      data: {
        status: OrderItemStatus.SUPPLIER_CONFIRMED,
      },
    });

    await createAuditLog(
      {
        actorId,
        actionType: "SUPPLIER_CONFIRM_ORDER",
        targetType: "ORDER",
        targetId: orderId,
        afterData: {
          supplierId,
          expectedDeliveryDate: expectedDeliveryDate?.toISOString() ?? null,
          supplierNote,
        },
      },
      tx,
    );
    await createOrderEventLog(
      {
        orderId,
        eventType: OrderEventType.SUPPLIER_CONFIRMED,
        message: "공급사 주문 확인",
        createdBy: actorId,
      },
      tx,
    );

    if (orderSupplier.order.project_id) {
      await syncProjectStatusByOrderSuppliers(
        {
          projectId: orderSupplier.order.project_id,
          actorId,
        },
        tx,
      );
    }
  });

  await createNotification({
    eventType: NotificationEvent.SUPPLIER_CONFIRMED,
    entityType: "ORDER",
    entityId: orderSupplier.order.id,
    message: `공급사가 주문을 확인했습니다. (${orderSupplier.order.order_no})`,
    recipientUserIds: [orderSupplier.order.buyer_id],
  });

  const isDelayedConfirm =
    orderSupplier.sent_at instanceof Date &&
    Date.now() - orderSupplier.sent_at.getTime() >= 1000 * 60 * 60 * 24;
  if (isDelayedConfirm) {
    const adminUserIds = await listActiveUserIdsByRoles(ADMIN_NOTIFICATION_ROLES);
    await createNotification({
      eventType: NotificationEvent.SUPPLIER_CONFIRMED,
      entityType: "ORDER",
      entityId: orderSupplier.order.id,
      message: `공급사 확인이 지연 후 완료되었습니다. (${orderSupplier.order.order_no})`,
      recipientUserIds: adminUserIds,
    });
  }
}

export async function supplierSetDeliveryDate(
  orderId: number,
  supplierId: number,
  actorId: number,
  input: {
    expectedDeliveryDate: Date;
    supplierNote?: string | null;
  },
) {
  const orderSupplier = await prisma.orderSupplier.findUnique({
    where: { order_id_supplier_id: { order_id: orderId, supplier_id: supplierId } },
    include: {
      order: {
        select: {
          project_id: true,
        },
      },
    },
  });

  if (!orderSupplier) {
    throw new HttpError(404, "주문 공급사 상태를 찾을 수 없습니다.");
  }
  if (orderSupplier.status === OrderSupplierStatus.WAITING) {
    throw new HttpError(400, "아직 발송되지 않은 주문입니다.");
  }
  if (orderSupplier.status === OrderSupplierStatus.CANCELLED) {
    throw new HttpError(400, "취소된 주문입니다.");
  }
  if (orderSupplier.status === OrderSupplierStatus.COMPLETED) {
    throw new HttpError(400, "완료된 발주의 납기는 수정할 수 없습니다.");
  }
  if (!orderSupplier.supplier_confirmed_at) {
    throw new HttpError(400, "먼저 공급사 발주 확인을 진행해 주세요.");
  }

  const supplierNote = normalizeSupplierNote(input.supplierNote);

  await prisma.$transaction(async (tx) => {
    await tx.orderSupplier.update({
      where: { id: orderSupplier.id },
      data: {
        status: OrderSupplierStatus.DELIVERING,
        expected_delivery_date: input.expectedDeliveryDate,
        supplier_note: supplierNote,
      },
    });

    await tx.orderItem.updateMany({
      where: {
        order_id: orderId,
        supplier_id: supplierId,
      },
      data: {
        status: OrderItemStatus.SHIPPED,
      },
    });

    await createAuditLog(
      {
        actorId,
        actionType: "SUPPLIER_SET_DELIVERY_DATE",
        targetType: "ORDER",
        targetId: orderId,
        afterData: {
          supplierId,
          expectedDeliveryDate: input.expectedDeliveryDate.toISOString(),
          supplierNote,
        },
      },
      tx,
    );

    if (orderSupplier.order.project_id) {
      await syncProjectStatusByOrderSuppliers(
        {
          projectId: orderSupplier.order.project_id,
          actorId,
        },
        tx,
      );
    }
  });
}

type OrderItemAssignmentInput = {
  orderItemId: number;
  supplierId: number;
  mode?: "MANUAL" | "AUTO_PRODUCT" | "AUTO_TIMEOUT";
};

function toAssignmentMode(mode?: "MANUAL" | "AUTO_PRODUCT" | "AUTO_TIMEOUT") {
  if (mode === "AUTO_PRODUCT") return AssignmentMode.AUTO_PRODUCT;
  if (mode === "AUTO_TIMEOUT") return AssignmentMode.AUTO_TIMEOUT;
  return AssignmentMode.MANUAL;
}

export async function assignOrderItemSupplier(
  orderId: number,
  actorId: number,
  input: OrderItemAssignmentInput,
) {
  const mode = input.mode ?? "MANUAL";
  const settings = await assertAssignmentModeEnabled(mode);

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      order_no: true,
      status: true,
    },
  });
  if (!order) {
    throw new HttpError(404, "주문을 찾을 수 없습니다.");
  }
  if (order.status === OrderStatus.DELIVERED || order.status === OrderStatus.CANCELLED) {
    throw new HttpError(400, "납품 완료/취소된 주문은 재배정할 수 없습니다.");
  }

  const orderItem = await prisma.orderItem.findUnique({
    where: { id: input.orderItemId },
    select: {
      id: true,
      order_id: true,
      supplier_id: true,
      status: true,
    },
  });
  if (!orderItem || orderItem.order_id !== orderId) {
    throw new HttpError(404, "배정 대상 주문 품목을 찾을 수 없습니다.");
  }

  const supplier = await prisma.supplier.findUnique({
    where: { id: input.supplierId },
    select: { id: true, is_active: true, supplier_name: true, order_email: true, cc_email: true },
  });
  if (!supplier || !supplier.is_active) {
    throw new HttpError(400, "유효하지 않은 공급사입니다.");
  }

  const assignmentMode = toAssignmentMode(mode);
  const beforeSupplierId = orderItem.supplier_id;

  const updatedItem = await prisma.$transaction(async (tx) => {
    const updatedItem = await tx.orderItem.update({
      where: { id: orderItem.id },
      data: {
        supplier_id: input.supplierId,
        status: OrderItemStatus.ASSIGNED,
        assigned_by: actorId,
        assigned_at: new Date(),
        assignment_mode: assignmentMode,
      },
    });

    await tx.orderAssignment.create({
      data: {
        order_item_id: orderItem.id,
        supplier_id: input.supplierId,
        assigned_by: actorId,
        assigned_at: new Date(),
      },
    });

    await tx.orderSupplier.upsert({
      where: {
        order_id_supplier_id: {
          order_id: orderId,
          supplier_id: input.supplierId,
        },
      },
      update: {},
      create: {
        order_id: orderId,
        supplier_id: input.supplierId,
        status: OrderSupplierStatus.WAITING,
      },
    });

    if (beforeSupplierId !== input.supplierId) {
      const remains = await tx.orderItem.count({
        where: {
          order_id: orderId,
          supplier_id: beforeSupplierId,
          id: { not: orderItem.id },
        },
      });

      if (remains === 0) {
        const previousSupplierRow = await tx.orderSupplier.findUnique({
          where: {
            order_id_supplier_id: {
              order_id: orderId,
              supplier_id: beforeSupplierId,
            },
          },
        });
        if (previousSupplierRow && previousSupplierRow.status === OrderSupplierStatus.WAITING) {
          await tx.orderSupplier.delete({
            where: {
              order_id_supplier_id: {
                order_id: orderId,
                supplier_id: beforeSupplierId,
              },
            },
          });
        }
      }
    }

    await tx.order.update({
      where: { id: orderId },
      data: { status: OrderStatus.ASSIGNED },
    });

    await createAuditLog(
      {
        actorId,
        actionType: "ASSIGN_ORDER_ITEM_SUPPLIER",
        targetType: "ORDER_ITEM",
        targetId: orderItem.id,
        beforeData: { supplierId: beforeSupplierId, status: orderItem.status },
        afterData: {
          supplierId: input.supplierId,
          status: OrderItemStatus.ASSIGNED,
          mode: assignmentMode,
        },
      },
      tx,
    );
    await createOrderEventLog(
      {
        orderId,
        eventType: OrderEventType.ORDER_ASSIGNED,
        message: `주문 품목 공급사 배정: ${supplier.supplier_name}`,
        createdBy: actorId,
      },
      tx,
    );

    return updatedItem;
  });

  await notifyOrderAssignment({
    orderId,
    orderNo: order.order_no,
    supplier,
    mode: assignmentMode,
    settings,
  });

  const supplierRecipientIds = await listActiveUserIdsBySupplier(input.supplierId);
  await createNotification({
    eventType: NotificationEvent.ORDER_ASSIGNED,
    entityType: "ORDER",
    entityId: orderId,
    message: `주문이 배정되었습니다. (${order.order_no})`,
    recipientUserIds: supplierRecipientIds,
  });

  return updatedItem;
}

export async function autoAssignOrderItemsByProduct(orderId: number, actorId: number) {
  const items = await prisma.orderItem.findMany({
    where: { order_id: orderId },
    select: {
      id: true,
      supplier_id: true,
      status: true,
      product: {
        select: {
          supplier_id: true,
        },
      },
    },
  });

  let assignedCount = 0;
  for (const item of items) {
    const targetSupplierId = item.product.supplier_id;
    const shouldAssign =
      item.supplier_id !== targetSupplierId || item.status === OrderItemStatus.CREATED;
    if (!shouldAssign) {
      continue;
    }
    await assignOrderItemSupplier(orderId, actorId, {
      orderItemId: item.id,
      supplierId: targetSupplierId,
      mode: "AUTO_PRODUCT",
    });
    assignedCount += 1;
  }

  return {
    orderId,
    totalItems: items.length,
    assignedCount,
  };
}

export async function autoAssignOrderItemsByTimeout(orderId: number, actorId: number) {
  const items = await prisma.orderItem.findMany({
    where: {
      order_id: orderId,
      status: OrderItemStatus.CREATED,
    },
    select: {
      id: true,
      product: {
        select: {
          supplier_id: true,
        },
      },
    },
  });

  let assignedCount = 0;
  for (const item of items) {
    await assignOrderItemSupplier(orderId, actorId, {
      orderItemId: item.id,
      supplierId: item.product.supplier_id,
      mode: "AUTO_TIMEOUT",
    });
    assignedCount += 1;
  }

  return {
    orderId,
    totalItems: items.length,
    assignedCount,
  };
}

export async function runTimeoutAutoAssignmentSweep(actorId: number) {
  const settings = await getAssignmentSettings();
  if (!settings.modes.autoTimeout) {
    return {
      scannedOrders: 0,
      assignedOrders: 0,
      assignedItems: 0,
      skipped: "AUTO_TIMEOUT_DISABLED",
    };
  }

  const threshold = new Date(Date.now() - settings.timeoutHours * 60 * 60 * 1000);
  const orders = await prisma.order.findMany({
    where: {
      status: OrderStatus.UNDER_REVIEW,
      updated_at: {
        lte: threshold,
      },
      order_items: {
        some: {
          status: OrderItemStatus.CREATED,
        },
      },
    },
    select: {
      id: true,
    },
    orderBy: [{ created_at: "asc" }],
  });

  let assignedOrders = 0;
  let assignedItems = 0;
  for (const order of orders) {
    const result = await autoAssignOrderItemsByTimeout(order.id, actorId);
    if (result.assignedCount > 0) {
      assignedOrders += 1;
      assignedItems += result.assignedCount;
    }
  }

  return {
    scannedOrders: orders.length,
    assignedOrders,
    assignedItems,
    skipped: null,
  };
}

export async function supplierMarkShipped(
  orderId: number,
  supplierId: number,
  actorId: number,
  input?: { supplierNote?: string | null },
) {
  const orderSupplier = await prisma.orderSupplier.findUnique({
    where: { order_id_supplier_id: { order_id: orderId, supplier_id: supplierId } },
    include: {
      order: {
        select: {
          project_id: true,
        },
      },
    },
  });
  if (!orderSupplier || !orderSupplier.portal_visible) {
    throw new HttpError(404, "주문 공급사 상태를 찾을 수 없습니다.");
  }
  if (
    orderSupplier.status !== OrderSupplierStatus.SUPPLIER_CONFIRMED &&
    orderSupplier.status !== OrderSupplierStatus.DELIVERING
  ) {
    throw new HttpError(400, "출고 처리 가능한 상태가 아닙니다.");
  }

  const supplierNote = normalizeSupplierNote(input?.supplierNote);

  await prisma.$transaction(async (tx) => {
    await tx.orderSupplier.update({
      where: { id: orderSupplier.id },
      data: {
        status: OrderSupplierStatus.DELIVERING,
        supplier_note: supplierNote,
      },
    });

    await tx.orderItem.updateMany({
      where: {
        order_id: orderId,
        supplier_id: supplierId,
        status: {
          notIn: [OrderItemStatus.CANCELLED, OrderItemStatus.DELIVERED],
        },
      },
      data: {
        status: OrderItemStatus.SHIPPED,
      },
    });

    await createAuditLog(
      {
        actorId,
        actionType: "SUPPLIER_MARK_SHIPPED",
        targetType: "ORDER",
        targetId: orderId,
        afterData: { supplierId, supplierNote },
      },
      tx,
    );
    await createOrderEventLog(
      {
        orderId,
        eventType: OrderEventType.SHIPMENT_SHIPPED,
        message: "배송 시작",
        createdBy: actorId,
      },
      tx,
    );

    await syncOrderStatus(orderId, tx);
    if (orderSupplier.order.project_id) {
      await syncProjectStatusByOrderSuppliers(
        {
          projectId: orderSupplier.order.project_id,
          actorId,
        },
        tx,
      );
    }
  });
}

export async function supplierMarkDelivered(
  orderId: number,
  supplierId: number,
  actorId: number,
  input?: { supplierNote?: string | null },
) {
  const orderSupplier = await prisma.orderSupplier.findUnique({
    where: { order_id_supplier_id: { order_id: orderId, supplier_id: supplierId } },
    include: {
      order: {
        select: {
          project_id: true,
        },
      },
    },
  });
  if (!orderSupplier || !orderSupplier.portal_visible) {
    throw new HttpError(404, "주문 공급사 상태를 찾을 수 없습니다.");
  }
  if (
    orderSupplier.status !== OrderSupplierStatus.DELIVERING &&
    orderSupplier.status !== OrderSupplierStatus.SUPPLIER_CONFIRMED
  ) {
    throw new HttpError(400, "납품 완료 처리 가능한 상태가 아닙니다.");
  }

  const supplierNote = normalizeSupplierNote(input?.supplierNote);

  await prisma.$transaction(async (tx) => {
    await tx.orderSupplier.update({
      where: { id: orderSupplier.id },
      data: {
        status: OrderSupplierStatus.COMPLETED,
        supplier_note: supplierNote,
      },
    });

    await tx.orderItem.updateMany({
      where: {
        order_id: orderId,
        supplier_id: supplierId,
        status: {
          not: OrderItemStatus.CANCELLED,
        },
      },
      data: {
        status: OrderItemStatus.DELIVERED,
      },
    });

    await createAuditLog(
      {
        actorId,
        actionType: "SUPPLIER_MARK_DELIVERED",
        targetType: "ORDER",
        targetId: orderId,
        afterData: { supplierId, supplierNote },
      },
      tx,
    );
    await createOrderEventLog(
      {
        orderId,
        eventType: OrderEventType.SHIPMENT_DELIVERED,
        message: "배송 완료",
        createdBy: actorId,
      },
      tx,
    );

    await syncOrderStatus(orderId, tx);
    if (orderSupplier.order.project_id) {
      await syncProjectStatusByOrderSuppliers(
        {
          projectId: orderSupplier.order.project_id,
          actorId,
        },
        tx,
      );
    }
  });
}

export async function supplierCancelOrder(
  orderId: number,
  supplierId: number,
  actorId: number,
  input?: { reason?: string | null },
) {
  const orderSupplier = await prisma.orderSupplier.findUnique({
    where: { order_id_supplier_id: { order_id: orderId, supplier_id: supplierId } },
    include: {
      order: {
        select: {
          project_id: true,
        },
      },
    },
  });

  if (!orderSupplier || !orderSupplier.portal_visible) {
    throw new HttpError(404, "주문 공급사 상태를 찾을 수 없습니다.");
  }
  if (!canCancelOrderSupplier(orderSupplier.status)) {
    if (orderSupplier.status === OrderSupplierStatus.COMPLETED) {
      throw new HttpError(400, "완료된 발주는 취소할 수 없습니다.");
    }
    throw new HttpError(400, "취소 가능한 상태가 아닙니다.");
  }

  const reason = normalizeSupplierNote(input?.reason);

  await prisma.$transaction(async (tx) => {
    await tx.orderSupplier.update({
      where: { id: orderSupplier.id },
      data: {
        status: OrderSupplierStatus.CANCELLED,
        expected_delivery_date: null,
        supplier_note: reason,
      },
    });

    await tx.orderItem.updateMany({
      where: {
        order_id: orderId,
        supplier_id: supplierId,
      },
      data: {
        status: OrderItemStatus.CANCELLED,
      },
    });

    await createAuditLog(
      {
        actorId,
        actionType: "SUPPLIER_CANCEL_ORDER",
        targetType: "ORDER",
        targetId: orderId,
        afterData: { supplierId, reason },
      },
      tx,
    );

    await syncOrderStatus(orderId, tx);
    if (orderSupplier.order.project_id) {
      await syncProjectStatusByOrderSuppliers(
        {
          projectId: orderSupplier.order.project_id,
          actorId,
        },
        tx,
      );
    }
  });
}

export async function adminCancelSupplierOrder(
  orderId: number,
  supplierId: number,
  actorId: number,
  input?: { reason?: string | null },
) {
  const orderSupplier = await prisma.orderSupplier.findUnique({
    where: { order_id_supplier_id: { order_id: orderId, supplier_id: supplierId } },
    include: {
      order: {
        select: {
          project_id: true,
        },
      },
    },
  });

  if (!orderSupplier) {
    throw new HttpError(404, "주문 공급사 상태를 찾을 수 없습니다.");
  }
  if (!canCancelOrderSupplier(orderSupplier.status)) {
    if (orderSupplier.status === OrderSupplierStatus.COMPLETED) {
      throw new HttpError(400, "완료된 발주는 취소할 수 없습니다.");
    }
    throw new HttpError(400, "취소 가능한 상태가 아닙니다.");
  }

  const reason = normalizeSupplierNote(input?.reason);

  await prisma.$transaction(async (tx) => {
    await tx.orderSupplier.update({
      where: { id: orderSupplier.id },
      data: {
        status: OrderSupplierStatus.CANCELLED,
        expected_delivery_date: null,
        supplier_note: reason,
      },
    });

    await tx.orderItem.updateMany({
      where: {
        order_id: orderId,
        supplier_id: supplierId,
      },
      data: {
        status: OrderItemStatus.CANCELLED,
      },
    });

    await createAuditLog(
      {
        actorId,
        actionType: "ADMIN_CANCEL_ORDER",
        targetType: "ORDER",
        targetId: orderId,
        afterData: { supplierId, reason },
      },
      tx,
    );

    await syncOrderStatus(orderId, tx);
    if (orderSupplier.order.project_id) {
      await syncProjectStatusByOrderSuppliers(
        {
          projectId: orderSupplier.order.project_id,
          actorId,
        },
        tx,
      );
    }
  });
}
