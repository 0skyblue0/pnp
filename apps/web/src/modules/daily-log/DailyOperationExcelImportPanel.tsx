import { useMemo, useState } from "react";

import { apiPost } from "../../shared/api/client.js";
import { DailyLookupSection, type DailyOperationSavedRecord } from "./DailyLogPage.js";

export type DailyOperationExcelPreview = {
  fileName: string;
  records: Array<{
    date: string;
    existing: boolean;
    productRowCount: number;
    totalSales: number;
    customerResponseCandidateCount: number;
    draft: DailyOperationSavedRecord["draft"];
    productRows: DailyOperationSavedRecord["productRows"];
    channelRows: DailyOperationSavedRecord["channelRows"];
    staffSpecialRows: DailyOperationSavedRecord["staffSpecialRows"];
    checks: {
      salesMatched: boolean;
      productTotalsMatched: boolean;
      rawSectionsPreserved: boolean;
      mismatches: Array<{ field: string; expected: number; actual: number }>;
    };
  }>;
  customerResponseCandidates: Array<{ date: string; shortSummary: string; fullText: string }>;
  warnings: Array<{ sheetName: string; code: string; message: string }>;
  skippedSheets: Array<{ sheetName: string; reason: string }>;
};

type ApplyResult = {
  dailyOperationSavedCount: number;
  responseSavedCount: number;
};

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = "";
  const bytes = new Uint8Array(buffer);
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return window.btoa(binary);
}

