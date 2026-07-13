import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { ApiEnvelope } from "@pnp/shared";
import Fastify from "fastify";
import { describe, expect, it, vi } from "vitest";
import XLSX from "xlsx";

import { registerDailyOperationImportRoutes } from "./daily-operation-import.routes.js";

function buildWorkbookBase64() {
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
  setCell(10, 6, 100000);
  setCell(10, 7, 10);
  setCell(12, 1, "바게트");
  setCell(12, 2, 10);
  setCell(12, 8, 8);
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

function buildPrismaMock() {
  return {
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
      create: vi.fn()
    }
  };
}

describe("daily operation Excel import routes", () => {
  it("previews uploaded Excel records and customer response candidates before saving", async () => {
    const prisma = buildPrismaMock();
    const app = Fastify({ logger: false });
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
});
