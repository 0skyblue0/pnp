import { expect, test, type Page } from "@playwright/test";

const dashboardRoutes = ["/home", "/daily-log/today", "/sales-analysis", "/staff"] as const;
const targetViewports = [
  { width: 1440, height: 900 },
  { width: 768, height: 900 },
  { width: 375, height: 812 }
] as const;

const desktopRoutes = ["/home", "/daily-log/today", "/sales-analysis", "/regular-customer", "/prepaid-ledger", "/staff"] as const;
const tabletRoutes = ["/home", "/sales-analysis", "/prepaid-ledger"] as const;
const mobileRoutes = ["/home", "/daily-log/today", "/sales-analysis", "/staff"] as const;

async function expectNoPageOverflow(page: Page) {
  await expect
    .poll(() => page.locator("body").evaluate((body) => body.scrollWidth <= window.innerWidth))
    .toBe(true);
}

test("dashboard routes fit every target viewport", async ({ page }) => {
  for (const viewport of targetViewports) {
    await page.setViewportSize(viewport);

    for (const route of dashboardRoutes) {
      await page.goto(route, { waitUntil: "domcontentloaded" });
      await expect(page.getByRole("main")).toBeVisible();

      await expectNoPageOverflow(page);
    }
  }
});

test("reference fidelity matrix keeps every deployed dashboard route framed and readable", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  for (const route of desktopRoutes) {
    await page.goto(route, { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("main")).toBeVisible();
    await expect(page.locator("aside.bg-ref-cocoa")).toHaveCSS("background-color", "rgb(38, 30, 24)");
    await expect(page.locator("header.ref-page-header")).toBeVisible();
    await expect(page.locator("main > *").first()).toBeVisible();
    await expectNoPageOverflow(page);
  }

  await page.setViewportSize({ width: 768, height: 1000 });
  for (const route of tabletRoutes) {
    await page.goto(route, { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("main")).toBeVisible();
    await expect(page.locator("main h1")).toBeVisible();
    await expectNoPageOverflow(page);
  }

  await page.setViewportSize({ width: 375, height: 812 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const route of mobileRoutes) {
    await page.goto(route, { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("main")).toBeVisible();
    await expectNoPageOverflow(page);
  }

  const menuTrigger = page.getByRole("button", { name: "메뉴 열기" });
  await expect(menuTrigger).toBeVisible();
  const triggerBox = await menuTrigger.boundingBox();
  expect(triggerBox?.width).toBeGreaterThanOrEqual(44);
  expect(triggerBox?.height).toBeGreaterThanOrEqual(44);
  await menuTrigger.focus();
  await expect(menuTrigger).toBeFocused();
  await expect
    .poll(() =>
      menuTrigger.evaluate((element) => {
        const styles = window.getComputedStyle(element);
        return styles.outlineStyle !== "none" && styles.outlineWidth !== "0px";
      })
    )
    .toBe(true);
  await menuTrigger.click();
  await expect(page.getByRole("dialog", { name: "주요 메뉴" })).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => window.matchMedia("(prefers-reduced-motion: reduce)").matches))
    .toBe(true);
});

test("keyboard focus remains visible in a reduced-motion browser context", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/home", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("main")).toBeVisible();

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
