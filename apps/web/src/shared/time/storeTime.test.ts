import { describe, expect, it } from "vitest";

import { currentStoreDateTime, formatStoreDateLabel, todayInStoreTime } from "./storeTime.js";

describe("store time helpers", () => {
  const kstMidnight = new Date("2026-05-09T15:05:00.000Z");

  it("formats the current store date in Asia/Seoul", () => {
    expect(todayInStoreTime(kstMidnight)).toBe("2026-05-10");
  });

  it("formats datetime-local values without changing the current UI shape", () => {
    expect(currentStoreDateTime(kstMidnight)).toBe("2026-05-10T00:05");
  });

  it("formats the layout date label in the existing Korean style", () => {
    expect(formatStoreDateLabel(kstMidnight)).toBe("2026-05-10 일요일");
  });
});
