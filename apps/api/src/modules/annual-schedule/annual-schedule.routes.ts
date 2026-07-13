import type { FastifyInstance } from "fastify";
import { z } from "zod";

import { HttpError, sendOk } from "../../common/http.js";

const createAnnualScheduleSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  title: z.string().trim().min(1).max(120),
  note: z.string().trim().max(2000).optional(),
  tone: z.enum(["notice", "launch", "close", "holiday"])
});

const annualScheduleParamsSchema = z.object({
  id: z.coerce.bigint()
});

function parseDateOnly(date: string): Date {
  return new Date(`${date}T00:00:00.000Z`);
}

function toDto(item: {
  id: bigint;
  date: Date;
  title: string;
  note: string | null;
  tone: string;
  createdAt: Date;
}) {
  return {
    id: item.id.toString(),
    date: item.date.toISOString().slice(0, 10),
    title: item.title,
    note: item.note ?? "",
    tone: item.tone,
    createdAt: item.createdAt.toISOString()
  };
}

export async function registerAnnualScheduleRoutes(app: FastifyInstance) {
  app.get("/annual-schedule", async (_request, reply) => {
    const items = await app.prisma.annualSchedule.findMany({
      orderBy: [{ date: "asc" }, { id: "asc" }]
    });
    return sendOk(reply, { items: items.map(toDto) });
  });

  app.post("/annual-schedule", async (request, reply) => {
    const input = createAnnualScheduleSchema.parse(request.body);
    const item = await app.prisma.annualSchedule.create({
      data: {
        date: parseDateOnly(input.date),
        title: input.title,
        note: input.note ?? null,
        tone: input.tone
      }
    });
    return sendOk(reply, toDto(item), 201);
  });

  app.patch("/annual-schedule/:id", async (request, reply) => {
    const params = annualScheduleParamsSchema.parse(request.params);
    const input = createAnnualScheduleSchema.parse(request.body);
    const existing = await app.prisma.annualSchedule.findUnique({ where: { id: params.id } });
    if (!existing) {
      throw new HttpError(404, "ANNUAL_SCHEDULE_NOT_FOUND", "스케줄을 찾을 수 없습니다.");
    }

    const item = await app.prisma.annualSchedule.update({
      where: { id: params.id },
      data: {
        date: parseDateOnly(input.date),
        title: input.title,
        note: input.note ?? null,
        tone: input.tone
      }
    });
    return sendOk(reply, toDto(item));
  });

  app.delete("/annual-schedule/:id", async (request, reply) => {
    const params = annualScheduleParamsSchema.parse(request.params);
    const existing = await app.prisma.annualSchedule.findUnique({ where: { id: params.id } });
    if (!existing) {
      throw new HttpError(404, "ANNUAL_SCHEDULE_NOT_FOUND", "스케줄을 찾을 수 없습니다.");
    }

    await app.prisma.annualSchedule.delete({ where: { id: params.id } });
    return sendOk(reply, { deleted: true });
  });
}
