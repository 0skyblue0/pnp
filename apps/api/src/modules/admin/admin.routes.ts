import bcrypt from "bcryptjs";
import type { Prisma } from "@prisma/client";
import type { FastifyInstance } from "fastify";

import { formatDateOnly, parseDateOnly } from "../../common/datetime.js";
import { HttpError, sendOk } from "../../common/http.js";
import {
  createStaffSchema,
  idParamsSchema,
  listProductQuerySchema,
  listResponseCriterionQuerySchema,
  productSchema,
  responseCriterionSchema,
  updateProductSchema,
  updateResponseCriterionSchema,
  updateStaffSchema,
  type ProductInput,
  type ResponseCriterionInput,
  type UpdateProductInput
} from "./admin.schemas.js";

function buildCreateProductData(input: ProductInput): Prisma.ProductUncheckedCreateInput {
  return {
    name: input.name,
    category: input.category || null,
    isSeasonal: input.isSeasonal,
    seasonStart: input.seasonStart ? parseDateOnly(input.seasonStart) : null,
    seasonEnd: input.seasonEnd ? parseDateOnly(input.seasonEnd) : null,
    isActive: input.isActive,
    updatedAt: new Date()
  };
}

function buildUpdateProductData(input: UpdateProductInput): Prisma.ProductUncheckedUpdateInput {
  return {
    ...(input.name !== undefined ? { name: input.name } : {}),
    ...(input.category !== undefined ? { category: input.category || null } : {}),
    ...(input.isSeasonal !== undefined ? { isSeasonal: input.isSeasonal } : {}),
    ...(input.seasonStart !== undefined
      ? { seasonStart: input.seasonStart ? parseDateOnly(input.seasonStart) : null }
      : {}),
    ...(input.seasonEnd !== undefined
      ? { seasonEnd: input.seasonEnd ? parseDateOnly(input.seasonEnd) : null }
      : {}),
    ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
    updatedAt: new Date()
  };
}

function toProductDto(product: {
  id: number;
  name: string;
  category: string | null;
  isSeasonal: boolean;
  seasonStart: Date | null;
  seasonEnd: Date | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: product.id,
    name: product.name,
    category: product.category,
    isSeasonal: product.isSeasonal,
    seasonStart: formatDateOnly(product.seasonStart),
    seasonEnd: formatDateOnly(product.seasonEnd),
    isActive: product.isActive,
    createdAt: product.createdAt.toISOString(),
    updatedAt: product.updatedAt.toISOString()
  };
}

function toStaffDto(staff: {
  id: number;
  username: string;
  displayName: string | null;
  role: string | null;
  isActive: boolean;
  createdAt: Date;
}) {
  return {
    id: staff.id,
    username: staff.username,
    displayName: staff.displayName,
    role: staff.role,
    isActive: staff.isActive,
    createdAt: staff.createdAt.toISOString()
  };
}

type ResponseCriterionRecord = {
  id: number;
  parentId: number | null;
  depth: number;
  name: string;
  sortOrder: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};

async function resolveCriterionDepth(app: FastifyInstance, input: ResponseCriterionInput) {
  if (!input.parentId) {
    return 1;
  }

  const parent = await app.prisma.responseCriterion.findUnique({
    where: { id: input.parentId }
  });

  if (!parent) {
    throw new HttpError(404, "RESPONSE_CRITERION_PARENT_NOT_FOUND", "Parent criterion not found");
  }
  if (!parent.isActive) {
    throw new HttpError(400, "RESPONSE_CRITERION_PARENT_INACTIVE", "Parent criterion is inactive");
  }
  if (parent.depth >= 3) {
    throw new HttpError(400, "RESPONSE_CRITERION_DEPTH_LIMIT", "Criterion depth is limited to 3");
  }

  return parent.depth + 1;
}

function toResponseCriterionDto(criterion: ResponseCriterionRecord) {
  return {
    id: criterion.id,
    parentId: criterion.parentId,
    depth: criterion.depth,
    name: criterion.name,
    sortOrder: criterion.sortOrder,
    isActive: criterion.isActive,
    createdAt: criterion.createdAt.toISOString(),
    updatedAt: criterion.updatedAt.toISOString()
  };
}

