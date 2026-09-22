import { expect, test } from "@playwright/test";

test("home fits the tablet viewport", async ({ page }) => {
  await page.goto("/home");
  await expect(page.getByRole("heading", { name: "홈" })).toBeVisible();
  await expect(page.getByRole("main").getByRole("link", { name: /^일일 운영 작성/ })).toHaveAttribute(
    "href",
    "/daily-log/today"
  );
  await expect(page.getByRole("main").getByRole("link", { name: /^손님 반응 기록/ })).toHaveAttribute("href", "/response");
});
