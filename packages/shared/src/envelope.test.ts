import { describe, expect, it } from "vitest";

import { fail, ok, paginationQuerySchema } from "./envelope.js";

describe("API envelope helpers", () => {
  it("wraps successful data in the agreed response shape", () => {
    expect(ok({ id: 1 })).toEqual({
      data: { id: 1 },
      error: null
    });
  });

  it("wraps errors in the agreed response shape", () => {
    expect(fail({ code: "TEST_ERROR", message: "failed" })).toEqual({
      data: null,
      error: { code: "TEST_ERROR", message: "failed" }
    });
  });

  it("defaults pagination to page 1 and size 20", () => {
    expect(paginationQuerySchema.parse({})).toEqual({ page: 1, size: 20 });
  });
});
