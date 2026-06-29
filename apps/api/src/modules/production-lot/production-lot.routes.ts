import type { Prisma } from "@prisma/client";
import type { FastifyInstance } from "fastify";

import {
  parseStoreDateEnd,
  parseStoreDateStart,
  parseStoreDateTime,
  todayInStoreTime
} from "../../common/datetime.js";
import { sendOk } from "../../common/http.js";
import { resolveProduct } from "../product/product-resolver.js";
import {
  createProductionLotSchema,
  listProductionLotQuerySchema
} from "./production-lot.schemas.js";

type ProductionLotWithProduct = Prisma.ProductionLotGetPayload<{
  include: {
    product: true;
  };
}>;

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
