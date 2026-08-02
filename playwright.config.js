import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 60000,
  retries: 1,
  use: {
    baseURL: "http://127.0.0.1:3002",
    headless: true,
    locale: "id-ID",
    screenshot: "only-on-failure",
  },
  webServer: {
    command: "npm.cmd run dev",
    url: "http://127.0.0.1:3000",
    cwd: ".",
    reuseExistingServer: true,
    timeout: 120000,
  },
});