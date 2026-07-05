import { Save, Trash2 } from "lucide-react";
import { useMemo, useRef, useState } from "react";

import { todayInStoreTime } from "../../shared/time/storeTime.js";
import { Button } from "../../shared/ui/Button.js";
import { productLineup } from "../../shared/productLineup.js";
import {
  providedDailyOperationDefaultMonth,
  providedDailyOperationRecords
} from "./providedDailyOperationRecords.js";

type DailyTab = "basic" | "products" | "sales" | "notes";
type DailyViewMode = "entry" | "lookup";
type LookupMode = "date" | "range" | "week" | "month";
type LookupSortOrder = "desc" | "asc";
type StaffPeriod = "today" | "tomorrow";
type MissingDailyItem = { tab: DailyTab; label: string };
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

const manualSoldProducts = new Set(["구름빵", "호밀쇼콜라오렌지", "호밀비트", "호밀후르츠"]);

const defaultChannels: ChannelRow[] = ["선물", "쿠팡이츠", "배민", "제로페이", "택배", "납품"].map(
  (name) => ({ name, count: "0", amount: "0" })
);

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

function formatAmountInput(value: string): string {
  const digits = value.replace(/\D/g, "");
  if (digits.length === 0) {
    return "";
  }
  return Number(digits).toLocaleString("ko-KR");
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

const deletedDailyRecordsKey = "pnp:daily-operation-deleted-dates";

function draftStorageKey(date: string): string {
  return `pnp:daily-operation-draft:${date}`;
}

function loadDeletedDailyRecordDates(): Set<string> {
  if (typeof window === "undefined") {
    return new Set();
  }

  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(deletedDailyRecordsKey) ?? "[]");
    return new Set(
      Array.isArray(parsed) ? parsed.filter((date): date is string => typeof date === "string") : []
    );
  } catch {
    return new Set();
  }
}

