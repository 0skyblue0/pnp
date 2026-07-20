import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { ApiEnvelope } from "@pnp/shared";
import Fastify, { type FastifyInstance } from "fastify";
import { describe, expect, it, vi } from "vitest";
import XLSX from "xlsx";

import { registerDailyOperationImportRoutes } from "./daily-operation-import.routes.js";
import { HttpError, sendError } from "../../../common/http.js";

function buildWorkbookBase64(options: { reportedSalesAmount?: number } = {}) {
  const dir = mkdtempSync(join(tmpdir(), "pnp-import-route-"));
  const path = join(dir, "일일업무보고서.xlsx");
  const workbook = XLSX.utils.book_new();
  const rows: unknown[][] = Array.from({ length: 90 }, () => []);
  const setCell = (row: number, column: number, value: unknown) => {
    const target = rows[row];
    if (target) {
      target[column] = value;
    }
  };
  setCell(1, 2, "2026-07-10");
  setCell(2, 5, "폴폴");
  setCell(5, 4, "맑음");
  setCell(10, 2, 100000);
  setCell(10, 3, 10);
  setCell(10, 6, options.reportedSalesAmount ?? 100000);
  setCell(10, 7, 10);
  setCell(12, 1, "바게트");
  setCell(12, 2, 10);
  setCell(12, 8, 8);
  setCell(50, 2, 10);
  setCell(50, 8, 8);
  setCell(56, 2, "손님: 바게트가 맛있어요");
  setCell(60, 2, "손실 없음");
  setCell(64, 2, "청소 완료");
  setCell(69, 2, "전달 없음");
  setCell(72, 2, "내일 준비");
  setCell(75, 0, "직원 특이사항");
  setCell(79, 0, "시설 점검사항");
  const sheet = XLSX.utils.aoa_to_sheet(rows);
  XLSX.utils.book_append_sheet(workbook, sheet, "10일");
  XLSX.writeFile(workbook, path);
  return Buffer.from(readFileSync(path)).toString("base64");
}

function attachHttpErrorHandler(app: FastifyInstance) {
  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof HttpError) {
      return sendError(reply, error);
    }
    throw error;
  });
}

function buildPrismaMock() {
  const prisma = {
    dailyOperationRecord: {
      findUnique: vi.fn().mockResolvedValue(null),
      upsert: vi.fn(async (input: { create: Record<string, unknown> }) => ({
        ...input.create,
        id: 1n,
        createdAt: new Date("2026-07-10T00:00:00.000Z"),
        updatedAt: new Date("2026-07-10T00:00:00.000Z")
      }))
    },
    responseCriterion: {
      findFirst: vi.fn().mockResolvedValue({ id: 2000, parentId: null, depth: 1, name: "제품", sortOrder: 1, isActive: true })
    },
    customerResponse: {
      create: vi.fn(),
      createMany: vi.fn(),
      deleteMany: vi.fn()
    },
    $transaction: vi.fn()
  };
  prisma.$transaction.mockImplementation(async (callback: (transaction: typeof prisma) => Promise<unknown>) => callback(prisma));
  return prisma;
}

describe("daily operation Excel import routes", () => {
  it("previews uploaded Excel records and customer response candidates before saving", async () => {
    const prisma = buildPrismaMock();
    const app = Fastify({ logger: false });
    attachHttpErrorHandler(app);
    app.decorate("prisma", prisma as never);
    await app.register(registerDailyOperationImportRoutes);

    const response = await app.inject({
      method: "POST",
      url: "/preview",
      payload: { fileName: "일일업무보고서.xlsx", fileBase64: buildWorkbookBase64() }
    });

    expect(response.statusCode).toBe(200);
    const body = response.json<ApiEnvelope<{ records: Array<{ date: string; existing: boolean }>; customerResponseCandidates: Array<{ date: string; fullText: string }>; warnings: unknown[] }>>();
    expect(body.error).toBeNull();
    expect(body.data?.records[0]).toMatchObject({ date: "2026-07-10", existing: false });
    expect(body.data?.customerResponseCandidates[0]?.fullText).toContain("바게트가 맛있어요");

    await app.close();
  });

  it("requires acknowledgement before applying a date with validation mismatches", async () => {
    const prisma = buildPrismaMock();
    const app = Fastify({ logger: false });
    attachHttpErrorHandler(app);
    app.decorate("prisma", prisma as never);
    await app.register(registerDailyOperationImportRoutes);

    const response = await app.inject({
      method: "POST",
      url: "/apply",
      payload: {
        fileName: "일일업무보고서.xlsx",
        fileBase64: buildWorkbookBase64({ reportedSalesAmount: 90_000 }),
        acknowledgedDates: []
      }
    });

    expect(response.statusCode).toBe(409);
    expect(response.json<ApiEnvelope<unknown>>().error?.code).toBe("IMPORT_VALIDATION_ACK_REQUIRED");
    expect(prisma.dailyOperationRecord.upsert).not.toHaveBeenCalled();

    await app.close();
  });

  it("replaces only workbook-originated customer responses while applying a parsed date", async () => {
    const prisma = buildPrismaMock();
    const app = Fastify({ logger: false });
    attachHttpErrorHandler(app);
    app.decorate("prisma", prisma as never);
    await app.register(registerDailyOperationImportRoutes);

    const response = await app.inject({
      method: "POST",
      url: "/apply",
      payload: {
        fileName: "일일업무보고서.xlsx",
        fileBase64: buildWorkbookBase64()
      }
    });

    expect(response.statusCode).toBe(200);
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(prisma.customerResponse.deleteMany).toHaveBeenCalledWith({
      where: {
        date: new Date("2026-07-10T00:00:00.000Z"),
        fullText: { startsWith: "[일일업무보고서 서비스내역 및 손님 특이사항]" }
      }
    });
    expect(prisma.customerResponse.createMany).toHaveBeenCalledTimes(1);
    expect(prisma.customerResponse.create).not.toHaveBeenCalled();

    await app.close();
  });
});
