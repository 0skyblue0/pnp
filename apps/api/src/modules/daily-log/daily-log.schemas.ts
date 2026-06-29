import { z } from "zod";

export const dateOnlySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
export const timeOnlySchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/);

const productReferenceShape = {
  productId: z.coerce.number().int().positive().optional(),
  productName: z.string().trim().min(1).max(80).optional()
} as const;

function hasProductReference(value: {
  productId?: number | undefined;
  productName?: string | undefined;
}) {
  return value.productId !== undefined || value.productName !== undefined;
}

export const createTastingLogSchema = z
  .object({
    ...productReferenceShape,
    recommended: z.coerce.boolean().default(true),
    convertedToSale: z.coerce.boolean().optional(),
    note: z.string().trim().max(2000).optional()
  })
  .refine(hasProductReference, {
    message: "productId or productName is required"
  });

export const createCongestionLogSchema = z.object({
  timeSlotStart: timeOnlySchema,
  timeSlotEnd: timeOnlySchema,
  level: z.coerce.number().int().min(1).max(5).optional(),
  queueInside: z.coerce.boolean().default(false),
  queueOutside: z.coerce.boolean().default(false),
  estLostCustomers: z.coerce.number().int().min(0).max(999).default(0)
});

export const createStockoutLogSchema = z
  .object({
    ...productReferenceShape,
    date: dateOnlySchema,
    sequence: z.coerce.number().int().min(1).max(99).default(1),
    stockoutAt: z.string().trim().min(1),
    inquiryAfterStockout: z.enum(["NONE", "FEW", "SOME", "MANY", "EXTREME"]).optional(),
    discardQty: z.coerce.number().int().min(0).max(9999).default(0),
    discardReason: z.string().trim().max(2000).optional()
  })
  .refine(hasProductReference, {
    message: "productId or productName is required"
  });

export const createDiscardSchema = z.object({
  productId: z.coerce.number().int().positive(),
  date: dateOnlySchema,
  discardQty: z.coerce.number().int().min(1).max(9999)
});

export const updateStockoutLogSchema = z
  .object({
    sequence: z.coerce.number().int().min(1).max(99).optional(),
    stockoutAt: z.string().trim().min(1).optional(),
    inquiryAfterStockout: z.enum(["NONE", "FEW", "SOME", "MANY", "EXTREME"]).nullable().optional(),
    discardQty: z.coerce.number().int().min(0).max(9999).optional(),
    discardReason: z.string().trim().max(2000).nullable().optional()
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field is required"
  });

export const listStockoutQuerySchema = z.object({
  from: dateOnlySchema.optional(),
  to: dateOnlySchema.optional(),
  product_id: z.coerce.number().int().positive().optional()
});

export const incrementAbsentInquirySchema = z.object({
  productId: z.coerce.number().int().positive().optional(),
  productName: z.string().trim().min(1).max(80),
  date: dateOnlySchema.optional(),
  note: z.string().trim().max(2000).optional()
});

export const listAbsentInquiryQuerySchema = z.object({
  date: dateOnlySchema.optional(),
  streak_days: z.coerce.number().int().min(1).max(30).optional()
});

export const idParamsSchema = z.object({
  id: z.coerce.bigint().positive()
});

export const dateParamsSchema = z.object({
  date: dateOnlySchema
});

export type CreateCongestionLogInput = z.infer<typeof createCongestionLogSchema>;
export type CreateTastingLogInput = z.infer<typeof createTastingLogSchema>;
export type CreateStockoutLogInput = z.infer<typeof createStockoutLogSchema>;
export type CreateDiscardInput = z.infer<typeof createDiscardSchema>;
export type UpdateStockoutLogInput = z.infer<typeof updateStockoutLogSchema>;
export type IncrementAbsentInquiryInput = z.infer<typeof incrementAbsentInquirySchema>;
