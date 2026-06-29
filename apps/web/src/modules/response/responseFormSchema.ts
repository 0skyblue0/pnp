import { z } from "zod";

export const responseFormSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  criterionId: z.number().int().positive("반응 기준을 선택하세요."),
  shortSummary: z.string().min(1, "요약을 입력하세요.").max(200),
  fullText: z.string().max(5000).optional(),
  llmAssisted: z.boolean().optional()
});

export type ResponseFormValues = z.infer<typeof responseFormSchema>;
