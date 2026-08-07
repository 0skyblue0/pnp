import type { FastifyInstance, FastifyRequest } from "fastify";

import { HttpError, sendOk } from "../../common/http.js";
import {
  checkPnpV2HermesAvailability,
  loadAuthorizedStoreCriteria,
  requestPnpV2HermesSuggestion
} from "./pnp-v2-feedback.service.js";
import {
  classifyFeedbackSchema,
  classifyStatusSchema
} from "./pnp-v2-feedback.schemas.js";

function bearerToken(request: FastifyRequest): string {
  const header = request.headers.authorization;
  if (!header?.startsWith("Bearer ") || !header.slice("Bearer ".length).trim()) {
    throw new HttpError(401, "SUPABASE_AUTH_INVALID", "로그인이 만료되었습니다. 다시 로그인해 주세요.");
  }
  return header.slice("Bearer ".length).trim();
}

export async function registerPnpV2FeedbackRoutes(app: FastifyInstance): Promise<void> {
  app.get("/classify/status", async (request, reply) => {
    const input = classifyStatusSchema.parse(request.query);
    const token = bearerToken(request);
    const criteria = await loadAuthorizedStoreCriteria(app.config, token, input.storeId);
    const available = criteria.length > 0 && await checkPnpV2HermesAvailability(app.config);
    return sendOk(reply, { available });
  });

  app.post("/classify", async (request, reply) => {
    const input = classifyFeedbackSchema.parse(request.body);
    const token = bearerToken(request);
    const criteria = await loadAuthorizedStoreCriteria(app.config, token, input.storeId);
    if (criteria.length === 0) {
      throw new HttpError(502, "HERMES_INVALID_SUGGESTION", "활성 분류 기준이 없습니다. 직접 분류해 주세요.");
    }
    return sendOk(
      reply,
      await requestPnpV2HermesSuggestion(app.config, input.content, criteria)
    );
  });
}
