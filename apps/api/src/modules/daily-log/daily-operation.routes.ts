import type { Prisma } from "@prisma/client";
import type { FastifyInstance } from "fastify";
import { z } from "zod";

import { formatDateOnly, parseDateOnly } from "../../common/datetime.js";
import { HttpError, sendOk } from "../../common/http.js";

const dateOnlySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const dailyOperationRecordBodySchema = z.object({
  draft: z.record(z.string(), z.unknown()),
  productRows: z.array(z.record(z.string(), z.unknown())),
  channelRows: z.array(z.record(z.string(), z.unknown())),
  staffSpecialRows: z.record(z.string(), z.unknown())
});

const listDailyOperationQuerySchema = z.object({
  from: dateOnlySchema.optional(),
  to: dateOnlySchema.optional()
});

const dailyOperationDateParamsSchema = z.object({
  date: dateOnlySchema
});

function toInputJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function toDto(record: {
  id: bigint;
  date: Date;
  draft: Prisma.JsonValue;
  productRows: Prisma.JsonValue;
  channelRows: Prisma.JsonValue;
  staffSpecialRows: Prisma.JsonValue;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: record.id.toString(),
    date: formatDateOnly(record.date),
    draft: record.draft,
    productRows: record.productRows,
    channelRows: record.channelRows,
    staffSpecialRows: record.staffSpecialRows,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString()
  };
}

export async function registerDailyOperationRoutes(app: FastifyInstance): Promise<void> {
  app.get("/", async (request, reply) => {
    const query = listDailyOperationQuerySchema.parse(request.query);
    const where =
      query.from || query.to
        ? {
            date: {
              ...(query.from ? { gte: parseDateOnly(query.from) } : {}),
              ...(query.to ? { lte: parseDateOnly(query.to) } : {})
            }
          }
        : {};

    const [items, total] = await app.prisma.$transaction([
      app.prisma.dailyOperationRecord.findMany({
        where,
        orderBy: { date: "desc" },
        take: 370
      }),
      app.prisma.dailyOperationRecord.count({ where })
    ]);

    return sendOk(reply, { items: items.map(toDto), total, page: 1, size: items.length });
  });

  app.get("/:date", async (request, reply) => {
    const params = dailyOperationDateParamsSchema.parse(request.params);
    const record = await app.prisma.dailyOperationRecord.findUnique({
      where: { date: parseDateOnly(params.date) }
    });

    if (!record) {
      throw new HttpError(404, "DAILY_OPERATION_NOT_FOUND", "일일 운영 기록을 찾을 수 없습니다.");
    }

    return sendOk(reply, toDto(record));
  });

  app.put("/:date", async (request, reply) => {
    const params = dailyOperationDateParamsSchema.parse(request.params);
    const input = dailyOperationRecordBodySchema.parse(request.body);
    const date = parseDateOnly(params.date);
    const now = new Date();

    const record = await app.prisma.dailyOperationRecord.upsert({
      where: { date },
      create: {
        date,
        draft: toInputJson({ ...input.draft, date: params.date }),
        productRows: toInputJson(input.productRows),
        channelRows: toInputJson(input.channelRows),
        staffSpecialRows: toInputJson(input.staffSpecialRows),
        updatedAt: now
      },
      update: {
        draft: toInputJson({ ...input.draft, date: params.date }),
        productRows: toInputJson(input.productRows),
        channelRows: toInputJson(input.channelRows),
        staffSpecialRows: toInputJson(input.staffSpecialRows),
        updatedAt: now
      }
    });

    return sendOk(reply, toDto(record));
  });

  app.delete("/:date", async (request, reply) => {
    const params = dailyOperationDateParamsSchema.parse(request.params);
    const date = parseDateOnly(params.date);
    const existing = await app.prisma.dailyOperationRecord.findUnique({ where: { date } });
    if (!existing) {
      throw new HttpError(404, "DAILY_OPERATION_NOT_FOUND", "일일 운영 기록을 찾을 수 없습니다.");
    }

    await app.prisma.dailyOperationRecord.delete({ where: { date } });
    return sendOk(reply, { deleted: true });
  });
}
