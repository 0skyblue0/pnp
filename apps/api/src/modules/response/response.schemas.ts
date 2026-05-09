import {
  actionPrioritySchema,
  quickResponseTagSchema,
  responseCategorySchema,
  responseSourceSchema,
  responseTargetSchema,
  visitOriginSchema
} from "@pnp/shared";
import { z } from "zod";

const dateOnlySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const createResponseSchema = z.object({
  date: dateOnlySchema,
  category: responseCategorySchema,
  target: responseTargetSchema.optional(),
  sentimentScore: z.number().int().min(1).max(5).optional(),
  actionPriority: actionPrioritySchema.default("RECORD_ONLY"),
  visitOrigin: visitOriginSchema.optional(),
  source: responseSourceSchema.optional(),
  isBossFlag: z.boolean().default(false),
  shortSummary: z.string().min(1).max(200),
  fullText: z.string().max(5000).optional(),
  tags: z.array(quickResponseTagSchema).default([]),
  productIds: z.array(z.number().int().positive()).default([])
});

export const updateResponseSchema = createResponseSchema
  .partial()
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field is required"
  });

export const listResponseQuerySchema = z.object({
  from: dateOnlySchema.optional(),
  to: dateOnlySchema.optional(),
  category: responseCategorySchema.optional(),
  boss_flag: z.coerce.boolean().optional()
});

export type CreateResponseInput = z.infer<typeof createResponseSchema>;
export type UpdateResponseInput = z.infer<typeof updateResponseSchema>;
