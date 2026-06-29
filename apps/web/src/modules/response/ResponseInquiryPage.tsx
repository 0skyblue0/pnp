import { BarChart3, ListFilter } from "lucide-react";
import { useMemo } from "react";
import { useSearchParams } from "react-router-dom";

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
  { value: "stats", label: "통계", icon: BarChart3 },
  { value: "detail", label: "상세 조회", icon: ListFilter }
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
      <section className="panel mx-auto w-full max-w-7xl min-w-0">
        <div className="panel-heading">
          <div>
            <p className="text-sm text-muted">고객 반응</p>
            <h2 className="section-title">손님 반응</h2>
            <p className="mt-1 text-sm text-muted">
              매일 들은 손님 반응을 입력하고, 월별·주별 보고에서 분류 비율을 확인합니다.
            </p>
          </div>
        </div>

        <div aria-label="손님 반응 화면 선택" className="flex flex-wrap gap-2" role="tablist">
          {([
            ["entry", "입력"],
            ["lookup", "조회"]
          ] as Array<[ResponseMode, string]>).map(([mode, label]) => (
            <button
              key={mode}
              aria-selected={activeMode === mode}
              className={[
                "inline-flex min-h-11 items-center rounded-control border px-5 text-sm font-bold transition",
                activeMode === mode
                  ? "border-cocoa bg-cocoa text-white shadow-control"
                  : "border-latte bg-white text-cocoa hover:border-bread"
              ].join(" ")}
              role="tab"
              type="button"
              onClick={() => handleModeChange(mode)}
            >
              {label}
            </button>
          ))}
        </div>

        {activeMode === "lookup" ? (
          <div aria-label="조회 유형" className="mt-4 flex flex-wrap gap-2" role="tablist">
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
                    ? "border-stone-900 bg-stone-900 text-white"
                    : "border-stone-300 bg-white text-stone-800 hover:bg-stone-100"
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
        <ResponseEntryPage embedded />
      ) : (
        <div
          aria-labelledby={tabIds[activeTab].tab}
          id={tabIds[activeTab].panel}
          role="tabpanel"
        >
          {activeTab === "stats" ? <StatisticsPage /> : <ResponseListPage />}
        </div>
      )}
    </div>
  );
}
