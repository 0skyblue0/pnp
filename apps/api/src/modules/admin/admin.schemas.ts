import { z } from "zod";

export const productSchema = z.object({
  name: z.string().trim().min(1).max(80),
  category: z.string().trim().max(40).optional(),
  isSeasonal: z.coerce.boolean().default(false),
  seasonStart: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  seasonEnd: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  isActive: z.coerce.boolean().default(true)
});

export const updateProductSchema = z
  .object({
    name: z.string().trim().min(1).max(80).optional(),
    category: z.string().trim().max(40).nullable().optional(),
    isSeasonal: z.coerce.boolean().optional(),
    seasonStart: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .nullable()
      .optional(),
    seasonEnd: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .nullable()
      .optional(),
    isActive: z.coerce.boolean().optional()
  })
  .refine((value) => Object.keys(value).length > 0, { message: "At least one field is required" });

export const listProductQuerySchema = z.object({
  active: z.coerce.boolean().optional()
});

export const staffRoleSchema = z.enum(["SALES", "PRODUCTION", "OWNER"]);

export const createStaffSchema = z.object({
  username: z.string().trim().min(1).max(40),
  displayName: z.string().trim().max(40).nullable().optional(),
  password: z.string().min(8).max(200),
  role: staffRoleSchema.default("SALES"),
  isActive: z.coerce.boolean().default(true)
});

export const updateStaffSchema = z
  .object({
    displayName: z.string().trim().max(40).nullable().optional(),
    role: staffRoleSchema.nullable().optional(),
    isActive: z.coerce.boolean().optional(),
    password: z.string().min(8).max(200).optional()
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field is required"
  });

export const idParamsSchema = z.object({
  id: z.coerce.number().int().positive()
});

export type ProductInput = z.infer<typeof productSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
export type CreateStaffInput = z.infer<typeof createStaffSchema>;
export type UpdateStaffInput = z.infer<typeof updateStaffSchema>;
