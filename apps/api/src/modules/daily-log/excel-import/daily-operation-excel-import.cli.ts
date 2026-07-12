import { PrismaClient, type Prisma } from "@prisma/client";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

import { parseDailyOperationWorkbook } from "./daily-operation-excel-parser.js";

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
      console.log(`저장 완료: ${record.date}`);
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  console.error(usage());
  process.exit(1);
});
