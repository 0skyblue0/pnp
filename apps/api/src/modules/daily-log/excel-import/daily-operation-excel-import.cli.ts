import { PrismaClient, type Prisma } from "@prisma/client";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

import { parseDailyOperationWorkbook, type CustomerResponseRow } from "./daily-operation-excel-parser.js";

type ResponseCriterionWithParents = Prisma.ResponseCriterionGetPayload<{
  include: { parent: { include: { parent: true } } };
}>;

type ResponseCriterionPathIds = {
  criterionId: number;
  majorCriterionId: number;
  middleCriterionId: number | null;
  minorCriterionId: number | null;
};

const importedDailyServiceResponsePrefix = "[일일업무보고서 서비스내역 및 손님 특이사항]";

function usage(): string {
  return [
    "Usage: npm run import:daily-operation -w @pnp/api -- [--dry-run|--apply] <xlsx...>",
    "",
    "Examples:",
    "  npm run import:daily-operation -w @pnp/api -- --dry-run Docs/User_Send/일일업무보고서_5월.xlsx",
    "  npm run import:daily-operation -w @pnp/api -- --apply Docs/User_Send/일일업무보고서_5월.xlsx"
  ].join("\n");
}

function toInputJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function parseArgs(argv: string[]): { apply: boolean; files: string[] } {
  const apply = argv.includes("--apply");
  const dryRun = argv.includes("--dry-run");
  if (apply && dryRun) {
    throw new Error("--apply와 --dry-run은 함께 사용할 수 없습니다.");
  }
  const files = argv.filter((arg) => arg !== "--apply" && arg !== "--dry-run");
  if (files.length === 0) {
    throw new Error("가져올 Excel 파일 경로가 필요합니다.");
  }
  return { apply, files: files.map(resolveInputPath) };
}

function resolveInputPath(path: string): string {
  if (existsSync(path)) {
    return path;
  }
  const initialCwd = process.env.INIT_CWD;
  if (initialCwd) {
    const fromInitialCwd = resolve(initialCwd, path);
    if (existsSync(fromInitialCwd)) {
      return fromInitialCwd;
    }
  }
  return path;
}

async function main() {
  const { apply, files } = parseArgs(process.argv.slice(2));
  const parsedWorkbooks = files.map((file) => ({ file, parsed: parseDailyOperationWorkbook(file) }));
  const records = parsedWorkbooks.flatMap(({ parsed }) => parsed.records);
  const warnings = parsedWorkbooks.flatMap(({ file, parsed }) =>
    parsed.warnings.map((warning) => ({ file, ...warning }))
  );
  const skippedSheets = parsedWorkbooks.flatMap(({ file, parsed }) =>
    parsed.skippedSheets.map((skipped) => ({ file, ...skipped }))
  );

  console.log(`모드: ${apply ? "APPLY" : "DRY-RUN"}`);
  console.log(`파일: ${files.length}개`);
  console.log(`파싱 대상 날짜: ${records.length}건`);
  console.log(`손님반응 적재 후보: ${records.reduce((total, record) => total + record.customerResponseRows.length, 0)}건`);
  console.log(`제외 시트: ${skippedSheets.length}건`);
  for (const skipped of skippedSheets) {
    console.log(`  - ${skipped.file} / ${skipped.sheetName}: ${skipped.reason}`);
  }
  console.log(`경고: ${warnings.length}건`);
  for (const warning of warnings) {
    console.log(`  - ${warning.file} / ${warning.sheetName}: ${warning.code} ${warning.message}`);
  }

  if (!apply) {
    console.log("dry-run 완료: DB에는 저장하지 않았습니다.");
    return;
  }

  const prisma = new PrismaClient();
  try {
    const responseCriterionPathIds = await resolveImportedResponseCriterionPathIds(prisma);
    for (const record of records) {
      const date = new Date(`${record.date}T00:00:00.000Z`);
      await prisma.dailyOperationRecord.upsert({
        where: { date },
        create: {
          date,
          draft: toInputJson({ ...record.draft, date: record.date }),
          productRows: toInputJson(record.productRows),
          channelRows: toInputJson(record.channelRows),
          staffSpecialRows: toInputJson(record.staffSpecialRows),
          updatedAt: new Date()
        },
        update: {
          draft: toInputJson({ ...record.draft, date: record.date }),
          productRows: toInputJson(record.productRows),
          channelRows: toInputJson(record.channelRows),
          staffSpecialRows: toInputJson(record.staffSpecialRows),
          updatedAt: new Date()
        }
      });
      await upsertImportedCustomerResponses(prisma, date, record.customerResponseRows, responseCriterionPathIds);
      console.log(`저장 완료: ${record.date}`);
    }
  } finally {
    await prisma.$disconnect();
  }
}

async function resolveImportedResponseCriterionPathIds(prisma: PrismaClient): Promise<ResponseCriterionPathIds> {
  const criteria = await prisma.responseCriterion.findMany({
    where: { id: { in: [2502, 2501, 2004] }, isActive: true },
    include: { parent: { include: { parent: true } } },
    orderBy: [{ id: "asc" }]
  });
  const criterion = criteria.find((item) => item.id === 2502) ?? criteria.find((item) => item.id === 2501) ?? criteria[0];
  if (!criterion) {
    throw new Error("손님반응 적재에 사용할 활성 분류 기준을 찾지 못했습니다.");
  }
  return criterionPathIds(criterion);
}

function criterionPathIds(criterion: ResponseCriterionWithParents): ResponseCriterionPathIds {
  if (criterion.depth === 1) {
    return {
      criterionId: criterion.id,
      majorCriterionId: criterion.id,
      middleCriterionId: null,
      minorCriterionId: null
    };
  }

  if (criterion.depth === 2) {
    if (!criterion.parent) {
      throw new Error("2단계 손님반응 분류 기준의 상위 기준이 없습니다.");
    }
    return {
      criterionId: criterion.id,
      majorCriterionId: criterion.parent.id,
      middleCriterionId: criterion.id,
      minorCriterionId: null
    };
  }

  if (!criterion.parent?.parent) {
    throw new Error("3단계 손님반응 분류 기준의 상위 기준이 없습니다.");
  }
  return {
    criterionId: criterion.id,
    majorCriterionId: criterion.parent.parent.id,
    middleCriterionId: criterion.parent.id,
    minorCriterionId: criterion.id
  };
}

async function upsertImportedCustomerResponses(
  prisma: PrismaClient,
  date: Date,
  rows: CustomerResponseRow[],
  pathIds: ResponseCriterionPathIds
) {
  await prisma.customerResponse.deleteMany({
    where: {
      date,
      fullText: { startsWith: importedDailyServiceResponsePrefix }
    }
  });

  if (rows.length === 0) {
    return;
  }

  await prisma.customerResponse.createMany({
    data: rows.map((row) => ({
      date,
      criterionId: pathIds.criterionId,
      majorCriterionId: pathIds.majorCriterionId,
      middleCriterionId: pathIds.middleCriterionId,
      minorCriterionId: pathIds.minorCriterionId,
      shortSummary: row.shortSummary,
      fullText: row.fullText,
      llmAssisted: false
    }))
  });
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  console.error(usage());
  process.exit(1);
});
