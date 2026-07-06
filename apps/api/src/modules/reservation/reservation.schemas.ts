import { z } from "zod";

export const dateOnlySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
export const reservationStatusSchema = z.enum(["PENDING", "COMPLETED"]);
export const reservationPurposeSchema = z.enum(["GIFT", "SELF", "UNKNOWN"]);
export const reservationCuttingOptionSchema = z.enum(["NONE", "HALF", "SLICE", "HALF_SLICE"]);

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

export const reservationItemSchema = z
  .object({
    ...productReferenceShape,
    quantity: z.coerce.number().int().min(1).max(999),
    cuttingOption: reservationCuttingOptionSchema.default("NONE")
  })
  .refine(hasProductReference, {
    message: "productId or productName is required"
  });

export const createReservationSchema = z.object({
  contactRef: z.string().trim().min(1).max(200),
  customerName: z.string().trim().min(1).max(80),
  contactPhone: z.string().trim().min(1).max(40),
  pickupAt: z.string().trim().min(1),
  isPaid: z.coerce.boolean().default(false),
  isCut: z.coerce.boolean().default(false),
  isBag: z.coerce.boolean().default(false),
  purpose: reservationPurposeSchema.default("UNKNOWN"),
  allergyNote: z.string().trim().max(2000).optional(),
  memo: z.string().trim().max(2000).optional(),
  items: z.array(reservationItemSchema).min(1).max(20)
});

export const updateReservationSchema = createReservationSchema.partial().extend({
  items: z.array(reservationItemSchema).min(1).max(20).optional()
});

export const updateReservationStatusSchema = z.object({
  status: reservationStatusSchema,
  cancelReason: z.string().trim().max(2000).optional()
});

export const updateReservationPaymentSchema = z.object({
  isPaid: z.coerce.boolean()
});

export const upsertRegularCustomerSchema = z.object({
  customerName: z.string().trim().min(1).max(80),
  contactPhone: z.string().trim().max(40).optional(),
  fixedMemo: z.string().trim().min(1).max(2000)
});

export const listReservationQuerySchema = z.object({
  from: dateOnlySchema.optional(),
  to: dateOnlySchema.optional(),
  status: reservationStatusSchema.optional(),
  query: z.string().trim().max(80).optional()
});

export const availabilityParamsSchema = z.object({
  date: dateOnlySchema,
  productId: z.coerce.number().int().positive()
});

export const availabilityQuerySchema = z.object({
  produced: z.coerce.number().int().min(0).default(0),
  sold_walkin: z.coerce.number().int().min(0).default(0)
});

export const idParamsSchema = z.object({
  id: z.coerce.bigint().positive()
});

export type ReservationItemInput = z.infer<typeof reservationItemSchema>;
export type CreateReservationInput = z.infer<typeof createReservationSchema>;
