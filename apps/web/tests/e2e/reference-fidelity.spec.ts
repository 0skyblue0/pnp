import { expect, test } from "@playwright/test";

const comparisonRoutes = ["/home", "/sales-analysis", "/daily-log/today"] as const;
const comparisonViewports = [
  { width: 1440, height: 1000, label: "1440" },
  { width: 768, height: 1000, label: "768" },
  { width: 375, height: 812, label: "375" }
] as const;

test("captures the reference routes at the comparison viewports", async ({ page }) => {
  for (const viewport of comparisonViewports) {
    await page.setViewportSize(viewport);

    for (const route of comparisonRoutes) {
      await page.goto(route, { waitUntil: "domcontentloaded" });
      await expect(page.getByRole("main")).toBeVisible();
      await expect(page).toHaveScreenshot(`${route.slice(1)}-${viewport.label}.png`, {
        fullPage: true
      });
    }
  }
});
