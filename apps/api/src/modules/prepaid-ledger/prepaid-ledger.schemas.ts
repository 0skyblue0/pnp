import { z } from "zod";

export const idParamsSchema = z.object({
  id: z.coerce.bigint().positive()
});

export const transactionParamsSchema = z.object({
  id: z.coerce.bigint().positive(),
  transactionId: z.coerce.bigint().positive()
});

export const listPrepaidLedgerQuerySchema = z.object({
  query: z.string().trim().max(80).optional()
});

export const createPrepaidCustomerSchema = z.object({
  customerName: z.string().trim().min(1).max(80),
  contactPhone: z.string().trim().max(40).optional(),
  amount: z.coerce.number().int().positive().max(99_999_999),
  memo: z.string().trim().max(2000).optional(),
  ledgerType: z.enum(["GENERAL", "SHARED"]).optional(),
  sharedLimit: z.coerce.number().int().positive().max(99_999_999).optional(),
  participants: z
    .array(
      z.object({
        participantName: z.string().trim().min(1).max(80),
        phoneLast4: z
          .string()
          .trim()
          .regex(/^\d{4}$/),
        limitAmount: z.coerce.number().int().positive().max(99_999_999).optional()
      })
    )
    .max(50)
    .optional()
});

export const sharedUsePrepaidBalanceSchema = z.object({
  participantName: z.string().trim().min(1).max(80),
  phoneLast4: z
    .string()
    .trim()
    .regex(/^\d{4}$/),
  amount: z.coerce.number().int().positive().max(99_999_999),
  note: z.string().trim().max(2000).optional()
});

export const usePrepaidBalanceSchema = z.object({
  amount: z.coerce.number().int().positive().max(99_999_999),
  maxAmount: z.coerce.number().int().positive().max(99_999_999).optional(),
  note: z.string().trim().max(2000).optional()
});

export const chargePrepaidBalanceSchema = z.object({
  amount: z.coerce.number().int().positive().max(99_999_999),
  note: z.string().trim().max(2000).optional()
});

export const updatePrepaidCustomerSchema = z.object({
  customerName: z.string().trim().min(1).max(80).optional(),
  contactPhone: z.string().trim().max(40).optional(),
  memo: z.string().trim().max(2000).optional()
});
