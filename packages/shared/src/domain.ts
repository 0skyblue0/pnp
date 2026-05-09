import { z } from "zod";

export const responseCategories = [
  "PRODUCT_REVIEW",
  "SERVICE_REVIEW",
  "VISIT_MOTIVE",
  "REQUEST",
  "CASUAL_TALK",
  "COMPLAINT",
  "USE_CASE"
] as const;

export const responseTargets = ["PRODUCT", "STORE", "STAFF", "PRICE", "DISPLAY"] as const;
export const actionPriorities = ["IMMEDIATE", "REVIEW", "RECORD_ONLY"] as const;
export const visitOrigins = ["FIRST", "REVISIT", "REGULAR"] as const;
export const responseSources = ["DIRECT", "SNS", "RECOMMEND", "PASSING", "DISTANT_INTENT"] as const;
export const notificationSeverities = ["INFO", "WARN", "CRITICAL"] as const;
export const notificationTypes = [
  "RESERVATION_24H",
  "RESERVATION_1H",
  "RESERVATION_DUE",
  "RESERVATION_OVER_WALKIN",
  "SUGGESTION_THRESHOLD",
  "ABSENT_INQUIRY_STREAK",
  "COMPLAINT_UNRESOLVED",
  "INGREDIENT_CHANGE_COMPLAINT",
  "TASTING_RECOMMEND",
  "LLM_REVIEW_PENDING"
] as const;

export const quickResponseTags = [
  "DISTANT",
  "GIFT",
  "REVISIT",
  "REGULAR",
  "FROZEN_USE",
  "SNS",
  "BULK_PURCHASE"
] as const;

export const responseCategorySchema = z.enum(responseCategories);
export const responseTargetSchema = z.enum(responseTargets);
export const actionPrioritySchema = z.enum(actionPriorities);
export const visitOriginSchema = z.enum(visitOrigins);
export const responseSourceSchema = z.enum(responseSources);
export const notificationSeveritySchema = z.enum(notificationSeverities);
export const notificationTypeSchema = z.enum(notificationTypes);
export const quickResponseTagSchema = z.enum(quickResponseTags);

export type ResponseCategory = z.infer<typeof responseCategorySchema>;
export type ResponseTarget = z.infer<typeof responseTargetSchema>;
export type ActionPriority = z.infer<typeof actionPrioritySchema>;
export type VisitOrigin = z.infer<typeof visitOriginSchema>;
export type ResponseSource = z.infer<typeof responseSourceSchema>;
export type NotificationSeverity = z.infer<typeof notificationSeveritySchema>;
export type NotificationType = z.infer<typeof notificationTypeSchema>;
export type QuickResponseTag = z.infer<typeof quickResponseTagSchema>;
