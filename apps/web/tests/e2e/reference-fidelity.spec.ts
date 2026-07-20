import { expect, test } from "@playwright/test";

const comparisonRoutes = [
  { path: "/home", heading: "홈" },
  { path: "/sales-analysis", heading: "매출 분석" },
  { path: "/daily-log/today", heading: "일일 운영 기록" }
] as const;
const comparisonViewports = [
  { width: 1440, height: 1000, label: "1440" },
  { width: 768, height: 1000, label: "768" },
  { width: 375, height: 812, label: "375" }
] as const;

test("captures the reference routes at the comparison viewports", async ({ page }) => {
  await page.clock.install({ time: new Date("2026-07-20T09:00:00+09:00") });

  for (const viewport of comparisonViewports) {
    await page.setViewportSize(viewport);

    for (const route of comparisonRoutes) {
      await page.goto(route.path, { waitUntil: "networkidle" });
      await expect(page.locator('meta[name="pnp-ui-source"]')).toHaveAttribute(
        "content",
        "reference-fidelity-alignment-task-1"
      );
      await expect(page.getByRole("main")).toBeVisible();
      await expect(page.getByRole("heading", { name: route.heading })).toBeVisible();
      await expect(page.locator('[aria-busy="true"]')).toHaveCount(0);
      await page.evaluate(async () => document.fonts.ready);
      await expect(page).toHaveScreenshot(`${route.path.slice(1)}-${viewport.label}.png`, {
        fullPage: true
      });
    }
  }
});
