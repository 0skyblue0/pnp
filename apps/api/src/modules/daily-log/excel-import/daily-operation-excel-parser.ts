import XLSX from "xlsx";

export type ProductRow = {
  productName: string;
  producedQty: string;
  lossQty: string;
  tastingQty: string;
  otherInQty: string;
  otherOutQty: string;
  stockQty: string;
  soldQty: string;
  soldQtyUnmeasurable?: boolean;
  manualSold: boolean;
};

export type ChannelRow = {
  name: string;
  count: string;
  amount: string;
};

type StaffPeriod = "today" | "tomorrow";
type StaffCategory = "dayOff" | "vacation" | "lateEarly" | "support" | "birthday" | "newStaff" | "etc";

export type StaffSpecialRows = Record<StaffPeriod, Record<StaffCategory, string>>;

export type DailyOperationRawSections = {
  source: {
    fileName: string;
    sheetName: string;
    importedAt: string;
  };
  sections: {
    serviceAndCustomerNotes: RawSection;
    productOpinionAndLoss: RawSection;
    storeManagement: RawSection;
    instructions: RawSection;
    tomorrowPrep: RawSection;
    staffSpecial: RawSection;
    facilityCheck: RawSection;
  };
};

export type RawSection = {
  label: string;
  rows: number[];
  text: string;
};

export type DailyOperationDraft = {
  date: string;
  author: string;
  outsideTemp: string;
  insideTemp: string;
  outsideHumidity: string;
  insideHumidity: string;
  weather: string;
  posSalesAmount: string;
  posSalesCount: string;
  nonPosSalesAmount: string;
  nonPosSalesCount: string;
  productOpinionAndLoss: string;
  facilityIssue: string;
  cleaningWork: string;
  instructions: string;
  tomorrowPrep: string;
  firstWorker: string;
  firstWorkerTime: string;
  lastWorker: string;
  lastWorkerTime: string;
  hygieneChecker: string;
  finalChecker: string;
  rawSections?: DailyOperationRawSections;
};

export type ImportWarning = {
  sheetName: string;
  code: string;
  message: string;
};

export type ImportCheckMismatch = {
  field: string;
  expected: number;
  actual: number;
};

export type ParsedDailyOperationRecord = {
  date: string;
  draft: DailyOperationDraft;
  productRows: ProductRow[];
  channelRows: ChannelRow[];
  staffSpecialRows: StaffSpecialRows;
  customerResponseRows: CustomerResponseRow[];
  checks: {
    salesMatched: boolean;
    productTotalsMatched: boolean;
    rawSectionsPreserved: boolean;
    mismatches: ImportCheckMismatch[];
  };
};

export type CustomerResponseRow = {
  date: string;
  shortSummary: string;
  fullText: string;
};

export type ParsedDailyOperationWorkbook = {
  records: ParsedDailyOperationRecord[];
  warnings: ImportWarning[];
  skippedSheets: Array<{ sheetName: string; reason: string }>;
};

const manualSoldProducts = new Set(["구름빵", "호밀쇼콜라오렌지", "호밀비트", "호밀후르츠"]);

const productNameMap = new Map([
  ["깜파뉴", "깜빠뉴"],
  ["깜파뉴(H)", "깜빠뉴 (H)"],
  ["깜빠뉴(H)", "깜빠뉴 (H)"],
  ["바질치킨", "바질치킨샌드위치"],
  ["크로아상", "크로와상"]
]);

const channelNameMap = new Map([["배 민", "배민"]]);

export function parseDailyOperationWorkbook(path: string): ParsedDailyOperationWorkbook {
  const workbook = XLSX.readFile(path, { cellDates: false });
  return parseDailyOperationWorkbookData(workbook, path.split(/[\\/]/).pop() ?? path);
}

export function parseDailyOperationWorkbookFromBuffer(
  buffer: Buffer,
  fileName: string
): ParsedDailyOperationWorkbook {
  const workbook = XLSX.read(buffer, { type: "buffer", cellDates: false });
  return parseDailyOperationWorkbookData(workbook, fileName);
}

