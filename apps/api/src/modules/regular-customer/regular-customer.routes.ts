import type { Prisma } from "@prisma/client";
import type { FastifyInstance } from "fastify";
import { z } from "zod";

import { sendOk } from "../../common/http.js";

const idParamsSchema = z.object({ id: z.coerce.bigint().positive() });
const listQuerySchema = z.object({ query: z.string().optional() });
const saveRegularCustomerSchema = z.object({
  customerName: z.string().trim().min(1),
  contactPhone: z.string().trim().optional(),
  fixedMemo: z.string().trim().optional()
});

function maskPhone(value: string | null | undefined): string | null {
  if (!value) return null;
  const digits = value.replace(/\D/g, "");
  if (digits.length < 8) return value;
  if (digits.length === 11) return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-****`;
  return `${value.slice(0, Math.max(0, value.length - 4))}****`;
}

function balance(transactions: Array<{ type: string; amount: number }>) {
  return transactions.reduce((sum, item) => sum + (item.type === "USE" ? -item.amount : item.amount), 0);
}

function toDto(customer: {
  id: bigint;
  customerName: string;
  contactPhone: string | null;
  fixedMemo: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: customer.id.toString(),
    customerName: customer.customerName,
    contactPhone: customer.contactPhone,
    maskedPhone: maskPhone(customer.contactPhone),
    fixedMemo: customer.fixedMemo,
    isActive: customer.isActive,
    createdAt: customer.createdAt.toISOString(),
    updatedAt: customer.updatedAt.toISOString()
  };
}

export async function registerRegularCustomerRoutes(app: FastifyInstance): Promise<void> {
  app.get("/", async (request, reply) => {
    const query = listQuerySchema.parse(request.query);
    const search = query.query?.trim();
    const where: Prisma.RegularCustomerWhereInput = {
      isActive: true,
      ...(search
        ? {
            OR: [
              { customerName: { contains: search, mode: "insensitive" } },
              { contactPhone: { contains: search, mode: "insensitive" } },
              { fixedMemo: { contains: search, mode: "insensitive" } }
            ]
          }
        : {})
    };
    const [items, total] = await app.prisma.$transaction([
      app.prisma.regularCustomer.findMany({ where, orderBy: [{ updatedAt: "desc" }, { customerName: "asc" }], take: 100 }),
      app.prisma.regularCustomer.count({ where })
    ]);
    return sendOk(reply, { items: items.map(toDto), total, page: 1, size: items.length });
  });

  app.get("/candidates", async (_request, reply) => {
    const [reservationGroups, prepaidCustomers] = await Promise.all([
      app.prisma.reservation.groupBy({
        by: ["customerName", "contactPhone"],
        where: { customerName: { not: null }, status: { not: "CANCELLED" } },
        _count: { _all: true },
        _max: { pickupAt: true },
        having: { id: { _count: { gte: 2 } } },
        orderBy: { _count: { id: "desc" } },
        take: 30
      }),
      app.prisma.prepaidCustomer.findMany({
        where: { isActive: true },
        include: { transactions: true },
        orderBy: [{ updatedAt: "desc" }, { customerName: "asc" }],
        take: 30
      })
    ]);

    const reservationCandidates = reservationGroups
      .filter((item) => item.customerName)
      .map((item) => ({
        customerName: item.customerName ?? "이름 없음",
        contactPhone: item.contactPhone,
        maskedPhone: maskPhone(item.contactPhone),
        source: "RESERVATION" as const,
        reason: `예약 ${item._count._all}회`,
        lastUsedAt: item._max.pickupAt?.toISOString() ?? null,
        fixedMemo: ""
      }));
    const prepaidCandidates = prepaidCustomers.map((customer) => ({
      customerName: customer.customerName,
      contactPhone: customer.contactPhone,
      maskedPhone: maskPhone(customer.contactPhone),
      source: "PREPAID" as const,
      reason: `선결제 잔액 ${balance(customer.transactions).toLocaleString("ko-KR")}원`,
      lastUsedAt: customer.updatedAt.toISOString(),
      fixedMemo: customer.memo ?? ""
    }));

    return sendOk(reply, { items: [...reservationCandidates, ...prepaidCandidates].slice(0, 60) });
  });

  app.post("/", async (request, reply) => {
    const input = saveRegularCustomerSchema.parse(request.body);
    const now = new Date();
    const customer = await app.prisma.regularCustomer.create({
      data: {
        customerName: input.customerName,
        contactPhone: input.contactPhone || null,
        fixedMemo: input.fixedMemo || "",
        updatedAt: now
      }
    });
    return sendOk(reply, toDto(customer), 201);
  });

  app.patch("/:id", async (request, reply) => {
    const params = idParamsSchema.parse(request.params);
    const input = saveRegularCustomerSchema.partial().parse(request.body);
    const customer = await app.prisma.regularCustomer.update({
      where: { id: params.id },
      data: {
        ...(input.customerName !== undefined ? { customerName: input.customerName } : {}),
        ...(input.contactPhone !== undefined ? { contactPhone: input.contactPhone || null } : {}),
        ...(input.fixedMemo !== undefined ? { fixedMemo: input.fixedMemo || "" } : {}),
        updatedAt: new Date()
      }
    });
    return sendOk(reply, toDto(customer));
  });

  app.delete("/:id", async (request, reply) => {
    const params = idParamsSchema.parse(request.params);
    await app.prisma.regularCustomer.update({ where: { id: params.id }, data: { isActive: false, updatedAt: new Date() } });
    return sendOk(reply, { deleted: true });
  });
}
