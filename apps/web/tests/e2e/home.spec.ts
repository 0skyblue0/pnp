import { expect, test } from "@playwright/test";

test("home fits the tablet viewport", async ({ page }) => {
  await page.goto("/home");
  await expect(page.getByRole("heading", { name: "오늘의 가용 재고" })).toBeVisible();
  await expect(page.getByRole("main").getByRole("link", { name: "반응 입력" })).toBeVisible();
});
