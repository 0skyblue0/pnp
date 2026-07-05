import type { ApiEnvelope } from "@pnp/shared";
import Fastify from "fastify";
import { describe, expect, it, vi } from "vitest";
import { ZodError } from "zod";

import { HttpError, sendError } from "../../common/http.js";
import { registerDailyLogRoutes } from "./daily-log.routes.js";

type StockoutDto = {
  id: string;
  productId: number;
  productName: string;
  date: string;
  sequence: number;
  stockoutAt: string;
  discardQty: number;
};

const product = {
  id: 1,
  name: "바게트"
};

const stockoutBase = {
  id: 10n,
  productId: 1,
  product,
  date: new Date("2026-06-03T00:00:00.000Z"),
  sequence: 2,
  stockoutAt: new Date("2026-06-03T03:00:00.000Z"),
  inquiryAfterStockout: null,
  discardReason: null,
  createdAt: new Date("2026-06-03T03:00:00.000Z")
};

function buildPrismaMock() {
  const prisma = {
    $transaction: vi.fn(),
    product: {
      findUnique: vi.fn()
    },
    stockoutLog: {
      findFirst: vi.fn(),
      update: vi.fn(),
      create: vi.fn()
    }
  };

  prisma.$transaction.mockImplementation(async (input: unknown) => {
    if (typeof input === "function") {
      return (input as (tx: typeof prisma) => Promise<unknown>)(prisma);
    }

    return Promise.all(input as Array<Promise<unknown>>);
  });

  return prisma;
}

async function buildApp(prisma: ReturnType<typeof buildPrismaMock>) {
  const app = Fastify({ logger: false });
  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof HttpError) {
      return sendError(reply, error);
    }

    if (error instanceof ZodError) {
      return sendError(
        reply,
        new HttpError(400, "VALIDATION_ERROR", "Request validation failed", error.flatten())
      );
    }

    return sendError(reply, new HttpError(500, "INTERNAL_ERROR", "Unexpected server error"));
  });
  app.decorate("prisma", prisma as never);
  await app.register(registerDailyLogRoutes);
  return app;
}

describe("daily log discard route", () => {
  it("increments discard quantity on the latest stockout log for the product and date", async () => {
    const prisma = buildPrismaMock();
    prisma.product.findUnique.mockResolvedValue(product);
    prisma.stockoutLog.findFirst.mockResolvedValue({
      ...stockoutBase,
      discardQty: 2
    });
    prisma.stockoutLog.update.mockResolvedValue({
      ...stockoutBase,
      discardQty: 5
    });

    const app = await buildApp(prisma);
    const response = await app.inject({
      method: "POST",
      url: "/discard",
      payload: {
        productId: 1,
        date: "2026-06-03",
        discardQty: 3
      }
    });

    expect(response.statusCode).toBe(200);
    const body = response.json<ApiEnvelope<StockoutDto>>();
    expect(body.error).toBeNull();
    expect(body.data).toMatchObject({
      id: "10",
      productId: 1,
      productName: "바게트",
      date: "2026-06-03",
      sequence: 2,
      discardQty: 5
    });
    expect(prisma.stockoutLog.findFirst).toHaveBeenCalledWith({
      where: {
        productId: 1,
        date: new Date("2026-06-03T00:00:00.000Z")
      },
      include: {
        product: true
      },
      orderBy: [{ stockoutAt: "desc" }, { id: "desc" }]
    });
    expect(prisma.stockoutLog.update).toHaveBeenCalledWith({
      where: { id: 10n },
      data: {
        discardQty: { increment: 3 }
      },
      include: {
        product: true
      }
    });
    expect(prisma.stockoutLog.create).not.toHaveBeenCalled();

    await app.close();
  });

  it("creates a stockout log when discard is recorded before stockout", async () => {
    const prisma = buildPrismaMock();
    prisma.product.findUnique.mockResolvedValue(product);
    prisma.stockoutLog.findFirst.mockResolvedValue(null);
    prisma.stockoutLog.create.mockResolvedValue({
      ...stockoutBase,
      id: 11n,
      sequence: 1,
      stockoutAt: new Date("2026-06-03T04:00:00.000Z"),
      discardQty: 4
    });

    const app = await buildApp(prisma);
    const response = await app.inject({
      method: "POST",
      url: "/discard",
      payload: {
        productId: 1,
        date: "2026-06-03",
        discardQty: 4
      }
    });

    expect(response.statusCode).toBe(201);
    const body = response.json<ApiEnvelope<StockoutDto>>();
    expect(body.error).toBeNull();
    expect(body.data).toMatchObject({
      id: "11",
      productId: 1,
      productName: "바게트",
      date: "2026-06-03",
      sequence: 1,
      discardQty: 4
    });
    expect(prisma.stockoutLog.create).toHaveBeenCalledWith({
      data: {
        productId: 1,
        date: new Date("2026-06-03T00:00:00.000Z"),
        sequence: 1,
        stockoutAt: expect.any(Date) as Date,
        inquiryAfterStockout: null,
        discardQty: 4
      },
      include: {
        product: true
      }
    });

    await app.close();
  });

  it("rejects discard quantities less than one", async () => {
    const prisma = buildPrismaMock();
    const app = await buildApp(prisma);
    const response = await app.inject({
      method: "POST",
      url: "/discard",
      payload: {
        productId: 1,
        date: "2026-06-03",
        discardQty: 0
      }
    });

    expect(response.statusCode).toBe(400);
    const body = response.json<ApiEnvelope<unknown>>();
    expect(body.error).toMatchObject({
      code: "VALIDATION_ERROR",
      message: "Request validation failed"
    });
    expect(prisma.product.findUnique).not.toHaveBeenCalled();

    await app.close();
  });
});
