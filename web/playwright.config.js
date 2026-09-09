import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./e2e",
  timeout: 120000,
  workers: 1,
  use: {
    baseURL: process.env.ALIGNREF_BASE_URL || "http://127.0.0.1:4173/AlignRef/",
    viewport: { width: 1440, height: 1000 },
    headless: true,
  },
  webServer: process.env.ALIGNREF_BASE_URL
    ? undefined
    : {
        command: "npm run preview -- --port 4173",
        url: "http://127.0.0.1:4173/AlignRef/",
        reuseExistingServer: !process.env.CI,
      },
});
