import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";
import { createHeistServer } from "../server/server";
import type { AddressInfo } from "node:net";
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
async function hack(page: Page, count: number, final = false) {
  await page.keyboard.down("KeyE");
  try {
    await expect(page.locator(".mission-progress")).toContainText(
      final ? "GET TO THE ENTRANCE" : `${count} /`,
      { timeout: 7000 },
    );
  } finally {
    await page.keyboard.up("KeyE");
  }
}
for (const mission of ["vault", "data", "annex"] as const)
  test(`solo ${mission} contract can be completed and escaped with real controls`, async ({
    page,
  }) => {
    // A veteran-profile fixture unlocks gadgets through the real server profile store.
    // All navigation, objectives, guards and extraction still run normally.
    const service = createHeistServer();
    const auth = service.store.profiles.authenticate("");
    service.store.profiles.reward(auth.token, true, 650, 800);
    await new Promise<void>((done) =>
      service.http.listen(0, "127.0.0.1", done),
    );
    await page.addInitScript(
      (token) => localStorage.setItem("heist-profile-key", token),
      auth.token,
    );
    try {
      test.setTimeout(240000);
      await page.goto(
        `http://127.0.0.1:${(service.http.address() as AddressInfo).port}`,
      );
      await page.getByRole("button", { name: "Solo heist" }).click();
      await page.getByLabel("Mission", { exact: true }).selectOption(mission);
      await page.getByLabel("Difficulty", { exact: true }).selectOption("easy");
      await page.getByRole("button", { name: "Ready up" }).click();
      await page.getByRole("button", { name: "Start heist" }).click();
      if (mission === "annex") {
        await move(page, "cy", 16);
        await move(page, "cx", -16);
        await move(page, "cy", -22);
        await move(page, "cx", -18);
        await hack(page, 1);
        await move(page, "cy", -25);
        await move(page, "cx", 0);
        await hack(page, 2);
        await move(page, "cx", 18);
        await move(page, "cy", -22);
        await hack(page, 3, true);
        await page.screenshot({path:"test-results/annex-objective.png"});
        await move(page, "cx", 16);
        await move(page, "cy", 16);
        await move(page, "cx", 0);
      } else {
      await move(page, "cx", -11);
      await move(page, "cy", 6);
      await hack(page, 1);
      // Return through the south hall instead of crossing the central patrol.
      await move(page, "cy", 12);
      await move(page, "cx", 3);
      await move(page, "cy", -14);
      await page.keyboard.press("KeyQ");
      await hack(page, 2);
      await move(page, "cy", 10);
      await move(page, "cx", 9.5);
      await page.keyboard.press("KeyR");
      await move(page, "cy", -10);
      if (mission === "vault") {
        await move(page, "cy", -13);
        await page.keyboard.press("KeyQ");
        await hack(page, 3, true);
        await move(page, "cy", -10);
      } else {
        await move(page, "cx", -9);
        await move(page, "cy", 5);
        await page.keyboard.press("KeyQ");
        await move(page, "cy", 7);
        await move(page, "cx", -11);
        await hack(page, 3, true);
        await move(page, "cx", -9);
        await move(page, "cy", -10);
        await move(page, "cx", 9.5);
      }
      }
      await page.screenshot({ path: `test-results/${mission}-objective.png` });
      await move(page, "cy", 13);
      await move(page, "cx", 0);
      await page.keyboard.down("KeyE");
      await expect(
        page.getByRole("heading", { name: "A clean getaway." }),
      ).toBeVisible({ timeout: 6000 });
      await page.keyboard.up("KeyE");
      await page.screenshot({ path: `test-results/${mission}-victory.png` });
    } catch (error) {
      for (const room of service.store.rooms.values())
        console.log(
          "Mission failure state",
          JSON.stringify({
            phase: room.phase,
            players: [...room.players.values()].map((p) => ({
              state: p.state,
              operative: p.operative,
              holding: p.holding,
            })),
            guards: room.heist?.guards,
          }),
        );
      throw error;
    } finally {
      await service.close();
    }
  });