export function DailyOperationExcelImportPanel() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileBase64, setFileBase64] = useState("");
  const [preview, setPreview] = useState<DailyOperationExcelPreview | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [acknowledgedDates, setAcknowledgedDates] = useState<Set<string>>(() => new Set());
  const warnedRecords = useMemo(
    () => preview?.records.filter((record) => record.checks.mismatches.length > 0) ?? [],
    [preview]
  );
  const hasUnacknowledgedWarning = warnedRecords.some((record) => !acknowledgedDates.has(record.date));
  const previewRecords: DailyOperationSavedRecord[] = (preview?.records ?? []).filter((record) => Boolean(record.draft)).map((record) => ({
    draft: record.draft,
    productRows: record.productRows,
    channelRows: record.channelRows,
    staffSpecialRows: record.staffSpecialRows,
    savedAt: record.date
  }));

  async function readFile(file: File) {
    const buffer = await file.arrayBuffer();
    return arrayBufferToBase64(buffer);
  }

  async function previewFile(file: File) {
    setIsLoading(true);
    setError("");
    setMessage("");
    setPreview(null);
    setAcknowledgedDates(new Set());
    const base64 = await readFile(file);
    setFileBase64(base64);
    const envelope = await apiPost<DailyOperationExcelPreview, { fileName: string; fileBase64: string }>(
      "/import/daily-operation-excel/preview",
      { fileName: file.name, fileBase64: base64 }
    );
    setIsLoading(false);
    if (envelope.error) {
      setError(envelope.error.message);
      return;
    }
    setPreview(envelope.data);
    setMessage("엑셀 미리보기를 만들었습니다. 날짜와 손님 반응 후보를 확인한 뒤 저장하세요.");
  }

  async function applyImport() {
    if (!selectedFile || !fileBase64) {
      setError("먼저 엑셀 파일을 선택해 주세요.");
      return;
    }
    setIsLoading(true);
    setError("");
    const envelope = await apiPost<ApplyResult, { fileName: string; fileBase64: string; acknowledgedDates: string[] }>(
      "/import/daily-operation-excel/apply",
      { fileName: selectedFile.name, fileBase64, acknowledgedDates: Array.from(acknowledgedDates).sort() }
    );
    setIsLoading(false);
    if (envelope.error) {
      setError(envelope.error.message);
      return;
    }
    setMessage(
      `일일 운영 ${envelope.data.dailyOperationSavedCount}일, 손님 반응 ${envelope.data.responseSavedCount}건을 저장했습니다.`
    );
  }

  return (
    <section className="app-card mb-4 px-4 py-4" aria-labelledby="daily-operation-excel-import-title">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 id="daily-operation-excel-import-title" className="text-sm font-extrabold text-ink">일일업무보고서 엑셀 불러오기</h3>
          <p className="mt-1 text-xs leading-5 text-muted">
            엑셀을 바로 저장하지 않고 먼저 날짜·제품·손님 반응 후보를 미리 보여줍니다.
          </p>
        </div>
        <label className="inline-flex min-h-11 cursor-pointer items-center rounded-control border border-latte bg-cream px-4 text-sm font-bold text-cocoa focus-within:ring-2 focus-within:ring-bread/30">
          엑셀 선택
          <input
            className="sr-only"
            type="file"
            accept=".xlsx,.xlsm"
            onChange={(event) => {
              const file = event.target.files?.[0] ?? null;
              setSelectedFile(file);
              if (file) {
                void previewFile(file);
              }
            }}
          />
        </label>
      </div>
      {message ? <p className="mt-3 rounded-control bg-green/10 px-3 py-2 text-sm font-bold text-green">{message}</p> : null}
      {error ? <p className="mt-3 rounded-control bg-red/10 px-3 py-2 text-sm font-bold text-red">{error}</p> : null}
      {isLoading ? <p className="mt-3 text-sm font-bold text-muted">엑셀을 확인하는 중입니다.</p> : null}
      {preview ? (
        <div className="mt-4 grid gap-3">
          <div className="app-card-muted p-3">
            <p className="text-xs font-bold text-muted">읽은 날짜</p>
            <p className="mt-1 text-xl font-extrabold text-ink">{preview.records.length}일</p>
            <div className="mt-3 grid gap-2">
              {preview.records.map((record) => (
                <div key={record.date} className="rounded-[9px] bg-white px-3 py-2 text-sm">
                  <b>{record.date}</b> · {record.totalSales.toLocaleString("ko-KR")}원 · 제품 {record.productRowCount}줄
                  {record.existing ? <span className="ml-2 text-red">기존 기록 있음</span> : null}
                  {record.checks.mismatches.length > 0 ? (
                    <div className="mt-2 rounded-[7px] bg-red/10 px-2 py-2 text-xs leading-5 text-red">
                      <b>검증 경고</b> · {record.checks.mismatches.map(formatMismatch).join(" / ")}
                      <label className="mt-2 flex cursor-pointer items-center gap-2 font-bold text-cocoa">
                        <input
                          type="checkbox"
                          checked={acknowledgedDates.has(record.date)}
                          onChange={(event) => {
                            setAcknowledgedDates((current) => {
                              const next = new Set(current);
                              if (event.target.checked) next.add(record.date);
                              else next.delete(record.date);
                              return next;
                            });
                          }}
                        />
                        {record.date} 검증 경고를 확인하고 저장합니다.
                      </label>
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
          <div className="app-card-muted p-3">
            <p className="text-xs font-bold text-muted">손님 반응 후보</p>
            <p className="mt-1 text-xl font-extrabold text-ink">{preview.customerResponseCandidates.length}건</p>
            <div className="mt-3 grid gap-2">
              {preview.customerResponseCandidates.slice(0, 3).map((candidate, index) => (
                <p key={`${candidate.date}-${index}`} className="rounded-[9px] bg-white px-3 py-2 text-sm leading-5 text-cocoa">
                  {candidate.date} · {candidate.shortSummary}
                </p>
              ))}
              {preview.customerResponseCandidates.length === 0 ? <p className="text-sm text-muted">손님 반응으로 보이는 내용이 없습니다.</p> : null}
            </div>
          </div>
          <DailyLookupSection
            records={previewRecords}
            previousRecords={[]}
            allRecordCount={previewRecords.length}
            lookupMode="month"
            lookupDate={previewRecords[0]?.draft.date ?? ""}
            lookupStartDate={previewRecords.at(-1)?.draft.date ?? ""}
            lookupEndDate={previewRecords[0]?.draft.date ?? ""}
            lookupMonth={(previewRecords[0]?.draft.date ?? "").slice(0, 7)}
            lookupSortOrder="desc"
            lookupRange={{ startDate: previewRecords.at(-1)?.draft.date ?? "", endDate: previewRecords[0]?.draft.date ?? "" }}
            previousLookupRange={{ startDate: "", endDate: "" }}
            setLookupMode={() => undefined}
            setLookupDate={() => undefined}
            setLookupStartDate={() => undefined}
            setLookupEndDate={() => undefined}
            setLookupMonth={() => undefined}
            setLookupSortOrder={() => undefined}
            onEditRecord={() => undefined}
            onDeleteRecord={() => undefined}
            preview
          />
          <div className="app-card lg:col-span-2 flex flex-wrap items-center justify-between gap-3 p-3">
            <p className="text-sm leading-6 text-muted">
              경고 {preview.warnings.length}건 · 건너뜀 {preview.skippedSheets.length}개 시트.
              {hasUnacknowledgedWarning ? " 경고 날짜를 확인해야 저장할 수 있습니다." : " 저장 전 날짜와 후보를 확인하세요."}
            </p>
            <button
              className="min-h-11 rounded-control bg-bread px-4 py-2 text-sm font-bold text-white transition hover:bg-cocoa focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bread/30 disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none"
              type="button"
              disabled={isLoading || hasUnacknowledgedWarning}
              onClick={() => void applyImport()}
            >
              확인한 내용 저장
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function formatMismatch(mismatch: { field: string; expected: number; actual: number }): string {
  const label =
    {
      salesAmount: "매출액",
      salesCount: "매출건수",
      producedQty: "생산량",
      lossQty: "손실량",
      tastingQty: "시식량",
      otherQty: "기타수량",
      stockQty: "재고량",
      soldQty: "판매량"
    }[mismatch.field] ?? mismatch.field;
  return `${label} 엑셀 ${mismatch.expected.toLocaleString("ko-KR")} / 계산 ${mismatch.actual.toLocaleString("ko-KR")}`;
}
