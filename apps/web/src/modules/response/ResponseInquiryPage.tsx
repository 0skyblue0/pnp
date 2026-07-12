import { BarChart3, ListFilter } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";

import { StatisticsPage } from "../statistics/StatisticsPage.js";
import { ResponseEntryPage } from "./ResponseEntryPage.js";
import { ResponseListPage } from "./ResponseListPage.js";
import { apiGet } from "../../shared/api/client.js";
import type { ListEnvelope } from "../../shared/api/types.js";
import { criterionPathLabel, type CriterionPathItem } from "./responseCriteria.js";

type ResponseMode = "entry" | "lookup";
type InquiryTab = "stats" | "detail";

type ResponsePreviewDto = {
  id: string;
  date: string;
  criterionPath: CriterionPathItem[];
  shortSummary: string | null;
  llmAssisted: boolean;
};

const tabOptions: Array<{
  value: InquiryTab;
  label: string;
  icon: typeof BarChart3;
}> = [
  { value: "stats", label: "요약 보기", icon: BarChart3 },
  { value: "detail", label: "상세 기록", icon: ListFilter }
];

function parseTab(value: string | null): InquiryTab {
  return value === "detail" ? "detail" : "stats";
}

function parseMode(value: string | null): ResponseMode {
  return value === "lookup" ? "lookup" : "entry";
}

export function ResponseInquiryPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeMode = parseMode(searchParams.get("mode"));
  const activeTab = parseTab(searchParams.get("tab"));

  const tabIds = useMemo(
    () => ({
      stats: {
        tab: "response-inquiry-tab-stats",
        panel: "response-inquiry-panel-stats"
      },
      detail: {
        tab: "response-inquiry-tab-detail",
        panel: "response-inquiry-panel-detail"
      }
    }),
    []
  );

  const handleTabChange = (tab: InquiryTab) => {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set("mode", "lookup");

    if (tab === "stats") {
      nextParams.delete("tab");
    } else {
      nextParams.set("tab", tab);
    }

    setSearchParams(nextParams, { replace: true });
  };

  const handleModeChange = (mode: ResponseMode) => {
    const nextParams = new URLSearchParams(searchParams);

    if (mode === "entry") {
      nextParams.delete("mode");
      nextParams.delete("tab");
    } else {
      nextParams.set("mode", "lookup");
      nextParams.delete("tab");
    }

    setSearchParams(nextParams, { replace: true });
  };

  return (
    <div className="grid gap-4">
      <section className="mx-auto w-full max-w-none min-w-0">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="section-title">손님 반응</h2>
          <div
            aria-label="손님 반응 화면 선택"
            className="flex flex-wrap gap-2 rounded-control border border-latte bg-white p-1"
            role="tablist"
          >
            {(
              [
                ["entry", "반응 입력"],
                ["lookup", "반응 분석"]
              ] as Array<[ResponseMode, string]>
            ).map(([mode, label]) => (
              <button
                key={mode}
                aria-selected={activeMode === mode}
                className={[
                  "inline-flex min-h-8 items-center rounded-[7px] px-4 text-[12.5px] font-semibold transition",
                  activeMode === mode ? "bg-bread text-white" : "text-cocoa hover:bg-cream"
                ].join(" ")}
                role="tab"
                type="button"
                onClick={() => handleModeChange(mode)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {activeMode === "lookup" ? (
          <div
            aria-label="조회 유형"
            className="mb-4 flex flex-wrap gap-2 rounded-control border border-latte bg-white p-1"
            role="tablist"
          >
            {tabOptions.map((option) => {
              const Icon = option.icon;
              const isActive = activeTab === option.value;

              return (
                <button
                  key={option.value}
                  aria-controls={tabIds[option.value].panel}
                  aria-selected={isActive}
                  className={[
                    "inline-flex min-h-11 items-center rounded-control border px-3 text-sm font-semibold",
                    isActive
                      ? "border-bread bg-bread text-white"
                      : "border-transparent bg-white text-cocoa hover:bg-cream"
                  ].join(" ")}
                  id={tabIds[option.value].tab}
                  role="tab"
                  type="button"
                  onClick={() => handleTabChange(option.value)}
                >
                  <Icon className="mr-2 h-4 w-4 shrink-0" aria-hidden="true" />
                  {option.label}
                </button>
              );
            })}
          </div>
        ) : null}
      </section>

      {activeMode === "entry" ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <ResponseEntryPage embedded />
          <RecentResponsesCard />
        </div>
      ) : (
        <div aria-labelledby={tabIds[activeTab].tab} id={tabIds[activeTab].panel} role="tabpanel">
          {activeTab === "stats" ? <StatisticsPage /> : <ResponseListPage />}
        </div>
      )}
    </div>
  );
}

function RecentResponsesCard() {
  const [items, setItems] = useState<ResponsePreviewDto[]>([]);
  const [error, setError] = useState<string | null>(null);

  const loadRecent = useCallback(async () => {
    const envelope = await apiGet<ListEnvelope<ResponsePreviewDto>>("/response?size=4");
    if (envelope.error) {
      setError(envelope.error.message);
      return;
    }
    setItems(envelope.data.items.slice(0, 4));
  }, []);

  useEffect(() => {
    void loadRecent();
  }, [loadRecent]);

  return (
    <section className="panel min-w-0">
      <p className="text-sm text-muted">최근 기록 ({items.length}건)</p>
      <div className="mt-4 grid gap-3">
        {items.map((item) => (
          <article key={item.id} className="border-b border-latte pb-3 last:border-b-0">
            <p className="text-xs text-muted">
              {item.date.slice(5).replace("-", ".")} · {criterionPathLabel(item.criterionPath)}
            </p>
            <p className="mt-1 text-sm font-bold text-ink">{item.shortSummary || "요약 없음"}</p>
            <span className="mt-2 inline-flex rounded-full bg-[#F4E3D8] px-2 py-1 text-[11px] font-bold text-cocoa">
              {item.llmAssisted ? "AI 분류" : "직원 분류"}
            </span>
          </article>
        ))}
        {error ? <p className="text-sm font-semibold text-red">{error}</p> : null}
        {!error && items.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted">최근 기록 없음</p>
        ) : null}
      </div>
    </section>
  );
}
