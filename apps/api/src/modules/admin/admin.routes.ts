import bcrypt from "bcryptjs";
import type { Prisma } from "@prisma/client";
import type { FastifyInstance } from "fastify";

import { HttpError, sendOk } from "../../common/http.js";
import {
  createStaffSchema,
  idParamsSchema,
  listProductQuerySchema,
  productSchema,
  updateProductSchema,
  updateStaffSchema,
  type ProductInput,
  type UpdateProductInput
} from "./admin.schemas.js";

function parseDateOnly(date: string): Date {
  return new Date(`${date}T00:00:00.000Z`);
}

function formatDateOnly(date: Date | null): string | null {
  return date?.toISOString().slice(0, 10) ?? null;
}

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

export async function registerAdminRoutes(app: FastifyInstance): Promise<void> {
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
