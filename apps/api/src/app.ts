import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import Fastify, { type FastifyInstance } from "fastify";
import { ZodError } from "zod";

import type { AppConfig } from "./config.js";
import { loadConfig } from "./config.js";
import { HttpError, sendError, sendOk } from "./common/http.js";
import { attachCsrfProtection } from "./common/security/csrf.js";
import { registerPrisma } from "./infra/db/prisma.js";
import { registerAdminRoutes } from "./modules/admin/admin.routes.js";
import { registerAnnualGoalNoticeRoutes } from "./modules/annual-goal-notice/annual-goal-notice.routes.js";
import { registerAnnualScheduleRoutes } from "./modules/annual-schedule/annual-schedule.routes.js";
import { registerAuthRoutes } from "./modules/auth/auth.routes.js";
import { registerDailyOperationRoutes } from "./modules/daily-log/daily-operation.routes.js";
import { registerDailyOperationImportRoutes } from "./modules/daily-log/excel-import/daily-operation-import.routes.js";
import { registerDailyLogRoutes } from "./modules/daily-log/daily-log.routes.js";
import { registerNotificationRoutes } from "./modules/notification/notification.routes.js";
import { registerPrepaidLedgerRoutes } from "./modules/prepaid-ledger/prepaid-ledger.routes.js";
import { registerPnpV2FeedbackRoutes } from "./modules/pnp-v2-feedback/pnp-v2-feedback.routes.js";
import { registerProductionLotRoutes } from "./modules/production-lot/production-lot.routes.js";
import { registerReservationRoutes } from "./modules/reservation/reservation.routes.js";
import { registerResponseRoutes } from "./modules/response/response.routes.js";
import { registerRegularCustomerRoutes } from "./modules/regular-customer/regular-customer.routes.js";
import { registerSalesAnalysisRoutes } from "./modules/sales-analysis/sales-analysis.routes.js";

declare module "fastify" {
  interface FastifyInstance {
    config: AppConfig;
  }
}

type BuildServerOptions = {
  config?: AppConfig;
};

export async function buildServer(options: BuildServerOptions = {}): Promise<FastifyInstance> {
  const config = options.config ?? loadConfig();
  const app = Fastify({
    logger: {
      level: config.NODE_ENV === "test" ? "silent" : "info"
    }
  });

  app.decorate("config", config);

  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof HttpError) {
      return sendError(reply, error);
    }

    if (error instanceof ZodError) {
      return sendError(
        reply,
        new HttpError(400, "VALIDATION_ERROR", "Request validation failed", error.flatten())
      );
    }

    app.log.error(error);
    return sendError(reply, new HttpError(500, "INTERNAL_ERROR", "Unexpected server error"));
  });

  await app.register(cors, {
    credentials: true,
    origin: config.CORS_ORIGIN
  });
  await app.register(cookie);
  attachCsrfProtection(app);
  await registerPrisma(app);

  app.get("/healthz", async (_request, reply) => sendOk(reply, { status: "ok" }));

  await app.register(registerAuthRoutes, { prefix: "/api/v1/auth" });
  await app.register(registerAdminRoutes, { prefix: "/api/v1" });
  await app.register(registerAnnualGoalNoticeRoutes, { prefix: "/api/v1" });
  await app.register(registerAnnualScheduleRoutes, { prefix: "/api/v1" });
  await app.register(registerDailyOperationImportRoutes, { prefix: "/api/v1/import/daily-operation-excel" });
  await app.register(registerDailyOperationRoutes, { prefix: "/api/v1/daily-operation" });
  await app.register(registerDailyLogRoutes, { prefix: "/api/v1" });
  await app.register(registerProductionLotRoutes, { prefix: "/api/v1/production-lot" });
  await app.register(registerPrepaidLedgerRoutes, { prefix: "/api/v1/prepaid-ledger" });
  await app.register(registerPnpV2FeedbackRoutes, { prefix: "/api/v1/pnp-v2/feedback" });
  await app.register(registerRegularCustomerRoutes, { prefix: "/api/v1/regular-customer" });
  await app.register(registerReservationRoutes, { prefix: "/api/v1/reservation" });
  await app.register(registerResponseRoutes, { prefix: "/api/v1/response" });
  await app.register(registerSalesAnalysisRoutes, { prefix: "/api/v1/sales-analysis" });
  await app.register(registerNotificationRoutes, { prefix: "/api/v1/notification" });

  return app;
}
