import { notificationSeveritySchema, notificationTypeSchema } from "@pnp/shared";
import type { FastifyInstance } from "fastify";
import { z } from "zod";

import { HttpError, sendOk } from "../../common/http.js";

const listNotificationQuerySchema = z.object({
  unread: z.coerce.boolean().optional()
});

const notificationSchema = z.object({
  type: notificationTypeSchema,
  title: z.string().min(1).max(120),
  body: z.string().max(2000).optional(),
  link: z.string().max(200).optional(),
  severity: notificationSeveritySchema.default("INFO")
});

type NotificationRecord = z.infer<typeof notificationSchema> & {
  id: number;
  isRead: boolean;
  createdAt: string;
  readAt: string | null;
};

const idParamsSchema = z.object({
  id: z.coerce.bigint().positive()
});

function toNotificationDto(notification: {
  id: bigint;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  severity: string | null;
  isRead: boolean;
  createdAt: Date;
  readAt: Date | null;
}): NotificationRecord {
  return {
    id: Number(notification.id),
    type: notificationTypeSchema.parse(notification.type),
    title: notification.title,
    body: notification.body ?? undefined,
    link: notification.link ?? undefined,
    severity: notificationSeveritySchema.parse(notification.severity ?? "INFO"),
    isRead: notification.isRead,
    createdAt: notification.createdAt.toISOString(),
    readAt: notification.readAt?.toISOString() ?? null
  };
}

export async function registerNotificationRoutes(app: FastifyInstance): Promise<void> {
  app.get("/", async (request, reply) => {
    const query = listNotificationQuerySchema.parse(request.query);
    const where = query.unread === true ? { isRead: false } : {};
    const [items, total] = await app.prisma.$transaction([
      app.prisma.notification.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: 100
      }),
      app.prisma.notification.count({ where })
    ]);

    return sendOk(reply, {
      items: items.map(toNotificationDto),
      total,
      page: 1,
      size: items.length
    });
  });

  app.post("/", async (request, reply) => {
    const input = notificationSchema.parse(request.body);
    const record = await app.prisma.notification.create({
      data: {
        type: input.type,
        title: input.title,
        body: input.body ?? null,
        link: input.link ?? null,
        severity: input.severity,
        isRead: false
      }
    });

    return sendOk(reply, toNotificationDto(record), 201);
  });

  app.patch("/:id/read", async (request, reply) => {
    const params = idParamsSchema.parse(request.params);
    const notification = await app.prisma.notification.findUnique({
      where: { id: params.id }
    });

    if (!notification) {
      throw new HttpError(404, "NOTIFICATION_NOT_FOUND", "Notification not found");
    }

    const updated = await app.prisma.notification.update({
      where: { id: params.id },
      data: {
        isRead: true,
        readAt: new Date()
      }
    });

    return sendOk(reply, toNotificationDto(updated));
  });

  app.patch("/read-all", async (_request, reply) => {
    const updated = await app.prisma.notification.updateMany({
      where: { isRead: false },
      data: {
        isRead: true,
        readAt: new Date()
      }
    });

    return sendOk(reply, { updated: updated.count });
  });
}
