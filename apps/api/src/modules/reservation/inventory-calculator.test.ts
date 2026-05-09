import { describe, expect, it } from "vitest";

import { calculateAvailableWalkin } from "./inventory-calculator.js";

describe("calculateAvailableWalkin", () => {
  it("subtracts reservations before walk-in availability", () => {
    expect(
      calculateAvailableWalkin({
        produced: 24,
        reservedToday: 6,
        soldWalkin: 8
      })
    ).toMatchObject({
      availableWalkin: 10,
      warning: null
    });
  });

  it("clamps negative availability and flags reservation pressure", () => {
    expect(
      calculateAvailableWalkin({
        produced: 12,
        reservedToday: 9,
        soldWalkin: 5
      })
    ).toMatchObject({
      availableWalkin: 0,
      warning: "RESERVATION_HEAVY"
    });
  });
});
