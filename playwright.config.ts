import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests",
  timeout: 120000,
  workers: 1,
  use: {
    actionTimeout:15000,
    baseURL: "http://127.0.0.1:5173",
    viewport: { width: 1440, height: 900 },
    channel: "chrome",
    launchOptions: { args: ["--enable-unsafe-swiftshader"] },
    screenshot: "only-on-failure",
  },
  webServer: [
    {
      command: "npm run dev:server",
      url: "http://127.0.0.1:3001/health",
      reuseExistingServer: true,
    },
    {
      command: "npm run dev:web -- --port 5173 --strictPort",
      url: "http://127.0.0.1:5173",
      reuseExistingServer: true,
    },
  ],
  reporter: "list",
});
