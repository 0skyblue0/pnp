import { BarChart3, ListFilter } from "lucide-react";
import { useMemo } from "react";
import { useSearchParams } from "react-router-dom";

import { PageHeader } from "../../shared/ui/PageHeader.js";
import { StatisticsPage } from "../statistics/StatisticsPage.js";
import { ResponseEntryPage } from "./ResponseEntryPage.js";
import { ResponseListPage } from "./ResponseListPage.js";

type ResponseMode = "entry" | "lookup";
type InquiryTab = "stats" | "detail";

const tabOptions: Array<{
  value: InquiryTab;
  label: string;
  icon: typeof BarChart3;
}> = [
  { value: "stats", label: "대표 요약", icon: BarChart3 },
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
    <div className="app-page grid gap-4">
      <section className="app-card min-w-0">
        <PageHeader title="손님 반응" description="손님 반응을 입력하고 기록을 분석합니다." actions={<div
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
                  "inline-flex min-h-11 items-center rounded-[7px] px-4 text-[12.5px] font-semibold transition motion-reduce:transition-none",
                  activeMode === mode ? "bg-bread text-white" : "text-cocoa hover:bg-cream"
                ].join(" ")}
                role="tab"
                type="button"
                onClick={() => handleModeChange(mode)}
              >
                {label}
              </button>
            ))}
          </div>} />

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
                    "inline-flex min-h-11 items-center rounded-control border px-3 text-sm font-semibold motion-reduce:transition-none",
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
        <ResponseEntryPage />
      ) : (
        <div aria-labelledby={tabIds[activeTab].tab} id={tabIds[activeTab].panel} role="tabpanel">
          {activeTab === "stats" ? <StatisticsPage /> : <ResponseListPage />}
        </div>
      )}
    </div>
  );
}
