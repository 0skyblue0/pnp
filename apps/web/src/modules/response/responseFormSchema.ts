import {
  actionPrioritySchema,
  quickResponseTagSchema,
  responseCategorySchema,
  responseSourceSchema,
  responseTargetSchema,
  visitOriginSchema
} from "@pnp/shared";
import { z } from "zod";

export const responseFormSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  category: responseCategorySchema,
  target: responseTargetSchema,
  sentimentScore: z.number().int().min(1).max(5),
  actionPriority: actionPrioritySchema,
  visitOrigin: visitOriginSchema.optional(),
  source: responseSourceSchema.optional(),
  tags: z.array(quickResponseTagSchema),
  isBossFlag: z.boolean(),
  shortSummary: z.string().min(1, "요약을 입력하세요.").max(200),
  fullText: z.string().max(5000).optional()
});

export type ResponseFormValues = z.infer<typeof responseFormSchema>;
