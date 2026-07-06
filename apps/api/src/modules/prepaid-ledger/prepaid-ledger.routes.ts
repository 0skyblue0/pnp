import type { Prisma } from "@prisma/client";
import type { FastifyInstance } from "fastify";

import { HttpError, sendOk } from "../../common/http.js";
import {
  chargePrepaidBalanceSchema,
  createPrepaidCustomerSchema,
  idParamsSchema,
  listPrepaidLedgerQuerySchema,
  transactionParamsSchema,
  updatePrepaidCustomerSchema,
  usePrepaidBalanceSchema
} from "./prepaid-ledger.schemas.js";

type PrepaidCustomerWithTransactions = Prisma.PrepaidCustomerGetPayload<{
  include: {
    transactions: true;
  };
}>;

function transactionDelta(transaction: { type: string; amount: number }) {
  return transaction.type === "USE" ? -transaction.amount : transaction.amount;
}

function calculateBalance(transactions: Array<{ type: string; amount: number }>) {
  return transactions.reduce((total, transaction) => total + transactionDelta(transaction), 0);
}

function lastUsedAt(transactions: Array<{ type: string; occurredAt: Date }>) {
  return transactions
    .filter((transaction) => transaction.type === "USE")
    .sort((left, right) => right.occurredAt.getTime() - left.occurredAt.getTime())[0]?.occurredAt;
}

function toPrepaidCustomerDto(customer: PrepaidCustomerWithTransactions) {
  return {
    id: customer.id.toString(),
    customerName: customer.customerName,
    contactPhone: customer.contactPhone,
    memo: customer.memo,
    balance: calculateBalance(customer.transactions),
    lastUsedAt: lastUsedAt(customer.transactions)?.toISOString() ?? null,
    createdAt: customer.createdAt.toISOString(),
    updatedAt: customer.updatedAt.toISOString(),
    transactions: customer.transactions
      .slice()
      .sort((left, right) => right.occurredAt.getTime() - left.occurredAt.getTime())
      .map((transaction) => ({
        id: transaction.id.toString(),
        type: transaction.type,
        amount: transaction.amount,
        note: transaction.note,
        occurredAt: transaction.occurredAt.toISOString(),
        createdAt: transaction.createdAt.toISOString()
      }))
  };
}

async function findPrepaidCustomer(app: FastifyInstance, id: bigint) {
  return app.prisma.prepaidCustomer.findUnique({
    where: { id },
    include: { transactions: true }
  });
}

