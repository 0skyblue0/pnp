import { zodResolver } from "@hookform/resolvers/zod";
import { RefreshCcw, Save, Sparkles } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";

import { apiGet, apiPost } from "../../shared/api/client.js";
import type { ListEnvelope } from "../../shared/api/types.js";
import { todayInStoreTime } from "../../shared/time/storeTime.js";
import { Button } from "../../shared/ui/Button.js";
import {
  criteriaByParent,
  criterionPathLabel,
  type CriterionPathItem,
  type ResponseCriterionDto
} from "./responseCriteria.js";
import { responseFormSchema, type ResponseFormValues } from "./responseFormSchema.js";

function criterionButtonClass(isSelected: boolean) {
  return [
    "min-h-11 rounded-control border px-3 text-sm font-semibold",
    isSelected
      ? "border-stone-900 bg-stone-900 text-white"
      : "border-stone-300 bg-white text-stone-800 hover:bg-stone-100"
  ].join(" ");
}

type ResponseSuggestionDto = {
  criterionId: number;
  criterionPath: CriterionPathItem[];
  shortSummary: string;
  reason: string;
};

function pathLabel(path: CriterionPathItem[]): string {
  return criterionPathLabel(path);
}

export function ResponseEntryPage({ embedded = false }: { embedded?: boolean } = {}) {
  const {
    register,
    setValue,
    watch,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting }
  } = useForm<ResponseFormValues>({
    resolver: zodResolver(responseFormSchema),
    defaultValues: {
      date: todayInStoreTime(),
      criterionId: 0,
      shortSummary: "",
      fullText: "",
      llmAssisted: false
    }
  });

  const [criteria, setCriteria] = useState<ResponseCriterionDto[]>([]);
  const [selectedMajorId, setSelectedMajorId] = useState<number | null>(null);
  const [selectedMiddleId, setSelectedMiddleId] = useState<number | null>(null);
  const [selectedMinorId, setSelectedMinorId] = useState<number | null>(null);
  const [isLoadingCriteria, setIsLoadingCriteria] = useState(false);
  const [isSuggesting, setIsSuggesting] = useState(false);
  const [aiSuggestionPath, setAiSuggestionPath] = useState<CriterionPathItem[] | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const selectedCriterionId = watch("criterionId");
  const fullText = watch("fullText");
  const majorCriteria = useMemo(() => criteriaByParent(criteria, null), [criteria]);
  const middleCriteria = useMemo(
    () => (selectedMajorId ? criteriaByParent(criteria, selectedMajorId) : []),
    [criteria, selectedMajorId]
  );
  const minorCriteria = useMemo(
    () => (selectedMiddleId ? criteriaByParent(criteria, selectedMiddleId) : []),
    [criteria, selectedMiddleId]
  );
  const selectedPath = useMemo(
    () =>
      [selectedMajorId, selectedMiddleId, selectedMinorId]
        .map((id) => criteria.find((criterion) => criterion.id === id))
        .filter((criterion): criterion is ResponseCriterionDto => criterion !== undefined),
    [criteria, selectedMajorId, selectedMiddleId, selectedMinorId]
  );

  const loadCriteria = useCallback(async () => {
    setIsLoadingCriteria(true);
    setSaveError(null);

    try {
      const envelope = await apiGet<ListEnvelope<ResponseCriterionDto>>(
        "/response-criteria?active=true"
      );

      if (envelope.error) {
        setSaveError(envelope.error.message);
        return;
      }

      setCriteria(envelope.data.items);
    } catch (unknownError) {
      setSaveError(
        unknownError instanceof Error ? unknownError.message : "반응 기준을 조회하지 못했습니다."
      );
    } finally {
      setIsLoadingCriteria(false);
    }
  }, []);

  useEffect(() => {
    void loadCriteria();
  }, [loadCriteria]);

  function selectMajor(id: number) {
    setAiSuggestionPath(null);
    setSelectedMajorId(id);
    setSelectedMiddleId(null);
    setSelectedMinorId(null);
    setValue("criterionId", id, { shouldValidate: true });
  }

  function selectMiddle(id: number) {
    setAiSuggestionPath(null);
    setSelectedMiddleId(id);
    setSelectedMinorId(null);
    setValue("criterionId", id, { shouldValidate: true });
  }

  function selectMinor(id: number) {
    setAiSuggestionPath(null);
    setSelectedMinorId(id);
    setValue("criterionId", id, { shouldValidate: true });
  }

  function applyCriterionPath(path: CriterionPathItem[], criterionId: number) {
    setSelectedMajorId(path.find((criterion) => criterion.depth === 1)?.id ?? null);
    setSelectedMiddleId(path.find((criterion) => criterion.depth === 2)?.id ?? null);
    setSelectedMinorId(path.find((criterion) => criterion.depth === 3)?.id ?? null);
    setValue("criterionId", criterionId, { shouldValidate: true });
  }

  async function suggestWithAi() {
    const text = fullText?.trim() ?? "";
    if (!text) {
      setSaveError("자세한 내용을 입력한 뒤 AI 분류하기를 눌러주세요.");
      return;
    }

    setIsSuggesting(true);
    setSaveMessage(null);
    setSaveError(null);

    try {
      const envelope = await apiPost<ResponseSuggestionDto, { fullText: string }>("/response/suggest", {
        fullText: text
      });

      if (envelope.error) {
        setSaveError(envelope.error.message);
        return;
      }

      applyCriterionPath(envelope.data.criterionPath, envelope.data.criterionId);
      setAiSuggestionPath(envelope.data.criterionPath);
      setValue("shortSummary", envelope.data.shortSummary, { shouldValidate: true });
      setValue("llmAssisted", true, { shouldValidate: true });
      setSaveMessage(`AI 추천 적용됨: ${pathLabel(envelope.data.criterionPath)}`);
    } catch (unknownError) {
      setSaveError(unknownError instanceof Error ? unknownError.message : "AI 추천을 가져오지 못했습니다.");
    } finally {
      setIsSuggesting(false);
    }
  }

  async function submit(values: ResponseFormValues) {
    setSaveMessage(null);
    setSaveError(null);

    const envelope = await apiPost<{ id: string }, ResponseFormValues>("/response", values);

    if (envelope.error) {
      setSaveError(envelope.error.message);
      return;
    }

    setSaveMessage(`저장 완료 #${envelope.data.id}`);
    setAiSuggestionPath(null);
    reset({
      date: values.date,
      criterionId: values.criterionId,
      shortSummary: "",
      fullText: "",
      llmAssisted: false
    });
  }

  return (
    <form
      className={["mx-auto grid gap-4", embedded ? "w-full max-w-7xl" : "max-w-5xl"].join(" ")}
      onSubmit={(event) => {
        void handleSubmit(submit)(event);
      }}
    >
      <section className="panel">
        <div className="panel-heading">
          <div>
            <p className="text-sm text-muted">입력</p>
            <h2 className="section-title">손님 반응 입력</h2>
            <p className="mt-1 text-sm text-muted">
              손님이 말한 내용을 그대로 적고 AI 분류하기를 누른 뒤 직원이 확인해서 저장합니다.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button icon={RefreshCcw} type="button" onClick={() => void loadCriteria()}>
              {isLoadingCriteria ? "조회 중" : "기준 새로고침"}
            </Button>
            <Button
              disabled={isSuggesting || criteria.length === 0 || !fullText?.trim()}
              icon={Sparkles}
              type="button"
              onClick={() => void suggestWithAi()}
            >
              {isSuggesting ? "AI 분류 중" : "AI 분류하기"}
            </Button>
            <Button disabled={isSubmitting || criteria.length === 0} icon={Save} type="submit">
              {isSubmitting ? "저장 중" : "저장"}
            </Button>
          </div>
        </div>

        <div className="grid gap-5">
          {saveMessage ? (
            <div className="rounded-control border border-green/20 bg-green/10 px-3 py-2 text-sm font-semibold text-green">
              {saveMessage}
            </div>
          ) : null}
          {saveError ? (
            <div className="rounded-control border border-red/20 bg-red/10 px-3 py-2 text-sm font-semibold text-red">
              {saveError}
            </div>
          ) : null}

          <label className="grid max-w-[12rem] gap-2">
            <span className="field-label">날짜</span>
            <input className="input w-48 max-w-full" type="date" {...register("date")} />
          </label>

          <div className="grid gap-4">
            <div>
              <span className="field-label">대분류</span>
              <div className="flex flex-wrap gap-2">
                {majorCriteria.map((criterion) => (
                  <button
                    key={criterion.id}
                    className={criterionButtonClass(selectedMajorId === criterion.id)}
                    type="button"
                    onClick={() => selectMajor(criterion.id)}
                  >
                    {criterion.name}
                  </button>
                ))}
              </div>
            </div>

            {selectedMajorId && middleCriteria.length > 0 ? (
              <div>
                <span className="field-label">중분류</span>
                <div className="flex flex-wrap gap-2">
                  {middleCriteria.map((criterion) => (
                    <button
                      key={criterion.id}
                      className={criterionButtonClass(selectedMiddleId === criterion.id)}
                      type="button"
                      onClick={() => selectMiddle(criterion.id)}
                    >
                      {criterion.name}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            {selectedMiddleId && minorCriteria.length > 0 ? (
              <div>
                <span className="field-label">소분류</span>
                <div className="flex flex-wrap gap-2">
                  {minorCriteria.map((criterion) => (
                    <button
                      key={criterion.id}
                      className={criterionButtonClass(selectedMinorId === criterion.id)}
                      type="button"
                      onClick={() => selectMinor(criterion.id)}
                    >
                      {criterion.name}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="rounded-control border border-stone-200 bg-stone-50 px-3 py-2 text-sm font-semibold text-stone-700">
              선택 기준:{" "}
              {selectedCriterionId > 0
                ? `${aiSuggestionPath ? "AI 추천 · " : ""}${criterionPathLabel(selectedPath)}`
                : "미선택"}
            </div>
            {errors.criterionId ? (
              <span className="text-sm font-medium text-red">{errors.criterionId.message}</span>
            ) : null}
            {!isLoadingCriteria && majorCriteria.length === 0 ? (
              <div className="rounded-control border border-stone-200 px-3 py-6 text-center text-sm font-medium text-muted">
                관리 메뉴에서 반응 기준을 먼저 등록하세요.
              </div>
            ) : null}
          </div>

          <label className="grid gap-2">
            <span className="field-label">요약</span>
            <input
              className="input"
              placeholder="고객 반응을 한 줄로 요약"
              {...register("shortSummary")}
            />
            {errors.shortSummary ? (
              <span className="text-sm font-medium text-red">{errors.shortSummary.message}</span>
            ) : null}
          </label>

          <label className="grid gap-2">
            <span className="field-label">손님 반응 내용</span>
            <textarea
              className="input min-h-32 resize-y"
              placeholder="예: 청주에서 방문한 손님 계셨습니다."
              {...register("fullText")}
            />
          </label>
        </div>
      </section>
    </form>
  );
}
