import type { ApiEnvelope } from "@pnp/shared";
import Fastify from "fastify";
import { describe, expect, it, vi } from "vitest";

import { registerRegularCustomerRoutes } from "./regular-customer.routes.js";

const now = new Date("2026-07-13T10:00:00.000Z");

function buildPrismaMock() {
  return {
    $transaction: vi.fn(async (queries: Promise<unknown>[]) => Promise.all(queries)),
    regularCustomer: {
      findMany: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn()
    },
    reservation: {
      groupBy: vi.fn(),
      findMany: vi.fn()
    },
    prepaidCustomer: {
      findMany: vi.fn()
    }
  };
}

describe("regular customer routes", () => {
  it("lists manually saved regular customers with masked phone and usage summary", async () => {
    const prisma = buildPrismaMock();
    prisma.regularCustomer.findMany.mockResolvedValue([
      {
        id: 1n,
        customerName: "김단골",
        contactPhone: "010-1234-5678",
        fixedMemo: "깜빠뉴 선호",
        isActive: true,
        createdAt: now,
        updatedAt: now
      }
    ]);
    prisma.regularCustomer.count.mockResolvedValue(1);

    const app = Fastify({ logger: false });
    app.decorate("prisma", prisma as never);
    await app.register(registerRegularCustomerRoutes);

    const response = await app.inject({ method: "GET", url: "/?query=김" });

    expect(response.statusCode).toBe(200);
    const body = response.json<ApiEnvelope<{ items: Array<{ customerName: string; maskedPhone: string; fixedMemo: string }> }>>();
    expect(body.error).toBeNull();
    expect(body.data?.items[0]).toMatchObject({ customerName: "김단골", maskedPhone: "010-1234-****", fixedMemo: "깜빠뉴 선호" });
    expect(prisma.regularCustomer.findMany).toHaveBeenCalledOnce();

    await app.close();
  });

  it("builds staff-confirmed candidates from repeated reservations and prepaid customers", async () => {
    const prisma = buildPrismaMock();
    prisma.reservation.groupBy.mockResolvedValue([
      { customerName: "예약단골", contactPhone: "010-9999-0000", _count: { _all: 3 }, _max: { pickupAt: now } }
    ]);
    prisma.prepaidCustomer.findMany.mockResolvedValue([
      { id: 2n, customerName: "선결제단골", contactPhone: "010-1111-2222", memo: "잔액 확인", updatedAt: now, transactions: [{ type: "CHARGE", amount: 50000 }, { type: "USE", amount: 12000 }] }
    ]);

    const app = Fastify({ logger: false });
    app.decorate("prisma", prisma as never);
    await app.register(registerRegularCustomerRoutes);

    const response = await app.inject({ method: "GET", url: "/candidates" });

    expect(response.statusCode).toBe(200);
    const body = response.json<ApiEnvelope<{ items: Array<{ customerName: string; source: string; reason: string; maskedPhone: string }> }>>();
    expect(body.data?.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ customerName: "예약단골", source: "RESERVATION", reason: "예약 3회" }),
        expect.objectContaining({ customerName: "선결제단골", source: "PREPAID", maskedPhone: "010-1111-****" })
      ])
    );

    await app.close();
  });
});
