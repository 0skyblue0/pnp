import { z } from "zod";

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

export const notificationSeveritySchema = z.enum(notificationSeverities);
export const notificationTypeSchema = z.enum(notificationTypes);

export type NotificationSeverity = z.infer<typeof notificationSeveritySchema>;
export type NotificationType = z.infer<typeof notificationTypeSchema>;