async function findCriterionSubtreeIds(app: FastifyInstance, id: number): Promise<number[]> {
  const children = await app.prisma.responseCriterion.findMany({
    where: { parentId: id },
    select: { id: true }
  });
  const childIds = children.map((criterion) => criterion.id);
  const grandchildren =
    childIds.length > 0
      ? await app.prisma.responseCriterion.findMany({
          where: { parentId: { in: childIds } },
          select: { id: true }
        })
      : [];

  return [id, ...childIds, ...grandchildren.map((criterion) => criterion.id)];
}

async function assertActiveCriterionParent(app: FastifyInstance, parentId: number | null) {
  if (parentId === null) {
    return;
  }

  const parent = await app.prisma.responseCriterion.findUnique({
    where: { id: parentId },
    select: { isActive: true }
  });

  if (!parent?.isActive) {
    throw new HttpError(400, "RESPONSE_CRITERION_PARENT_INACTIVE", "Parent criterion is inactive");
  }
}

export async function registerAdminRoutes(app: FastifyInstance): Promise<void> {
  app.get("/response-criteria", async (request, reply) => {
    const query = listResponseCriterionQuerySchema.parse(request.query);
    const where = query.active === undefined ? {} : { isActive: query.active };
    const [items, total] = await app.prisma.$transaction([
      app.prisma.responseCriterion.findMany({
        where,
        orderBy: [{ depth: "asc" }, { parentId: "asc" }, { sortOrder: "asc" }, { name: "asc" }],
        take: 500
      }),
      app.prisma.responseCriterion.count({ where })
    ]);

    return sendOk(reply, {
      items: items.map(toResponseCriterionDto),
      total,
      page: 1,
      size: items.length
    });
  });

  app.post("/response-criteria", async (request, reply) => {
    const input = responseCriterionSchema.parse(request.body);
    const depth = await resolveCriterionDepth(app, input);
    const criterion = await app.prisma.responseCriterion.create({
      data: {
        parentId: input.parentId ?? null,
        depth,
        name: input.name,
        sortOrder: input.sortOrder,
        isActive: input.isActive,
        updatedAt: new Date()
      }
    });

    return sendOk(reply, toResponseCriterionDto(criterion), 201);
  });

  app.patch("/response-criteria/:id", async (request, reply) => {
    const params = idParamsSchema.parse(request.params);
    const input = updateResponseCriterionSchema.parse(request.body);
    const existing = await app.prisma.responseCriterion.findUnique({ where: { id: params.id } });

    if (!existing) {
      throw new HttpError(404, "RESPONSE_CRITERION_NOT_FOUND", "Response criterion not found");
    }

    if (input.isActive === true) {
      await assertActiveCriterionParent(app, existing.parentId);
    }

    const criterion = await app.prisma.responseCriterion.update({
      where: { id: params.id },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
        updatedAt: new Date()
      }
    });

    if (input.isActive === false) {
      const criterionIds = await findCriterionSubtreeIds(app, params.id);
      const childIds = criterionIds.filter((id) => id !== params.id);
      if (childIds.length > 0) {
        await app.prisma.responseCriterion.updateMany({
          where: { id: { in: childIds } },
          data: { isActive: false, updatedAt: new Date() }
        });
      }
    }

    return sendOk(reply, toResponseCriterionDto(criterion));
  });

  app.delete("/response-criteria/:id", async (request, reply) => {
    const params = idParamsSchema.parse(request.params);
    const existing = await app.prisma.responseCriterion.findUnique({ where: { id: params.id } });

    if (!existing) {
      throw new HttpError(404, "RESPONSE_CRITERION_NOT_FOUND", "Response criterion not found");
    }

    const criterionIds = await findCriterionSubtreeIds(app, params.id);

    await app.prisma.responseCriterion.updateMany({
      where: { id: { in: criterionIds } },
      data: { isActive: false, updatedAt: new Date() }
    });

    const criterion = await app.prisma.responseCriterion.findUniqueOrThrow({
      where: { id: params.id }
    });

    return sendOk(reply, {
      deleted: true,
      deactivated: true,
      item: toResponseCriterionDto(criterion)
    });
  });

  app.get("/product", async (request, reply) => {
    const query = listProductQuerySchema.parse(request.query);
    const where = query.active === undefined ? {} : { isActive: query.active };
    const [items, total] = await app.prisma.$transaction([
      app.prisma.product.findMany({
        where,
        orderBy: [{ isActive: "desc" }, { name: "asc" }],
        take: 200
      }),
      app.prisma.product.count({ where })
    ]);

    return sendOk(reply, {
      items: items.map(toProductDto),
      total,
      page: 1,
      size: items.length
    });
  });

  app.post("/product", async (request, reply) => {
    const input = productSchema.parse(request.body);
    const product = await app.prisma.product.create({
      data: buildCreateProductData(input)
    });

    return sendOk(reply, toProductDto(product), 201);
  });

  app.patch("/product/:id", async (request, reply) => {
    const params = idParamsSchema.parse(request.params);
    const input = updateProductSchema.parse(request.body);
    const existing = await app.prisma.product.findUnique({ where: { id: params.id } });

    if (!existing) {
      throw new HttpError(404, "PRODUCT_NOT_FOUND", "Product not found");
    }

    const product = await app.prisma.product.update({
      where: { id: params.id },
      data: buildUpdateProductData(input)
    });

    return sendOk(reply, toProductDto(product));
  });

  app.delete("/product/:id", async (request, reply) => {
    const params = idParamsSchema.parse(request.params);
    const existing = await app.prisma.product.findUnique({ where: { id: params.id } });

    if (!existing) {
      throw new HttpError(404, "PRODUCT_NOT_FOUND", "Product not found");
    }

    try {
      await app.prisma.product.delete({ where: { id: params.id } });
      return sendOk(reply, { deleted: true, deactivated: false });
    } catch (error) {
      if (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === "P2003"
      ) {
        const product = await app.prisma.product.update({
          where: { id: params.id },
          data: {
            isActive: false,
            updatedAt: new Date()
          }
        });
        return sendOk(reply, { deleted: true, deactivated: true, item: toProductDto(product) });
      }
      throw error;
    }
  });

  app.get("/staff", async (_request, reply) => {
    const [items, total] = await app.prisma.$transaction([
      app.prisma.staff.findMany({
        orderBy: [{ isActive: "desc" }, { username: "asc" }],
        take: 100
      }),
      app.prisma.staff.count()
    ]);

    return sendOk(reply, {
      items: items.map(toStaffDto),
      total,
      page: 1,
      size: items.length
    });
  });

  app.post("/staff", async (request, reply) => {
    const input = createStaffSchema.parse(request.body);
    const existing = await app.prisma.staff.findUnique({ where: { username: input.username } });

    if (existing) {
      throw new HttpError(409, "STAFF_USERNAME_EXISTS", "Username already exists");
    }

    const passwordHash = await bcrypt.hash(input.password, 12);
    const staff = await app.prisma.staff.create({
      data: {
        username: input.username,
        displayName: input.displayName ?? null,
        passwordHash,
        role: input.role,
        isActive: input.isActive
      }
    });

    return sendOk(reply, toStaffDto(staff), 201);
  });

  app.patch("/staff/:id", async (request, reply) => {
    const params = idParamsSchema.parse(request.params);
    const input = updateStaffSchema.parse(request.body);
    const existing = await app.prisma.staff.findUnique({ where: { id: params.id } });

    if (!existing) {
      throw new HttpError(404, "STAFF_NOT_FOUND", "Staff not found");
    }

    const staff = await app.prisma.staff.update({
      where: { id: params.id },
      data: {
        ...(input.displayName !== undefined ? { displayName: input.displayName } : {}),
        ...(input.role !== undefined ? { role: input.role } : {}),
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
        ...(input.password !== undefined
          ? { passwordHash: await bcrypt.hash(input.password, 12) }
          : {})
      }
    });

    return sendOk(reply, toStaffDto(staff));
  });

  app.delete("/staff/:id", async (request, reply) => {
    const params = idParamsSchema.parse(request.params);
    const existing = await app.prisma.staff.findUnique({ where: { id: params.id } });

    if (!existing) {
      throw new HttpError(404, "STAFF_NOT_FOUND", "Staff not found");
    }

    try {
      await app.prisma.staff.delete({ where: { id: params.id } });
      return sendOk(reply, { deleted: true, deactivated: false });
    } catch (error) {
      if (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === "P2003"
      ) {
        const staff = await app.prisma.staff.update({
          where: { id: params.id },
          data: { isActive: false }
        });
        return sendOk(reply, { deleted: true, deactivated: true, item: toStaffDto(staff) });
      }
      throw error;
    }
  });
}