function parseDailyOperationWorkbookData(
  workbook: XLSX.WorkBook,
  fileName: string
): ParsedDailyOperationWorkbook {
  const workbookYearMonth = inferWorkbookYearMonth(workbook);
  const importedAt = new Date().toISOString();
  const records: ParsedDailyOperationRecord[] = [];
  const warnings: ImportWarning[] = [];
  const skippedSheets: Array<{ sheetName: string; reason: string }> = [];

  for (const sheetName of workbook.SheetNames) {
    if (sheetName === "사용법" || sheetName === "결산") {
      skippedSheets.push({ sheetName, reason: "non-daily-sheet" });
      continue;
    }

    if (!/^\d+일$/.test(sheetName)) {
      skippedSheets.push({ sheetName, reason: "non-daily-sheet" });
      continue;
    }

    const sheet = workbook.Sheets[sheetName];
    if (!sheet) {
      skippedSheets.push({ sheetName, reason: "missing-sheet" });
      continue;
    }

    const date = parseKoreanDate(cellText(sheet, "C2")) ?? dateFromSheetName(sheetName, workbookYearMonth);
    if (!date) {
      skippedSheets.push({ sheetName, reason: "invalid-date" });
      continue;
    }

    const record = parseDailySheet({ sheet, sheetName, fileName, importedAt, date });
    records.push(record);

    if (!record.checks.salesMatched) {
      warnings.push({ sheetName, code: "SALES_TOTAL_MISMATCH", message: "매출 합계가 일치하지 않습니다." });
    }
    if (!record.checks.rawSectionsPreserved) {
      warnings.push({ sheetName, code: "RAW_SECTIONS_MISSING", message: "원문 섹션 보존이 누락되었습니다." });
    }
  }

  return { records, warnings, skippedSheets };
}

function parseDailySheet(input: {
  sheet: XLSX.WorkSheet;
  sheetName: string;
  fileName: string;
  importedAt: string;
  date: string;
}): ParsedDailyOperationRecord {
  const { sheet, sheetName, fileName, importedAt, date } = input;
  const channelRows = parseChannels(sheet);
  const productRows = parseProductRows(sheet);
  const rawSections = buildRawSections(sheet, { fileName, sheetName, importedAt });
  const staffSpecialRows = parseStaffSpecialRows(sheet);
  const facilityChecks = parseFacilityChecks(sheet);
  const storeManagement = parseStoreManagement(sheet);

  const productText = rawSections.sections.productOpinionAndLoss.text;
  const customerResponseRows = buildCustomerResponseRows({
    date,
    fileName,
    sheetName,
    serviceText: rawSections.sections.serviceAndCustomerNotes.text
  });

  const draft: DailyOperationDraft = {
    date,
    author: cellText(sheet, "F3"),
    outsideTemp: cellText(sheet, "F6"),
    insideTemp: cellText(sheet, "G6"),
    outsideHumidity: cellText(sheet, "H6"),
    insideHumidity: cellText(sheet, "I6"),
    weather: cellText(sheet, "E6"),
    posSalesAmount: numberText(cellNumber(sheet, "C11")),
    posSalesCount: numberText(cellNumber(sheet, "D11")),
    nonPosSalesAmount: numberText(sumChannels(channelRows, "amount")),
    nonPosSalesCount: numberText(sumChannels(channelRows, "count")),
    productOpinionAndLoss: productText,
    facilityIssue: storeManagement.facilityIssue,
    cleaningWork: storeManagement.cleaningWork,
    instructions: rawSections.sections.instructions.text,
    tomorrowPrep: rawSections.sections.tomorrowPrep.text,
    firstWorker: facilityChecks.firstWorker,
    firstWorkerTime: facilityChecks.firstWorkerTime,
    lastWorker: facilityChecks.lastWorker,
    lastWorkerTime: facilityChecks.lastWorkerTime,
    hygieneChecker: facilityChecks.hygieneChecker,
    finalChecker: facilityChecks.finalChecker,
    rawSections
  };

  const salesMismatches = salesTotalMismatches(sheet, channelRows);

  return {
    date,
    draft,
    productRows,
    channelRows,
    staffSpecialRows,
    customerResponseRows,
    checks: {
      salesMatched: salesMismatches.length === 0,
      productTotalsMatched: true,
      rawSectionsPreserved: rawSectionsPreserved(rawSections),
      mismatches: salesMismatches
    }
  };
}

function buildCustomerResponseRows(input: {
  date: string;
  fileName: string;
  sheetName: string;
  serviceText: string;
}): CustomerResponseRow[] {
  const serviceText = input.serviceText
    .split("\n")
    .map(normalizeServiceNoteLine)
    .filter((line) => line.length > 0)
    .join("\n")
    .trim();
  if (!serviceText) {
    return [];
  }
  return splitCustomerResponseNotes(serviceText).map((note) => ({
    date: input.date,
    shortSummary: note.slice(0, 200),
    fullText: `[일일업무보고서 서비스내역 및 손님 특이사항]\n출처: ${input.fileName} / ${input.sheetName}\n\n${note}`
  }));
}

