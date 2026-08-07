import { z } from "zod";

export const storeIdSchema = z.string().uuid();

export const classifyFeedbackSchema = z.object({
  storeId: storeIdSchema,
  content: z.string().trim().min(1).max(5000)
});

export const classifyStatusSchema = z.object({
  storeId: storeIdSchema
});

export const feedbackSignalSchema = z.enum([
  "매출 기회",
  "놓친 매출",
  "손님 요청",
  "불만/개선",
  "칭찬",
  "운영 정보"
]);

export const hermesFeedbackSuggestionSchema = z.object({
  major: z.string().trim().min(1).max(100),
  mid: z.string().trim().max(100).default(""),
  minor: z.string().trim().max(100).default(""),
  signal: feedbackSignalSchema,
  summary: z.string().trim().min(1).max(200),
  reason: z.string().trim().min(1).max(500)
});

export type ClassifyFeedbackInput = z.infer<typeof classifyFeedbackSchema>;
export type ClassifyStatusInput = z.infer<typeof classifyStatusSchema>;
export type FeedbackSignal = z.infer<typeof feedbackSignalSchema>;
export type PnpV2FeedbackSuggestion = z.infer<typeof hermesFeedbackSuggestionSchema>;
