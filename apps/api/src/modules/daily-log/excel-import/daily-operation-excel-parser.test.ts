import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import XLSX from "xlsx";
import { describe, expect, it } from "vitest";

import { parseDailyOperationWorkbook } from "./daily-operation-excel-parser.js";

function setCell(rows: unknown[][], row: number, column: number, value: unknown) {
  const targetRow = rows[row];
  if (!targetRow) {
    throw new Error(`Missing test row ${row}`);
  }
  targetRow[column] = value;
}

function buildWorkbook(
  path: string,
  options: {
    reportedSoldTotal?: number;
    missingProductionWithStock?: boolean;
    missingProductionWithZeroSales?: boolean;
    serviceText?: string;
  } = {}
) {
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([["사용법"]]), "사용법");

  const rows: unknown[][] = Array.from({ length: 81 }, () => []);
  setCell(rows, 1, 2, "2026년  5월  1일 ( 금요일)");
  setCell(rows, 2, 2, "여의도");
  setCell(rows, 2, 5, "정희주");
  setCell(rows, 5, 4, "맑음");
  setCell(rows, 5, 5, 23);
  setCell(rows, 5, 6, 27.5);
  setCell(rows, 5, 7, 0.32);
  setCell(rows, 5, 8, 0.26);
  setCell(rows, 10, 2, 2_012_600);
  setCell(rows, 10, 3, 138);
  setCell(rows, 10, 4, 220_700);
  setCell(rows, 10, 5, 10);
  setCell(rows, 10, 6, 2_233_300);
  setCell(rows, 10, 7, 148);
  setCell(rows, 10, 8, 15089.864864864865);

  setCell(rows, 12, 1, "깜파뉴");
  setCell(rows, 12, 2, 18);
  setCell(rows, 12, 3, 2);
  setCell(rows, 12, 4, 1);
  setCell(rows, 12, 5, -1);
  setCell(rows, 12, 7, 2);
  setCell(rows, 12, 8, 12);
  setCell(rows, 13, 1, "바질치킨");
  setCell(rows, 13, 2, 5);
  setCell(rows, 13, 8, 5);
  setCell(rows, 14, 1, "호라산 통밀");
  if (options.missingProductionWithStock || options.missingProductionWithZeroSales) {
    setCell(rows, 14, 7, 4);
    if (options.missingProductionWithStock) setCell(rows, 14, 8, -4);
  } else {
    setCell(rows, 14, 2, 4);
    setCell(rows, 14, 8, 4);
  }

  setCell(rows, 50, 1, "합 계");
  setCell(rows, 50, 2, 27);
  setCell(rows, 50, 3, 2);
  setCell(rows, 50, 4, 1);
  setCell(rows, 50, 5, -1);
  setCell(rows, 50, 7, 2);
  setCell(rows, 50, 8, options.reportedSoldTotal ?? 21);

  setCell(rows, 51, 3, "선물");
  setCell(rows, 51, 4, "쿠팡이츠");
  setCell(rows, 51, 5, "배 민");
  setCell(rows, 51, 6, "제로페이");
  setCell(rows, 51, 7, "택배");
  setCell(rows, 51, 8, "납품");
  setCell(rows, 52, 2, "매출건수(건)");
  setCell(rows, 52, 4, 4);
  setCell(rows, 52, 5, 1);
  setCell(rows, 52, 6, 4);
  setCell(rows, 52, 8, 1);
  setCell(rows, 54, 2, "매출액(원)");
  setCell(rows, 54, 4, 104_000);
  setCell(rows, 54, 5, 33_700);
  setCell(rows, 54, 6, 44_400);
  setCell(rows, 54, 8, 38_600);

  setCell(rows, 56, 0, "4. 서비스내역 및\n   손님 특이사항");
  setCell(rows, 56, 2, options.serviceText ?? "호밀빵 판매: 4개, (H) 4개/ 호밀쇼콜라오렌지 판매: 3개");
  setCell(rows, 57, 2, "주차지원 요청이 많았습니다./ 샌드위치 수요가 높았습니다.\n비가 와서 배달 주문이 적었습니다.");
  setCell(rows, 60, 0, "5. 제품의견 / 손실");
  setCell(rows, 60, 2, "오픈(김도현) : 반죽힘이 강했습니다.");
  setCell(rows, 64, 0, "6. 매장\n   관리");
  setCell(rows, 64, 2, "냉장고 점검 필요");
  setCell(rows, 66, 2, "도우컨 날개 청소 완료");
  setCell(rows, 69, 0, "7. 지시 및 전달사항");
  setCell(rows, 69, 2, "닭가슴살 재고 확인");
  setCell(rows, 72, 0, "8. 내일 준비사항");
  setCell(rows, 72, 2, "구름빵 반죽 작업");
  setCell(rows, 74, 0, "9. 직원 특이사항");
  setCell(rows, 74, 2, "휴무");
  setCell(rows, 74, 3, "휴가");
  setCell(rows, 74, 4, "지각/조퇴");
  setCell(rows, 74, 5, "지원");
  setCell(rows, 74, 6, "생일");
  setCell(rows, 74, 7, "신입");
  setCell(rows, 74, 8, "기타사항");
  setCell(rows, 75, 2, "준모,용국");
  setCell(rows, 75, 3, "지민");
  setCell(rows, 75, 4, "준모 30분 지각");
  setCell(rows, 75, 5, "본점 지원");
  setCell(rows, 75, 6, "희주");
  setCell(rows, 75, 7, "민숙");
  setCell(rows, 75, 8, "유니폼 수령");
  setCell(rows, 76, 2, "세은,희주");
  setCell(rows, 78, 0, "10. 시설 점검사항");
  setCell(rows, 78, 2, "첫 출 근 자");
  setCell(rows, 78, 4, "최 종 퇴 근 자");
  setCell(rows, 78, 6, "위생/마감 점검");
  setCell(rows, 78, 8, "최종 점검");
  setCell(rows, 79, 2, 0.25);
  setCell(rows, 79, 3, "도현,희주");
  setCell(rows, 79, 4, 0.8125);
  setCell(rows, 79, 5, "윤경");
  setCell(rows, 79, 6, "윤희");
  setCell(rows, 79, 8, "윤희");

  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(rows), "1일");

  const invalidRows: unknown[][] = Array.from({ length: 80 }, () => []);
  setCell(invalidRows, 1, 2, "202 년  월  일 ( 요일)");
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(invalidRows), "32일");
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([["결산"]]), "결산");
  XLSX.writeFile(workbook, path);
}