function splitCustomerResponseNotes(serviceText: string): string[] {
  return serviceText
    .split(/\s*(?:\/|\n)+\s*/u)
    .map((note) => note.trim())
    .filter((note) => note.length > 0)
    .filter((note) => !isProductQuantityMemo(note));
}

function isProductQuantityMemo(note: string): boolean {
  if (!/\d+\s*개/u.test(note) || !/(?:시식|판매|재고|생산량)\s*:|\([HhFf]\)\s*\d+\s*개/u.test(note)) {
    return false;
  }

  const withoutProductName = note.replace(
    /^[가-힣A-Za-z\s]+?(?=\s*(?:(?:시식|판매|재고|생산량)\s*:|\([HhFf]\)\s*\d+\s*개))/u,
    ""
  );
  const remaining = withoutProductName
    .replace(/(?:시식|판매|재고|생산량)?\s*:?\s*(?:\([HhFf]\)|[HhFf])?\s*\d+\s*개/gu, "")
    .replace(/[(),\s]/gu, "");

  return remaining.length === 0;
}

function normalizeServiceNoteLine(line: string): string {
  let result = line.trim();
  const productSalesPrefixPatterns = [
    /^호밀빵\s*판매\s*:\s*[\d\s,().Hh개시식재고+-]+(?:\/\s*)?/,
    /^호밀쇼콜라오렌지\s*(?:판매\s*)?:\s*[\d\s,().Hh개시식재고+-]+(?:\/\s*)?/,
    /^호밀소콜라오렌지\s*(?:판매\s*)?:\s*[\d\s,().Hh개시식재고+-]+(?:\/\s*)?/,
    /^여름메밀빵\s*판매\s*:\s*[\d\s,().Hh개시식재고+-]+(?:\/\s*)?/
  ];

  let changed = true;
  while (changed) {
    changed = false;
    for (const pattern of productSalesPrefixPatterns) {
      const next = result.replace(pattern, "").replace(/^[\s,/]+/, "").trim();
      if (next !== result) {
        result = next;
        changed = true;
      }
    }
  }

  return result;
}

function parseFacilityChecks(sheet: XLSX.WorkSheet): Pick<
  DailyOperationDraft,
  "firstWorker" | "firstWorkerTime" | "lastWorker" | "lastWorkerTime" | "hygieneChecker" | "finalChecker"
> {
  const headerRow = findLabelRow(sheet, "10. 시설 점검사항") ?? 78;
  const valueRow = headerRow + 1;
  return {
    firstWorker: cellDisplayText(sheet, `D${valueRow}`),
    firstWorkerTime: cellDisplayText(sheet, `C${valueRow}`),
    lastWorker: cellDisplayText(sheet, `F${valueRow}`),
    lastWorkerTime: cellDisplayText(sheet, `E${valueRow}`),
    hygieneChecker: cellDisplayText(sheet, `G${valueRow}`),
    finalChecker: cellDisplayText(sheet, `I${valueRow}`)
  };
}

function parseProductRows(sheet: XLSX.WorkSheet): ProductRow[] {
  const rows: ProductRow[] = [];
  for (let row = 13; row <= 50; row += 1) {
    const rawName = cellText(sheet, `B${row}`).trim();
    if (!rawName || rawName === "합 계") {
      continue;
    }

    const productName = normalizeProductName(rawName);
    const other = cellNumber(sheet, `F${row}`);
    const producedQty = cellNumber(sheet, `C${row}`);
    const stockQty = cellNumber(sheet, `H${row}`);
    const soldQty = cellNumber(sheet, `I${row}`);
    const soldQtyUnmeasurable =
      !manualSoldProducts.has(productName) &&
      cellText(sheet, `C${row}`).trim().length === 0 &&
      soldQty < 0;
    rows.push({
      productName,
      producedQty: numberText(producedQty),
      lossQty: numberText(cellNumber(sheet, `D${row}`)),
      tastingQty: numberText(cellNumber(sheet, `E${row}`)),
      otherInQty: numberText(other > 0 ? other : 0),
      otherOutQty: numberText(other < 0 ? Math.abs(other) : 0),
      stockQty: numberText(stockQty),
      soldQty: numberText(soldQty),
      ...(soldQtyUnmeasurable ? { soldQtyUnmeasurable: true } : {}),
      manualSold: manualSoldProducts.has(productName)
    });
  }
  return rows;
}

