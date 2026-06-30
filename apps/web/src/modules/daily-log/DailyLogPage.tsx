import { ClipboardCheck, Save } from "lucide-react";
import { Fragment, useMemo, useState } from "react";

import { todayInStoreTime } from "../../shared/time/storeTime.js";
import { Button } from "../../shared/ui/Button.js";
import {
  providedDailyOperationDefaultMonth,
  providedDailyOperationRecords
} from "./providedDailyOperationRecords.js";

type DailyTab = "basic" | "products" | "sales" | "notes";
type DailyViewMode = "entry" | "lookup";
type LookupMode = "date" | "range" | "week" | "month";
type StaffPeriod = "today" | "tomorrow";
type StaffCategory =
  | "dayOff"
  | "vacation"
  | "lateEarly"
  | "support"
  | "birthday"
  | "newStaff"
  | "etc";

export type ProductRow = {
  productName: string;
  producedQty: string;
  lossQty: string;
  tastingQty: string;
  otherInQty: string;
  otherOutQty: string;
  stockQty: string;
  soldQty: string;
  manualSold: boolean;
};

export type ChannelRow = {
  name: string;
  count: string;
  amount: string;
};

export type StaffSpecialRows = Record<StaffPeriod, Record<StaffCategory, string>>;

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
};

export type DailyOperationSavedRecord = {
  draft: DailyOperationDraft;
  productRows: ProductRow[];
  channelRows: ChannelRow[];
  staffSpecialRows: StaffSpecialRows;
  savedAt: string;
};

type ProductTotals = {
  produced: number;
  loss: number;
  tasting: number;
  otherIn: number;
  otherOut: number;
  stock: number;
  sold: number;
};

type ChannelTotals = {
  amount: number;
  count: number;
};

type LookupSummary = {
  totalSales: number;
  totalCount: number;
};

const tabs: Array<{ id: DailyTab; label: string; description: string }> = [
  { id: "basic", label: "기본 정보", description: "날짜, 작성자, 온습도, 날씨" },
  { id: "products", label: "제품", description: "고정 제품별 생산·손실·시식·기타·재고·판매량" },
  { id: "sales", label: "매출", description: "POS 매출, POS 외 매출, 객단가" },
  { id: "notes", label: "메모·점검", description: "매장관리, 직원 특이사항, 위생·시설 점검" }
];

const productLineup = [
  "바게트",
  "바게트(H)",
  "화이트바게트",
  "화이트바게트(H)",
  "깜빠뉴",
  "깜빠뉴(H)",
  "식빵",
  "식빵(H)",
  "호밀빵",
  "호밀빵(H)",
  "블랙올리브",
  "허브",
  "치아바타",
  "화이트치아바타",
  "크로와상",
  "뺑오쇼콜라",
  "플레인 스콘",
  "크렌베리 스콘",
  "브레첼",
  "스틱브레첼",
  "버터브레첼",
  "호밀쇼콜라오렌지",
  "호밀비트",
  "호밀후르츠",
  "구름빵",
  "무화과호밀스틱",
  "봄날깜빠뉴",
  "봄날깜빠뉴(H)",
  "여름메밀빵",
  "여름메밀빵(H)",
  "가을애깜빠뉴",
  "가을애깜빠뉴(H)",
  "슈톨렌",
  "여름파네토네",
  "파네토네",
  "햄치즈샌드위치",
  "치킨샌드위치",
  "바질치킨",
  "멜란자네",
  "수프+샌드위치",
  "수프+빵"
];

const manualSoldProducts = new Set(["구름빵", "호밀쇼콜라오렌지", "호밀비트", "호밀후르츠"]);

const defaultChannels: ChannelRow[] = ["선물", "쿠팡이츠", "배민", "제로페이", "택배", "납품"].map(
  (name) => ({ name, count: "0", amount: "0" })
);

const staffCategories: Array<{ key: StaffCategory; label: string }> = [
  { key: "dayOff", label: "휴무" },
  { key: "vacation", label: "휴가" },
  { key: "lateEarly", label: "지각/조퇴" },
  { key: "support", label: "지원" },
  { key: "birthday", label: "생일" },
  { key: "newStaff", label: "신입" },
  { key: "etc", label: "기타사항" }
];

