import type { Prisma } from "@prisma/client";
import type { FastifyInstance } from "fastify";

import {
  formatDateOnly,
  formatTimeOnly,
  parseDateOnly,
  parseStoreDateTime,
  parseTimeOnly,
  subtractDays,
  todayInStoreTime
} from "../../common/datetime.js";
import { HttpError, sendOk } from "../../common/http.js";
import { resolveProduct } from "../product/product-resolver.js";
import {
  createCongestionLogSchema,
  createDiscardSchema,
  createStockoutLogSchema,
  createTastingLogSchema,
  dateParamsSchema,
  idParamsSchema,
  incrementAbsentInquirySchema,
  listAbsentInquiryQuerySchema,
  listStockoutQuerySchema,
  updateStockoutLogSchema
} from "./daily-log.schemas.js";

type DailyLogWithRelations = Prisma.DailyLogGetPayload<{
  include: {
    congestionLogs: true;
    tastingLogs: {
      include: {
        product: true;
      };
    };
  };
}>;

type StockoutWithProduct = Prisma.StockoutLogGetPayload<{
  include: {
    product: true;
  };
}>;

function toDailyLogDto(dailyLog: DailyLogWithRelations) {
  return {
    id: dailyLog.id.toString(),
    date: formatDateOnly(dailyLog.date),
    weatherSummary: dailyLog.weatherSummary,
    notes: dailyLog.notes,
    congestionLogs: dailyLog.congestionLogs.map((log) => ({
      id: log.id.toString(),
      timeSlotStart: formatTimeOnly(log.timeSlotStart),
      timeSlotEnd: formatTimeOnly(log.timeSlotEnd),
      level: log.level,
      queueInside: log.queueInside,
      queueOutside: log.queueOutside,
      estLostCustomers: log.estLostCustomers
    })),
    tastingLogs: dailyLog.tastingLogs.map((log) => ({
      id: log.id.toString(),
      productId: log.productId,
      productName: log.product.name,
      recommended: log.recommended,
      convertedToSale: log.convertedToSale,
      note: log.note
    })),
    createdAt: dailyLog.createdAt.toISOString(),
    updatedAt: dailyLog.updatedAt.toISOString()
  };
}

function toStockoutDto(stockout: StockoutWithProduct) {
  return {
    id: stockout.id.toString(),
    productId: stockout.productId,
    productName: stockout.product.name,
    date: formatDateOnly(stockout.date),
    sequence: stockout.sequence,
    stockoutAt: stockout.stockoutAt.toISOString(),
    inquiryAfterStockout: stockout.inquiryAfterStockout,
    discardQty: stockout.discardQty,
    discardReason: stockout.discardReason,
    createdAt: stockout.createdAt.toISOString()
  };
}

function toAbsentInquiryDto(absentInquiry: {
  id: bigint;
  productName: string;
  productId: number | null;
  date: Date;
  count: number;
  note: string | null;
}) {
  return {
    id: absentInquiry.id.toString(),
    productName: absentInquiry.productName,
    productId: absentInquiry.productId,
    date: formatDateOnly(absentInquiry.date),
    count: absentInquiry.count,
    note: absentInquiry.note
  };
}

async function findDailyLog(
  app: FastifyInstance,
  date: Date
): Promise<DailyLogWithRelations | null> {
  return app.prisma.dailyLog.findUnique({
    where: { date },
    include: {
      congestionLogs: {
        orderBy: { timeSlotStart: "asc" }
      },
      tastingLogs: {
        include: {
          product: true
        },
        orderBy: { id: "desc" }
      }
    }
  });
}

async function getOrCreateDailyLog(
  app: FastifyInstance,
  date: Date
): Promise<DailyLogWithRelations> {
  const existing = await findDailyLog(app, date);

  if (existing) {
    return existing;
  }

  return app.prisma.dailyLog.create({
    data: { date },
    include: {
      congestionLogs: true,
      tastingLogs: {
        include: {
          product: true
        }
      }
    }
  });
}

