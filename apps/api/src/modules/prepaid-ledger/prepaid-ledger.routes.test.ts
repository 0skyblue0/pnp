import type { ApiEnvelope } from "@pnp/shared";
import Fastify from "fastify";
import { describe, expect, it, vi } from "vitest";

import { registerPrepaidLedgerRoutes } from "./prepaid-ledger.routes.js";

const now = new Date("2026-07-14T09:00:00.000Z");

function buildPrismaMock() {
  return {
    $transaction: vi.fn(async (queries: Promise<unknown>[]) => Promise.all(queries)),
    prepaidCustomer: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn()
    },
    prepaidParticipant: {
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn()
    },
    prepaidTransaction: {
      create: vi.fn(),
      delete: vi.fn()
    }
  };
}

describe("prepaid ledger routes", () => {
  it("blocks shared use when the participant would exceed their per-person limit", async () => {
    const prisma = buildPrismaMock();
    prisma.prepaidCustomer.findUnique.mockResolvedValue({
      id: 1n,
      customerName: "법인카드",
      contactPhone: null,
      memo: null,
      ledgerType: "SHARED",
      sharedLimit: 30000,
      isActive: true,
      createdAt: now,
      updatedAt: now,
      participants: [
        {
          id: 10n,
          customerId: 1n,
          participantName: "홍길동",
          phoneLast4: "1234",
          limitAmount: 30000,
          createdAt: now,
          updatedAt: now
        }
      ],
      transactions: [
        {
          id: 20n,
          customerId: 1n,
          participantId: 10n,
          type: "CHARGE",
          amount: 150000,
          note: "법인카드",
          occurredAt: now,
          createdAt: now
        },
        {
          id: 21n,
          customerId: 1n,
          participantId: 10n,
          type: "USE",
          amount: 20000,
          note: "공동 사용",
          occurredAt: now,
          createdAt: now
        }
      ]
    });

    const app = Fastify({ logger: false });
    app.decorate("prisma", prisma as never);
    await app.register(registerPrepaidLedgerRoutes);

    const response = await app.inject({
      method: "POST",
      url: "/1/shared-use",
      payload: { participantName: "홍길동", phoneLast4: "1234", amount: 15000 }
    });

    expect(response.statusCode).toBe(400);
    expect(response.body).toContain(
      "이 사람에게 남은 공동 사용 한도보다 큰 금액은 사용할 수 없습니다."
    );
    expect(prisma.prepaidTransaction.create).not.toHaveBeenCalled();

    await app.close();
  });

  it("records shared use against a participant and returns participant usage summary", async () => {
    const prisma = buildPrismaMock();
    const existingCustomer = {
      id: 1n,
      customerName: "법인카드",
      contactPhone: null,
      memo: null,
      ledgerType: "SHARED",
      sharedLimit: 30000,
      isActive: true,
      createdAt: now,
      updatedAt: now,
      participants: [
        {
          id: 10n,
          customerId: 1n,
          participantName: "홍길동",
          phoneLast4: "1234",
          limitAmount: 30000,
          createdAt: now,
          updatedAt: now
        }
      ],
      transactions: [
        {
          id: 20n,
          customerId: 1n,
          participantId: null,
          type: "CHARGE",
          amount: 150000,
          note: "법인카드",
          occurredAt: now,
          createdAt: now
        },
        {
          id: 21n,
          customerId: 1n,
          participantId: 10n,
          type: "USE",
          amount: 10000,
          note: "공동 사용",
          occurredAt: now,
          createdAt: now
        }
      ]
    };
    const updatedCustomer = {
      ...existingCustomer,
      transactions: [
        ...existingCustomer.transactions,
        {
          id: 22n,
          customerId: 1n,
          participantId: 10n,
          type: "USE",
          amount: 20000,
          note: "공동 사용",
          occurredAt: now,
          createdAt: now
        }
      ]
    };
    prisma.prepaidCustomer.findUnique
      .mockResolvedValueOnce(existingCustomer)
      .mockResolvedValueOnce(updatedCustomer);
    prisma.prepaidTransaction.create.mockResolvedValue({});
    prisma.prepaidCustomer.update.mockResolvedValue({});

    const app = Fastify({ logger: false });
    app.decorate("prisma", prisma as never);
    await app.register(registerPrepaidLedgerRoutes);

    const response = await app.inject({
      method: "POST",
      url: "/1/shared-use",
      payload: { participantName: "홍길동", phoneLast4: "1234", amount: 20000, note: "2차 사용" }
    });

    expect(response.statusCode).toBe(200);
    const createArgs = prisma.prepaidTransaction.create.mock.calls[0]?.[0] as {
      data?: { customerId?: bigint; participantId?: bigint; type?: string; amount?: number };
    };
    expect(createArgs.data).toMatchObject({
      customerId: 1n,
      participantId: 10n,
      type: "USE",
      amount: 20000
    });
    const body =
      response.json<
        ApiEnvelope<{
          participants: Array<{ phoneLast4: string; usedAmount: number; remainingAmount: number }>;
        }>
      >();
    expect(body.data?.participants).toEqual([
      expect.objectContaining({ phoneLast4: "1234", usedAmount: 30000, remainingAmount: 0 })
    ]);

    await app.close();
  });
});
