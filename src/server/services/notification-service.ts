import { NotificationEvent, Prisma, Role } from "@prisma/client";

import { HttpError } from "@/lib/http";
import { prisma } from "@/lib/prisma";

type CreateNotificationInput = {
  eventType: NotificationEvent;
  entityType: string;
  entityId: number;
  message: string;
  recipientUserIds: number[];
};

export async function createNotification(
  input: CreateNotificationInput,
  tx: Prisma.TransactionClient | typeof prisma = prisma,
) {
  const recipientUserIds = [...new Set(input.recipientUserIds.filter((id) => Number.isInteger(id)))];
  if (recipientUserIds.length === 0) {
    return null;
  }

  const created = await tx.notification.create({
    data: {
      event_type: input.eventType,
      entity_type: input.entityType,
      entity_id: input.entityId,
      message: input.message,
      recipients: {
        createMany: {
          data: recipientUserIds.map((userId) => ({
            user_id: userId,
          })),
          skipDuplicates: true,
        },
      },
    },
    select: {
      id: true,
      event_type: true,
      entity_type: true,
      entity_id: true,
      message: true,
      created_at: true,
    },
  });

  return created;
}

export async function markAsRead(recipientId: number, userId: number) {
  const result = await prisma.notificationRecipient.updateMany({
    where: {
      id: recipientId,
      user_id: userId,
      is_read: false,
    },
    data: {
      is_read: true,
    },
  });

  if (result.count === 0) {
    throw new HttpError(404, "알림을 찾을 수 없습니다.");
  }

  return { id: recipientId, isRead: true };
}

export async function listUserNotifications(userId: number, limit = 20) {
  const take = Math.max(1, Math.min(limit, 100));
  const [rows, unreadCount] = await Promise.all([
    prisma.notificationRecipient.findMany({
      where: { user_id: userId },
      include: {
        notification: true,
      },
      orderBy: [
        { notification: { created_at: "desc" } },
        { id: "desc" },
      ],
      take,
    }),
    prisma.notificationRecipient.count({
      where: {
        user_id: userId,
        is_read: false,
      },
    }),
  ]);

  return {
    unreadCount,
    notifications: rows.map((row) => ({
      recipientId: row.id,
      isRead: row.is_read,
      createdAt: row.notification.created_at,
      eventType: row.notification.event_type,
      entityType: row.notification.entity_type,
      entityId: row.notification.entity_id,
      message: row.notification.message,
    })),
  };
}

export async function listActiveUserIdsByRoles(roles: Role[]) {
  const uniqueRoles = [...new Set(roles)];
  if (uniqueRoles.length === 0) {
    return [];
  }
  const users = await prisma.user.findMany({
    where: {
      role: { in: uniqueRoles },
      is_active: true,
    },
    select: { id: true },
  });
  return users.map((user) => user.id);
}

export async function listActiveUserIdsBySupplier(supplierId: number) {
  const users = await prisma.user.findMany({
    where: {
      supplier_id: supplierId,
      is_active: true,
    },
    select: { id: true },
  });
  return users.map((user) => user.id);
}
