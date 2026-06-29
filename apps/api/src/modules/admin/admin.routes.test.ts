import type { ApiEnvelope } from "@pnp/shared";
import Fastify from "fastify";
import { describe, expect, it, vi } from "vitest";

import { registerAdminRoutes } from "./admin.routes.js";

type ListBody<T> = {
  items: T[];
  total: number;
  page: number;
  size: number;
};

type ResponseCriterionDto = {
  id: number;
  parentId: number | null;
  depth: number;
  name: string;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

function buildPrismaMock() {
  return {
    $transaction: vi.fn(async (queries: Promise<unknown>[]) => Promise.all(queries)),
    responseCriterion: {
      findMany: vi.fn(),
      count: vi.fn()
    }
  };
}

describe("admin response criteria routes", () => {
  it("parses active=false as an inactive criteria filter", async () => {
    const prisma = buildPrismaMock();
    const now = new Date("2026-01-01T00:00:00.000Z");
    prisma.responseCriterion.findMany.mockResolvedValue([
      {
        id: 1,
        parentId: null,
        depth: 1,
        name: "비활성",
        sortOrder: 10,
        isActive: false,
        createdAt: now,
        updatedAt: now
      }
    ]);
    prisma.responseCriterion.count.mockResolvedValue(1);

    const app = Fastify({ logger: false });
    app.decorate("prisma", prisma as never);
    await app.register(registerAdminRoutes);

    const response = await app.inject({
      method: "GET",
      url: "/response-criteria?active=false"
    });

    expect(response.statusCode).toBe(200);
    const body = response.json<ApiEnvelope<ListBody<ResponseCriterionDto>>>();
    expect(body.error).toBeNull();
    expect(body.data?.items[0]).toMatchObject({
      id: 1,
      name: "비활성",
      isActive: false
    });
    expect(prisma.responseCriterion.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { isActive: false } })
    );
    expect(prisma.responseCriterion.count).toHaveBeenCalledWith({
      where: { isActive: false }
    });

    await app.close();
  });
});