function parseChannels(sheet: XLSX.WorkSheet): ChannelRow[] {
  const channels: ChannelRow[] = [];
  for (const column of ["D", "E", "F", "G", "H", "I"]) {
    const rawName = cellText(sheet, `${column}52`).trim();
    if (!rawName) {
      continue;
    }
    channels.push({
      name: channelNameMap.get(rawName) ?? rawName.replaceAll(" ", ""),
      count: numberText(cellNumber(sheet, `${column}53`)),
      amount: numberText(cellNumber(sheet, `${column}55`))
    });
  }
  return channels;
}

function buildRawSections(
  sheet: XLSX.WorkSheet,
  source: DailyOperationRawSections["source"]
): DailyOperationRawSections {
  const facilityCheckRow = findLabelRow(sheet, "10. 시설 점검사항") ?? 78;
  return {
    source,
    sections: {
      serviceAndCustomerNotes: section(sheet, "4. 서비스내역 및 손님 특이사항", [57, 58, 59, 60]),
      productOpinionAndLoss: section(sheet, "5. 제품의견 / 손실", [61, 62, 63, 64]),
      storeManagement: section(sheet, "6. 매장 관리", [65, 66, 67, 68, 69]),
      instructions: section(sheet, "7. 지시 및 전달사항", [70, 71, 72]),
      tomorrowPrep: section(sheet, "8. 내일 준비사항", [73, 74]),
      staffSpecial: section(sheet, "9. 직원 특이사항", [75, 76, 77]),
      facilityCheck: section(sheet, "10. 시설 점검사항", [facilityCheckRow, facilityCheckRow + 1, facilityCheckRow + 2])
    }
  };
}

function section(sheet: XLSX.WorkSheet, label: string, rows: number[]): RawSection {
  return {
    label,
    rows,
    text: joinLines(rows.map((row) => lineAt(sheet, row)))
  };
}

function findLabelRow(sheet: XLSX.WorkSheet, label: string): number | null {
  const normalizedLabel = normalizeSectionLabel(label);
  for (let row = 1; row <= 100; row += 1) {
    if (normalizeSectionLabel(cellText(sheet, `A${row}`)) === normalizedLabel) {
      return row;
    }
  }
  return null;
}

function normalizeSectionLabel(value: string): string {
  return value.replace(/\s+/g, "").trim();
}

function lineAt(sheet: XLSX.WorkSheet, row: number): string {
  return joinLines(["C", "D", "E", "F", "G", "H", "I"].map((column) => cellDisplayText(sheet, `${column}${row}`)));
}

function cellDisplayText(sheet: XLSX.WorkSheet, address: string): string {
  const cell = sheet[address] as XLSX.CellObject | undefined;
  if (!cell || cell.v === undefined || cell.v === null) {
    return "";
  }
  if (typeof cell.v === "number" && cell.v > 0 && cell.v < 1) {
    return excelTimeToText(cell.v);
  }
  return cellText(sheet, address);
}

function cellText(sheet: XLSX.WorkSheet, address: string): string {
  const cell = sheet[address] as XLSX.CellObject | undefined;
  if (!cell || cell.v === undefined || cell.v === null) {
    return "";
  }
  if (typeof cell.v === "number") {
    return numberText(cell.v);
  }
  return String(cell.v).trim();
}

function cellNumber(sheet: XLSX.WorkSheet, address: string): number {
  const text = cellText(sheet, address).replaceAll(",", "").trim();
  if (!text || text.startsWith("#")) {
    return 0;
  }
  const value = Number(text);
  return Number.isFinite(value) ? value : 0;
}

function numberText(value: number): string {
  if (!Number.isFinite(value) || value === 0) {
    return "0";
  }
  return Number.isInteger(value) ? String(value) : String(value);
}

function normalizeProductName(value: string): string {
  const normalizedSpaces = value.replace(/\s+/g, " ").trim();
  return productNameMap.get(normalizedSpaces) ?? normalizedSpaces;
}

