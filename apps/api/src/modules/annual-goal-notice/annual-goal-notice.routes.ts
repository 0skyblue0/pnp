import { Prisma } from "@prisma/client";
import type { FastifyInstance } from "fastify";
import { z } from "zod";

import { HttpError, sendOk } from "../../common/http.js";

const annualGoalNoticeCategorySchema = z.enum(["sales", "operation", "staff"]);
const monthKeys = ["01", "02", "03", "04", "05", "06", "07", "08", "09", "10", "11", "12"] as const;

const monthlyTargetsSchema = z
  .object(
    Object.fromEntries(monthKeys.map((month) => [month, z.coerce.number().int().min(0).max(999_999_999)])) as Record<
      (typeof monthKeys)[number],
      z.ZodNumber
    >
  )
  .strict();

const baseAnnualGoalNoticeSchema = z.object({
  category: annualGoalNoticeCategorySchema,
  title: z.string().trim().min(1).max(120),
  value: z.string().trim().min(1).max(200),
  note: z.string().trim().max(2000).optional(),
  targetYear: z.coerce.number().int().min(2000).max(2100).optional(),
  monthlyTargets: monthlyTargetsSchema.optional()
});

const createAnnualGoalNoticeSchema = baseAnnualGoalNoticeSchema.superRefine((input, context) => {
  if (input.category === "sales") {
    if (input.targetYear === undefined) {
      context.addIssue({ code: "custom", path: ["targetYear"], message: "targetYear is required for sales goals" });
    }
    if (input.monthlyTargets === undefined) {
      context.addIssue({ code: "custom", path: ["monthlyTargets"], message: "monthlyTargets is required for sales goals" });
    }
  }
});

const annualGoalNoticeParamsSchema = z.object({
  id: z.coerce.bigint()
});

type MonthlyTargets = z.infer<typeof monthlyTargetsSchema>;

function emptyMonthlyTargets(): MonthlyTargets {
  return Object.fromEntries(monthKeys.map((month) => [month, 0])) as MonthlyTargets;
}

function normalizeMonthlyTargets(value: Prisma.JsonValue | null): MonthlyTargets | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const parsed = monthlyTargetsSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

function targetTotal(monthlyTargets: MonthlyTargets | null): number | null {
  if (!monthlyTargets) {
    return null;
  }
  return monthKeys.reduce((total, month) => total + monthlyTargets[month], 0);
}

function toDto(item: {
  id: bigint;
  category: string;
  title: string;
  value: string;
  note: string | null;
  targetYear: number | null;
  monthlyTargets: Prisma.JsonValue | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  const monthlyTargets = normalizeMonthlyTargets(item.monthlyTargets);
  return {
    id: item.id.toString(),
    category: annualGoalNoticeCategorySchema.parse(item.category),
    title: item.title,
    value: item.value,
    note: item.note ?? "",
    targetYear: item.targetYear,
    monthlyTargets,
    targetTotal: targetTotal(monthlyTargets),
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString()
  };
}

function valueFromSalesGoal(targetYear: number, monthlyTargets: MonthlyTargets): string {
  return `${targetYear}년 연간 매출 목표 ${targetTotal(monthlyTargets)?.toLocaleString("ko-KR") ?? "0"}원`;
}

function dataFromInput(input: z.infer<typeof createAnnualGoalNoticeSchema>) {
  if (input.category === "sales") {
    const monthlyTargets = input.monthlyTargets ?? emptyMonthlyTargets();
    const targetYear = input.targetYear ?? new Date().getFullYear();
    return {
      category: input.category,
      title: input.title,
      value: valueFromSalesGoal(targetYear, monthlyTargets),
      note: input.note ?? null,
      targetYear,
      monthlyTargets,
      updatedAt: new Date()
    };
  }

  return {
    category: input.category,
    title: input.title,
    value: input.value,
    note: input.note ?? null,
    targetYear: null,
    monthlyTargets: Prisma.JsonNull,
    updatedAt: new Date()
  };
}

export async function registerAnnualGoalNoticeRoutes(app: FastifyInstance) {
  app.get("/annual-goal-notice", async (_request, reply) => {
    const [items, total] = await app.prisma.$transaction([
      app.prisma.annualGoalNotice.findMany({
        orderBy: [{ targetYear: "desc" }, { createdAt: "asc" }, { id: "asc" }]
      }),
      app.prisma.annualGoalNotice.count()
    ]);

    return sendOk(reply, { items: items.map(toDto), total, page: 1, size: items.length });
  });

  app.post("/annual-goal-notice", async (request, reply) => {
    const input = createAnnualGoalNoticeSchema.parse(request.body);
    const item = await app.prisma.annualGoalNotice.create({ data: dataFromInput(input) });
    return sendOk(reply, toDto(item), 201);
  });

  app.patch("/annual-goal-notice/:id", async (request, reply) => {
    const params = annualGoalNoticeParamsSchema.parse(request.params);
    const input = createAnnualGoalNoticeSchema.parse(request.body);
    const existing = await app.prisma.annualGoalNotice.findUnique({ where: { id: params.id } });
    if (!existing) {
      throw new HttpError(404, "ANNUAL_GOAL_NOTICE_NOT_FOUND", "홈 공지를 찾을 수 없습니다.");
    }

    const item = await app.prisma.annualGoalNotice.update({
      where: { id: params.id },
      data: dataFromInput(input)
    });
    return sendOk(reply, toDto(item));
  });

  app.delete("/annual-goal-notice/:id", async (request, reply) => {
    const params = annualGoalNoticeParamsSchema.parse(request.params);
    const existing = await app.prisma.annualGoalNotice.findUnique({ where: { id: params.id } });
    if (!existing) {
      throw new HttpError(404, "ANNUAL_GOAL_NOTICE_NOT_FOUND", "홈 공지를 찾을 수 없습니다.");
    }

    await app.prisma.annualGoalNotice.delete({ where: { id: params.id } });
    return sendOk(reply, { deleted: true });
  });
}