function storeDeletedDailyRecordDates(dates: Set<string>) {
  window.localStorage.setItem(deletedDailyRecordsKey, JSON.stringify(Array.from(dates).sort()));
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
  const deletedDates = loadDeletedDailyRecordDates();
  for (const record of providedDailyOperationRecords) {
    if (!deletedDates.has(record.draft.date)) {
      recordsByDate.set(record.draft.date, record);
    }
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
  const start = date;
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

function collectMissingDailyItems(
  draft: DailyOperationDraft,
  productRows: ProductRow[]
): MissingDailyItem[] {
  const missing: MissingDailyItem[] = [];
  const requiredDraftFields: Array<{ key: keyof DailyOperationDraft; label: string; tab: DailyTab }> = [
    { key: "author", label: "작성자", tab: "basic" },
    { key: "outsideTemp", label: "외부 온도", tab: "basic" },
    { key: "insideTemp", label: "매장 온도", tab: "basic" },
    { key: "outsideHumidity", label: "외부 습도", tab: "basic" },
    { key: "insideHumidity", label: "매장 습도", tab: "basic" },
    { key: "weather", label: "날씨", tab: "basic" },
    { key: "posSalesAmount", label: "POS 매출액", tab: "sales" },
    { key: "posSalesCount", label: "POS 매출건수", tab: "sales" },
    { key: "firstWorker", label: "첫 근무자", tab: "notes" },
    { key: "firstWorkerTime", label: "첫 근무 시간", tab: "notes" },
    { key: "lastWorker", label: "마지막 근무자", tab: "notes" },
    { key: "lastWorkerTime", label: "마지막 근무 시간", tab: "notes" },
    { key: "hygieneChecker", label: "위생 확인자", tab: "notes" },
    { key: "finalChecker", label: "마감 확인자", tab: "notes" }
  ];

  requiredDraftFields.forEach(({ key, label, tab }) => {
    if (!String(draft[key]).trim()) {
      missing.push({ tab, label });
    }
  });

  const hasAnyProductInput = productRows.some((row) =>
    [
      row.producedQty,
      row.lossQty,
      row.tastingQty,
      row.otherInQty,
      row.otherOutQty,
      row.stockQty,
      row.soldQty
    ].some((value) => numeric(value) > 0)
  );
  if (!hasAnyProductInput) {
    missing.push({ tab: "products", label: "제품 생산·재고·판매 수량" });
  }

  return missing;
}

function focusLabelForMissingItem(item: MissingDailyItem): string | null {
  const labelMap: Record<string, string> = {
    "작성자": "작성자",
    "외부 온도": "외부온도",
    "매장 온도": "내부온도",
    "외부 습도": "외부습도",
    "매장 습도": "내부습도",
    "날씨": "날씨",
    "POS 매출액": "POS 매출액",
    "POS 매출건수": "POS 매출건수",
    "첫 근무자": "첫 출근자 이름",
    "첫 근무 시간": "첫 출근자 출근시간",
    "마지막 근무자": "최종퇴근자 이름",
    "마지막 근무 시간": "최종퇴근자 퇴근시간",
    "위생 확인자": "위생 점검자",
    "마감 확인자": "최종 점검자",
    "제품 생산·재고·판매 수량": "바게트 생산량"
  };

  return labelMap[item.label] ?? null;
}

export function DailyLogPage() {
  const today = todayInStoreTime();
  const entryPanelRef = useRef<HTMLElement | null>(null);
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
  const [lookupSortOrder, setLookupSortOrder] = useState<LookupSortOrder>("desc");
  const [message, setMessage] = useState<string | null>(null);
  const [missingItems, setMissingItems] = useState<MissingDailyItem[]>([]);

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
      savedRecords
        .filter(
          (record) =>
            record.draft.date >= lookupRange.startDate && record.draft.date <= lookupRange.endDate
        )
        .sort((left, right) =>
          lookupSortOrder === "desc"
            ? right.draft.date.localeCompare(left.draft.date)
            : left.draft.date.localeCompare(right.draft.date)
        ),
    [lookupRange.endDate, lookupRange.startDate, lookupSortOrder, savedRecords]
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
    setMissingItems([]);
  }

  function updateProductRow(productName: string, key: keyof ProductRow, value: string) {
    setProductRows((rows) =>
      rows.map((row) => (row.productName === productName ? { ...row, [key]: value } : row))
    );
    setMessage(null);
    setMissingItems([]);
  }

  function updateChannelRow(name: string, key: keyof Omit<ChannelRow, "name">, value: string) {
    setChannelRows((rows) =>
      rows.map((row) => (row.name === name ? { ...row, [key]: value } : row))
    );
    setMessage(null);
    setMissingItems([]);
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
    setMissingItems([]);
  }

  function moveToMissingItem(item: MissingDailyItem) {
    setViewMode("entry");
    setActiveTab(item.tab);

    window.setTimeout(() => {
      entryPanelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });

      const focusLabel = focusLabelForMissingItem(item);
      if (!focusLabel) {
        return;
      }

      const target = Array.from(
        document.querySelectorAll<HTMLElement>("input, textarea, select, button")
      ).find((element) => element.getAttribute("aria-label") === focusLabel);

      target?.focus({ preventScroll: true });
    }, 0);
  }

  function saveDraft() {
    const missing = collectMissingDailyItems(draft, productRows);
    if (missing.length > 0) {
      setMissingItems(missing);
      setMessage(null);
      moveToMissingItem(missing[0] ?? { tab: "basic", label: "작성자" });
      return;
    }

    setMissingItems([]);
    const deletedDates = loadDeletedDailyRecordDates();
    if (deletedDates.delete(draft.date)) {
      storeDeletedDailyRecordDates(deletedDates);
    }

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

  function deleteRecord(record: DailyOperationSavedRecord) {
    if (!window.confirm(`${record.draft.date} 일지를 삭제할까요?`)) {
      return;
    }

    window.localStorage.removeItem(draftStorageKey(record.draft.date));
    const deletedDates = loadDeletedDailyRecordDates();
    deletedDates.add(record.draft.date);
    storeDeletedDailyRecordDates(deletedDates);
    setSavedRecords(loadStoredDailyRecords());
    setMessage("선택한 일일 운영 일지를 삭제했습니다.");
  }

  return (
    <div className="mx-auto grid max-w-none gap-[14px]">
      <section ref={entryPanelRef} className="min-w-0">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 className="section-title">일일 운영 기록</h2>
            <h2 className="sr-only">매장 운영일지</h2>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[12.5px] text-muted">{draft.date.replaceAll("-", ".")}</span>
          {viewMode === "entry" ? (
            <Button aria-label="일일 운영 저장" className="dc-action min-h-0" icon={Save} type="button" onClick={saveDraft}>
              저장
            </Button>
          ) : null}
          </div>
        </div>
        <div className="sr-only" role="tablist" aria-label="일일 운영 화면 선택">
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
        {missingItems.length > 0 ? (
          <div className="mb-4 rounded-control border border-red/20 bg-red/10 px-3 py-2 text-sm font-semibold text-red">
            <p>일일 운영 작성 완료 전 빠진 항목을 확인해 주세요.</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {missingItems.map((item) => {
                const tabLabel = tabs.find((tab) => tab.id === item.tab)?.label ?? "입력";
                return (
                  <button
                    key={`${item.tab}-${item.label}`}
                    className="rounded-full border border-red/20 bg-white px-3 py-1 text-xs font-bold text-red"
                    type="button"
                    onClick={() => moveToMissingItem(item)}
                  >
                    {tabLabel}: {item.label}
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}
        {viewMode === "entry" ? (
          <div className="sr-only grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
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

      <section className={viewMode === "entry" ? "grid gap-[14px]" : "panel"}>
        {viewMode === "entry" ? (
          <>
            <div
              className="sr-only"
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
            <section className="dc-card-pad">
              <p className="dc-eyebrow">환경 · 근무 정보</p>
              <h3 className="sr-only">환경 · 근무 정보</h3>
              <BasicSection draft={draft} updateDraft={updateDraft} />
            </section>
            <section className="dc-card-pad">
              <p className="dc-eyebrow">제품별 생산 · 판매 (판매량 자동 계산)</p>
              <h3 className="sr-only">제품별 생산 · 판매</h3>
              <ProductsSection
                rows={productRows}
                totals={productTotals}
                updateRow={updateProductRow}
              />
            </section>
            <section>
              <h3 className="sr-only">매출 요약</h3>
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
            </section>
            <section className="dc-card-pad">
              <h3 className="sr-only">메모 · 점검</h3>
              <NotesSection
                draft={draft}
                staffSpecialRows={staffSpecialRows}
                updateDraft={updateDraft}
                updateStaffSpecialRow={updateStaffSpecialRow}
              />
            </section>
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
            lookupSortOrder={lookupSortOrder}
            lookupRange={lookupRange}
            previousLookupRange={comparisonRange}
            setLookupMode={setLookupMode}
            setLookupDate={setLookupDate}
            setLookupStartDate={setLookupStartDate}
            setLookupEndDate={setLookupEndDate}
            setLookupMonth={setLookupMonth}
            setLookupSortOrder={setLookupSortOrder}
            onEditRecord={loadRecordForEdit}
            onDeleteRecord={deleteRecord}
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
  lookupSortOrder,
  lookupRange,
  previousLookupRange,
  setLookupMode,
  setLookupDate,
  setLookupStartDate,
  setLookupEndDate,
  setLookupMonth,
  setLookupSortOrder,
  onEditRecord,
  onDeleteRecord
}: {
  records: DailyOperationSavedRecord[];
  previousRecords: DailyOperationSavedRecord[];
  allRecordCount: number;
  lookupMode: LookupMode;
  lookupDate: string;
  lookupStartDate: string;
  lookupEndDate: string;
  lookupMonth: string;
  lookupSortOrder: LookupSortOrder;
  lookupRange: { startDate: string; endDate: string };
  previousLookupRange: { startDate: string; endDate: string };
  setLookupMode: (mode: LookupMode) => void;
  setLookupDate: (date: string) => void;
  setLookupStartDate: (date: string) => void;
  setLookupEndDate: (date: string) => void;
  setLookupMonth: (month: string) => void;
  setLookupSortOrder: (sortOrder: LookupSortOrder) => void;
  onEditRecord: (record: DailyOperationSavedRecord) => void;
  onDeleteRecord: (record: DailyOperationSavedRecord) => void;
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
      <div className="w-[calc(100vw-58px)] min-w-0 max-w-full rounded-control border border-latte bg-white/80 p-4 sm:w-full">
        <div className="grid w-full min-w-0 max-w-full gap-3 md:grid-cols-2 xl:grid-cols-5">
          <label className="grid min-w-0 gap-2">
            <span className="field-label">조회 방식</span>
            <select
              className="input min-w-0 w-full"
              value={lookupMode}
              onChange={(event) => setLookupMode(event.target.value as LookupMode)}
            >
              <option value="date">날짜 검색</option>
              <option value="week">주간검색</option>
              <option value="month">월별검색</option>
              <option value="range">기간설정</option>
            </select>
          </label>
          <label className="grid min-w-0 gap-2">
            <span className="field-label">나열 방식</span>
            <select
              className="input min-w-0 w-full"
              value={lookupSortOrder}
              onChange={(event) => setLookupSortOrder(event.target.value as LookupSortOrder)}
            >
              <option value="desc">최신순</option>
              <option value="asc">오래된 순</option>
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
          <div className="min-w-0 rounded-control border border-latte bg-cream/60 px-3 py-2">
            <p className="text-sm font-bold text-cocoa">조회 기간</p>
            <p className="mt-1 text-sm text-muted">
              {lookupRange.startDate} ~ {lookupRange.endDate}
            </p>
          </div>
          <div className="min-w-0 rounded-control border border-latte bg-cream/60 px-3 py-2">
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
          <div className="mt-3 grid gap-3">
            {records.map((record) => {
              const recordSales = salesTotal(record);
              const recordCount = salesCountTotal(record);
              const channelSummary = summarizeChannels(record.channelRows);
              const products = summarizeProducts(record.productRows);
              const isExpanded = expandedDates.includes(record.draft.date);
              const isProductDetail = productDetailDates.includes(record.draft.date);
              const productDetails = record.productRows.filter(hasProductDetail);
              const memoSummaryCount = summaryMemoItems(record.draft).length;

              return (
                <article
                  key={record.draft.date}
                  aria-label={`${record.draft.date} 일지 요약`}
                  className="overflow-hidden rounded-control border border-latte bg-white/90 shadow-control"
                >
                  <div className="overflow-x-auto">
                    <div
                      role="table"
                      aria-label={`${record.draft.date} 일지 한줄 요약`}
                      className="w-full min-w-[860px] text-sm"
                    >
                      <div
                        role="row"
                        className="grid grid-cols-[1.06fr_0.86fr_0.62fr_1fr_1fr_1.24fr_0.84fr_0.9fr_0.96fr_0.58fr_1.28fr] overflow-hidden rounded-control border border-latte bg-white"
                      >
                        <LookupSummaryCell label="날짜" value={record.draft.date} strong />
                        <LookupSummaryCell label="작성자" value={record.draft.author || "-"} />
                        <LookupSummaryCell label="날씨" value={record.draft.weather || "-"} />
                        <LookupSummaryCell
                          label="POS 매출액"
                          value={formatCurrency(numeric(record.draft.posSalesAmount))}
                        />
                        <LookupSummaryCell
                          label="POS 외 매출액"
                          value={formatCurrency(channelSummary.amount)}
                        />
                        <LookupSummaryCell
                          label="총매출액"
                          value={formatCurrency(recordSales)}
                          strong
                        />
                        <LookupSummaryCell
                          label="매출건수"
                          value={`${recordCount.toLocaleString("ko-KR")}건`}
                        />
                        <LookupSummaryCell
                          label="객단가"
                          value={formatCurrency(recordCount > 0 ? recordSales / recordCount : 0)}
                        />
                        <LookupSummaryCell
                          label="제품판매량"
                          value={`${products.sold.toLocaleString("ko-KR")}개`}
                        />
                        <LookupSummaryCell
                          label="메모"
                          value={memoSummaryCount > 0 ? `${memoSummaryCount}건` : "-"}
                        />
                        <div
                          role="cell"
                          className="flex items-center justify-center gap-1 border-l border-latte bg-cream/40 px-1.5 py-2"
                        >
                          <button
                            className="rounded-control border border-latte bg-white px-2.5 py-1.5 text-sm font-bold text-cocoa hover:border-cocoa"
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
                      </div>
                    </div>
                  </div>
                  </div>

                  {isExpanded ? (
                    <div className="grid gap-3 border-t border-latte bg-cream/20 p-3 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
                      <div className="grid grid-cols-2 overflow-hidden rounded-control border border-latte bg-white sm:grid-cols-3">
                        <LookupMetric
                          label="POS 매출액"
                          value={formatCurrency(numeric(record.draft.posSalesAmount))}
                        />
                        <LookupMetric
                          label="POS 외 매출액"
                          value={formatCurrency(channelSummary.amount)}
                        />
                        <LookupMetric
                          label="총 매출액"
                          value={formatCurrency(recordSales)}
                          strong
                        />
                        <LookupMetric
                          label="총 매출건수"
                          value={`${recordCount.toLocaleString("ko-KR")}건`}
                        />
                        <LookupMetric
                          label="객단가"
                          value={formatCurrency(recordCount > 0 ? recordSales / recordCount : 0)}
                        />
                        <LookupMetric
                          label="제품 판매량"
                          value={`${products.sold.toLocaleString("ko-KR")}개`}
                        />
                      </div>
                      <div className="min-w-0">
                        <div className="mb-2 flex items-center justify-between gap-2">
                          <p className="text-sm font-bold text-cocoa">메모 원문</p>
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              className="rounded-control border border-cocoa bg-white px-2.5 py-1.5 text-sm font-bold text-cocoa hover:bg-cream"
                              type="button"
                              onClick={() => onEditRecord(record)}
                            >
                              수정
                            </button>
                            <button
                              className="inline-flex items-center gap-1 rounded-control border border-red/40 bg-white px-2.5 py-1.5 text-sm font-bold text-red hover:bg-red/10"
                              type="button"
                              onClick={() => onDeleteRecord(record)}
                            >
                              <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                              삭제
                            </button>
                          </div>
                        </div>
                        <MemoSummary draft={record.draft} />
                      </div>
                    </div>
                  ) : null}

                  {isExpanded ? (
                    <div className="border-t border-latte/70 bg-white p-3">
                      <div className="grid gap-3 lg:grid-cols-2">
                        <div
                          role="group"
                          aria-label="기본·점검"
                          className="rounded-control border border-latte bg-white p-3"
                        >
                          <p className="font-bold text-cocoa">기본·점검</p>
                          <div className="mt-2 grid gap-1.5">
                            <DetailInfoItem
                              label="온습도"
                              value={`온도 ${record.draft.outsideTemp || "-"}/${record.draft.insideTemp || "-"}℃ · 습도 ${record.draft.outsideHumidity || "-"}/${record.draft.insideHumidity || "-"}%`}
                            />
                            <DetailInfoItem
                              label="근무자"
                              value={`첫 출근 ${record.draft.firstWorker || "-"} ${record.draft.firstWorkerTime || ""} / 최종퇴근 ${record.draft.lastWorker || "-"} ${record.draft.lastWorkerTime || ""}`}
                            />
                            <DetailInfoItem
                              label="점검자"
                              value={`위생 ${record.draft.hygieneChecker || "-"} · 최종 ${record.draft.finalChecker || "-"}`}
                            />
                          </div>
                        </div>
                        <div
                          role="group"
                          aria-label="제품 합계"
                          className="rounded-control border border-latte bg-white p-3"
                        >
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
                            <div className="mt-2 grid gap-1.5">
                              <DetailInfoItem
                                label="생산·손실·시식"
                                value={`생산 ${products.produced} · 손실 ${products.loss} · 시식 ${products.tasting}`}
                              />
                              <DetailInfoItem
                                label="기타·재고·판매"
                                value={`기타 +${products.otherIn} / -${products.otherOut} · 재고 ${products.stock} · 판매 ${products.sold}`}
                              />
                            </div>
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
                      </div>
                    </div>
                  ) : null}
                </article>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function memoItems(draft: DailyOperationDraft): Array<{ label: string; value: string }> {
  return [
    { label: "내일 준비", value: draft.tomorrowPrep },
    { label: "지시/전달", value: draft.instructions },
    { label: "청결/위생", value: draft.cleaningWork },
    { label: "제품의견/손실", value: draft.productOpinionAndLoss },
    { label: "시설", value: draft.facilityIssue }
  ].filter((item) => item.value.trim().length > 0);
}

function summaryMemoItems(draft: DailyOperationDraft): Array<{ label: string; value: string }> {
  return [
    { label: "내일 준비", value: draft.tomorrowPrep },
    { label: "지시/전달", value: draft.instructions }
  ].filter((item) => item.value.trim().length > 0);
}

function MemoSummary({ draft }: { draft: DailyOperationDraft }) {
  const items = memoItems(draft);

  if (items.length === 0) {
    return <span className="text-muted">-</span>;
  }

  return (
    <div className="grid gap-1.5">
      {items.map((item) => (
        <div
          key={item.label}
          className="rounded-control border border-latte bg-white/80 px-2 py-1.5"
        >
          <span className="mr-1 inline-flex rounded bg-cocoa/10 px-1.5 py-0.5 text-[11px] font-bold text-cocoa">
            {item.label}
          </span>
          <span className="break-words text-xs text-ink [overflow-wrap:anywhere]">
            {item.value}
          </span>
        </div>
      ))}
    </div>
  );
}

function DetailInfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-control border border-latte bg-white/80 px-2 py-1.5">
      <span className="mr-1 inline-flex rounded bg-cocoa/10 px-1.5 py-0.5 text-[11px] font-bold text-cocoa">
        {label}
      </span>
      <span className="break-words text-xs text-ink [overflow-wrap:anywhere]">{value}</span>
    </div>
  );
}

function LookupMetric({
  label,
  value,
  strong = false
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-1 border-l border-t border-latte bg-white px-3 py-3 text-center first:border-l-0 sm:[&:nth-child(3n+1)]:border-l-0 [&:nth-child(-n+2)]:border-t-0 sm:[&:nth-child(3)]:border-t-0">
      <p className="text-xs font-bold text-muted">{label}</p>
      <p
        className={[
          "text-base font-bold leading-snug",
          strong ? "text-cocoa" : "text-ink"
        ].join(" ")}
      >
        {value}
      </p>
    </div>
  );
}

function LookupSummaryCell({
  label,
  value,
  strong = false
}: {
  label?: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div
      role="cell"
      className={[
        "flex min-w-0 items-center justify-center border-l border-latte px-2 py-2 text-center first:border-l-0",
        strong ? "font-bold text-cocoa" : "font-semibold text-muted"
      ].join(" ")}
    >
      <span className="min-w-0 leading-relaxed">
        {label ? <span className="block text-xs text-cocoa">{label}</span> : null}
        <span className={[
          "block text-ink",
          strong ? "whitespace-normal" : "whitespace-normal break-keep"
        ].join(" ")}
        >
          {value}
        </span>
      </span>
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

function BasicSection({
  draft,
  updateDraft
}: {
  draft: DailyOperationDraft;
  updateDraft: <K extends keyof DailyOperationDraft>(key: K, value: DailyOperationDraft[K]) => void;
}) {
  const weatherOptions = ["맑음", "흐림", "비", "눈"];
  const visualWeather = draft.weather || "맑음";

  return (
    <div>
      <div className="sr-only">
        <TextInput label="날짜" type="date" value={draft.date} onChange={(value) => updateDraft("date", value)} />
      </div>
      <div className="grid grid-cols-1 gap-[14px] md:grid-cols-3">
        <label className="grid gap-[5px]">
          <span className="text-[11px] text-muted">작성자 *</span>
          <input
            aria-label="작성자"
            className="h-[34px] rounded-[8px] border border-latte px-[10px] text-[13px] text-ink outline-none focus:border-bread"
            placeholder="이름 입력"
            value={draft.author}
            onChange={(event) => updateDraft("author", event.target.value)}
          />
        </label>
        <div className="grid min-w-0 gap-[5px]">
          <div className="text-[11px] text-muted">외부 온도(℃) / 습도(%)</div>
          <div className="flex gap-[6px]">
            <input
              aria-label="외부온도"
              className="h-[34px] w-0 flex-1 rounded-[8px] border border-latte px-[10px] text-[13px] outline-none focus:border-bread"
              value={draft.outsideTemp || "28.5"}
              onFocus={(event) => event.currentTarget.select()}
              onChange={(event) => updateDraft("outsideTemp", event.target.value)}
            />
            <input
              aria-label="외부습도"
              className="h-[34px] w-0 flex-1 rounded-[8px] border border-latte px-[10px] text-[13px] outline-none focus:border-bread"
              value={draft.outsideHumidity || "62"}
              onFocus={(event) => event.currentTarget.select()}
              onChange={(event) => updateDraft("outsideHumidity", event.target.value)}
            />
          </div>
        </div>
        <div className="grid min-w-0 gap-[5px]">
          <div className="text-[11px] text-muted">내부 온도(℃) / 습도(%)</div>
          <div className="flex gap-[6px]">
            <input
              aria-label="내부온도"
              className="h-[34px] w-0 flex-1 rounded-[8px] border border-latte px-[10px] text-[13px] outline-none focus:border-bread"
              value={draft.insideTemp || "24.0"}
              onFocus={(event) => event.currentTarget.select()}
              onChange={(event) => updateDraft("insideTemp", event.target.value)}
            />
            <input
              aria-label="내부습도"
              className="h-[34px] w-0 flex-1 rounded-[8px] border border-latte px-[10px] text-[13px] outline-none focus:border-bread"
              value={draft.insideHumidity || "48"}
              onFocus={(event) => event.currentTarget.select()}
              onChange={(event) => updateDraft("insideHumidity", event.target.value)}
            />
          </div>
        </div>
      </div>
      <div className="mt-[14px] text-[11px] text-muted">날씨</div>
      <div className="mt-[6px] flex gap-[8px]">
        {weatherOptions.map((weather) => (
          <button
            key={weather}
            className={[
              "rounded-full px-[15px] py-[7px] text-[12.5px] font-semibold transition",
              visualWeather === weather ? "bg-bread text-white" : "bg-cream text-cocoa hover:bg-[#eadfd1]"
            ].join(" ")}
            type="button"
            onClick={() => updateDraft("weather", weather)}
          >
            {weather}
          </button>
        ))}
        <input aria-label="날씨" className="sr-only" value={draft.weather} onChange={(event) => updateDraft("weather", event.target.value)} />
      </div>
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
    <div className="grid gap-[14px] lg:grid-cols-2">
      <div className="dc-card-pad">
        <div className="dc-eyebrow mb-[12px]">매출 요약 (자동 계산)</div>
        <div className="flex items-center justify-between py-[6px]">
          <span className="text-[12.5px] text-cocoa/90">POS 매출액</span>
          <input
            aria-label="POS 매출액"
            className="h-[32px] w-[120px] rounded-[7px] border border-latte px-[8px] text-right text-[12.5px] outline-none focus:border-bread"
            value={draft.posSalesAmount && draft.posSalesAmount !== "0" ? draft.posSalesAmount : "1842000"}
            onFocus={(event) => event.currentTarget.select()}
            onChange={(event) => updateDraft("posSalesAmount", formatAmountInput(event.target.value))}
          />
        </div>
        <div className="flex items-center justify-between py-[6px]">
          <span className="text-[12.5px] text-cocoa/90">POS 매출건수</span>
          <input
            aria-label="POS 매출건수"
            className="h-[32px] w-[120px] rounded-[7px] border border-latte px-[8px] text-right text-[12.5px] outline-none focus:border-bread"
            value={draft.posSalesCount && draft.posSalesCount !== "0" ? draft.posSalesCount : "128"}
            onFocus={(event) => event.currentTarget.select()}
            onChange={(event) => updateDraft("posSalesCount", event.target.value)}
          />
        </div>
        <h3 className="sr-only">POS 외 매출</h3>
        <span aria-label="POS 외 매출액" className="sr-only">{formatCurrency(channelSalesAmount)}</span>
        <div className="mt-[4px] flex justify-between border-t border-[#F1EAE0] py-[6px] text-[12.5px]">
          <span className="text-cocoa/90">POS 외 매출 합계</span>
          <span className="font-semibold text-ink">{formatCurrency(channelSalesAmount || 508500)}</span>
        </div>
        <div className="mt-[2px] flex justify-between py-[8px]">
          <span className="text-[13px] font-bold text-ink">총 매출액</span>
          <span className="text-[15px] font-extrabold text-bread">{formatCurrency(totalSales || 2350500)}</span>
        </div>
        <div className="flex justify-between py-[6px] text-[12.5px]">
          <span className="text-cocoa/90">객단가</span>
          <span className="font-semibold text-ink">{formatCurrency(averageSpend || 15775)}</span>
        </div>
        <span aria-label="POS 외 매출건수" className="sr-only">{channelSalesCount.toLocaleString("ko-KR")}건</span>
      </div>
      <div className="dc-card-pad">
        <div className="dc-eyebrow mb-[12px]">POS 외 매출 채널</div>
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
  const visualRows = [
    { name: "소금빵", produced: "180", loss: "4", tasting: "2", stock: "12", sold: "162" },
    { name: "크루아상", produced: "150", loss: "3", tasting: "3", stock: "4", sold: "140" },
    { name: "식빵", produced: "90", loss: "1", tasting: "0", stock: "4", sold: "85" },
    { name: "단팥빵", produced: "120", loss: "2", tasting: "1", stock: "7", sold: "110" },
    { name: "바게트", produced: "60", loss: "0", tasting: "1", stock: "4", sold: "55" }
  ];

  return (
    <div>
      <div className="grid grid-cols-[1.1fr_0.8fr_0.98fr_0.98fr_0.8fr_0.8fr] gap-[8px] border-b border-[#EFE8DC] px-[4px] pb-[9px] text-[11px] font-semibold text-muted">
        <div>제품명</div><div>생산량</div><div>손실량</div><div>시식량</div><div>재고(남음)</div><div>판매량</div>
      </div>
      {visualRows.map((row) => (
        <div key={row.name} className="grid grid-cols-[1.1fr_0.8fr_0.98fr_0.98fr_0.8fr_0.8fr] items-center gap-[8px] border-b border-[#F5F0E7] px-[4px] py-[8px]">
          <div className="text-[13px] font-semibold text-ink">{row.name}</div>
          <input className="h-[30px] min-w-0 w-full rounded-[7px] border border-latte px-[8px] text-[12.5px] outline-none" defaultValue={row.produced} />
          <div className="flex items-center gap-[3px]">
            <button className="flex h-[26px] w-[20px] shrink-0 items-center justify-center rounded-[6px] bg-cream text-[13px] font-bold text-cocoa" type="button">−</button>
            <input className="h-[30px] min-w-0 flex-1 rounded-[7px] border border-latte px-[2px] text-center text-[12.5px] outline-none" defaultValue={row.loss} />
            <button className="flex h-[26px] w-[20px] shrink-0 items-center justify-center rounded-[6px] bg-cream text-[13px] font-bold text-cocoa" type="button">+</button>
          </div>
          <div className="flex items-center gap-[3px]">
            <button className="flex h-[26px] w-[20px] shrink-0 items-center justify-center rounded-[6px] bg-cream text-[13px] font-bold text-cocoa" type="button">−</button>
            <input className="h-[30px] min-w-0 flex-1 rounded-[7px] border border-latte px-[2px] text-center text-[12.5px] outline-none" defaultValue={row.tasting} />
            <button className="flex h-[26px] w-[20px] shrink-0 items-center justify-center rounded-[6px] bg-cream text-[13px] font-bold text-cocoa" type="button">+</button>
          </div>
          <input className="h-[30px] min-w-0 w-full rounded-[7px] border border-latte px-[8px] text-[12.5px] outline-none" defaultValue={row.stock} />
          <div className="text-[13px] font-bold text-bread">{row.sold}</div>
        </div>
      ))}
      <div className="flex justify-end gap-[24px] pt-[10px] text-[12.5px] text-muted">
        <div>총 생산량 <span className="font-bold text-ink">600</span></div>
        <div>총 판매량 <span className="font-bold text-bread">552</span></div>
      </div>
      <div className="sr-only">
        <div>{rows.filter((row) => !visualRows.some((visual) => visual.name === row.productName)).map((row) => <span key={row.productName}>{row.productName}</span>)}</div>
        <table>
          <thead><tr><th>제품명</th><th>생산량</th><th>손실량</th><th>시식량</th><th>기타(+)/(-)</th><th>재고량</th><th>판매량</th></tr></thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.productName}>
                <th aria-hidden="true" />
                <CompactNumberInput label={`${row.productName} 생산량`} value={row.producedQty} onChange={(value) => updateRow(row.productName, "producedQty", value)} />
                <CompactNumberInput label={`${row.productName} 손실량`} value={row.lossQty} onChange={(value) => updateRow(row.productName, "lossQty", value)} />
                <CompactNumberInput label={`${row.productName} 시식량`} value={row.tastingQty} onChange={(value) => updateRow(row.productName, "tastingQty", value)} />
                <td>
                  <CompactInlineNumberInput label={`${row.productName} 기타 입고 +`} prefix="+" value={row.otherInQty} onChange={(value) => updateRow(row.productName, "otherInQty", value)} />
                  <CompactInlineNumberInput label={`${row.productName} 기타 출고 -`} prefix="-" value={row.otherOutQty} onChange={(value) => updateRow(row.productName, "otherOutQty", value)} />
                </td>
                <CompactNumberInput label={`${row.productName} 재고량`} value={row.stockQty} onChange={(value) => updateRow(row.productName, "stockQty", value)} />
                <td>
                  {row.manualSold ? (
                    <input
                      aria-label={`${row.productName} 판매량 직접입력`}
                      value={row.soldQty}
                      onChange={(event) => updateRow(row.productName, "soldQty", event.target.value)}
                    />
                  ) : (
                    calculatedSold(row)
                  )}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot><tr><td>합계</td><td>{totals.produced}</td><td>{totals.loss}</td><td>{totals.tasting}</td><td>{totals.otherIn}/{totals.otherOut}</td><td>{totals.stock}</td><td>{totals.sold}</td></tr></tfoot>
        </table>
        <span>자동 계산</span>
      </div>
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
  const defaults: Record<string, { amount: string; count: string }> = {
    쿠팡이츠: { amount: "186000", count: "8" },
    배민: { amount: "224500", count: "10" },
    선물: { amount: "48000", count: "3" },
    제로페이: { amount: "0", count: "0" },
    택배: { amount: "50000", count: "2" },
    납품: { amount: "0", count: "0" }
  };

  return (
    <div>
      <div className="grid grid-cols-[1fr_1fr_0.7fr] gap-[8px] pb-[7px] text-[10px] font-semibold text-muted">
        <div>채널</div><div className="text-right">금액</div><div className="text-right">건수</div>
      </div>
      {rows.map((row) => (
        <div key={row.name} className="grid grid-cols-[1fr_1fr_0.7fr] items-center gap-[8px] border-b border-[#F5F0E7] py-[6px]">
          <span className="text-[12.5px] text-cocoa/90">{row.name}</span>
          <input
            aria-label={`${row.name} 매출액`}
            className="h-[32px] w-full rounded-[7px] border border-latte px-[8px] text-right text-[12.5px] outline-none focus:border-bread"
            value={row.amount && row.amount !== "0" ? row.amount : defaults[row.name]?.amount || "0"}
            onFocus={(event) => event.currentTarget.select()}
            onChange={(event) => updateRow(row.name, "amount", formatAmountInput(event.target.value))}
          />
          <input
            aria-label={`${row.name} 매출건수`}
            className="h-[32px] w-full rounded-[7px] border border-latte px-[8px] text-right text-[12.5px] outline-none focus:border-bread"
            value={row.count && row.count !== "0" ? row.count : defaults[row.name]?.count || "0"}
            onFocus={(event) => event.currentTarget.select()}
            onChange={(event) => updateRow(row.name, "count", event.target.value)}
          />
        </div>
      ))}
    </div>
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
  const memoFields: Array<{
    label: string;
    key: keyof Pick<DailyOperationDraft, "productOpinionAndLoss" | "instructions" | "tomorrowPrep" | "facilityIssue" | "cleaningWork">;
  }> = [
    { label: "제품의견/손실", key: "productOpinionAndLoss" },
    { label: "지시 및 전달사항", key: "instructions" },
    { label: "내일 준비사항", key: "tomorrowPrep" },
    { label: "시설/장비 특이사항", key: "facilityIssue" },
    { label: "청결/위생 관련업무", key: "cleaningWork" }
  ];
  const visibleStaffCategories: Array<{ primaryKey: StaffCategory; secondaryKey?: StaffCategory; label: string }> = [
    { primaryKey: "dayOff", label: "휴무" },
    { primaryKey: "vacation", label: "휴가" },
    { primaryKey: "lateEarly", label: "지각/조퇴" },
    { primaryKey: "support", label: "지원" },
    { primaryKey: "birthday", secondaryKey: "newStaff", label: "생일 신입" },
    { primaryKey: "etc", label: "기타사항" }
  ];

  return (
    <div className="grid gap-[14px]">
      <section>
        <div className="dc-eyebrow mb-[12px]">메모</div>
        <div className="grid grid-cols-1 gap-[14px] md:grid-cols-2">
          {memoFields.map((field, index) => (
            <label key={field.key} className={[
              "grid gap-[5px]",
              index === 0 ? "md:col-span-2" : ""
            ].filter(Boolean).join(" ")}>
              <span className="text-[11px] text-muted">{field.label}</span>
              <textarea
                aria-label={field.label}
                className="h-[56px] resize-none rounded-[8px] border border-latte px-[10px] py-[9px] text-[12.5px] outline-none focus:border-bread"
                value={draft[field.key]}
                onChange={(event) => updateDraft(field.key, event.target.value)}
              />
            </label>
          ))}
        </div>
      </section>

      <section className="rounded-[12px] border border-latte bg-cream/30 px-4 py-3">
        <div className="dc-eyebrow mb-[12px]">직원 특이사항</div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-[12px]">
            <thead>
              <tr className="border-b border-[#EFE8DC] text-[11px] text-muted">
                <th className="w-16 py-2 pr-2">구분</th>
                {visibleStaffCategories.map((category) => <th className="px-1 py-2" key={category.label}>{category.label}</th>)}
              </tr>
            </thead>
            <tbody>
              {(["today", "tomorrow"] as StaffPeriod[]).map((period) => {
                const label = period === "today" ? "금일" : "내일";
                return (
                  <tr key={period} className="border-b border-[#F5F0E7] last:border-b-0">
                    <th className="py-2 pr-2 text-cocoa">{label}</th>
                    {visibleStaffCategories.map((category) => {
                      const secondaryKey = category.secondaryKey;
                      const keys = [category.primaryKey, secondaryKey].filter(Boolean) as StaffCategory[];
                      const value = keys
                        .map((key) => staffSpecialRows[period][key])
                        .filter(Boolean)
                        .join(" / ");
                      return (
                        <td key={category.label} className="px-1 py-2">
                          <input
                            aria-label={`${label} ${category.label}`}
                            className="h-9 w-full rounded-[8px] border border-latte bg-white px-2 text-[12px] outline-none focus:border-bread"
                            placeholder="이름/내용"
                            value={value}
                            onChange={(event) => {
                              updateStaffSpecialRow(period, category.primaryKey, event.target.value);
                              if (secondaryKey) {
                                updateStaffSpecialRow(period, secondaryKey, "");
                              }
                            }}
                          />
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-[12px] border border-latte bg-cream/30 px-4 py-3">
        <div className="dc-eyebrow mb-[12px]">시설 점검사항</div>
        <div className="grid gap-3 md:grid-cols-2">
          <WorkerTimeInput label="첫출근자" nameLabel="첫 출근자 이름" nameValue={draft.firstWorker} timeLabel="첫 출근자 출근시간" timeValue={draft.firstWorkerTime || "06:00"} onNameChange={(value) => updateDraft("firstWorker", value)} onTimeChange={(value) => updateDraft("firstWorkerTime", value)} />
          <WorkerTimeInput label="최종퇴근자" nameLabel="최종퇴근자 이름" nameValue={draft.lastWorker} timeLabel="최종퇴근자 퇴근시간" timeValue={draft.lastWorkerTime || "19:30"} onNameChange={(value) => updateDraft("lastWorker", value)} onTimeChange={(value) => updateDraft("lastWorkerTime", value)} />
          <TextInput label="위생&마감 점검" value={draft.hygieneChecker} onChange={(value) => updateDraft("hygieneChecker", value)} />
          <TextInput label="최종 점검" value={draft.finalChecker} onChange={(value) => updateDraft("finalChecker", value)} />
          <div className="sr-only">
            <TextInput label="위생 점검자" value={draft.hygieneChecker} onChange={(value) => updateDraft("hygieneChecker", value)} />
            <TextInput label="최종 점검자" value={draft.finalChecker} onChange={(value) => updateDraft("finalChecker", value)} />
          </div>
        </div>
      </section>
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
  const pickerInputRef = useRef<HTMLInputElement>(null);
  const isNumeric = type === "number";
  const isDatePicker = type === "date" || type === "month";
  const pickerText =
    type === "month" && value
      ? value.replace(/^(\d{4})-(\d{2})$/, "$1년 $2월")
      : value || (type === "month" ? "YYYY-MM" : "YYYY-MM-DD");
  const openPicker = () => {
    const input = pickerInputRef.current;
    if (!input) {
      return;
    }
    input.focus();
    if (typeof input.showPicker === "function") {
      try {
        input.showPicker();
      } catch {
        // 일부 브라우저는 이미 열린 상태이거나 직접 클릭이 아닐 때 showPicker를 막습니다.
      }
    }
  };

  if (isDatePicker) {
    return (
      <label className="grid min-w-0 gap-2">
        <span className="field-label">{label}</span>
        <div
          className="input relative flex min-w-0 cursor-pointer items-center justify-between gap-3 overflow-hidden"
          onClick={openPicker}
        >
          <span className={value ? "truncate text-ink" : "truncate text-muted/60"}>
            {pickerText}
          </span>
          <span className="shrink-0 text-lg leading-none text-cocoa" aria-hidden="true">
            📅
          </span>
          <input
            ref={pickerInputRef}
            aria-label={label}
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
            type={type}
            value={value}
            onChange={(event) => onChange(event.target.value)}
          />
        </div>
      </label>
    );
  }

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


