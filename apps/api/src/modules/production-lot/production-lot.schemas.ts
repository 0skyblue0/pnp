import { z } from "zod";

const dateOnlySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const lotTypeSchema = z.enum(["AM", "PM_2ND"]);

export const createProductionLotSchema = z
  .object({
    productId: z.coerce.number().int().positive().optional(),
    productName: z.string().trim().min(1).max(80).optional(),
    producedAt: z.string().min(1),
    lotType: lotTypeSchema.nullable().optional(),
    producedQty: z.coerce.number().int().positive(),
    staffNote: z.string().trim().max(2000).optional()
  })
  .refine((value) => value.productId !== undefined || value.productName !== undefined, {
    message: "productId or productName is required",
    path: ["productName"]
  });

export const listProductionLotQuerySchema = z.object({
  date: dateOnlySchema.optional(),
  product_id: z.coerce.number().int().positive().optional()
});

export type CreateProductionLotInput = z.infer<typeof createProductionLotSchema>;