export async function registerPrepaidLedgerRoutes(app: FastifyInstance): Promise<void> {
  app.get("/", async (request, reply) => {
    const query = listPrepaidLedgerQuerySchema.parse(request.query);
    const search = query.query?.trim();
    const where: Prisma.PrepaidCustomerWhereInput = {
      isActive: true,
      ...(search
        ? {
            OR: [
              { customerName: { contains: search, mode: "insensitive" } },
              { contactPhone: { contains: search, mode: "insensitive" } }
            ]
          }
        : {})
    };

    const [items, total] = await app.prisma.$transaction([
      app.prisma.prepaidCustomer.findMany({
        where,
        include: { transactions: true },
        orderBy: [{ updatedAt: "desc" }, { customerName: "asc" }],
        take: 100
      }),
      app.prisma.prepaidCustomer.count({ where })
    ]);

    return sendOk(reply, {
      items: items.map(toPrepaidCustomerDto),
      total,
      page: 1,
      size: items.length
    });
  });

  app.post("/", async (request, reply) => {
    const input = createPrepaidCustomerSchema.parse(request.body);
    const now = new Date();
    const customer = await app.prisma.prepaidCustomer.create({
      data: {
        customerName: input.customerName,
        contactPhone: input.contactPhone || null,
        memo: input.memo || null,
        updatedAt: now,
        transactions: {
          create: {
            type: "CHARGE",
            amount: input.amount,
            note: input.memo || "선결제 등록",
            occurredAt: now
          }
        }
      },
      include: { transactions: true }
    });

    return sendOk(reply, toPrepaidCustomerDto(customer), 201);
  });

  app.post("/:id/use", async (request, reply) => {
    const params = idParamsSchema.parse(request.params);
    const input = usePrepaidBalanceSchema.parse(request.body);
    const existing = await findPrepaidCustomer(app, params.id);

    if (!existing || !existing.isActive) {
      throw new HttpError(404, "PREPAID_CUSTOMER_NOT_FOUND", "Prepaid customer not found");
    }

    const balance = calculateBalance(existing.transactions);
    if (input.amount > balance) {
      throw new HttpError(400, "PREPAID_BALANCE_NOT_ENOUGH", "남은 선결제 금액보다 큰 금액은 사용할 수 없습니다.");
    }

    const now = new Date();
    await app.prisma.prepaidTransaction.create({
      data: {
        customerId: params.id,
        type: "USE",
        amount: input.amount,
        note: input.note,
        occurredAt: now
      }
    });
    const customer = await app.prisma.prepaidCustomer.update({
      where: { id: params.id },
      data: { updatedAt: now },
      include: { transactions: true }
    });

    return sendOk(reply, toPrepaidCustomerDto(customer));
  });

  app.post("/:id/charge", async (request, reply) => {
    const params = idParamsSchema.parse(request.params);
    const input = chargePrepaidBalanceSchema.parse(request.body);
    const existing = await findPrepaidCustomer(app, params.id);

    if (!existing || !existing.isActive) {
      throw new HttpError(404, "PREPAID_CUSTOMER_NOT_FOUND", "Prepaid customer not found");
    }

    const now = new Date();
    await app.prisma.prepaidTransaction.create({
      data: {
        customerId: params.id,
        type: "CHARGE",
        amount: input.amount,
        note: input.note || "추가 충전",
        occurredAt: now
      }
    });
    const customer = await app.prisma.prepaidCustomer.update({
      where: { id: params.id },
      data: { updatedAt: now },
      include: { transactions: true }
    });

    return sendOk(reply, toPrepaidCustomerDto(customer));
  });

  app.patch("/:id", async (request, reply) => {
    const params = idParamsSchema.parse(request.params);
    const input = updatePrepaidCustomerSchema.parse(request.body);
    const existing = await findPrepaidCustomer(app, params.id);

    if (!existing || !existing.isActive) {
      throw new HttpError(404, "PREPAID_CUSTOMER_NOT_FOUND", "Prepaid customer not found");
    }

    const customer = await app.prisma.prepaidCustomer.update({
      where: { id: params.id },
      data: {
        ...(input.customerName !== undefined ? { customerName: input.customerName } : {}),
        ...(input.contactPhone !== undefined ? { contactPhone: input.contactPhone || null } : {}),
        ...(input.memo !== undefined ? { memo: input.memo || null } : {}),
        updatedAt: new Date()
      },
      include: { transactions: true }
    });

    return sendOk(reply, toPrepaidCustomerDto(customer));
  });

  app.delete("/:id", async (request, reply) => {
    const params = idParamsSchema.parse(request.params);
    const existing = await findPrepaidCustomer(app, params.id);

    if (!existing || !existing.isActive) {
      throw new HttpError(404, "PREPAID_CUSTOMER_NOT_FOUND", "Prepaid customer not found");
    }

    await app.prisma.prepaidCustomer.update({
      where: { id: params.id },
      data: { isActive: false, updatedAt: new Date() }
    });

    return sendOk(reply, { deleted: true });
  });

  app.delete("/:id/transactions/:transactionId", async (request, reply) => {
    const params = transactionParamsSchema.parse(request.params);
    const existing = await findPrepaidCustomer(app, params.id);

    if (!existing || !existing.isActive) {
      throw new HttpError(404, "PREPAID_CUSTOMER_NOT_FOUND", "Prepaid customer not found");
    }

    const transaction = existing.transactions.find((item) => item.id === params.transactionId);
    if (!transaction) {
      throw new HttpError(404, "PREPAID_TRANSACTION_NOT_FOUND", "Prepaid transaction not found");
    }

    const remainingTransactions = existing.transactions.filter((item) => item.id !== params.transactionId);
    const nextBalance = calculateBalance(remainingTransactions);
    if (nextBalance < 0) {
      throw new HttpError(
        400,
        "PREPAID_CANCEL_WOULD_OVERDRAW",
        "이 내역을 취소하면 잔액이 부족해져서 취소할 수 없습니다."
      );
    }

    const now = new Date();
    await app.prisma.$transaction([
      app.prisma.prepaidTransaction.delete({ where: { id: params.transactionId } }),
      app.prisma.prepaidCustomer.update({ where: { id: params.id }, data: { updatedAt: now } })
    ]);

    const customer = await findPrepaidCustomer(app, params.id);
    if (!customer) {
      throw new HttpError(404, "PREPAID_CUSTOMER_NOT_FOUND", "Prepaid customer not found");
    }

    return sendOk(reply, toPrepaidCustomerDto(customer));
  });
}
