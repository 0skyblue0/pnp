import type { FastifyInstance } from "fastify";
import { z } from "zod";

import { parseDateOnly } from "../../common/datetime.js";
import { sendOk } from "../../common/http.js";

const dateOnlySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const querySchema = z.object({
  from: dateOnlySchema.optional(),
  to: dateOnlySchema.optional(),
  year: z.coerce.number().int().min(2000).max(2100).optional()
});

const monthKeys = ["01", "02", "03", "04", "05", "06", "07", "08", "09", "10", "11", "12"] as const;

function numeric(value: unknown): number {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }
  if (typeof value !== "string") {
    return 0;
  }
  const parsed = Number(value.replace(/[^0-9.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function jsonArray(value: unknown): Array<Record<string, unknown>> {
  return Array.isArray(value) ? value.filter((item): item is Record<string, unknown> => item !== null && typeof item === "object" && !Array.isArray(item)) : [];
}

function text(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function monthRange(year: number) {
  return {
    from: `${year}-01-01`,
    to: `${year}-12-31`
  };
}

function monthFromDate(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function dateLabel(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function ratio(value: number, total: number): number | null {
  return total > 0 ? value / total : null;
}

export async function registerSalesAnalysisRoutes(app: FastifyInstance): Promise<void> {
  app.get("/summary", async (request, reply) => {
    const query = querySchema.parse(request.query);
    const range = query.year ? monthRange(query.year) : { from: query.from, to: query.to };
    const from = range.from ?? `${new Date().getFullYear()}-01-01`;
    const to = range.to ?? `${new Date().getFullYear()}-12-31`;
    const year = query.year ?? Number(from.slice(0, 4));

    const [records, goalNotice] = await Promise.all([
      app.prisma.dailyOperationRecord.findMany({
        where: { date: { gte: parseDateOnly(from), lte: parseDateOnly(to) } },
        orderBy: { date: "asc" }
      }),
      app.prisma.annualGoalNotice.findFirst({
        where: { category: "sales", targetYear: year },
        orderBy: { updatedAt: "desc" }
      })
    ]);

    const monthlyTargets = (goalNotice?.monthlyTargets ?? {}) as Record<string, number>;
    const monthly = monthKeys.map((month) => ({
      month: `${year}-${month}`,
      sales: 0,
      count: 0,
      targetAmount: numeric(monthlyTargets[month]),
      targetProgressRate: null as number | null
    }));
    const monthlyByKey = new Map(monthly.map((item) => [item.month, item]));
    const daily: Array<{ date: string; sales: number; count: number; averageTicket: number }> = [];
    const channelMap = new Map<string, { name: string; amount: number; count: number }>();
    const productMap = new Map<string, { productName: string; soldQty: number; lossQty: number; tastingQty: number }>();

    let totalSales = 0;
    let totalCount = 0;

    for (const record of records) {
      const draft = (record.draft ?? {}) as Record<string, unknown>;
      const channels = jsonArray(record.channelRows);
      const products = jsonArray(record.productRows);
      const posAmount = numeric(draft.posSalesAmount);
      const posCount = numeric(draft.posSalesCount);
      const channelAmount = channels.reduce((sum, channel) => sum + numeric(channel.amount), 0);
      const channelCount = channels.reduce((sum, channel) => sum + numeric(channel.count), 0);
      const sales = posAmount + channelAmount;
      const count = posCount + channelCount;
      const monthKey = monthFromDate(record.date);
      const monthlyItem = monthlyByKey.get(monthKey);

      totalSales += sales;
      totalCount += count;
      daily.push({ date: dateLabel(record.date), sales, count, averageTicket: count > 0 ? Math.round(sales / count) : 0 });
      if (monthlyItem) {
        monthlyItem.sales += sales;
        monthlyItem.count += count;
      }

      const posChannel = channelMap.get("POS") ?? { name: "POS", amount: 0, count: 0 };
      posChannel.amount += posAmount;
      posChannel.count += posCount;
      channelMap.set("POS", posChannel);
      for (const channel of channels) {
        const name = text(channel.name, "POS 외").trim() || "POS 외";
        const item = channelMap.get(name) ?? { name, amount: 0, count: 0 };
        item.amount += numeric(channel.amount);
        item.count += numeric(channel.count);
        channelMap.set(name, item);
      }

      for (const product of products) {
        const productName = text(product.productName).trim();
        if (!productName) continue;
        const item = productMap.get(productName) ?? { productName, soldQty: 0, lossQty: 0, tastingQty: 0 };
        item.soldQty += numeric(product.soldQty);
        item.lossQty += numeric(product.lossQty);
        item.tastingQty += numeric(product.tastingQty);
        productMap.set(productName, item);
      }
    }

    for (const item of monthly) {
      item.targetProgressRate = ratio(item.sales, item.targetAmount);
    }

    const targetTotal = monthly.reduce((sum, item) => sum + item.targetAmount, 0);
    const maxMonthlySales = Math.max(0, ...monthly.map((item) => item.sales));

    return sendOk(reply, {
      from,
      to,
      year,
      totalSales,
      totalCount,
      averageTicket: totalCount > 0 ? Math.round(totalSales / totalCount) : 0,
      dailyAverageSales: records.length > 0 ? Math.round(totalSales / records.length) : 0,
      targetAmount: targetTotal,
      targetProgressRate: ratio(totalSales, targetTotal),
      monthly,
      daily,
      channels: [...channelMap.values()].map((item) => ({ ...item, ratio: ratio(item.amount, totalSales) ?? 0 })).sort((left, right) => right.amount - left.amount),
      productTop: [...productMap.values()].sort((left, right) => right.soldQty - left.soldQty).slice(0, 10),
      lossTop: [...productMap.values()].sort((left, right) => right.lossQty - left.lossQty).slice(0, 10),
      visual: { maxMonthlySales, maxDailySales: Math.max(0, ...daily.map((item) => item.sales)) }
    });
  });
}
