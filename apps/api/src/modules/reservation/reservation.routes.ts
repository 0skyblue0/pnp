import { createHash } from "node:crypto";

import type { Prisma, Product } from "@prisma/client";
import type { FastifyInstance } from "fastify";

import { HttpError, sendOk } from "../../common/http.js";
import { calculateAvailableWalkin } from "./inventory-calculator.js";
import {
  availabilityParamsSchema,
  availabilityQuerySchema,
  createReservationSchema,
  idParamsSchema,
  listReservationQuerySchema,
  updateReservationStatusSchema,
  type ReservationItemInput
} from "./reservation.schemas.js";

type ReservationWithItems = Prisma.ReservationGetPayload<{
  include: {
    items: {
      include: {
        product: true;
      };
    };
  };
}>;

const KST_OFFSET = "+09:00";

function parseDateOnly(date: string): Date {
  return new Date(`${date}T00:00:00.000Z`);
}

function formatDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function parseStoreDateTime(value: string): Date {
  const normalized = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)
    ? `${value}:00${KST_OFFSET}`
    : /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(value)
      ? `${value}${KST_OFFSET}`
      : value;
  const parsed = new Date(normalized);

  if (Number.isNaN(parsed.getTime())) {
    throw new HttpError(400, "INVALID_DATETIME", "Invalid date-time value");
  }

  return parsed;
}

function parseStoreDateStart(date: string): Date {
  return parseStoreDateTime(`${date}T00:00`);
}

function parseStoreDateEnd(date: string): Date {
  const start = parseDateOnly(date);
  start.setUTCDate(start.getUTCDate() + 1);
  return parseStoreDateStart(formatDateOnly(start));
}

function todayInStoreTime(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date());
}

function toContactToken(contactRef: string): string {
  return createHash("sha256").update(contactRef.trim()).digest("hex");
}

function toReservationDto(reservation: ReservationWithItems) {
  return {
    id: reservation.id.toString(),
    pickupAt: reservation.pickupAt.toISOString(),
    status: reservation.status,
    purpose: reservation.purpose,
    allergyNote: reservation.allergyNote,
    memo: reservation.memo,
    cancelReason: reservation.cancelReason,
    createdAt: reservation.createdAt.toISOString(),
    completedAt: reservation.completedAt?.toISOString() ?? null,
    items: reservation.items.map((item) => ({
      id: item.id.toString(),
      productId: item.productId,
      productName: item.product.name,
      quantity: item.quantity
    }))
  };
}

async function resolveProduct(
  app: FastifyInstance,
  input: Pick<ReservationItemInput, "productId" | "productName">
): Promise<Product> {
  if (input.productId !== undefined) {
    const product = await app.prisma.product.findUnique({
      where: { id: input.productId }
    });

    if (!product) {
      throw new HttpError(404, "PRODUCT_NOT_FOUND", "Product not found");
    }

    return product;
  }

  const productName = input.productName;
  if (!productName) {
    throw new HttpError(400, "PRODUCT_REQUIRED", "productId or productName is required");
  }

  const existing = await app.prisma.product.findFirst({
    where: { name: productName },
    orderBy: { id: "asc" }
  });

  if (existing) {
    return existing;
  }

  return app.prisma.product.create({
    data: {
      name: productName,
      isActive: true
    }
  });
}

async function findReservationById(app: FastifyInstance, id: bigint) {
  return app.prisma.reservation.findUnique({
    where: { id },
    include: {
      items: {
        include: {
          product: true
        }
      }
    }
  });
}

export async function registerReservationRoutes(app: FastifyInstance): Promise<void> {
  app.get("/today", async (_request, reply) => {
    const today = todayInStoreTime();
    const items = await app.prisma.reservation.findMany({
      where: {
        pickupAt: {
          gte: parseStoreDateStart(today),
          lt: parseStoreDateEnd(today)
        }
      },
      include: {
        items: {
          include: {
            product: true
          }
        }
      },
      orderBy: { pickupAt: "asc" },
      take: 100
    });

    return sendOk(reply, {
      items: items.map(toReservationDto),
      total: items.length,
      page: 1,
      size: items.length
    });
  });

  app.get("/", async (request, reply) => {
    const query = listReservationQuerySchema.parse(request.query);
    const where: Prisma.ReservationWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.from || query.to
        ? {
            pickupAt: {
              ...(query.from ? { gte: parseStoreDateStart(query.from) } : {}),
              ...(query.to ? { lt: parseStoreDateEnd(query.to) } : {})
            }
          }
        : {})
    };

    const [items, total] = await app.prisma.$transaction([
      app.prisma.reservation.findMany({
        where,
        include: {
          items: {
            include: {
              product: true
            }
          }
        },
        orderBy: { pickupAt: "asc" },
        take: 100
      }),
      app.prisma.reservation.count({ where })
    ]);

    return sendOk(reply, {
      items: items.map(toReservationDto),
      total,
      page: 1,
      size: items.length
    });
  });

  app.post("/", async (request, reply) => {
    const input = createReservationSchema.parse(request.body);
    const products = await Promise.all(input.items.map((item) => resolveProduct(app, item)));

    const reservation = await app.prisma.reservation.create({
      data: {
        contactToken: toContactToken(input.contactRef),
        pickupAt: parseStoreDateTime(input.pickupAt),
        purpose: input.purpose,
        allergyNote: input.allergyNote ?? null,
        memo: input.memo ?? null,
        items: {
          create: input.items.map((item, index) => ({
            productId: products[index]?.id ?? 0,
            quantity: item.quantity
          }))
        }
      },
      include: {
        items: {
          include: {
            product: true
          }
        }
      }
    });

    return sendOk(reply, toReservationDto(reservation), 201);
  });

  app.patch("/:id/status", async (request, reply) => {
    const params = idParamsSchema.parse(request.params);
    const input = updateReservationStatusSchema.parse(request.body);
    const existing = await findReservationById(app, params.id);

    if (!existing) {
      throw new HttpError(404, "RESERVATION_NOT_FOUND", "Reservation not found");
    }

    const updated = await app.prisma.reservation.update({
      where: { id: params.id },
      data: {
        status: input.status,
        cancelReason: input.status === "CANCELED" ? (input.cancelReason ?? null) : null,
        completedAt: input.status === "COMPLETED" ? new Date() : null
      },
      include: {
        items: {
          include: {
            product: true
          }
        }
      }
    });

    return sendOk(reply, toReservationDto(updated));
  });

  app.get("/availability/:date/:productId", async (request, reply) => {
    const params = availabilityParamsSchema.parse(request.params);
    const query = availabilityQuerySchema.parse(request.query);
    const reserved = await app.prisma.reservationItem.aggregate({
      where: {
        productId: params.productId,
        reservation: {
          pickupAt: {
            gte: parseStoreDateStart(params.date),
            lt: parseStoreDateEnd(params.date)
          },
          status: {
            notIn: ["CANCELED", "NO_SHOW"]
          }
        }
      },
      _sum: {
        quantity: true
      }
    });

    const calculation = calculateAvailableWalkin({
      produced: query.produced,
      soldWalkin: query.sold_walkin,
      reservedToday: reserved._sum.quantity ?? 0
    });

    return sendOk(reply, {
      date: params.date,
      productId: params.productId,
      ...calculation
    });
  });
}
