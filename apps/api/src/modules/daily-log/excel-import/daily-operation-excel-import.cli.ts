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

type ResponseCriterionPathMap = Map<number, ResponseCriterionPathIds>;

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

async function resolveImportedResponseCriterionPathIds(prisma: PrismaClient): Promise<ResponseCriterionPathMap> {
  const criteria = await prisma.responseCriterion.findMany({
    where: {
      id: {
        in: [
          2004, 2120, 2144, 2150, 2201, 2300, 2330, 2350, 2351, 2352, 2354, 2355, 2356, 2360, 2361, 2410,
          2430, 2440, 2450, 2452, 2460, 2461, 2470, 2480, 2501, 2502
        ]
      },
      isActive: true
    },
    include: { parent: { include: { parent: true } } },
    orderBy: [{ id: "asc" }]
  });
  if (criteria.length === 0) {
    throw new Error("손님반응 적재에 사용할 활성 분류 기준을 찾지 못했습니다.");
  }
  return new Map(criteria.map((criterion) => [criterion.id, criterionPathIds(criterion)]));
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
  pathIdsByCriterionId: ResponseCriterionPathMap
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
    data: rows.map((row) => {
      const pathIds = resolveImportedRowPathIds(row.shortSummary, pathIdsByCriterionId);
      return {
        date,
        criterionId: pathIds.criterionId,
        majorCriterionId: pathIds.majorCriterionId,
        middleCriterionId: pathIds.middleCriterionId,
        minorCriterionId: pathIds.minorCriterionId,
        shortSummary: row.shortSummary,
        fullText: row.fullText,
        llmAssisted: false
      };
    })
  });
}

function resolveImportedRowPathIds(
  text: string,
  pathIdsByCriterionId: ResponseCriterionPathMap
): ResponseCriterionPathIds {
  const criterionId = classifyImportedCustomerResponse(text);
  const fallback = pathIdsByCriterionId.get(2502) ?? pathIdsByCriterionId.get(2501) ?? pathIdsByCriterionId.get(2004) ?? Array.from(pathIdsByCriterionId.values())[0];
  const pathIds = pathIdsByCriterionId.get(criterionId) ?? fallback;
  if (!pathIds) {
    throw new Error("손님반응 적재에 사용할 분류 기준을 찾지 못했습니다.");
  }
  return pathIds;
}

function classifyImportedCustomerResponse(text: string): number {
  if (/(배달.*많|쿠팡.*많)/u.test(text)) return 2361;
  if (/(배달.*없|배달.*적|배달 주문이 거의|배달 주문건이 적)/u.test(text)) return 2360;
  if (/(객단가.*낮|객단가도.*낮)/u.test(text)) return 2355;
  if (/(객단가.*높)/u.test(text)) return 2356;
  if (/(품절|빵이 없어서|구매하지못|구매하지 못|공백시간|일찍.*소진|이르게 품절)/u.test(text)) return 2300;
  if (/(일찍 마감|마감 되|솔드아웃|거의 소진)/u.test(text)) return 2300;
  if (/(예약|픽업)/u.test(text)) return 2330;
  if (/(샌드위치.*수요|샌드위치.*구매|샌드위치.*인기|바질치킨)/u.test(text)) return 2351;
  if (/(대량|[0-9]+개씩|여러.*구매)/u.test(text)) return 2354;
  if (/(수요가 높|찾으시는 손님|찾는 손님|많이 구매|대부분.*구매|구매해가|잘 나갔|꾸준하게|꾸준히|고르게 판매|판매 완료|판매 많|빠르게 판매|매출.*높)/u.test(text)) return 2350;
  if (/(쌀빵|건강빵|통밀|통곡물|잡곡|신제품|계절.*문의|더 많이 만들어)/u.test(text)) return 2150;
  if (/(시식.*좋|시식 후 구매|구매로 이어|극찬|맛있|맛좋|맛 좋|긍정|만족|칭찬|좋아한다고|최고로)/u.test(text)) return 2430;
  if (/(시식 많이|반응 좋)/u.test(text)) return 2430;
  if (/(선물)/u.test(text)) return 2440;
  if (/(짜다는|짰)/u.test(text)) return 2120;
  if (/(친절|설명|안내 도와)/u.test(text)) return 2201;
  if (/(주차)/u.test(text)) return 2480;
  if (/(청주|영종도|목동|멀리|지방|여행)/u.test(text)) return 2410;
  if (/(가족)/u.test(text)) return 2460;
  if (/(어린이|아이)/u.test(text)) return 2461;
  if (/(비가|우천|더운|날씨|흐리)/u.test(text)) return 2470;
  if (/(점심시간대.*방문 많|방문 몰렸|손님 방문 많)/u.test(text)) return 2452;
  if (/(유동인구|방문.*저조|방문수.*저조|한가|뜸하다|4시 이후|오전.*저조)/u.test(text)) return 2450;
  if (/(컷팅 문의|비닐.*문의|쇼핑백|봉투 문의|상품권|크림이나 잼|모양이 다른|보관.*문의|요청)/u.test(text)) return 2144;
  return 2502;
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  console.error(usage());
  process.exit(1);
});
