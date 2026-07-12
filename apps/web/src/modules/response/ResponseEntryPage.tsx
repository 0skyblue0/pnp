import { zodResolver } from "@hookform/resolvers/zod";
import { Save, Sparkles } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";

import { apiGet, apiPost } from "../../shared/api/client.js";
import type { ListEnvelope } from "../../shared/api/types.js";
import { todayInStoreTime } from "../../shared/time/storeTime.js";
import { Button } from "../../shared/ui/Button.js";
import { useToast } from "../../shared/ui/Toast.js";
import {
  criteriaByParent,
  criterionPathLabel,
  type CriterionPathItem,
  type ResponseCriterionDto
} from "./responseCriteria.js";
import { responseFormSchema, type ResponseFormValues } from "./responseFormSchema.js";

function criterionButtonClass(isSelected: boolean) {
  return [
    "rounded-full px-3 py-1.5 text-[11.5px] font-semibold transition",
    isSelected ? "bg-bread text-white" : "bg-cream text-cocoa hover:bg-[#eadfd1]"
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

const responseExamples = [
  "빵이 너무 딱딱하다고 하심",
  "청주에서 일부러 방문했다고 하심",
  "직원이 친절하다고 하심",
  "소금빵이 없어서 아쉬워하심"
];

export function ResponseEntryPage({ embedded = false }: { embedded?: boolean } = {}) {
  const toast = useToast();
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
  const [showManualCriteria, setShowManualCriteria] = useState(true);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const dateInputRef = useRef<HTMLInputElement | null>(null);

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
  const dateField = register("date");

  function openDatePicker() {
    const input = dateInputRef.current;
    if (!input) {
      return;
    }
    input.focus();
    if (typeof input.showPicker === "function") {
      try {
        input.showPicker();
      } catch {
        // 이미 열린 상태이거나 브라우저가 직접 클릭만 허용하는 경우에는 기본 focus만 유지합니다.
      }
    }
  }

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
    setShowManualCriteria(true);
    setAiSuggestionPath(null);
    setSelectedMajorId(id);
    setSelectedMiddleId(null);
    setSelectedMinorId(null);
    setValue("criterionId", id, { shouldValidate: true });
  }

  function selectMiddle(id: number) {
    setShowManualCriteria(true);
    setAiSuggestionPath(null);
    setSelectedMiddleId(id);
    setSelectedMinorId(null);
    setValue("criterionId", id, { shouldValidate: true });
  }

  function selectMinor(id: number) {
    setShowManualCriteria(true);
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

  function stopSuggestionWithAlert(message: string) {
    setSaveError(message);
    toast.error(message);
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
      const envelope = await apiPost<ResponseSuggestionDto, { fullText: string }>(
        "/response/suggest",
        {
          fullText: text
        }
      );

      if (envelope.error) {
        stopSuggestionWithAlert(envelope.error.message);
        return;
      }

      applyCriterionPath(envelope.data.criterionPath, envelope.data.criterionId);
      setAiSuggestionPath(envelope.data.criterionPath);
      setShowManualCriteria(false);
      setValue("shortSummary", envelope.data.shortSummary, { shouldValidate: true });
      setValue("llmAssisted", true, { shouldValidate: true });
      setSaveMessage(`AI 추천 적용됨: ${pathLabel(envelope.data.criterionPath)}`);
    } catch (unknownError) {
      stopSuggestionWithAlert(
        unknownError instanceof Error ? unknownError.message : "AI 추천을 가져오지 못했습니다."
      );
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
    setShowManualCriteria(true);
    setSelectedMajorId(null);
    setSelectedMiddleId(null);
    setSelectedMinorId(null);
    reset({
      date: values.date,
      criterionId: 0,
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
      <section className="dc-card-pad">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <p className="dc-eyebrow">새 반응 입력</p>
            <h2 className="sr-only">손님 반응 입력</h2>
            <p className="mt-1 text-sm font-semibold text-muted">
              손님 말과 직원 관찰을 실제 기록으로 남겨 대표 요약에 반영합니다.
            </p>
          </div>
        </div>

        <div className="grid gap-5">
          <div className="grid gap-2 rounded-control border border-latte bg-cream/50 p-3 text-sm text-cocoa sm:grid-cols-3">
            <span className="font-bold">1. 실제 기록 입력</span>
            <span className="font-bold">2. AI 분류 후 직원 확인</span>
            <span className="font-bold">3. 맞으면 저장</span>
          </div>
          <p className="rounded-control border border-latte bg-white px-3 py-2 text-sm font-semibold text-muted">
            손님이 한 말이면 그대로, 직원이 관찰한 내용이면 있었던 일을 적어주세요.
          </p>
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

          <label className="grid max-w-[12rem] cursor-pointer gap-2" onClick={openDatePicker}>
            <span className="field-label">날짜</span>
            <input
              className="input w-48 max-w-full cursor-pointer"
              type="date"
              {...dateField}
              ref={(element) => {
                dateField.ref(element);
                dateInputRef.current = element;
              }}
            />
          </label>

          <div className="grid gap-2">
            <span className="field-label">예시 문구</span>
            <div className="flex flex-wrap gap-2">
              {responseExamples.map((example) => (
                <button
                  key={example}
                  className="rounded-full border border-latte bg-white px-3 py-1.5 text-xs font-bold text-cocoa hover:border-bread"
                  type="button"
                  onClick={() => {
                    setValue("fullText", example, { shouldValidate: true });
                    setSaveError(null);
                  }}
                >
                  {example}
                </button>
              ))}
            </div>
          </div>

          <label className="grid gap-2">
            <span className="field-label">실제 기록 내용</span>
            <textarea
              className="input min-h-32 resize-y"
              placeholder="예: 청주에서 방문한 손님 계셨습니다. / 바게트가 딱딱하다고 하셨습니다."
              {...register("fullText")}
            />
            {errors.fullText ? (
              <span className="text-sm font-medium text-red">{errors.fullText.message}</span>
            ) : null}
          </label>

          <Button
            className="bg-[#F4E3D8] text-cocoa hover:bg-[#ecd8ca]"
            disabled={isSuggesting || criteria.length === 0 || !fullText?.trim()}
            icon={Sparkles}
            type="button"
            onClick={() => void suggestWithAi()}
          >
            {isSuggesting ? "AI 분류 중" : "AI 분류하기"}
          </Button>

          <div className="grid gap-3 rounded-control border border-latte bg-white px-3 py-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <span className="field-label">분류 확인·수정</span>
                <p className="mt-1 text-xs font-semibold text-muted">
                  AI 추천을 확인하고, 다르면 직접 고쳐주세요.
                </p>
              </div>
              {aiSuggestionPath ? (
                <button
                  className="rounded-full border border-latte bg-cream px-3 py-1 text-xs font-bold text-cocoa hover:bg-[#F4E3D8]"
                  type="button"
                  onClick={() => setShowManualCriteria((current) => !current)}
                >
                  {showManualCriteria ? "분류 선택 접기" : "분류 직접 수정"}
                </button>
              ) : null}
            </div>

            <div className="rounded-control border border-latte bg-cream/40 px-3 py-2 text-sm font-semibold text-stone-700">
              선택 기준:{" "}
              {selectedCriterionId > 0
                ? `${aiSuggestionPath ? "AI 추천 · " : ""}${criterionPathLabel(selectedPath)}`
                : "미선택"}
            </div>
            {errors.criterionId ? (
              <span className="text-sm font-medium text-red">{errors.criterionId.message}</span>
            ) : null}

            {showManualCriteria ? (
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

                {!isLoadingCriteria && majorCriteria.length === 0 ? (
                  <div className="rounded-control border border-stone-200 px-3 py-6 text-center text-sm font-medium text-muted">
                    관리 메뉴에서 반응 기준을 먼저 등록하세요.
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>

          <label className="grid gap-2">
            <span className="field-label">한 줄 요약</span>
            <input
              className="input"
              placeholder="고객 반응을 한 줄로 요약"
              {...register("shortSummary")}
            />
            {errors.shortSummary ? (
              <span className="text-sm font-medium text-red">{errors.shortSummary.message}</span>
            ) : null}
          </label>

          <div className="flex gap-2">
            <Button
              className="dc-action flex-1"
              disabled={isSubmitting || criteria.length === 0}
              icon={Save}
              type="submit"
            >
              {isSubmitting ? "저장 중" : "저장"}
            </Button>
          </div>
        </div>
      </section>
    </form>
  );
}
