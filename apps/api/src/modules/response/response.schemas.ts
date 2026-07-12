import { z } from "zod";

const dateOnlySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const createResponseSchema = z.object({
  date: dateOnlySchema,
  criterionId: z.number().int().positive(),
  shortSummary: z.string().trim().min(1).max(200),
  fullText: z.string().trim().min(1, "실제 기록 내용을 적어주세요.").max(5000),
  llmAssisted: z.boolean().optional()
});

export const updateResponseSchema = createResponseSchema
  .partial()
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field is required"
  });

export const listResponseQuerySchema = z.object({
  from: dateOnlySchema.optional(),
  to: dateOnlySchema.optional(),
  criterion_id: z.coerce.number().int().positive().optional(),
  insight_bucket: z
    .enum(["salesStrength", "missedSales", "productImprovements", "visitFlow", "serviceRisk"])
    .optional(),
  check_needed: z
    .enum(["true", "false"])
    .optional()
    .transform((value) => value === "true"),
  size: z.coerce.number().int().positive().max(100).optional()
});

export const statsResponseQuerySchema = z
  .object({
    from: dateOnlySchema,
    to: dateOnlySchema
  })
  .refine((value) => value.from <= value.to, {
    message: "from must be before or equal to to",
    path: ["from"]
  });

export const suggestResponseSchema = z.object({
  fullText: z.string().trim().min(1).max(5000)
});

export type CreateResponseInput = z.infer<typeof createResponseSchema>;
export type SuggestResponseInput = z.infer<typeof suggestResponseSchema>;
export type UpdateResponseInput = z.infer<typeof updateResponseSchema>;
