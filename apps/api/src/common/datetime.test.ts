import { describe, expect, it } from "vitest";

import {
  formatDateOnly,
  formatTimeOnly,
  parseDateOnly,
  parseStoreDateEnd,
  parseStoreDateTime,
  parseTimeOnly,
  subtractDays,
  todayInStoreTime
} from "./datetime.js";

describe("datetime helpers", () => {
  it("keeps date-only parsing at UTC midnight", () => {
    expect(parseDateOnly("2026-05-10").toISOString()).toBe("2026-05-10T00:00:00.000Z");
    expect(formatDateOnly(parseDateOnly("2026-05-10"))).toBe("2026-05-10");
    expect(formatDateOnly(null)).toBeNull();
  });

  it("rejects impossible date-only values", () => {
    expect(() => parseDateOnly("2026-02-31")).toThrow("Invalid date value");
  });

  it("parses store datetime-local values as Asia/Seoul time", () => {
    expect(parseStoreDateTime("2026-05-10T00:05").toISOString()).toBe("2026-05-09T15:05:00.000Z");
    expect(parseStoreDateTime("2026-05-10T00:05:30").toISOString()).toBe(
      "2026-05-09T15:05:30.000Z"
    );
  });

  it("keeps store date ranges as exclusive next-day KST midnight", () => {
    expect(parseStoreDateEnd("2026-05-10").toISOString()).toBe("2026-05-10T15:00:00.000Z");
  });

  it("keeps helper output shapes used by existing routes", () => {
    const fixed = new Date("2026-05-09T15:05:00.000Z");

    expect(todayInStoreTime(fixed)).toBe("2026-05-10");
    expect(subtractDays("2026-05-10", 2)).toBe("2026-05-08");
    expect(formatTimeOnly(parseTimeOnly("14:30"))).toBe("14:30");
  });
});
