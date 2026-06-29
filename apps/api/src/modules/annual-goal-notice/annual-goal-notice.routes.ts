import type { FastifyInstance } from "fastify";
import { z } from "zod";

import { HttpError, sendOk } from "../../common/http.js";

const annualGoalNoticeCategorySchema = z.enum(["sales", "operation", "staff"]);

const createAnnualGoalNoticeSchema = z.object({
  category: annualGoalNoticeCategorySchema,
  title: z.string().trim().min(1).max(120),
  value: z.string().trim().min(1).max(200),
  note: z.string().trim().max(2000).optional()
});

const annualGoalNoticeParamsSchema = z.object({
  id: z.coerce.bigint()
});

function toDto(item: {
  id: bigint;
  category: string;
  title: string;
  value: string;
  note: string | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: item.id.toString(),
    category: annualGoalNoticeCategorySchema.parse(item.category),
    title: item.title,
    value: item.value,
    note: item.note ?? "",
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString()
  };
}

export async function registerAnnualGoalNoticeRoutes(app: FastifyInstance) {
  app.get("/annual-goal-notice", async (_request, reply) => {
    const [items, total] = await app.prisma.$transaction([
      app.prisma.annualGoalNotice.findMany({ orderBy: [{ createdAt: "asc" }, { id: "asc" }] }),
      app.prisma.annualGoalNotice.count()
    ]);

    return sendOk(reply, { items: items.map(toDto), total, page: 1, size: items.length });
  });

  app.post("/annual-goal-notice", async (request, reply) => {
    const input = createAnnualGoalNoticeSchema.parse(request.body);
    const item = await app.prisma.annualGoalNotice.create({
      data: {
        category: input.category,
        title: input.title,
        value: input.value,
        note: input.note ?? null,
        updatedAt: new Date()
      }
    });
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
      data: {
        category: input.category,
        title: input.title,
        value: input.value,
        note: input.note ?? null,
        updatedAt: new Date()
      }
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
