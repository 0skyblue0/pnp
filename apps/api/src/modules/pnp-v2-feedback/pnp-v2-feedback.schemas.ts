import { z } from "zod";

export const storeIdSchema = z.string().uuid();

export const classifyFeedbackSchema = z.object({
  storeId: storeIdSchema,
  content: z.string().trim().min(1).max(5000)
});

export const classifyStatusSchema = z.object({
  storeId: storeIdSchema
});

export type ClassifyFeedbackInput = z.infer<typeof classifyFeedbackSchema>;
export type ClassifyStatusInput = z.infer<typeof classifyStatusSchema>;