function createProductRows(): ProductRow[] {
  return productLineup.map((productName) => ({
    productName,
    producedQty: "0",
    lossQty: "0",
    tastingQty: "0",
    otherInQty: "0",
    otherOutQty: "0",
    stockQty: "0",
    soldQty: "0",
    manualSold: manualSoldProducts.has(productName)
  }));
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

function createDefaultDraft(): DailyOperationDraft {
  return {
    date: todayInStoreTime(),
    author: "",
    outsideTemp: "",
    insideTemp: "",
    outsideHumidity: "",
    insideHumidity: "",
    weather: "",
    posSalesAmount: "0",
    posSalesCount: "0",
    nonPosSalesAmount: "0",
    nonPosSalesCount: "0",
    productOpinionAndLoss: "",
    facilityIssue: "",
    cleaningWork: "",
    instructions: "",
    tomorrowPrep: "",
    firstWorker: "",
    firstWorkerTime: "",
    lastWorker: "",
    lastWorkerTime: "",
    hygieneChecker: "",
    finalChecker: ""
  };
}

function numeric(value: string): number {
  const parsed = Number(value.replaceAll(",", ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatCurrency(value: number): string {
  return `${Math.round(value).toLocaleString("ko-KR")}원`;
}

function calculatedSold(row: ProductRow): number {
  if (row.manualSold) {
    return numeric(row.soldQty);
  }
  return Math.max(
    0,
    numeric(row.producedQty) -
      numeric(row.otherOutQty) -
      numeric(row.lossQty) -
      numeric(row.tastingQty) -
      numeric(row.stockQty)
  );
}

function summarizeProducts(rows: ProductRow[]): ProductTotals {
  return rows.reduce(
    (totals, row) => ({
      produced: totals.produced + numeric(row.producedQty),
      loss: totals.loss + numeric(row.lossQty),
      tasting: totals.tasting + numeric(row.tastingQty),
      otherIn: totals.otherIn + numeric(row.otherInQty),
      otherOut: totals.otherOut + numeric(row.otherOutQty),
      stock: totals.stock + numeric(row.stockQty),
      sold: totals.sold + calculatedSold(row)
    }),
    { produced: 0, loss: 0, tasting: 0, otherIn: 0, otherOut: 0, stock: 0, sold: 0 }
  );
}

const productDetailFields: Array<{ key: keyof ProductTotals; label: string }> = [
  { key: "produced", label: "생산" },
  { key: "loss", label: "손실" },
  { key: "tasting", label: "시식" },
  { key: "otherIn", label: "기타+" },
  { key: "otherOut", label: "기타-" },
  { key: "stock", label: "재고" },
  { key: "sold", label: "판매" }
];

function productDetailValues(row: ProductRow): ProductTotals {
  return {
    produced: numeric(row.producedQty),
    loss: numeric(row.lossQty),
    tasting: numeric(row.tastingQty),
    otherIn: numeric(row.otherInQty),
    otherOut: numeric(row.otherOutQty),
    stock: numeric(row.stockQty),
    sold: calculatedSold(row)
  };
}

function productDetailText(row: ProductRow): string {
  const values = productDetailValues(row);
  return productDetailFields
    .filter((field) => values[field.key] !== 0)
    .map((field) => `${field.label} ${values[field.key].toLocaleString("ko-KR")}`)
    .join(" · ");
}

function hasProductDetail(row: ProductRow): boolean {
  const values = productDetailValues(row);
  return productDetailFields.some((field) => values[field.key] !== 0);
}

function summarizeChannels(rows: ChannelRow[]): ChannelTotals {
  return rows.reduce(
    (totals, row) => ({
      amount: totals.amount + numeric(row.amount),
      count: totals.count + numeric(row.count)
    }),
    { amount: 0, count: 0 }
  );
}

function draftStorageKey(date: string): string {
  return `pnp:daily-operation-draft:${date}`;
}

function isDailyOperationRecord(value: unknown): value is DailyOperationSavedRecord {
  if (!value || typeof value !== "object") {
    return false;
  }
  const record = value as Partial<DailyOperationSavedRecord>;
  return Boolean(
    record.draft?.date &&
    Array.isArray(record.productRows) &&
    Array.isArray(record.channelRows) &&
    record.staffSpecialRows &&
    typeof record.savedAt === "string"
  );
}

function loadStoredDailyRecords(): DailyOperationSavedRecord[] {
  if (typeof window === "undefined") {
    return providedDailyOperationRecords;
  }
  const recordsByDate = new Map<string, DailyOperationSavedRecord>();
  for (const record of providedDailyOperationRecords) {
    recordsByDate.set(record.draft.date, record);
  }

  Object.keys(window.localStorage)
    .filter((key) => key.startsWith("pnp:daily-operation-draft:"))
    .forEach((key) => {
      try {
        const parsed: unknown = JSON.parse(window.localStorage.getItem(key) ?? "null");
        if (isDailyOperationRecord(parsed)) {
          recordsByDate.set(parsed.draft.date, parsed);
        }
      } catch {
        // 저장 중 깨진 임시 기록은 조회에서 제외합니다.
      }
    });

  return Array.from(recordsByDate.values()).sort((left, right) =>
    right.draft.date.localeCompare(left.draft.date)
  );
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function formatDateInput(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function weekRange(baseDate: string): { startDate: string; endDate: string } {
  const date = new Date(`${baseDate}T00:00:00`);
  const day = date.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const start = addDays(date, mondayOffset);
  const end = addDays(start, 6);
  return { startDate: formatDateInput(start), endDate: formatDateInput(end) };
}

function monthRange(month: string): { startDate: string; endDate: string } {
  const [yearText, monthText] = month.split("-");
  const year = Number(yearText || todayInStoreTime().slice(0, 4));
  const monthIndex = Number(monthText || todayInStoreTime().slice(5, 7));
  const start = new Date(year, monthIndex - 1, 1);
  const end = new Date(year, monthIndex, 0);
  return { startDate: formatDateInput(start), endDate: formatDateInput(end) };
}

function summarizeDailyRecords(records: DailyOperationSavedRecord[]): LookupSummary {
  return records.reduce(
    (totals, record) => {
      const channels = summarizeChannels(record.channelRows);
      return {
        totalSales: totals.totalSales + numeric(record.draft.posSalesAmount) + channels.amount,
        totalCount: totals.totalCount + numeric(record.draft.posSalesCount) + channels.count
      };
    },
    { totalSales: 0, totalCount: 0 }
  );
}

function daysBetweenInclusive(startDate: string, endDate: string): number {
  const start = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T00:00:00`);
  return Math.max(1, Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1);
}

function previousRange(range: { startDate: string; endDate: string }): {
  startDate: string;
  endDate: string;
} {
  const days = daysBetweenInclusive(range.startDate, range.endDate);
  const start = new Date(`${range.startDate}T00:00:00`);
  const previousEnd = addDays(start, -1);
  const previousStart = addDays(previousEnd, 1 - days);
  return { startDate: formatDateInput(previousStart), endDate: formatDateInput(previousEnd) };
}

function salesTotal(record: DailyOperationSavedRecord): number {
  return numeric(record.draft.posSalesAmount) + summarizeChannels(record.channelRows).amount;
}

function salesCountTotal(record: DailyOperationSavedRecord): number {
  return numeric(record.draft.posSalesCount) + summarizeChannels(record.channelRows).count;
}

function percentChange(current: number, previous: number): string {
  if (previous === 0) {
    return current === 0 ? "0%" : "+100%";
  }
  const changed = ((current - previous) / previous) * 100;
  const sign = changed > 0 ? "+" : "";
  return `${sign}${changed.toFixed(1)}%`;
}

export function DailyLogPage() {
  const today = todayInStoreTime();
  const [viewMode, setViewMode] = useState<DailyViewMode>("entry");
  const [activeTab, setActiveTab] = useState<DailyTab>("basic");
  const [draft, setDraft] = useState<DailyOperationDraft>(() => createDefaultDraft());
  const [productRows, setProductRows] = useState<ProductRow[]>(() => createProductRows());
  const [channelRows, setChannelRows] = useState<ChannelRow[]>(defaultChannels);
  const [staffSpecialRows, setStaffSpecialRows] = useState<StaffSpecialRows>(() =>
    createStaffSpecialRows()
  );
  const [savedRecords, setSavedRecords] = useState<DailyOperationSavedRecord[]>(() =>
    loadStoredDailyRecords()
  );
  const [lookupMode, setLookupMode] = useState<LookupMode>("month");
  const [lookupDate, setLookupDate] = useState(today);
  const [lookupStartDate, setLookupStartDate] = useState(today);
  const [lookupEndDate, setLookupEndDate] = useState(today);
  const [lookupMonth, setLookupMonth] = useState(providedDailyOperationDefaultMonth);
  const [message, setMessage] = useState<string | null>(null);

  const channelSales = useMemo(() => summarizeChannels(channelRows), [channelRows]);
  const totalSales = numeric(draft.posSalesAmount) + channelSales.amount;
  const totalSalesCount = numeric(draft.posSalesCount) + channelSales.count;
  const averageSpend = totalSalesCount > 0 ? totalSales / totalSalesCount : 0;
  const productTotals = useMemo(() => summarizeProducts(productRows), [productRows]);
  const lookupRange = useMemo(() => {
    if (lookupMode === "date") {
      return { startDate: lookupDate, endDate: lookupDate };
    }
    if (lookupMode === "week") {
      return weekRange(lookupDate);
    }
    if (lookupMode === "month") {
      return monthRange(lookupMonth);
    }
    return {
      startDate: lookupStartDate <= lookupEndDate ? lookupStartDate : lookupEndDate,
      endDate: lookupStartDate <= lookupEndDate ? lookupEndDate : lookupStartDate
    };
  }, [lookupDate, lookupEndDate, lookupMode, lookupMonth, lookupStartDate]);
  const lookupRecords = useMemo(
    () =>
      savedRecords.filter(
        (record) =>
          record.draft.date >= lookupRange.startDate && record.draft.date <= lookupRange.endDate
      ),
    [lookupRange.endDate, lookupRange.startDate, savedRecords]
  );
  const comparisonRange = useMemo(() => previousRange(lookupRange), [lookupRange]);
  const comparisonRecords = useMemo(
    () =>
      savedRecords.filter(
        (record) =>
          record.draft.date >= comparisonRange.startDate &&
          record.draft.date <= comparisonRange.endDate
      ),
    [comparisonRange.endDate, comparisonRange.startDate, savedRecords]
  );

  function updateDraft<K extends keyof DailyOperationDraft>(key: K, value: DailyOperationDraft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
    setMessage(null);
  }

  function updateProductRow(productName: string, key: keyof ProductRow, value: string) {
    setProductRows((rows) =>
      rows.map((row) => (row.productName === productName ? { ...row, [key]: value } : row))
    );
    setMessage(null);
  }

  function updateChannelRow(name: string, key: keyof Omit<ChannelRow, "name">, value: string) {
    setChannelRows((rows) =>
      rows.map((row) => (row.name === name ? { ...row, [key]: value } : row))
    );
    setMessage(null);
  }

  function updateStaffSpecialRow(period: StaffPeriod, category: StaffCategory, value: string) {
    setStaffSpecialRows((rows) => ({
      ...rows,
      [period]: {
        ...rows[period],
        [category]: value
      }
    }));
    setMessage(null);
  }

  function saveDraft() {
    window.localStorage.setItem(
      draftStorageKey(draft.date),
      JSON.stringify({
        draft,
        productRows,
        channelRows,
        staffSpecialRows,
        savedAt: new Date().toISOString()
      })
    );
    setSavedRecords(loadStoredDailyRecords());
    setMessage(
      "일일 운영 입력 내용이 저장되었습니다. 조회 화면에서 날짜별·기간별로 확인할 수 있습니다."
    );
  }

  function loadRecordForEdit(record: DailyOperationSavedRecord) {
    setDraft({ ...record.draft });
    setProductRows(record.productRows.map((row) => ({ ...row })));
    setChannelRows(record.channelRows.map((row) => ({ ...row })));
    setStaffSpecialRows({
      today: { ...record.staffSpecialRows.today },
      tomorrow: { ...record.staffSpecialRows.tomorrow }
    });
    setActiveTab("basic");
    setViewMode("entry");
    setMessage(`${record.draft.date} 일지를 불러왔습니다. 저장하면 같은 날짜 기록이 갱신됩니다.`);
  }

  return (
    <div className="mx-auto grid max-w-7xl gap-4">
      <section className="panel">
        <div className="panel-heading">
          <div>
            <p className="text-sm text-muted">일일 운영</p>
            <h2 className="section-title">매장 운영일지</h2>
            <p className="mt-1 text-sm text-muted">
              매출, 제품 수량, POS 외 매출, 점검사항을 하루 단위로 입력합니다.
            </p>
          </div>
          {viewMode === "entry" ? (
            <Button icon={Save} type="button" onClick={saveDraft}>
              일일 운영 저장
            </Button>
          ) : null}
        </div>
        <div className="mb-4 flex flex-wrap gap-2" role="tablist" aria-label="일일 운영 화면 선택">
          {(
            [
              ["entry", "입력"],
              ["lookup", "조회"]
            ] as Array<[DailyViewMode, string]>
          ).map(([mode, label]) => (
            <button
              key={mode}
              type="button"
              role="tab"
              aria-selected={viewMode === mode}
              className={[
                "rounded-control border px-5 py-2 text-sm font-bold transition",
                viewMode === mode
                  ? "border-cocoa bg-cocoa text-white shadow-control"
                  : "border-latte bg-white text-cocoa hover:border-bread"
              ].join(" ")}
              onClick={() => {
                setViewMode(mode);
                if (mode === "lookup") {
                  setSavedRecords(loadStoredDailyRecords());
                }
              }}
            >
              {label}
            </button>
          ))}
        </div>
        {message ? (
          <div className="mb-4 rounded-control border border-green/20 bg-green/10 px-3 py-2 text-sm font-semibold text-green">
            {message}
          </div>
        ) : null}
        {viewMode === "entry" ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <SummaryCard label="총 매출액" value={formatCurrency(totalSales)} />
            <SummaryCard
              label="총 매출건수"
              value={`${totalSalesCount.toLocaleString("ko-KR")}건`}
            />
            <SummaryCard label="객단가" value={formatCurrency(averageSpend)} />
            <SummaryCard
              label="제품 판매량"
              value={`${productTotals.sold.toLocaleString("ko-KR")}개`}
            />
          </div>
        ) : null}
      </section>

      <section className="panel">
        {viewMode === "entry" ? (
          <>
            <div
              className="mb-4 flex flex-wrap gap-2"
              role="tablist"
              aria-label="일일 운영 입력 분류"
            >
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={activeTab === tab.id}
                  className={[
                    "rounded-control border px-4 py-2 text-sm font-bold transition",
                    activeTab === tab.id
                      ? "border-cocoa bg-cocoa text-white shadow-control"
                      : "border-latte bg-white text-cocoa hover:border-bread"
                  ].join(" ")}
                  onClick={() => setActiveTab(tab.id)}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            <p className="mb-4 text-sm text-muted">
              {tabs.find((tab) => tab.id === activeTab)?.description}
            </p>

            {activeTab === "basic" ? (
              <BasicSection draft={draft} updateDraft={updateDraft} />
            ) : null}
            {activeTab === "products" ? (
              <ProductsSection
                rows={productRows}
                totals={productTotals}
                updateRow={updateProductRow}
              />
            ) : null}
            {activeTab === "sales" ? (
              <SalesSection
                channelRows={channelRows}
                draft={draft}
                updateChannelRow={updateChannelRow}
                updateDraft={updateDraft}
                totalSales={totalSales}
                channelSalesAmount={channelSales.amount}
                channelSalesCount={channelSales.count}
                averageSpend={averageSpend}
              />
            ) : null}
            {activeTab === "notes" ? (
              <NotesSection
                draft={draft}
                staffSpecialRows={staffSpecialRows}
                updateDraft={updateDraft}
                updateStaffSpecialRow={updateStaffSpecialRow}
              />
            ) : null}
          </>
        ) : (
          <DailyLookupSection
            records={lookupRecords}
            previousRecords={comparisonRecords}
            allRecordCount={savedRecords.length}
            lookupMode={lookupMode}
            lookupDate={lookupDate}
            lookupStartDate={lookupStartDate}
            lookupEndDate={lookupEndDate}
            lookupMonth={lookupMonth}
            lookupRange={lookupRange}
            previousLookupRange={comparisonRange}
            setLookupMode={setLookupMode}
            setLookupDate={setLookupDate}
            setLookupStartDate={setLookupStartDate}
            setLookupEndDate={setLookupEndDate}
            setLookupMonth={setLookupMonth}
            onEditRecord={loadRecordForEdit}
          />
        )}
      </section>
    </div>
  );
}

function DailyLookupSection({
  records,
  previousRecords,
  allRecordCount,
  lookupMode,
  lookupDate,
  lookupStartDate,
  lookupEndDate,
  lookupMonth,
  lookupRange,
  previousLookupRange,
  setLookupMode,
  setLookupDate,
  setLookupStartDate,
  setLookupEndDate,
  setLookupMonth,
  onEditRecord
}: {
  records: DailyOperationSavedRecord[];
  previousRecords: DailyOperationSavedRecord[];
  allRecordCount: number;
  lookupMode: LookupMode;
  lookupDate: string;
  lookupStartDate: string;
  lookupEndDate: string;
  lookupMonth: string;
  lookupRange: { startDate: string; endDate: string };
  previousLookupRange: { startDate: string; endDate: string };
  setLookupMode: (mode: LookupMode) => void;
  setLookupDate: (date: string) => void;
  setLookupStartDate: (date: string) => void;
  setLookupEndDate: (date: string) => void;
  setLookupMonth: (month: string) => void;
  onEditRecord: (record: DailyOperationSavedRecord) => void;
}) {
  const [expandedDates, setExpandedDates] = useState<string[]>([]);
  const [productDetailDates, setProductDetailDates] = useState<string[]>([]);
  const summary = summarizeDailyRecords(records);
  const previousSummary = summarizeDailyRecords(previousRecords);
  const selectedDays = daysBetweenInclusive(lookupRange.startDate, lookupRange.endDate);
  const totalSales = summary.totalSales;
  const totalCount = summary.totalCount;
  const dailyAverageSales = totalSales / selectedDays;
  const averageSpend = totalCount > 0 ? totalSales / totalCount : 0;
  const previousLabel =
    lookupMode === "week" ? "전주 대비" : lookupMode === "month" ? "전월 대비" : "이전 기간 대비";

  return (
    <div className="grid gap-4">
      <div className="rounded-control border border-latte bg-white/80 p-4">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <label className="grid gap-2">
            <span className="field-label">조회 방식</span>
            <select
              className="input"
              value={lookupMode}
              onChange={(event) => setLookupMode(event.target.value as LookupMode)}
            >
              <option value="date">날짜 검색</option>
              <option value="week">주간검색</option>
              <option value="month">월별검색</option>
              <option value="range">기간설정</option>
            </select>
          </label>
          {lookupMode === "date" || lookupMode === "week" ? (
            <TextInput
              label={lookupMode === "week" ? "기준 날짜" : "조회 날짜"}
              type="date"
              value={lookupDate}
              onChange={setLookupDate}
            />
          ) : null}
          {lookupMode === "range" ? (
            <>
              <TextInput
                label="시작 날짜"
                type="date"
                value={lookupStartDate}
                onChange={setLookupStartDate}
              />
              <TextInput
                label="종료 날짜"
                type="date"
                value={lookupEndDate}
                onChange={setLookupEndDate}
              />
            </>
          ) : null}
          {lookupMode === "month" ? (
            <TextInput label="조회 월" type="month" value={lookupMonth} onChange={setLookupMonth} />
          ) : null}
          <div className="rounded-control border border-latte bg-cream/60 px-3 py-2">
            <p className="text-sm font-bold text-cocoa">조회 기간</p>
            <p className="mt-1 text-sm text-muted">
              {lookupRange.startDate} ~ {lookupRange.endDate}
            </p>
          </div>
          <div className="rounded-control border border-latte bg-cream/60 px-3 py-2">
            <p className="text-sm font-bold text-cocoa">저장된 일지</p>
            <p className="mt-1 text-sm text-muted">
              전체 {allRecordCount}일 / 조회 {records.length}일
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard label="총매출" value={formatCurrency(totalSales)} />
        <SummaryCard label="일 평균 매출" value={formatCurrency(dailyAverageSales)} />
        <SummaryCard label="객단가" value={formatCurrency(averageSpend)} />
        <SummaryCard
          label={previousLabel}
          value={percentChange(totalSales, previousSummary.totalSales)}
        />
      </div>

      <div className="rounded-control border border-latte bg-white/80 px-3 py-3 text-sm font-semibold text-muted">
        비교 기간: {previousLookupRange.startDate} ~ {previousLookupRange.endDate} / 비교 총매출{" "}
        {formatCurrency(previousSummary.totalSales)}
      </div>

      <div className="rounded-control border border-latte bg-white/80 p-4">
        <h3 className="text-lg font-bold text-cocoa">조회된 일지</h3>
        {records.length === 0 ? (
          <p className="mt-3 rounded-control border border-dashed border-latte bg-cream/40 px-3 py-6 text-center text-sm font-semibold text-muted">
            선택한 기간에 저장된 일일 운영 일지가 없습니다.
          </p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[1120px] text-left text-sm">
              <thead className="bg-cream text-cocoa">
                <tr>
                  <th className="px-2 py-2">날짜</th>
                  <th className="px-2 py-2">작성자</th>
                  <th className="px-2 py-2">날씨</th>
                  <th className="px-2 py-2 text-right">POS</th>
                  <th className="px-2 py-2 text-right">POS 외</th>
                  <th className="px-2 py-2 text-right">총 매출액</th>
                  <th className="px-2 py-2 text-right">총 매출건수</th>
                  <th className="px-2 py-2 text-right">객단가</th>
                  <th className="px-2 py-2 text-right">제품 판매량</th>
                  <th className="px-2 py-2">주요 메모</th>
                  <th className="px-2 py-2 text-center">전체 데이터</th>
                </tr>
              </thead>
              <tbody>
                {records.map((record) => {
                  const recordSales = salesTotal(record);
                  const recordCount = salesCountTotal(record);
                  const channelSummary = summarizeChannels(record.channelRows);
                  const products = summarizeProducts(record.productRows);
                  const isExpanded = expandedDates.includes(record.draft.date);
                  const isProductDetail = productDetailDates.includes(record.draft.date);
                  const productDetails = record.productRows.filter(hasProductDetail);
                  return (
                    <Fragment key={record.draft.date}>
                      <tr className="border-t border-latte align-top">
                        <td className="px-2 py-2 font-bold text-cocoa">{record.draft.date}</td>
                        <td className="px-2 py-2">{record.draft.author || "-"}</td>
                        <td className="px-2 py-2">{record.draft.weather || "-"}</td>
                        <td className="px-2 py-2 text-right">
                          {formatCurrency(numeric(record.draft.posSalesAmount))}
                        </td>
                        <td className="px-2 py-2 text-right">
                          {formatCurrency(channelSummary.amount)}
                        </td>
                        <td className="px-2 py-2 text-right font-bold text-cocoa">
                          {formatCurrency(recordSales)}
                        </td>
                        <td className="px-2 py-2 text-right">
                          {recordCount.toLocaleString("ko-KR")}건
                        </td>
                        <td className="px-2 py-2 text-right">
                          {formatCurrency(recordCount > 0 ? recordSales / recordCount : 0)}
                        </td>
                        <td className="px-2 py-2 text-right">
                          {products.sold.toLocaleString("ko-KR")}개
                        </td>
                        <td className="max-w-[220px] truncate px-2 py-2">
                          {record.draft.productOpinionAndLoss || record.draft.instructions || "-"}
                        </td>
                        <td className="px-2 py-2 text-center">
                          <button
                            className="rounded-control border border-latte bg-white px-3 py-1.5 text-xs font-bold text-cocoa hover:border-cocoa"
                            type="button"
                            onClick={() =>
                              setExpandedDates((current) =>
                                current.includes(record.draft.date)
                                  ? current.filter((date) => date !== record.draft.date)
                                  : [...current, record.draft.date]
                              )
                            }
                          >
                            {isExpanded ? "접기" : "상세"}
                          </button>
                        </td>
                      </tr>
                      {isExpanded ? (
                        <tr className="border-t border-latte bg-cream/30">
                          <td className="px-3 py-3" colSpan={11}>
                            <div className="mb-3 flex justify-end">
                              <button
                                className="rounded-control border border-cocoa bg-white px-3 py-1.5 text-xs font-bold text-cocoa hover:bg-cream"
                                type="button"
                                onClick={() => onEditRecord(record)}
                              >
                                수정
                              </button>
                            </div>
                            <div className="grid gap-3 lg:grid-cols-3">
                              <div className="rounded-control border border-latte bg-white p-3">
                                <p className="font-bold text-cocoa">기본·점검</p>
                                <p className="mt-2 text-sm text-muted">
                                  온도 {record.draft.outsideTemp || "-"}/
                                  {record.draft.insideTemp || "-"}℃ · 습도{" "}
                                  {record.draft.outsideHumidity || "-"}/
                                  {record.draft.insideHumidity || "-"}%
                                </p>
                                <p className="mt-1 text-sm text-muted">
                                  첫 출근 {record.draft.firstWorker || "-"}{" "}
                                  {record.draft.firstWorkerTime || ""} / 최종퇴근{" "}
                                  {record.draft.lastWorker || "-"}{" "}
                                  {record.draft.lastWorkerTime || ""}
                                </p>
                                <p className="mt-1 text-sm text-muted">
                                  위생 {record.draft.hygieneChecker || "-"} · 최종{" "}
                                  {record.draft.finalChecker || "-"}
                                </p>
                              </div>
                              <div className="rounded-control border border-latte bg-white p-3">
                                <div className="flex items-center justify-between gap-2">
                                  <p className="font-bold text-cocoa">제품 합계</p>
                                  <div
                                    className="flex rounded-control border border-latte bg-cream/60 p-0.5"
                                    role="tablist"
                                    aria-label={`${record.draft.date} 제품합계 보기`}
                                  >
                                    {(
                                      [
                                        [false, "요약"],
                                        [true, "상세"]
                                      ] as Array<[boolean, string]>
                                    ).map(([detailMode, label]) => (
                                      <button
                                        key={label}
                                        className={[
                                          "rounded-control px-2 py-1 text-xs font-bold transition",
                                          isProductDetail === detailMode
                                            ? "bg-cocoa text-white"
                                            : "text-cocoa hover:bg-white"
                                        ].join(" ")}
                                        type="button"
                                        role="tab"
                                        aria-selected={isProductDetail === detailMode}
                                        onClick={() =>
                                          setProductDetailDates((current) =>
                                            detailMode
                                              ? current.includes(record.draft.date)
                                                ? current
                                                : [...current, record.draft.date]
                                              : current.filter((date) => date !== record.draft.date)
                                          )
                                        }
                                      >
                                        {label}
                                      </button>
                                    ))}
                                  </div>
                                </div>
                                {!isProductDetail ? (
                                  <>
                                    <p className="mt-2 text-sm text-muted">
                                      생산 {products.produced} · 손실 {products.loss} · 시식{" "}
                                      {products.tasting}
                                    </p>
                                    <p className="mt-1 text-sm text-muted">
                                      기타 +{products.otherIn} / -{products.otherOut} · 재고{" "}
                                      {products.stock} · 판매 {products.sold}
                                    </p>
                                  </>
                                ) : productDetails.length > 0 ? (
                                  <div className="mt-2 max-h-56 overflow-auto rounded-control border border-latte">
                                    <table className="w-full text-left text-xs">
                                      <thead className="sticky top-0 bg-cream text-cocoa">
                                        <tr>
                                          <th className="px-2 py-1.5">제품</th>
                                          <th className="px-2 py-1.5">입력 내용</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {productDetails.map((row) => (
                                          <tr
                                            key={row.productName}
                                            className="border-t border-latte align-top"
                                          >
                                            <td className="whitespace-nowrap px-2 py-1.5 font-bold text-cocoa">
                                              {row.productName}
                                            </td>
                                            <td className="px-2 py-1.5 text-muted">
                                              {productDetailText(row)}
                                            </td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                ) : (
                                  <p className="mt-2 rounded-control border border-dashed border-latte bg-cream/40 px-2 py-4 text-center text-xs font-semibold text-muted">
                                    실제 입력된 제품 수량 없음
                                  </p>
                                )}
                              </div>
                              <div className="rounded-control border border-latte bg-white p-3">
                                <p className="font-bold text-cocoa">메모</p>
                                <p className="mt-2 text-sm text-muted">
                                  제품의견/손실: {record.draft.productOpinionAndLoss || "-"}
                                </p>
                                <p className="mt-1 text-sm text-muted">
                                  지시/전달: {record.draft.instructions || "-"}
                                </p>
                                <p className="mt-1 text-sm text-muted">
                                  내일 준비: {record.draft.tomorrowPrep || "-"}
                                </p>
                                <p className="mt-1 text-sm text-muted">
                                  시설/청결: {record.draft.facilityIssue || "-"} /{" "}
                                  {record.draft.cleaningWork || "-"}
                                </p>
                              </div>
                            </div>
                          </td>
                        </tr>
                      ) : null}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-control border border-latte bg-white/80 px-3 py-3 shadow-control">
      <p className="text-sm text-muted">{label}</p>
      <p className="mt-1 text-2xl font-bold text-cocoa">{value}</p>
    </div>
  );
}

function ReadOnlyMetric({
  label,
  value,
  helper
}: {
  label: string;
  value: string;
  helper: string;
}) {
  return (
    <div className="grid min-w-0 gap-2">
      <span className="field-label">{label}</span>
      <div className="rounded-control border border-latte bg-cream/60 px-3 py-2">
        <p aria-label={label} className="text-lg font-bold text-cocoa">
          {value}
        </p>
        <p className="mt-0.5 text-xs font-semibold text-muted">{helper}</p>
      </div>
    </div>
  );
}

function BasicSection({
  draft,
  updateDraft
}: {
  draft: DailyOperationDraft;
  updateDraft: <K extends keyof DailyOperationDraft>(key: K, value: DailyOperationDraft[K]) => void;
}) {
  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      <TextInput
        label="날짜"
        type="date"
        value={draft.date}
        onChange={(value) => updateDraft("date", value)}
      />
      <TextInput
        label="작성자"
        value={draft.author}
        onChange={(value) => updateDraft("author", value)}
      />
      <TextInput
        label="외부온도"
        suffix="℃"
        value={draft.outsideTemp}
        onChange={(value) => updateDraft("outsideTemp", value)}
      />
      <TextInput
        label="내부온도"
        suffix="℃"
        value={draft.insideTemp}
        onChange={(value) => updateDraft("insideTemp", value)}
      />
      <TextInput
        label="외부습도"
        suffix="%"
        value={draft.outsideHumidity}
        onChange={(value) => updateDraft("outsideHumidity", value)}
      />
      <TextInput
        label="내부습도"
        suffix="%"
        value={draft.insideHumidity}
        onChange={(value) => updateDraft("insideHumidity", value)}
      />
      <label className="grid gap-2 xl:col-span-2">
        <span className="field-label">날씨</span>
        <input
          className="input"
          value={draft.weather}
          onChange={(event) => updateDraft("weather", event.target.value)}
          placeholder="예: 맑음, 비, 흐림"
        />
      </label>
    </div>
  );
}

function SalesSection({
  channelRows,
  draft,
  updateChannelRow,
  updateDraft,
  totalSales,
  channelSalesAmount,
  channelSalesCount,
  averageSpend
}: {
  channelRows: ChannelRow[];
  draft: DailyOperationDraft;
  updateChannelRow: (name: string, key: keyof Omit<ChannelRow, "name">, value: string) => void;
  updateDraft: <K extends keyof DailyOperationDraft>(key: K, value: DailyOperationDraft[K]) => void;
  totalSales: number;
  channelSalesAmount: number;
  channelSalesCount: number;
  averageSpend: number;
}) {
  return (
    <div className="grid gap-5">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <TextInput
          label="POS 매출액"
          type="number"
          value={draft.posSalesAmount}
          onChange={(value) => updateDraft("posSalesAmount", value)}
        />
        <TextInput
          label="POS 매출건수"
          type="number"
          value={draft.posSalesCount}
          onChange={(value) => updateDraft("posSalesCount", value)}
        />
        <ReadOnlyMetric
          label="POS 외 매출액"
          value={formatCurrency(channelSalesAmount)}
          helper="아래 POS 외 매출 합산"
        />
        <ReadOnlyMetric
          label="POS 외 매출건수"
          value={`${channelSalesCount.toLocaleString("ko-KR")}건`}
          helper="아래 POS 외 매출 합산"
        />
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <SummaryCard label="총 매출액" value={formatCurrency(totalSales)} />
        <SummaryCard label="총 매출액 기준 객단가" value={formatCurrency(averageSpend)} />
      </div>
      <div className="grid gap-3">
        <div>
          <h3 className="text-lg font-bold text-cocoa">POS 외 매출</h3>
          <p className="mt-1 text-sm text-muted">
            선물, 배달, 결제, 택배, 납품 매출을 매출 탭 안에서 함께 입력합니다.
          </p>
        </div>
        <ChannelsSection rows={channelRows} updateRow={updateChannelRow} />
      </div>
    </div>
  );
}

function ProductsSection({
  rows,
  totals,
  updateRow
}: {
  rows: ProductRow[];
  totals: {
    produced: number;
    loss: number;
    tasting: number;
    otherIn: number;
    otherOut: number;
    stock: number;
    sold: number;
  };
  updateRow: (productName: string, key: keyof ProductRow, value: string) => void;
}) {
  return (
    <div className="grid gap-3">
      <div className="rounded-control border border-latte bg-white">
        <div className="max-h-[62vh] overflow-auto">
          <table className="w-full min-w-[880px] table-fixed text-left text-xs">
            <thead className="sticky top-0 z-10 bg-cream text-cocoa shadow-sm">
              <tr>
                <th className="w-40 px-2 py-2">제품</th>
                <th className="w-28 px-2 py-2 text-center">생산량</th>
                <th className="w-28 px-2 py-2 text-center">손실량</th>
                <th className="w-28 px-2 py-2 text-center">시식량</th>
                <th className="w-36 px-2 py-2 text-center">기타(+)/(-)</th>
                <th className="w-28 px-2 py-2 text-center">재고량</th>
                <th className="w-28 px-2 py-2 text-center">판매량</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const sold = calculatedSold(row);
                return (
                  <tr
                    key={row.productName}
                    className="border-t border-latte/80 odd:bg-white even:bg-cream/30"
                  >
                    <th className="sticky left-0 z-[1] bg-inherit px-2 py-1.5 text-sm font-bold text-cocoa">
                      {row.productName}
                    </th>
                    <CompactNumberInput
                      label={`${row.productName} 생산량`}
                      value={row.producedQty}
                      onChange={(value) => updateRow(row.productName, "producedQty", value)}
                    />
                    <CompactNumberInput
                      label={`${row.productName} 손실량`}
                      value={row.lossQty}
                      onChange={(value) => updateRow(row.productName, "lossQty", value)}
                    />
                    <CompactNumberInput
                      label={`${row.productName} 시식량`}
                      value={row.tastingQty}
                      onChange={(value) => updateRow(row.productName, "tastingQty", value)}
                    />
                    <td className="w-36 px-2 py-1.5">
                      <div className="flex justify-center gap-2">
                        <CompactInlineNumberInput
                          label={`${row.productName} 기타 입고 +`}
                          prefix="+"
                          value={row.otherInQty}
                          onChange={(value) => updateRow(row.productName, "otherInQty", value)}
                        />
                        <CompactInlineNumberInput
                          label={`${row.productName} 기타 출고 -`}
                          prefix="-"
                          value={row.otherOutQty}
                          onChange={(value) => updateRow(row.productName, "otherOutQty", value)}
                        />
                      </div>
                    </td>
                    <CompactNumberInput
                      label={`${row.productName} 재고량`}
                      value={row.stockQty}
                      onChange={(value) => updateRow(row.productName, "stockQty", value)}
                    />
                    <td className="w-28 px-2 py-1.5">
                      {row.manualSold ? (
                        <input
                          aria-label={`${row.productName} 판매량 직접입력`}
                          className="mx-auto block h-9 w-20 rounded-control border border-latte bg-white px-2 text-right font-bold text-cocoa outline-none focus:border-cocoa"
                          inputMode="numeric"
                          type="text"
                          value={row.soldQty}
                          onFocus={(event) => event.currentTarget.select()}
                          onChange={(event) =>
                            updateRow(row.productName, "soldQty", event.target.value)
                          }
                        />
                      ) : (
                        <span
                          className="mx-auto flex h-9 w-20 items-center justify-end rounded-control bg-cocoa/5 px-2 font-bold text-cocoa"
                          title="자동 계산"
                        >
                          {sold.toLocaleString("ko-KR")}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="sticky bottom-0 bg-cocoa text-xs font-bold text-white">
              <tr>
                <td className="px-2 py-2">합계</td>
                <td className="px-2 py-2 text-center">{totals.produced}</td>
                <td className="px-2 py-2 text-center">{totals.loss}</td>
                <td className="px-2 py-2 text-center">{totals.tasting}</td>
                <td className="px-2 py-2 text-center">
                  +{totals.otherIn} / -{totals.otherOut}
                </td>
                <td className="px-2 py-2 text-center">{totals.stock}</td>
                <td className="px-2 py-2 text-center">{totals.sold}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
      <p className="text-xs font-semibold text-muted">
        자동 계산: 생산량 - 기타(-) - 손실량 - 시식량 - 재고량. 기타(+)는 재고 증가 기록이라
        판매량에 더하지 않습니다. 구름빵, 호밀쇼콜라오렌지, 호밀비트, 호밀후르츠는 다음날 판매 가능
        제품이라 판매량을 직접 입력합니다.
        <span className="sr-only">자동 계산</span>
      </p>
    </div>
  );
}

function CompactNumberInput({
  label,
  value,
  onChange
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <td className="w-28 px-2 py-1.5">
      <input
        aria-label={label}
        className="mx-auto block h-9 w-20 rounded-control border border-latte bg-white px-2 text-right outline-none focus:border-cocoa"
        inputMode="numeric"
        type="text"
        value={value}
        onFocus={(event) => event.currentTarget.select()}
        onChange={(event) => onChange(event.target.value)}
      />
    </td>
  );
}

function CompactInlineNumberInput({
  label,
  prefix,
  value,
  onChange
}: {
  label: string;
  prefix: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="flex h-8 w-14 items-center rounded-control border border-latte bg-white px-1 focus-within:border-cocoa">
      <span className="w-3 text-center text-xs font-bold text-cocoa">{prefix}</span>
      <input
        aria-label={label}
        className="min-w-0 flex-1 bg-transparent px-1 text-right text-xs outline-none"
        type="number"
        value={value}
        onFocus={(event) => event.currentTarget.select()}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

function ChannelsSection({
  rows,
  updateRow
}: {
  rows: ChannelRow[];
  updateRow: (name: string, key: keyof Omit<ChannelRow, "name">, value: string) => void;
}) {
  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {rows.map((row) => (
        <div
          key={row.name}
          className="rounded-control border border-latte bg-white/90 p-4 shadow-control"
        >
          <h3 className="text-lg font-bold text-cocoa">{row.name}</h3>
          <div className="mt-3 grid min-w-0 gap-3 sm:grid-cols-2">
            <ChannelInput
              ariaLabel={`${row.name} 매출건수`}
              label="매출건수"
              type="number"
              value={row.count}
              onChange={(value) => updateRow(row.name, "count", value)}
            />
            <ChannelInput
              ariaLabel={`${row.name} 매출액`}
              label="매출액"
              type="number"
              value={row.amount}
              onChange={(value) => updateRow(row.name, "amount", value)}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function ChannelInput({
  ariaLabel,
  label,
  value,
  onChange,
  type = "text"
}: {
  ariaLabel: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
}) {
  const isNumeric = type === "number";
  return (
    <label className="grid min-w-0 gap-2">
      <span className="field-label">{label}</span>
      <input
        aria-label={ariaLabel}
        className="input min-w-0 w-full"
        inputMode={isNumeric ? "numeric" : undefined}
        type={isNumeric ? "text" : type}
        value={value}
        onFocus={isNumeric ? (event) => event.currentTarget.select() : undefined}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

function NotesSection({
  draft,
  staffSpecialRows,
  updateDraft,
  updateStaffSpecialRow
}: {
  draft: DailyOperationDraft;
  staffSpecialRows: StaffSpecialRows;
  updateDraft: <K extends keyof DailyOperationDraft>(key: K, value: DailyOperationDraft[K]) => void;
  updateStaffSpecialRow: (period: StaffPeriod, category: StaffCategory, value: string) => void;
}) {
  return (
    <div className="grid gap-4">
      <div className="grid gap-3 lg:grid-cols-2">
        <TextArea
          label="제품의견/손실"
          value={draft.productOpinionAndLoss}
          onChange={(value) => updateDraft("productOpinionAndLoss", value)}
          className="lg:col-span-2"
          textareaClassName="min-h-40"
        />
        <TextArea
          label="지시 및 전달사항"
          value={draft.instructions}
          onChange={(value) => updateDraft("instructions", value)}
        />
        <TextArea
          label="내일 준비사항"
          value={draft.tomorrowPrep}
          onChange={(value) => updateDraft("tomorrowPrep", value)}
        />
        <TextArea
          label="시설/장비 특이사항"
          value={draft.facilityIssue}
          onChange={(value) => updateDraft("facilityIssue", value)}
        />
        <TextArea
          label="청결/위생 관련업무"
          value={draft.cleaningWork}
          onChange={(value) => updateDraft("cleaningWork", value)}
        />
      </div>

      <div className="rounded-control border border-latte bg-white/80 p-4">
        <div className="mb-3 flex items-center gap-2 font-bold text-cocoa">
          <ClipboardCheck className="h-5 w-5" aria-hidden="true" />
          직원 특이사항
        </div>
        <div className="overflow-hidden rounded-control border border-latte">
          <table className="w-full table-fixed text-left text-xs">
            <thead className="bg-cream text-cocoa">
              <tr>
                <th className="w-14 px-1.5 py-2">구분</th>
                {staffCategories.map((category) => (
                  <th key={category.key} className="px-1.5 py-2">
                    {category.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(
                [
                  ["today", "금일"],
                  ["tomorrow", "내일"]
                ] as Array<[StaffPeriod, string]>
              ).map(([period, label]) => (
                <tr key={period} className="border-t border-latte">
                  <th className="px-1.5 py-2 text-cocoa">{label}</th>
                  {staffCategories.map((category) => (
                    <td key={category.key} className="px-1.5 py-2">
                      <input
                        aria-label={`${label} ${category.label}`}
                        className="h-10 w-full rounded-control border border-latte bg-white px-2 text-xs outline-none focus:border-cocoa"
                        value={staffSpecialRows[period][category.key]}
                        onChange={(event) =>
                          updateStaffSpecialRow(period, category.key, event.target.value)
                        }
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-control border border-latte bg-white/80 p-4">
        <div className="mb-3 flex items-center gap-2 font-bold text-cocoa">
          <ClipboardCheck className="h-5 w-5" aria-hidden="true" />
          시설 점검사항
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <WorkerTimeInput
            label="첫 출근자"
            nameLabel="첫 출근자 이름"
            nameValue={draft.firstWorker}
            timeLabel="첫 출근자 출근시간"
            timeValue={draft.firstWorkerTime}
            onNameChange={(value) => updateDraft("firstWorker", value)}
            onTimeChange={(value) => updateDraft("firstWorkerTime", value)}
          />
          <WorkerTimeInput
            label="최종퇴근자"
            nameLabel="최종퇴근자 이름"
            nameValue={draft.lastWorker}
            timeLabel="최종퇴근자 퇴근시간"
            timeValue={draft.lastWorkerTime}
            onNameChange={(value) => updateDraft("lastWorker", value)}
            onTimeChange={(value) => updateDraft("lastWorkerTime", value)}
          />
          <TextInput
            label="위생 점검자"
            value={draft.hygieneChecker}
            onChange={(value) => updateDraft("hygieneChecker", value)}
          />
          <TextInput
            label="최종 점검자"
            value={draft.finalChecker}
            onChange={(value) => updateDraft("finalChecker", value)}
          />
        </div>
      </div>
    </div>
  );
}

function WorkerTimeInput({
  label,
  nameLabel,
  nameValue,
  timeLabel,
  timeValue,
  onNameChange,
  onTimeChange
}: {
  label: string;
  nameLabel: string;
  nameValue: string;
  timeLabel: string;
  timeValue: string;
  onNameChange: (value: string) => void;
  onTimeChange: (value: string) => void;
}) {
  return (
    <label className="grid min-w-0 gap-2">
      <span className="field-label">{label}</span>
      <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_8rem] gap-2 rounded-control border border-latte bg-white p-1.5">
        <input
          aria-label={nameLabel}
          className="min-w-0 rounded-control bg-transparent px-2 outline-none focus:bg-cream/70"
          placeholder="이름"
          value={nameValue}
          onChange={(event) => onNameChange(event.target.value)}
        />
        <input
          aria-label={timeLabel}
          className="min-w-0 rounded-control bg-transparent px-2 outline-none focus:bg-cream/70"
          type="time"
          value={timeValue}
          onChange={(event) => onTimeChange(event.target.value)}
        />
      </div>
    </label>
  );
}

function TextInput({
  label,
  value,
  onChange,
  type = "text",
  suffix
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  suffix?: string;
}) {
  const isNumeric = type === "number";
  return (
    <label className="grid min-w-0 gap-2">
      <span className="field-label">{label}</span>
      <div className="flex min-w-0 items-center gap-2">
        <input
          aria-label={label}
          className="input min-w-0 w-full"
          inputMode={isNumeric ? "numeric" : undefined}
          type={isNumeric ? "text" : type}
          value={value}
          onFocus={isNumeric ? (event) => event.currentTarget.select() : undefined}
          onChange={(event) => onChange(event.target.value)}
        />
        {suffix ? <span className="text-sm font-bold text-muted">{suffix}</span> : null}
      </div>
    </label>
  );
}

function TextArea({
  label,
  value,
  onChange,
  className = "",
  textareaClassName = "min-h-28"
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  className?: string;
  textareaClassName?: string;
}) {
  return (
    <label className={["grid gap-2", className].filter(Boolean).join(" ")}>
      <span className="field-label">{label}</span>
      <textarea
        className={["input resize-y", textareaClassName].join(" ")}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}