export async function registerDailyLogRoutes(app: FastifyInstance): Promise<void> {
  app.get("/daily-log/today", async (_request, reply) => {
    const dailyLog = await getOrCreateDailyLog(app, parseDateOnly(todayInStoreTime()));
    return sendOk(reply, toDailyLogDto(dailyLog));
  });

  app.get("/daily-log/:date", async (request, reply) => {
    const params = dateParamsSchema.parse(request.params);
    const dailyLog = await getOrCreateDailyLog(app, parseDateOnly(params.date));
    return sendOk(reply, toDailyLogDto(dailyLog));
  });

  app.post("/daily-log/:date/congestion", async (request, reply) => {
    const params = dateParamsSchema.parse(request.params);
    const input = createCongestionLogSchema.parse(request.body);

    const dailyLog = await getOrCreateDailyLog(app, parseDateOnly(params.date));
    const start = parseTimeOnly(input.timeSlotStart);
    const end = parseTimeOnly(input.timeSlotEnd);

    if (end <= start) {
      throw new HttpError(400, "INVALID_TIME_RANGE", "timeSlotEnd must be after timeSlotStart");
    }

    await app.prisma.congestionLog.create({
      data: {
        dailyLogId: dailyLog.id,
        timeSlotStart: start,
        timeSlotEnd: end,
        level: input.level ?? null,
        queueInside: input.queueInside,
        queueOutside: input.queueOutside,
        estLostCustomers: input.estLostCustomers
      }
    });
    await app.prisma.dailyLog.update({
      where: { id: dailyLog.id },
      data: { updatedAt: new Date() }
    });

    const updated = await findDailyLog(app, dailyLog.date);
    return sendOk(reply, toDailyLogDto(updated ?? dailyLog), 201);
  });

  app.post("/daily-log/:date/tasting", async (request, reply) => {
    const params = dateParamsSchema.parse(request.params);
    const input = createTastingLogSchema.parse(request.body);
    const [dailyLog, product] = await Promise.all([
      getOrCreateDailyLog(app, parseDateOnly(params.date)),
      resolveProduct(app, input)
    ]);

    await app.prisma.tastingLog.create({
      data: {
        dailyLogId: dailyLog.id,
        productId: product.id,
        recommended: input.recommended,
        convertedToSale: input.convertedToSale ?? null,
        note: input.note ?? null
      }
    });
    await app.prisma.dailyLog.update({
      where: { id: dailyLog.id },
      data: { updatedAt: new Date() }
    });

    const updated = await findDailyLog(app, dailyLog.date);
    return sendOk(reply, toDailyLogDto(updated ?? dailyLog), 201);
  });

  app.post("/stockout", async (request, reply) => {
    const input = createStockoutLogSchema.parse(request.body);
    const product = await resolveProduct(app, input);

    const stockout = await app.prisma.stockoutLog.create({
      data: {
        productId: product.id,
        date: parseDateOnly(input.date),
        sequence: input.sequence,
        stockoutAt: parseStoreDateTime(input.stockoutAt),
        inquiryAfterStockout: input.inquiryAfterStockout ?? null,
        discardQty: input.discardQty,
        discardReason: input.discardReason ?? null
      },
      include: {
        product: true
      }
    });

    return sendOk(reply, toStockoutDto(stockout), 201);
  });

  app.post("/discard", async (request, reply) => {
    const input = createDiscardSchema.parse(request.body);
    const date = parseDateOnly(input.date);
    const product = await app.prisma.product.findUnique({
      where: { id: input.productId }
    });

    if (!product) {
      throw new HttpError(404, "PRODUCT_NOT_FOUND", "Product not found");
    }

    let statusCode = 200;
    const stockout = await app.prisma.$transaction(async (tx) => {
      const latest = await tx.stockoutLog.findFirst({
        where: {
          productId: input.productId,
          date
        },
        include: {
          product: true
        },
        orderBy: [{ stockoutAt: "desc" }, { id: "desc" }]
      });

      if (latest) {
        return tx.stockoutLog.update({
          where: { id: latest.id },
          data: {
            discardQty: { increment: input.discardQty }
          },
          include: {
            product: true
          }
        });
      }

      statusCode = 201;
      return tx.stockoutLog.create({
        data: {
          productId: product.id,
          date,
          sequence: 1,
          stockoutAt: new Date(),
          inquiryAfterStockout: null,
          discardQty: input.discardQty
        },
        include: {
          product: true
        }
      });
    });

    return sendOk(reply, toStockoutDto(stockout), statusCode);
  });

  app.get("/stockout", async (request, reply) => {
    const query = listStockoutQuerySchema.parse(request.query);
    const where: Prisma.StockoutLogWhereInput = {
      ...(query.product_id !== undefined ? { productId: query.product_id } : {}),
      ...(query.from || query.to
        ? {
            date: {
              ...(query.from ? { gte: parseDateOnly(query.from) } : {}),
              ...(query.to ? { lte: parseDateOnly(query.to) } : {})
            }
          }
        : {})
    };

    const [items, total] = await app.prisma.$transaction([
      app.prisma.stockoutLog.findMany({
        where,
        include: {
          product: true
        },
        orderBy: [{ date: "desc" }, { stockoutAt: "desc" }],
        take: 100
      }),
      app.prisma.stockoutLog.count({ where })
    ]);

    return sendOk(reply, {
      items: items.map(toStockoutDto),
      total,
      page: 1,
      size: items.length
    });
  });

  app.patch("/stockout/:id", async (request, reply) => {
    const params = idParamsSchema.parse(request.params);
    const input = updateStockoutLogSchema.parse(request.body);
    const existing = await app.prisma.stockoutLog.findUnique({
      where: { id: params.id }
    });

    if (!existing) {
      throw new HttpError(404, "STOCKOUT_NOT_FOUND", "Stockout log not found");
    }

    const data: Prisma.StockoutLogUncheckedUpdateInput = {
      ...(input.sequence !== undefined ? { sequence: input.sequence } : {}),
      ...(input.stockoutAt !== undefined
        ? { stockoutAt: parseStoreDateTime(input.stockoutAt) }
        : {}),
      ...(input.inquiryAfterStockout !== undefined
        ? { inquiryAfterStockout: input.inquiryAfterStockout }
        : {}),
      ...(input.discardQty !== undefined ? { discardQty: input.discardQty } : {}),
      ...(input.discardReason !== undefined ? { discardReason: input.discardReason } : {})
    };

    const updated = await app.prisma.stockoutLog.update({
      where: { id: params.id },
      data,
      include: {
        product: true
      }
    });

    return sendOk(reply, toStockoutDto(updated));
  });

  app.post("/absent-inquiry/increment", async (request, reply) => {
    const input = incrementAbsentInquirySchema.parse(request.body);
    const date = parseDateOnly(input.date ?? todayInStoreTime());
    const product = input.productId
      ? await app.prisma.product.findUnique({ where: { id: input.productId } })
      : await app.prisma.product.findFirst({
          where: { name: input.productName },
          orderBy: { id: "asc" }
        });

    if (input.productId && !product) {
      throw new HttpError(404, "PRODUCT_NOT_FOUND", "Product not found");
    }

    const absentInquiry = await app.prisma.absentInquiry.upsert({
      where: {
        productName_date: {
          productName: input.productName,
          date
        }
      },
      update: {
        count: { increment: 1 },
        ...(input.note !== undefined ? { note: input.note } : {}),
        ...(product ? { productId: product.id } : {})
      },
      create: {
        productName: input.productName,
        productId: product?.id ?? null,
        date,
        count: 1,
        note: input.note ?? null
      }
    });

    if (absentInquiry.count === 3) {
      await app.prisma.notification.create({
        data: {
          type: "ABSENT_INQUIRY_STREAK",
          title: `미취급 문의 3회 누적: ${absentInquiry.productName}`,
          body: `${formatDateOnly(absentInquiry.date)} 기준 ${absentInquiry.count}회`,
          link: "/daily-log/today",
          severity: "WARN"
        }
      });
    }

    return sendOk(reply, toAbsentInquiryDto(absentInquiry));
  });

  app.get("/absent-inquiry", async (request, reply) => {
    const query = listAbsentInquiryQuerySchema.parse(request.query);
    const today = todayInStoreTime();
    const where: Prisma.AbsentInquiryWhereInput = query.date
      ? { date: parseDateOnly(query.date) }
      : query.streak_days
        ? {
            date: {
              gte: parseDateOnly(subtractDays(today, query.streak_days - 1)),
              lte: parseDateOnly(today)
            }
          }
        : { date: parseDateOnly(today) };

    const [items, total] = await app.prisma.$transaction([
      app.prisma.absentInquiry.findMany({
        where,
        orderBy: [{ date: "desc" }, { count: "desc" }, { productName: "asc" }],
        take: 100
      }),
      app.prisma.absentInquiry.count({ where })
    ]);

    return sendOk(reply, {
      items: items.map(toAbsentInquiryDto),
      total,
      page: 1,
      size: items.length
    });
  });
}
