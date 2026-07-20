import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { apiPost } from "../../shared/api/client.js";
import { DailyOperationExcelImportPanel } from "./DailyOperationExcelImportPanel.js";

vi.mock("../../shared/api/client.js", () => ({ apiPost: vi.fn() }));

describe("DailyOperationExcelImportPanel", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("requires acknowledgement for a warned date and sends it when saving", async () => {
    vi.mocked(apiPost).mockResolvedValueOnce({
      data: {
        fileName: "일일업무보고서_5월.xlsx",
        records: [
          {
            date: "2026-05-07",
            existing: false,
            productRowCount: 38,
            channelRowCount: 6,
            totalSales: 100000,
            customerResponseCandidateCount: 1,
            draft: { date: "2026-05-07", author: "폴폴", outsideTemp: "20", insideTemp: "24", outsideHumidity: "0.4", insideHumidity: "0.3", weather: "맑음", posSalesAmount: "100000", posSalesCount: "10", nonPosSalesAmount: "0", nonPosSalesCount: "0", productOpinionAndLoss: "", facilityIssue: "", cleaningWork: "", instructions: "", tomorrowPrep: "", firstWorker: "", firstWorkerTime: "", lastWorker: "", lastWorkerTime: "", hygieneChecker: "", finalChecker: "" },
            productRows: [],
            channelRows: [],
            staffSpecialRows: { today: { dayOff: "", vacation: "", lateEarly: "", support: "", birthday: "", newStaff: "", etc: "" }, tomorrow: { dayOff: "", vacation: "", lateEarly: "", support: "", birthday: "", newStaff: "", etc: "" } },
            checks: {
              salesMatched: false,
              productTotalsMatched: true,
              rawSectionsPreserved: true,
              mismatches: [{ field: "salesAmount", expected: 100000, actual: 99000 }]
            }
          }
        ],
        customerResponseCandidates: [],
        warnings: [{ sheetName: "7일", code: "SALES_TOTAL_MISMATCH", message: "매출 합계가 일치하지 않습니다." }],
        skippedSheets: []
      },
      error: null
    });
    vi.mocked(apiPost).mockResolvedValueOnce({
      data: { dailyOperationSavedCount: 1, responseSavedCount: 0, warnings: [], skippedSheets: [] },
      error: null
    });
    const file = {
      name: "일일업무보고서_5월.xlsx",
      arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(1))
    } as unknown as File;

    render(<DailyOperationExcelImportPanel />);
    fireEvent.change(screen.getByLabelText("엑셀 선택"), { target: { files: [file] } });

    const acknowledgement = await screen.findByRole("checkbox", { name: "2026-05-07 검증 경고를 확인하고 저장합니다." });
    expect(screen.getByRole("heading", { name: "엑셀 미리보기 일지" })).toBeInTheDocument();
    expect(acknowledgement).not.toBeChecked();
    expect(screen.getByRole("button", { name: "확인한 내용 저장" })).toBeDisabled();

    fireEvent.click(acknowledgement);
    expect(screen.getByRole("button", { name: "확인한 내용 저장" })).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: "확인한 내용 저장" }));

    await waitFor(() => {
      expect(apiPost).toHaveBeenLastCalledWith("/import/daily-operation-excel/apply", {
        fileName: "일일업무보고서_5월.xlsx",
        fileBase64: "AA==",
        acknowledgedDates: ["2026-05-07"]
      });
    });
  });
});
