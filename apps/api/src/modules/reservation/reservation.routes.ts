import { createHash } from "node:crypto";

import type { Prisma } from "@prisma/client";
import type { FastifyInstance } from "fastify";

import {
  parseStoreDateEnd,
  parseStoreDateStart,
  parseStoreDateTime,
  todayInStoreTime
} from "../../common/datetime.js";
import { HttpError, sendOk } from "../../common/http.js";
import { resolveProduct } from "../product/product-resolver.js";
import { calculateAvailableWalkin } from "./inventory-calculator.js";
import {
  availabilityParamsSchema,
  availabilityQuerySchema,
  createReservationSchema,
  idParamsSchema,
  listReservationQuerySchema,
  updateReservationPaymentSchema,
  updateReservationSchema,
  updateReservationStatusSchema,
  upsertRegularCustomerSchema
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

function toContactToken(contactRef: string): string {
  return createHash("sha256").update(contactRef.trim()).digest("hex");
}

function toReservationDto(reservation: ReservationWithItems) {
  return {
    id: reservation.id.toString(),
    customerName: reservation.customerName,
    contactPhone: reservation.contactPhone,
    pickupAt: reservation.pickupAt.toISOString(),
    status: reservation.status,
    isPaid: reservation.isPaid,
    isCut: reservation.isCut,
    isBag: reservation.isBag,
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
      quantity: item.quantity,
      cuttingOption: item.cuttingOption
    }))
  };
}

function toRegularCustomerDto(customer: Prisma.RegularCustomerGetPayload<Record<string, never>>) {
  return {
    id: customer.id.toString(),
    customerName: customer.customerName,
    contactPhone: customer.contactPhone,
    fixedMemo: customer.fixedMemo,
    createdAt: customer.createdAt.toISOString(),
    updatedAt: customer.updatedAt.toISOString()
  };
}

function hasCuttingRequest(items: Array<{ cuttingOption?: string }>): boolean {
  return items.some((item) => item.cuttingOption !== undefined && item.cuttingOption !== "NONE");
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

  app.get("/regular-customers", async (_request, reply) => {
    const items = await app.prisma.regularCustomer.findMany({
      where: { isActive: true },
      orderBy: [{ updatedAt: "desc" }, { customerName: "asc" }],
      take: 100
    });

    return sendOk(reply, {
      items: items.map(toRegularCustomerDto),
      total: items.length,
      page: 1,
      size: items.length
    });
  });

  app.post("/regular-customers", async (request, reply) => {
    const input = upsertRegularCustomerSchema.parse(request.body);
    const customer = await app.prisma.regularCustomer.create({
      data: {
        customerName: input.customerName,
        contactPhone: input.contactPhone || null,
        fixedMemo: input.fixedMemo
      }
    });

    return sendOk(reply, toRegularCustomerDto(customer), 201);
  });

  app.patch("/regular-customers/:id", async (request, reply) => {
    const params = idParamsSchema.parse(request.params);
    const input = upsertRegularCustomerSchema.parse(request.body);
    const customer = await app.prisma.regularCustomer.update({
      where: { id: params.id },
      data: {
        customerName: input.customerName,
        contactPhone: input.contactPhone || null,
        fixedMemo: input.fixedMemo,
        updatedAt: new Date()
      }
    });

    return sendOk(reply, toRegularCustomerDto(customer));
  });

  app.delete("/regular-customers/:id", async (request, reply) => {
    const params = idParamsSchema.parse(request.params);
    await app.prisma.regularCustomer.update({
      where: { id: params.id },
      data: { isActive: false, updatedAt: new Date() }
    });

    return sendOk(reply, { deleted: true });
  });

  app.post("/", async (request, reply) => {
    const input = createReservationSchema.parse(request.body);
    const products = await Promise.all(input.items.map((item) => resolveProduct(app, item)));

    const reservation = await app.prisma.reservation.create({
      data: {
        contactToken: toContactToken(input.contactRef),
        customerName: input.customerName,
        contactPhone: input.contactPhone,
        pickupAt: parseStoreDateTime(input.pickupAt),
        isPaid: input.isPaid,
        isBag: input.isBag,
        isCut: hasCuttingRequest(input.items),
        purpose: input.purpose,
        allergyNote: input.allergyNote ?? null,
        memo: input.memo ?? null,
        items: {
          create: input.items.map((item, index) => ({
            productId: products[index]?.id ?? 0,
            quantity: item.quantity,
            cuttingOption: item.cuttingOption
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

  app.patch("/:id", async (request, reply) => {
    const params = idParamsSchema.parse(request.params);
    const input = updateReservationSchema.parse(request.body);
    const existing = await findReservationById(app, params.id);

    if (!existing) {
      throw new HttpError(404, "RESERVATION_NOT_FOUND", "Reservation not found");
    }

    const products = input.items
      ? await Promise.all(input.items.map((item) => resolveProduct(app, item)))
      : [];

    const updated = await app.prisma.reservation.update({
      where: { id: params.id },
      data: {
        ...(input.contactRef ? { contactToken: toContactToken(input.contactRef) } : {}),
        ...(input.customerName !== undefined ? { customerName: input.customerName } : {}),
        ...(input.contactPhone !== undefined ? { contactPhone: input.contactPhone } : {}),
        ...(input.pickupAt !== undefined ? { pickupAt: parseStoreDateTime(input.pickupAt) } : {}),
        ...(input.isPaid !== undefined ? { isPaid: input.isPaid } : {}),
        ...(input.isBag !== undefined ? { isBag: input.isBag } : {}),
        ...(input.items ? { isCut: hasCuttingRequest(input.items) } : {}),
        ...(input.memo !== undefined ? { memo: input.memo ?? null } : {}),
        ...(input.items
          ? {
              items: {
                deleteMany: {},
                create: input.items.map((item, index) => ({
                  productId: products[index]?.id ?? 0,
                  quantity: item.quantity,
                  cuttingOption: item.cuttingOption
                }))
              }
            }
          : {})
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
        cancelReason: null,
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

  app.patch("/:id/payment", async (request, reply) => {
    const params = idParamsSchema.parse(request.params);
    const input = updateReservationPaymentSchema.parse(request.body);
    const existing = await findReservationById(app, params.id);

    if (!existing) {
      throw new HttpError(404, "RESERVATION_NOT_FOUND", "Reservation not found");
    }

    const updated = await app.prisma.reservation.update({
      where: { id: params.id },
      data: {
        isPaid: input.isPaid
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

  app.delete("/:id", async (request, reply) => {
    const params = idParamsSchema.parse(request.params);
    const existing = await findReservationById(app, params.id);

    if (!existing) {
      throw new HttpError(404, "RESERVATION_NOT_FOUND", "Reservation not found");
    }

    await app.prisma.reservation.delete({ where: { id: params.id } });

    return sendOk(reply, { deleted: true });
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
