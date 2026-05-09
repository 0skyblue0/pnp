import { quickResponseTags } from "@pnp/shared";
import type { Prisma } from "@prisma/client";
import type { FastifyInstance } from "fastify";
import { z } from "zod";

import { HttpError, sendOk } from "../../common/http.js";
import {
  createResponseSchema,
  listResponseQuerySchema,
  updateResponseSchema,
  type CreateResponseInput,
  type UpdateResponseInput
} from "./response.schemas.js";

const idParamsSchema = z.object({
  id: z.coerce.bigint().positive()
});

type ResponseWithRelations = Prisma.CustomerResponseGetPayload<{
  include: {
    tags: true;
    products: true;
  };
}>;

function parseDateOnly(date: string): Date {
  return new Date(`${date}T00:00:00.000Z`);
}

function formatDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function buildCreateResponseData(
  input: CreateResponseInput
): Prisma.CustomerResponseUncheckedCreateInput {
  return {
    date: parseDateOnly(input.date),
    category: input.category,
    target: input.target ?? null,
    sentimentScore: input.sentimentScore ?? null,
    actionPriority: input.actionPriority,
    visitOrigin: input.visitOrigin ?? null,
    source: input.source ?? null,
    isBossFlag: input.isBossFlag,
    shortSummary: input.shortSummary,
    fullText: input.fullText ?? null,
    llmAssisted: false
  };
}

function buildUpdateResponseData(
  input: UpdateResponseInput
): Prisma.CustomerResponseUncheckedUpdateInput {
  return {
    ...(input.date ? { date: parseDateOnly(input.date) } : {}),
    ...(input.category ? { category: input.category } : {}),
    ...(input.target !== undefined ? { target: input.target ?? null } : {}),
    ...(input.sentimentScore !== undefined ? { sentimentScore: input.sentimentScore } : {}),
    ...(input.actionPriority !== undefined ? { actionPriority: input.actionPriority } : {}),
    ...(input.visitOrigin !== undefined ? { visitOrigin: input.visitOrigin ?? null } : {}),
    ...(input.source !== undefined ? { source: input.source ?? null } : {}),
    ...(input.isBossFlag !== undefined ? { isBossFlag: input.isBossFlag } : {}),
    ...(input.shortSummary !== undefined ? { shortSummary: input.shortSummary } : {}),
    ...(input.fullText !== undefined ? { fullText: input.fullText ?? null } : {}),
    llmAssisted: false
  };
}

function toResponseDto(response: ResponseWithRelations) {
  return {
    id: response.id.toString(),
    date: formatDateOnly(response.date),
    category: response.category,
    target: response.target,
    sentimentScore: response.sentimentScore,
    actionPriority: response.actionPriority,
    visitOrigin: response.visitOrigin,
    source: response.source,
    isBossFlag: response.isBossFlag,
    shortSummary: response.shortSummary,
    fullText: response.fullText,
    tags: response.tags.map((tag) => tag.tagCode),
    productIds: response.products.map((product) => product.productId),
    llmAssisted: response.llmAssisted,
    createdAt: response.createdAt.toISOString()
  };
}

async function findResponseById(app: FastifyInstance, id: bigint) {
  return app.prisma.customerResponse.findUnique({
    where: { id },
    include: {
      tags: true,
      products: true
    }
  });
}

async function replaceResponseTagsAndProducts(
  app: FastifyInstance,
  responseId: bigint,
  input: Pick<CreateResponseInput | UpdateResponseInput, "tags" | "productIds">
) {
  if (input.tags !== undefined) {
    await app.prisma.responseTag.deleteMany({ where: { responseId } });
    if (input.tags.length > 0) {
      await app.prisma.responseTag.createMany({
        data: input.tags.map((tagCode) => ({
          responseId,
          tagCode
        }))
      });
    }
  }

  if (input.productIds !== undefined) {
    await app.prisma.responseProduct.deleteMany({ where: { responseId } });
    if (input.productIds.length > 0) {
      await app.prisma.responseProduct.createMany({
        data: input.productIds.map((productId) => ({
          responseId,
          productId
        }))
      });
    }
  }
}

export async function registerResponseRoutes(app: FastifyInstance): Promise<void> {
  app.get("/", async (request, reply) => {
    const query = listResponseQuerySchema.parse(request.query);
    const where = {
      ...(query.category ? { category: query.category } : {}),
      ...(typeof query.boss_flag === "boolean" ? { isBossFlag: query.boss_flag } : {}),
      ...(query.from || query.to
        ? {
            date: {
              ...(query.from ? { gte: parseDateOnly(query.from) } : {}),
              ...(query.to ? { lte: parseDateOnly(query.to) } : {})
            }
          }
        : {})
    };

    const [items, total] = await app.prisma.$transaction([
      app.prisma.customerResponse.findMany({
        where,
        include: {
          tags: true,
          products: true
        },
        orderBy: [{ date: "desc" }, { createdAt: "desc" }],
        take: 100
      }),
      app.prisma.customerResponse.count({ where })
    ]);

    return sendOk(reply, {
      items: items.map(toResponseDto),
      total,
      page: 1,
      size: items.length
    });
  });

  app.post("/", async (request, reply) => {
    const input = createResponseSchema.parse(request.body);
    const response = await app.prisma.customerResponse.create({
      data: buildCreateResponseData(input)
    });

    await replaceResponseTagsAndProducts(app, response.id, input);

    const stored = await findResponseById(app, response.id);
    if (!stored) {
      throw new HttpError(500, "RESPONSE_CREATE_FAILED", "Response was not persisted");
    }

    return sendOk(reply, toResponseDto(stored), 201);
  });

  app.patch("/:id", async (request, reply) => {
    const params = idParamsSchema.parse(request.params);
    const input = updateResponseSchema.parse(request.body);
    const existing = await findResponseById(app, params.id);

    if (!existing) {
      throw new HttpError(404, "RESPONSE_NOT_FOUND", "Response not found");
    }

    await app.prisma.customerResponse.update({
      where: { id: params.id },
      data: buildUpdateResponseData(input)
    });
    await replaceResponseTagsAndProducts(app, params.id, input);

    const updated = await findResponseById(app, params.id);
    if (!updated) {
      throw new HttpError(404, "RESPONSE_NOT_FOUND", "Response not found");
    }

    return sendOk(reply, toResponseDto(updated));
  });

  app.delete("/:id", async (request, reply) => {
    const params = idParamsSchema.parse(request.params);
    const existing = await findResponseById(app, params.id);

    if (!existing) {
      throw new HttpError(404, "RESPONSE_NOT_FOUND", "Response not found");
    }

    await app.prisma.customerResponse.delete({ where: { id: params.id } });
    return sendOk(reply, { deleted: true });
  });

  app.get("/tags", async (_request, reply) => sendOk(reply, { tags: quickResponseTags }));
}
