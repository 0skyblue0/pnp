import { expect, test } from "@playwright/test";

const dashboardRoutes = ["/home", "/daily-log/today", "/sales-analysis", "/staff"] as const;
const targetViewports = [
  { width: 1440, height: 900 },
  { width: 768, height: 900 },
  { width: 375, height: 812 }
] as const;

test("dashboard routes fit every target viewport", async ({ page }) => {
  for (const viewport of targetViewports) {
    await page.setViewportSize(viewport);

    for (const route of dashboardRoutes) {
      await page.goto(route, { waitUntil: "domcontentloaded" });
      await expect(page.getByRole("main")).toBeVisible();

      await expect
        .poll(() =>
          page.locator("body").evaluate((body) => body.scrollWidth <= window.innerWidth)
        )
        .toBe(true);
    }
  }
});

test("keyboard focus remains visible in a reduced-motion browser context", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/home", { waitUntil: "domcontentloaded" });

  await page.keyboard.press("Tab");

  await expect
    .poll(() =>
      page.evaluate(() => {
        const activeElement = document.activeElement;
        if (!(activeElement instanceof HTMLElement) || activeElement === document.body) {
          return false;
        }

        const styles = window.getComputedStyle(activeElement);
        return styles.outlineStyle !== "none" && styles.outlineWidth !== "0px";
      })
    )
    .toBe(true);

  await expect
    .poll(() => page.evaluate(() => window.matchMedia("(prefers-reduced-motion: reduce)").matches))
    .toBe(true);
});
