import type { ApiEnvelope } from "@pnp/shared";
import Fastify from "fastify";
import { describe, expect, it, vi } from "vitest";

import { registerSalesAnalysisRoutes } from "./sales-analysis.routes.js";

function record(
  date: string,
  posSalesAmount: string,
  posSalesCount: string,
  channelRows: Array<Record<string, string>> = [],
  productRows: Array<Record<string, string>> = []
) {
  return {
    id: BigInt(date.replace(/\D/g, "")),
    date: new Date(`${date}T00:00:00.000Z`),
    draft: { posSalesAmount, posSalesCount },
    channelRows,
    productRows,
    staffSpecialRows: {},
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z")
  };
}

function buildPrismaMock() {
  return {
    dailyOperationRecord: { findMany: vi.fn() },
    annualGoalNotice: { findFirst: vi.fn() }
  };
}

describe("sales analysis routes", () => {
  it("summarizes yearly sales with visual chart data and monthly goal progress", async () => {
    const prisma = buildPrismaMock();
    prisma.dailyOperationRecord.findMany.mockResolvedValue([
      record(
        "2026-01-02",
        "100000",
        "10",
        [{ name: "배민", amount: "50000", count: "5" }],
        [
          { productName: "바게트", soldQty: "8", lossQty: "1" },
          { productName: "깜빠뉴", soldQty: "4", lossQty: "0" }
        ]
      ),
      record("2026-02-03", "200000", "20", [], [{ productName: "바게트", soldQty: "6", lossQty: "2" }])
    ]);
    prisma.annualGoalNotice.findFirst.mockResolvedValue({
      monthlyTargets: { "01": 300000, "02": 400000, "03": 0, "04": 0, "05": 0, "06": 0, "07": 0, "08": 0, "09": 0, "10": 0, "11": 0, "12": 0 }
    });

    const app = Fastify({ logger: false });
    app.decorate("prisma", prisma as never);
    await app.register(registerSalesAnalysisRoutes);

    const response = await app.inject({ method: "GET", url: "/summary?year=2026" });

    expect(response.statusCode).toBe(200);
    const body = response.json<ApiEnvelope<{ totalSales: number; totalCount: number; averageTicket: number; monthly: Array<{ month: string; sales: number; targetAmount: number; targetProgressRate: number | null }>; productTop: Array<{ productName: string; soldQty: number; lossQty: number }>; visual: { maxMonthlySales: number } }>>();
    expect(body.error).toBeNull();
    expect(body.data?.totalSales).toBe(350000);
    expect(body.data?.totalCount).toBe(35);
    expect(body.data?.averageTicket).toBe(10000);
    expect(body.data?.monthly.find((item) => item.month === "2026-01")).toMatchObject({ sales: 150000, targetAmount: 300000, targetProgressRate: 0.5 });
    expect(body.data?.productTop[0]).toMatchObject({ productName: "바게트", soldQty: 14, lossQty: 3 });
    expect(body.data?.visual.maxMonthlySales).toBe(200000);

    await app.close();
  });
});
