import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  use: {
    baseURL: "http://127.0.0.1:5173",
    trace: "on-first-retry"
  },
  projects: [
    {
      name: "tablet-chrome-1024",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1024, height: 768 }
      }
    }
  ],
  webServer: {
    command: "npm run dev",
    port: 5173,
    reuseExistingServer: true
  }
});
