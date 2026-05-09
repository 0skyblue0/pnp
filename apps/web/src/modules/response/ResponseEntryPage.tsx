import { zodResolver } from "@hookform/resolvers/zod";
import { Camera, Save, Star } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";

import {
  actionPriorities,
  quickResponseTags,
  responseCategories,
  responseSources,
  responseTargets,
  visitOrigins
} from "@pnp/shared";
import { Button } from "../../shared/ui/Button.js";
import { apiPost } from "../../shared/api/client.js";
import { SegmentedControl } from "../../shared/ui/SegmentedControl.js";
import { responseFormSchema, type ResponseFormValues } from "./responseFormSchema.js";

const categoryLabels: Record<(typeof responseCategories)[number], string> = {
  PRODUCT_REVIEW: "제품평가",
  SERVICE_REVIEW: "서비스",
  VISIT_MOTIVE: "방문동기",
  REQUEST: "요청제안",
  CASUAL_TALK: "일상대화",
  COMPLAINT: "컴플레인",
  USE_CASE: "사용법"
};

const targetLabels: Record<(typeof responseTargets)[number], string> = {
  PRODUCT: "제품",
  STORE: "매장",
  STAFF: "직원",
  PRICE: "가격",
  DISPLAY: "진열"
};

const actionLabels: Record<(typeof actionPriorities)[number], string> = {
  IMMEDIATE: "즉시",
  REVIEW: "검토",
  RECORD_ONLY: "단순 기록"
};

const visitLabels: Record<(typeof visitOrigins)[number], string> = {
  FIRST: "처음",
  REVISIT: "재방문",
  REGULAR: "단골"
};

const sourceLabels: Record<(typeof responseSources)[number], string> = {
  DIRECT: "직접",
  SNS: "SNS",
  RECOMMEND: "추천",
  PASSING: "지나가다",
  DISTANT_INTENT: "원거리"
};

const tagLabels: Record<(typeof quickResponseTags)[number], string> = {
  DISTANT: "멀리서",
  GIFT: "선물용",
  REVISIT: "재방문",
  REGULAR: "단골",
  FROZEN_USE: "냉동사용",
  SNS: "SNS보고",
  BULK_PURCHASE: "대량구매"
};

function todayInStoreTime(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date());
}

export function ResponseEntryPage() {
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
      category: "PRODUCT_REVIEW",
      target: "PRODUCT",
      sentimentScore: 4,
      actionPriority: "RECORD_ONLY",
      tags: [],
      isBossFlag: false,
      shortSummary: ""
    }
  });

  const selectedTags = watch("tags");
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  function toggleTag(tag: (typeof quickResponseTags)[number]) {
    const next = selectedTags.includes(tag)
      ? selectedTags.filter((selected) => selected !== tag)
      : [...selectedTags, tag];
    setValue("tags", next, { shouldDirty: true, shouldValidate: true });
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
    reset({
      ...values,
      shortSummary: "",
      fullText: "",
      tags: [],
      isBossFlag: false
    });
  }

  return (
    <form
      className="mx-auto grid max-w-5xl gap-4"
      onSubmit={(event) => {
        void handleSubmit(submit)(event);
      }}
    >
      <section className="panel">
        <div className="panel-heading">
          <div>
            <p className="text-sm text-muted">M3</p>
            <h2 className="section-title">고객 반응 입력</h2>
          </div>
          <Button disabled={isSubmitting} icon={Save} type="submit">
            {isSubmitting ? "저장 중" : "저장"}
          </Button>
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

          <SegmentedControl<(typeof responseCategories)[number]>
            label="카테고리"
            options={responseCategories.map((value) => ({
              value,
              label: categoryLabels[value]
            }))}
            value={watch("category")}
            onChange={(value) => setValue("category", value, { shouldValidate: true })}
          />

          <SegmentedControl<(typeof responseTargets)[number]>
            label="대상"
            options={responseTargets.map((value) => ({
              value,
              label: targetLabels[value]
            }))}
            value={watch("target")}
            onChange={(value) => setValue("target", value, { shouldValidate: true })}
          />

          <div className="grid gap-4 md:grid-cols-2">
            <SegmentedControl<(typeof actionPriorities)[number]>
              label="조치"
              options={actionPriorities.map((value) => ({
                value,
                label: actionLabels[value]
              }))}
              value={watch("actionPriority")}
              onChange={(value) => setValue("actionPriority", value, { shouldValidate: true })}
            />

            <div>
              <span className="field-label">감성</span>
              <div className="flex min-h-11 items-center gap-2">
                {[1, 2, 3, 4, 5].map((score) => (
                  <button
                    key={score}
                    className="grid h-11 w-11 place-items-center rounded-control border border-stone-300 bg-white text-amber hover:bg-amber/10"
                    type="button"
                    onClick={() => setValue("sentimentScore", score, { shouldValidate: true })}
                    title={`${score}점`}
                  >
                    <Star
                      className="h-5 w-5"
                      fill={watch("sentimentScore") >= score ? "currentColor" : "none"}
                      aria-hidden="true"
                    />
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div>
            <span className="field-label">퀵 태그</span>
            <div className="flex flex-wrap gap-2">
              {quickResponseTags.map((tag) => (
                <button
                  key={tag}
                  className={[
                    "min-h-11 rounded-control border px-3 text-sm font-semibold",
                    selectedTags.includes(tag)
                      ? "border-stone-900 bg-stone-900 text-white"
                      : "border-stone-300 bg-white text-stone-800 hover:bg-stone-100"
                  ].join(" ")}
                  type="button"
                  onClick={() => toggleTag(tag)}
                >
                  {tagLabels[tag]}
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <SegmentedControl<(typeof visitOrigins)[number]>
              label="방문"
              options={visitOrigins.map((value) => ({
                value,
                label: visitLabels[value]
              }))}
              value={watch("visitOrigin")}
              onChange={(value) => setValue("visitOrigin", value, { shouldValidate: true })}
            />

            <SegmentedControl<(typeof responseSources)[number]>
              label="유입"
              options={responseSources.map((value) => ({
                value,
                label: sourceLabels[value]
              }))}
              value={watch("source")}
              onChange={(value) => setValue("source", value, { shouldValidate: true })}
            />
          </div>

          <label className="grid gap-2">
            <span className="field-label">짧은 요약</span>
            <input
              className="input"
              placeholder="제주도 고객 대량 구매, 보관 안내"
              {...register("shortSummary")}
            />
            {errors.shortSummary ? (
              <span className="text-sm font-medium text-red">{errors.shortSummary.message}</span>
            ) : null}
          </label>

          <label className="grid gap-2">
            <span className="field-label">자세한 내용</span>
            <textarea className="input min-h-28 resize-y" {...register("fullText")} />
          </label>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <button
              className="inline-flex min-h-11 items-center gap-2 rounded-control border border-stone-300 bg-white px-4 font-semibold hover:bg-stone-100"
              type="button"
            >
              <Camera className="h-5 w-5" aria-hidden="true" />
              사진
            </button>
            <label className="inline-flex min-h-11 items-center gap-3 rounded-control border border-stone-300 bg-white px-4 font-semibold">
              <input
                className="h-5 w-5 accent-stone-900"
                type="checkbox"
                {...register("isBossFlag")}
              />
              사장 보고
            </label>
          </div>
        </div>
      </section>
    </form>
  );
}
