import type { Prisma } from "@prisma/client";
import type { FastifyInstance } from "fastify";
import { z } from "zod";

import { parseDateOnly } from "../../../common/datetime.js";
import { HttpError, sendOk } from "../../../common/http.js";
import { parseDailyOperationWorkbookFromBuffer, type ParsedDailyOperationRecord } from "./daily-operation-excel-parser.js";

const importedDailyServiceResponsePrefix = "[일일업무보고서 서비스내역 및 손님 특이사항]";

const importBodySchema = z.object({
  fileName: z.string().trim().min(1),
  fileBase64: z.string().min(1),
  apply: z.boolean().optional(),
  responseCandidateIndexes: z.array(z.number().int().min(0)).optional(),
  acknowledgedDates: z.array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).optional()
});

function toInputJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function decodeWorkbook(fileBase64: string): Buffer {
  const buffer = Buffer.from(fileBase64, "base64");
  if (buffer.length === 0) {
    throw new HttpError(400, "EMPTY_IMPORT_FILE", "엑셀 파일을 읽지 못했습니다.");
  }
  if (buffer.length > 20 * 1024 * 1024) {
    throw new HttpError(400, "IMPORT_FILE_TOO_LARGE", "20MB 이하 엑셀 파일만 불러올 수 있습니다.");
  }
  return buffer;
}

function candidateRows(records: ParsedDailyOperationRecord[]) {
  return records.flatMap((record) =>
    record.customerResponseRows.map((candidate) => ({
      date: candidate.date,
      shortSummary: candidate.shortSummary,
      fullText: candidate.fullText
    }))
  );
}

function previewRecord(record: ParsedDailyOperationRecord, existing: boolean) {
  const channelSales = record.channelRows.reduce((sum, row) => sum + Number(String(row.amount).replace(/\D/g, "")), 0);
  const posSales = Number(String(record.draft.posSalesAmount).replace(/\D/g, ""));
  return {
    date: record.date,
    existing,
    productRowCount: record.productRows.length,
    channelRowCount: record.channelRows.length,
    totalSales: posSales + channelSales,
    customerResponseCandidateCount: record.customerResponseRows.length,
    draft: record.draft,
    productRows: record.productRows,
    channelRows: record.channelRows,
    staffSpecialRows: record.staffSpecialRows,
    checks: record.checks
  };
}

async function defaultCriterionId(app: FastifyInstance) {
  const criterion = await app.prisma.responseCriterion.findFirst({
    where: { depth: 1, isActive: true },
    orderBy: { sortOrder: "asc" }
  });
  if (!criterion) {
    throw new HttpError(400, "RESPONSE_CRITERION_NOT_FOUND", "손님 반응 기준이 없어 엑셀 반응을 저장할 수 없습니다.");
  }
  return {
    criterionId: criterion.id,
    majorCriterionId: criterion.depth === 1 ? criterion.id : criterion.parentId ?? criterion.id,
    middleCriterionId: criterion.depth === 2 ? criterion.id : null,
    minorCriterionId: criterion.depth === 3 ? criterion.id : null
  };
}

export async function registerDailyOperationImportRoutes(app: FastifyInstance): Promise<void> {
  app.post("/preview", async (request, reply) => {
    const input = importBodySchema.parse(request.body);
    const parsed = parseDailyOperationWorkbookFromBuffer(decodeWorkbook(input.fileBase64), input.fileName);
    const existingDates = await Promise.all(
      parsed.records.map(async (record) => {
        const existing = await app.prisma.dailyOperationRecord.findUnique({ where: { date: parseDateOnly(record.date) } });
        return [record.date, Boolean(existing)] as const;
      })
    );
    const existingByDate = new Map(existingDates);

    return sendOk(reply, {
      fileName: input.fileName,
      records: parsed.records.map((record) => previewRecord(record, existingByDate.get(record.date) ?? false)),
      customerResponseCandidates: candidateRows(parsed.records),
      warnings: parsed.warnings,
      skippedSheets: parsed.skippedSheets
    });
  });

  app.post("/apply", async (request, reply) => {
    const input = importBodySchema.parse(request.body);
    const parsed = parseDailyOperationWorkbookFromBuffer(decodeWorkbook(input.fileBase64), input.fileName);
    const now = new Date();
    const responseCandidates = candidateRows(parsed.records);
    const selected = new Set(input.responseCandidateIndexes ?? responseCandidates.map((_, index) => index));
    const acknowledgedDates = new Set(input.acknowledgedDates ?? []);
    const unacknowledgedRecords = parsed.records.filter(
      (record) => record.checks.mismatches.length > 0 && !acknowledgedDates.has(record.date)
    );
    if (unacknowledgedRecords.length > 0) {
      throw new HttpError(
        409,
        "IMPORT_VALIDATION_ACK_REQUIRED",
        "검증 경고가 있는 날짜를 확인한 뒤 저장해 주세요.",
        unacknowledgedRecords.map((record) => ({ date: record.date, mismatches: record.checks.mismatches }))
      );
    }
    const criterion = await defaultCriterionId(app);
    const selectedCandidates = responseCandidates.filter((_, index) => selected.has(index));

    let responseSavedCount = 0;
    await app.prisma.$transaction(async (transaction) => {
      for (const record of parsed.records) {
        const date = parseDateOnly(record.date);
        await transaction.dailyOperationRecord.upsert({
          where: { date },
          create: {
            date,
            draft: toInputJson(record.draft),
            productRows: toInputJson(record.productRows),
            channelRows: toInputJson(record.channelRows),
            staffSpecialRows: toInputJson(record.staffSpecialRows),
            updatedAt: now
          },
          update: {
            draft: toInputJson(record.draft),
            productRows: toInputJson(record.productRows),
            channelRows: toInputJson(record.channelRows),
            staffSpecialRows: toInputJson(record.staffSpecialRows),
            updatedAt: now
          }
        });
        await transaction.customerResponse.deleteMany({
          where: { date, fullText: { startsWith: importedDailyServiceResponsePrefix } }
        });
        const rows = selectedCandidates.filter((candidate) => candidate.date === record.date);
        if (rows.length > 0) {
          await transaction.customerResponse.createMany({
            data: rows.map((candidate) => ({
              date,
              shortSummary: candidate.shortSummary,
              fullText: candidate.fullText,
              llmAssisted: false,
              ...criterion
            }))
          });
          responseSavedCount += rows.length;
        }
      }
    });

    return sendOk(reply, {
      dailyOperationSavedCount: parsed.records.length,
      responseSavedCount,
      warnings: parsed.warnings,
      skippedSheets: parsed.skippedSheets
    });
  });
}
