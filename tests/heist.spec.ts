import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";
async function move(page: Page, axis: "cx" | "cy", target: number) {
  const dot = page.locator(".map svg>circle").last();
  const initial = Number(await dot.getAttribute(axis));
  if (Math.abs(initial - target) < 0.2) return;
  const positive = target > initial,
    key =
      axis === "cx" ? (positive ? "KeyD" : "KeyA") : positive ? "KeyS" : "KeyW";
  await page.keyboard.down("ShiftLeft");
  await page.keyboard.down(key);
  try {
    if (Math.abs(initial - target) > 2.5) {
      await expect
        .poll(
          async () => {
            const n = Number(await dot.getAttribute(axis));
            return positive ? n >= target - 2.5 : n <= target + 2.5;
          },
          { timeout: 45000, intervals: [30] },
        )
        .toBe(true);
    }
    await page.keyboard.up("ShiftLeft");
    await page.keyboard.down("KeyC");
    await expect
      .poll(
        async () => {
          const n = Number(await dot.getAttribute(axis));
          return positive ? n >= target - 0.08 : n <= target + 0.08;
        },
        { timeout: 45000, intervals: [30] },
      )
      .toBe(true);
  } finally {
    await page.keyboard.up(key);
    await page.keyboard.up("ShiftLeft");
    await page.keyboard.up("KeyC");
  }
  await page.waitForTimeout(140);
}
async function interact(page: Page, expected: number) {
  await page.keyboard.down("KeyE");
  try {
    await expect(page.locator(".mission-progress")).toContainText(
      `${expected} /`,
      { timeout: 6000 },
    );
  } finally {
    await page.keyboard.up("KeyE");
  }
}
test("two browsers complete a real artifact heist, escape together, earn XP and rematch", async ({
  browser,
}) => {
  test.setTimeout(180000);
  const contexts = await Promise.all([
    browser.newContext({ viewport: { width: 1440, height: 900 } }),
    browser.newContext({ viewport: { width: 1440, height: 900 } }),
  ]);
  try {
    const pages = await Promise.all(contexts.map((c) => c.newPage()));
    const [host, guest] = pages;
    for (const page of pages) {
      await page.goto("http://127.0.0.1:5173");
      await page.getByRole("button", { name: "Play with friends" }).click();
    }
    await host.getByLabel("Your name").fill("Ghost");
    await host.getByRole("button", { name: "Create private room" }).click();
    await host.getByLabel("Difficulty", { exact: true }).selectOption("easy");
    const code = await host.getByTestId("room-code").innerText();
    await guest.getByLabel("Your name").fill("Lookout");
    await guest.getByLabel("Room code", { exact: true }).fill(code);
    await guest.getByRole("button", { name: "Join room" }).click();
    for (const page of pages)
      await page.getByRole("button", { name: "Ready up" }).click();
    await host.getByRole("button", { name: "Start heist" }).click();
    await expect(host.locator(".mission-progress")).toContainText("0 / 4");
    // West ground gallery, then the east stair to two upper artifacts.
    await move(host, "cx", -11);
    await move(host, "cy", 4.7);
    await interact(host, 1);
    await move(host, "cy", 12);
    await move(host, "cx", 9.5);
    await move(host, "cy", -10);
    await move(host, "cx", -3);
    await interact(host, 2);
    await move(host, "cx", 11);
    await move(host, "cy", -12);
    await interact(host, 3);
    // The upper east corridor reaches the south gallery without crossing the atrium.
    await move(host, "cx", 13);
    await move(host, "cy", 13);
    await move(host, "cx", 5);
    await host.keyboard.down("KeyE");
    await expect(host.locator(".mission-progress")).toContainText(
      "GET TO THE ENTRANCE",
      { timeout: 5000 },
    );
    await host.keyboard.up("KeyE");
    await expect(guest.locator(".mission-progress")).toContainText(
      "GET TO THE ENTRANCE",
    );
    await host.screenshot({
      path: "test-results/heist-objective-complete.png",
    });
    await move(host, "cx", 13);
    await move(host, "cy", -10);
    await move(host, "cx", 9.5);
    await move(host, "cy", 13);
    await move(host, "cx", 0);
    await host.keyboard.down("KeyE");
    await expect(host.locator(".interaction-prompt")).toContainText(
      "Waiting for the rest",
      { timeout: 5000 },
    );
    await host.keyboard.up("KeyE");
    await guest.keyboard.down("KeyE");
    await expect(
      guest.getByRole("heading", { name: "A clean getaway." }),
    ).toBeVisible({ timeout: 6000 });
    await guest.keyboard.up("KeyE");
    await expect(
      host.getByRole("heading", { name: "A clean getaway." }),
    ).toBeVisible();
    await expect(host.locator(".reward-grid")).toContainText("325 XP");
    await host.screenshot({ path: "test-results/heist-victory.png" });
    await host.getByRole("button", { name: "Plan another heist" }).click();
    await expect(guest.getByTestId("room-code")).toHaveText(code);
    await expect(host.locator(".crew-list")).toContainText("LV 2");
    await host.getByLabel("Mission", { exact: true }).selectOption("data");
    for (const page of pages)
      await page.getByRole("button", { name: "Ready up" }).click();
    await host.getByRole("button", { name: "Start heist" }).click();
    await expect(host.locator(".gadgets")).toContainText("Smoke ×2");
    await host.keyboard.press("KeyQ");
    await expect(host.locator(".gadgets")).toContainText("Smoke ×1");
    await expect(guest.locator(".heist-notice")).toContainText(
      "deployed smoke",
    );
    await host.keyboard.press("Escape");
    await host.getByRole("button", { name: "Leave room" }).click();
    await host.reload();
    await expect(host.locator(".profile-strip")).toContainText("LV 2");
    await expect(host.locator(".profile-strip")).toContainText("325 XP");
  } finally {
    await Promise.all(contexts.map((c) => c.close()));
  }
});