function parseKoreanDate(value: string): string | null {
  const match = value.match(/(\d{4})\D+(\d{1,2})\D+(\d{1,2})/);
  if (!match) {
    return null;
  }
  const [, yearText, monthText, dayText] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    Number.isNaN(date.getTime()) ||
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }
  return `${yearText}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function inferWorkbookYearMonth(workbook: XLSX.WorkBook): { year: number; month: number } | null {
  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) {
      continue;
    }
    const date = parseKoreanDate(cellText(sheet, "C2"));
    if (date) {
      return { year: Number(date.slice(0, 4)), month: Number(date.slice(5, 7)) };
    }
  }
  return null;
}

function dateFromSheetName(sheetName: string, yearMonth: { year: number; month: number } | null): string | null {
  if (!yearMonth) {
    return null;
  }
  const match = sheetName.match(/^(\d{1,2})일$/);
  if (!match) {
    return null;
  }
  const day = Number(match[1]);
  const date = new Date(Date.UTC(yearMonth.year, yearMonth.month - 1, day));
  if (
    Number.isNaN(date.getTime()) ||
    date.getUTCFullYear() !== yearMonth.year ||
    date.getUTCMonth() !== yearMonth.month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }
  return `${yearMonth.year}-${String(yearMonth.month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function sumChannels(rows: ChannelRow[], key: keyof Pick<ChannelRow, "amount" | "count">): number {
  return rows.reduce((total, row) => total + Number(row[key].replaceAll(",", "")), 0);
}

function salesTotalMismatches(sheet: XLSX.WorkSheet, channels: ChannelRow[]): ImportCheckMismatch[] {
  const amount = cellNumber(sheet, "C11") + sumChannels(channels, "amount");
  const count = cellNumber(sheet, "D11") + sumChannels(channels, "count");
  return [
    ...mismatch("salesAmount", cellNumber(sheet, "G11"), amount),
    ...mismatch("salesCount", cellNumber(sheet, "H11"), count)
  ];
}

function mismatch(field: string, expected: number, actual: number): ImportCheckMismatch[] {
  return totalsMatch(expected, actual) ? [] : [{ field, expected, actual }];
}

function rawSectionsPreserved(rawSections: DailyOperationRawSections): boolean {
  return Object.values(rawSections.sections).some((sectionValue) => sectionValue.text.length > 0);
}

function totalsMatch(left: number, right: number): boolean {
  return Math.abs(left - right) < 0.0001;
}

function joinLines(values: string[]): string {
  return values.map((value) => value.trim()).filter(Boolean).join("\n");
}

function createStaffSpecialRows(): StaffSpecialRows {
  const empty = {
    dayOff: "",
    vacation: "",
    lateEarly: "",
    support: "",
    birthday: "",
    newStaff: "",
    etc: ""
  };
  return { today: { ...empty }, tomorrow: { ...empty } };
}

function parseStaffSpecialRows(sheet: XLSX.WorkSheet): StaffSpecialRows {
  const rows = createStaffSpecialRows();
  const categoryByHeader = new Map<string, StaffCategory>([
    ["휴무", "dayOff"],
    ["휴가", "vacation"],
    ["지각/조퇴", "lateEarly"],
    ["지원", "support"],
    ["생일", "birthday"],
    ["신입", "newStaff"],
    ["기타사항", "etc"]
  ]);
  const columns = ["C", "D", "E", "F", "G", "H", "I"];
  const headerRow = findLabelRow(sheet, "9. 직원 특이사항") ?? 75;
  const periods: Array<[StaffPeriod, number]> = [["today", headerRow + 1], ["tomorrow", headerRow + 2]];

  for (const [period, row] of periods) {
    for (const column of columns) {
      const header = cellText(sheet, `${column}${headerRow}`).replace(/\s+/g, "");
      const category = categoryByHeader.get(header);
      if (category) {
        rows[period][category] = cellDisplayText(sheet, `${column}${row}`);
      }
    }
  }

  if (!Array.from(columns).some((column) => cellText(sheet, `${column}${headerRow}`).trim())) {
    rows.today.dayOff = lineAt(sheet, headerRow + 1);
    rows.tomorrow.dayOff = lineAt(sheet, headerRow + 2);
  }
  return rows;
}

function parseStoreManagement(sheet: XLSX.WorkSheet): Pick<DailyOperationDraft, "facilityIssue" | "cleaningWork"> {
  const headerRow = findLabelRow(sheet, "6. 매장 관리") ?? 65;
  return {
    facilityIssue: joinLines([lineAt(sheet, headerRow), lineAt(sheet, headerRow + 1)]),
    cleaningWork: joinLines([lineAt(sheet, headerRow + 2), lineAt(sheet, headerRow + 3), lineAt(sheet, headerRow + 4)])
  };
}

function excelTimeToText(value: number): string {
  const totalMinutes = Math.round(value * 24 * 60);
  const hours = Math.floor(totalMinutes / 60) % 24;
  const minutes = totalMinutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}
