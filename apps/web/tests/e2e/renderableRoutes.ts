export const renderableRoutes = [
  "/home",
  "/daily-log/today",
  "/sales-analysis",
  "/staff",
  "/response",
  "/response/new",
  "/regular-customer",
  "/prepaid-ledger",
  "/reservation",
  "/notification"
] as const;

export const acceptanceViewports = [
  { width: 1440, height: 1000 },
  { width: 768, height: 1000 },
  { width: 375, height: 812 }
] as const;
