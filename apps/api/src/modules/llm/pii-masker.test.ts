import { describe, expect, it } from "vitest";

import { maskPii } from "./pii-masker.js";

describe("maskPii", () => {
  it("masks email, phone, and resident registration number patterns", () => {
    const result = maskPii("test@example.com 010-1234-5678 990101-1234567");

    expect(result.maskedText).toBe("[EMAIL] [PHONE] [RRN]");
    expect(result.counts).toEqual({
      email: 1,
      phone: 1,
      residentRegistrationNumber: 1
    });
  });
});
