import type { Prisma, Product } from "@prisma/client";
import type { FastifyInstance } from "fastify";

import { HttpError, sendOk } from "../../common/http.js";
import {
  createProductionLotSchema,
  listProductionLotQuerySchema,
  type CreateProductionLotInput
} from "./production-lot.schemas.js";

type ProductionLotWithProduct = Prisma.ProductionLotGetPayload<{
  include: {
    product: true;
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

function toProductionLotDto(lot: ProductionLotWithProduct) {
  return {
    id: lot.id.toString(),
    productId: lot.productId,
    productName: lot.product.name,
    producedAt: lot.producedAt.toISOString(),
    lotType: lot.lotType,
    producedQty: lot.quantity,
    staffNote: lot.staffNote,
    createdAt: lot.createdAt.toISOString()
  };
}

async function resolveProduct(
  app: FastifyInstance,
  input: Pick<CreateProductionLotInput, "productId" | "productName">
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

export async function registerProductionLotRoutes(app: FastifyInstance): Promise<void> {
  app.get("/", async (request, reply) => {
    const query = listProductionLotQuerySchema.parse(request.query);
    const date = query.date ?? todayInStoreTime();
    const where: Prisma.ProductionLotWhereInput = {
      producedAt: {
        gte: parseStoreDateStart(date),
        lt: parseStoreDateEnd(date)
      },
      ...(query.product_id !== undefined ? { productId: query.product_id } : {})
    };

    const [items, total] = await app.prisma.$transaction([
      app.prisma.productionLot.findMany({
        where,
        include: {
          product: true
        },
        orderBy: [{ producedAt: "desc" }, { id: "desc" }],
        take: 100
      }),
      app.prisma.productionLot.count({ where })
    ]);

    return sendOk(reply, {
      date,
      items: items.map(toProductionLotDto),
      total,
      page: 1,
      size: items.length
    });
  });

  app.post("/", async (request, reply) => {
    const input = createProductionLotSchema.parse(request.body);
    const product = await resolveProduct(app, input);
    const lot = await app.prisma.productionLot.create({
      data: {
        productId: product.id,
        producedAt: parseStoreDateTime(input.producedAt),
        lotType: input.lotType ?? null,
        quantity: input.producedQty,
        staffNote: input.staffNote ?? null
      },
      include: {
        product: true
      }
    });

    return sendOk(reply, toProductionLotDto(lot), 201);
  });
}