describe("parseDailyOperationWorkbook", () => {
  it("parses daily sheets into the web daily-operation JSON shape and preserves raw sections", () => {
    const dir = mkdtempSync(join(tmpdir(), "daily-operation-import-"));
    const workbookPath = join(dir, "일일업무보고서_5월.xlsx");
    buildWorkbook(workbookPath);

    const parsed = parseDailyOperationWorkbook(workbookPath);

    expect(parsed.records).toHaveLength(1);
    expect(parsed.skippedSheets).toContainEqual({ sheetName: "32일", reason: "invalid-date" });
    const record = parsed.records[0];
    if (!record) {
      throw new Error("parsed record is required");
    }
    expect(record.date).toBe("2026-05-01");
    expect(record.draft).toMatchObject({
      date: "2026-05-01",
      author: "정희주",
      weather: "맑음",
      outsideTemp: "23",
      insideTemp: "27.5",
      outsideHumidity: "0.32",
      insideHumidity: "0.26",
      posSalesAmount: "2012600",
      posSalesCount: "138",
      nonPosSalesAmount: "220700",
      nonPosSalesCount: "10",
      cleaningWork: "도우컨 날개 청소 완료",
      instructions: "닭가슴살 재고 확인",
      tomorrowPrep: "구름빵 반죽 작업",
      facilityIssue: "냉장고 점검 필요",
      firstWorker: "도현,희주",
      firstWorkerTime: "06:00",
      lastWorker: "윤경",
      lastWorkerTime: "19:30",
      hygieneChecker: "윤희",
      finalChecker: "윤희"
    });
    expect(record.draft.productOpinionAndLoss).toContain("오픈(김도현)");
    expect(record.draft.productOpinionAndLoss).not.toContain("호밀빵 판매");
    expect(record.customerResponseRows).toEqual([
      {
        date: "2026-05-01",
        shortSummary: "주차지원 요청이 많았습니다.",
        fullText:
          "[일일업무보고서 서비스내역 및 손님 특이사항]\n출처: 일일업무보고서_5월.xlsx / 1일\n\n주차지원 요청이 많았습니다."
      },
      {
        date: "2026-05-01",
        shortSummary: "샌드위치 수요가 높았습니다.",
        fullText:
          "[일일업무보고서 서비스내역 및 손님 특이사항]\n출처: 일일업무보고서_5월.xlsx / 1일\n\n샌드위치 수요가 높았습니다."
      },
      {
        date: "2026-05-01",
        shortSummary: "비가 와서 배달 주문이 적었습니다.",
        fullText:
          "[일일업무보고서 서비스내역 및 손님 특이사항]\n출처: 일일업무보고서_5월.xlsx / 1일\n\n비가 와서 배달 주문이 적었습니다."
      }
    ]);
    expect(record.draft.rawSections?.sections.serviceAndCustomerNotes.text).toBe(
      "호밀빵 판매: 4개, (H) 4개/ 호밀쇼콜라오렌지 판매: 3개\n주차지원 요청이 많았습니다./ 샌드위치 수요가 높았습니다.\n비가 와서 배달 주문이 적었습니다."
    );
    expect(record.draft.rawSections?.sections.facilityCheck.text).toContain("06:00");
    expect(record.productRows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          productName: "깜빠뉴",
          producedQty: "18",
          lossQty: "2",
          tastingQty: "1",
          otherInQty: "0",
          otherOutQty: "1",
          stockQty: "2",
          soldQty: "12"
        }),
        expect.objectContaining({ productName: "바질치킨샌드위치" }),
        expect.objectContaining({ productName: "호라산 통밀" })
      ])
    );
    expect(record.channelRows).toContainEqual({ name: "배민", count: "1", amount: "33700" });
    expect(record.staffSpecialRows.today.dayOff).toBe("준모,용국");
    expect(record.staffSpecialRows.tomorrow.dayOff).toBe("세은,희주");
    expect(record.draft.firstWorkerTime).toBe("06:00");
    expect(record.checks).toMatchObject({
      salesMatched: true,
      productTotalsMatched: true,
      rawSectionsPreserved: true
    });
  });

  it("separates facility and every staff-special category from the standard rows", () => {
    const dir = mkdtempSync(join(tmpdir(), "daily-operation-import-"));
    const workbookPath = join(dir, "일일업무보고서_5월.xlsx");
    buildWorkbook(workbookPath);

    const [record] = parseDailyOperationWorkbook(workbookPath).records;

    expect(record?.draft.facilityIssue).toBe("냉장고 점검 필요");
    expect(record?.draft.cleaningWork).toBe("도우컨 날개 청소 완료");
    expect(record?.staffSpecialRows.today).toEqual({
      dayOff: "준모,용국",
      vacation: "지민",
      lateEarly: "준모 30분 지각",
      support: "본점 지원",
      birthday: "희주",
      newStaff: "민숙",
      etc: "유니폼 수령"
    });
  });

  it("does not raise a validation warning for product total differences", () => {
    const dir = mkdtempSync(join(tmpdir(), "daily-operation-import-"));
    const workbookPath = join(dir, "일일업무보고서_5월.xlsx");
    buildWorkbook(workbookPath, { reportedSoldTotal: 20 });

    const [record] = parseDailyOperationWorkbook(workbookPath).records;

    expect(record?.checks.productTotalsMatched).toBe(true);
    expect(record?.checks.mismatches).not.toContainEqual(expect.objectContaining({ field: "soldQty" }));
  });

  it("marks negative sales as unmeasurable when production is missing", () => {
    const dir = mkdtempSync(join(tmpdir(), "daily-operation-import-"));
    const workbookPath = join(dir, "일일업무보고서_5월.xlsx");
    buildWorkbook(workbookPath, { missingProductionWithStock: true, reportedSoldTotal: 15 });

    const [record] = parseDailyOperationWorkbook(workbookPath).records;
    const product = record?.productRows.find((row) => row.productName === "호라산 통밀");

    expect(product).toMatchObject({ soldQty: "-4", soldQtyUnmeasurable: true });
    expect(record?.checks.mismatches).not.toContainEqual(expect.objectContaining({ field: "soldQty" }));
  });

  it("keeps zero sales measurable even when production is blank", () => {
    const dir = mkdtempSync(join(tmpdir(), "daily-operation-import-"));
    const workbookPath = join(dir, "일일업무보고서_5월.xlsx");
    buildWorkbook(workbookPath, { missingProductionWithZeroSales: true });

    const [record] = parseDailyOperationWorkbook(workbookPath).records;
    const product = record?.productRows.find((row) => row.productName === "호라산 통밀");

    expect(product).toMatchObject({ soldQty: "0" });
    expect(product?.soldQtyUnmeasurable).toBeUndefined();
  });

  it("excludes product quantity memos from customer response candidates", () => {
    const dir = mkdtempSync(join(tmpdir(), "daily-operation-import-"));
    const workbookPath = join(dir, "일일업무보고서_4월.xlsx");
    buildWorkbook(workbookPath, {
      serviceText: "호밀빵 시식: (H) 1개, 판매: 4개, (H) 9개/ 봄깜빠뉴 판매: 5개, (H) 7개/ 가지 샌드위치 찾으시는 손님 계셨습니다."
    });

    const [record] = parseDailyOperationWorkbook(workbookPath).records;

    const candidates = record?.customerResponseRows.map((row) => row.shortSummary) ?? [];
    expect(candidates).not.toContain("호밀빵 시식: (H) 1개, 판매: 4개, (H) 9개");
    expect(candidates).not.toContain("봄깜빠뉴 판매: 5개, (H) 7개");
    expect(candidates).toContain("가지 샌드위치 찾으시는 손님 계셨습니다.");
  });
});
