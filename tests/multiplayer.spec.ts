import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";
test("four independent browsers join, ready, explore, reconnect, and return to lobby", async ({
  browser,
}) => {
  const contexts = await Promise.all(
    Array.from({ length: 4 }, () =>
      browser.newContext({ viewport: { width: 1440, height: 900 } }),
    ),
  );
  const pages: Page[] = [],
    errors: string[] = [];
  try {
    for (const context of contexts) {
      await context.addInitScript(() => {
        Element.prototype.requestPointerLock = async () => {
          throw new Error("Use drag look in automated multiplayer walkthrough");
        };
      });
      const page = await context.newPage();
      page.on("pageerror", (e) => errors.push(e.message));
      pages.push(page);
      await page.goto("http://127.0.0.1:5173");
      await page.getByRole("button", { name: "Play with friends" }).click();
    }
    const host = pages[0];
    await host.getByLabel("Your name").fill("Nightjar");
    await host.getByRole("button", { name: "Create private room" }).click();
    const code = await host.getByTestId("room-code").innerText();
    await host.getByLabel("Mission", { exact: true }).selectOption("training");
    expect(code).toMatch(/^[A-F0-9]{6}$/);
    for (let i = 1; i < 4; i++) {
      await pages[i]
        .getByLabel("Your name")
        .fill(["", "Fox", "Rook", "Wren"][i]);
      await pages[i].getByLabel("Room code", { exact: true }).fill(code);
      await pages[i].getByRole("button", { name: "Join room" }).click();
      await expect(pages[i].getByTestId("room-code")).toHaveText(code);
    }
    await expect(host.locator(".crew-list li:not(.empty-slot)")).toHaveCount(4);
    await expect(
      host.getByRole("button", { name: "Start exploration" }),
    ).toBeDisabled();
    await host.screenshot({ path: "test-results/multiplayer-lobby.png" });
    for (const page of pages)
      await page.getByRole("button", { name: "Ready up" }).click();
    await host.getByRole("button", { name: "Start exploration" }).click();
    for (const page of pages)
      await expect(page.getByTestId("crew-member")).toHaveCount(4);
    await host.screenshot({ path: "test-results/multiplayer-crew.png" });
    const observer = pages[1],
      hostDot = observer.locator('circle[data-player="Nightjar"]');
    await host.keyboard.down("KeyW");
    await expect
      .poll(async () => Number(await hostDot.getAttribute("cy")))
      .toBeLessThan(10.8);
    await host.keyboard.up("KeyW");
    await host.keyboard.down("KeyC");
    await expect(host.locator(".player-card")).toContainText("Crouching");
    await host.keyboard.up("KeyC");
    await host.keyboard.press("Space");
    await expect
      .poll(async () => Number(await hostDot.getAttribute("data-y")))
      .toBeGreaterThan(0.25);
    await expect
      .poll(async () => Number(await hostDot.getAttribute("data-y")))
      .toBe(0);
    await host.keyboard.down("KeyD");
    await expect
      .poll(async () => Number(await hostDot.getAttribute("cx")), {
        timeout: 15000,
        intervals: [50],
      })
      .toBeGreaterThan(9.3);
    await host.keyboard.up("KeyD");
    await host.keyboard.down("KeyW");
    await expect
      .poll(async () => Number(await hostDot.getAttribute("cy")), {
        timeout: 20000,
        intervals: [50],
      })
      .toBeLessThan(-9);
    await host.keyboard.up("KeyW");
    await expect
      .poll(async () => Number(await hostDot.getAttribute("data-y")))
      .toBe(4.5);
    await expect(
      observer.getByTestId("crew-member").filter({ hasText: "Nightjar" }),
    ).toContainText("Upper gallery");
    await host.screenshot({
      path: "test-results/multiplayer-upper-gallery.png",
    });
    // Pause is local: a different crewmate can still move.
    await host.keyboard.press("Escape");
    await expect(
      host.getByRole("heading", { name: "Heist on hold." }),
    ).toBeVisible();
    await observer.keyboard.down("KeyW");
    await expect
      .poll(async () =>
        Number(
          await host.locator('circle[data-player="Fox"]').getAttribute("cy"),
        ),
      )
      .toBeLessThan(11);
    await observer.keyboard.up("KeyW");
    // Network interruption exercises actual client automatic resumption.
    await contexts[0].setOffline(true);
    await expect(
      observer.getByTestId("crew-member").filter({ hasText: "Nightjar" }),
    ).toContainText("Reconnecting", { timeout: 15000 });
    await contexts[0].setOffline(false);
    await expect(
      observer.getByTestId("crew-member").filter({ hasText: "Nightjar" }),
    ).toContainText("Upper gallery", { timeout: 15000 });
    await expect(
      host.getByRole("button", { name: "Resume exploration" }),
    ).toBeEnabled();
    // Fox inherited hosting when Nightjar disconnected.
    await observer.keyboard.press("Escape");
    await observer
      .getByRole("button", { name: "Return crew to lobby" })
      .click();
    for (const page of pages)
      await expect(page.getByTestId("room-code")).toHaveText(code);
    await expect(
      observer.getByRole("button", { name: "Start exploration" }),
    ).toBeDisabled();
    await pages[3].getByRole("button", { name: "Leave room" }).click();
    await expect(host.locator(".crew-list li:not(.empty-slot)")).toHaveCount(3);
    expect(errors).toEqual([]);
  } finally {
    await Promise.all(contexts.map((c) => c.close()));
  }
});
test("invalid room code shows an actionable error", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Play with friends" }).click();
  await page.getByLabel("Room code", { exact: true }).fill("ZZZZZZ");
  await page.getByRole("button", { name: "Join room" }).click();
  await expect(page.getByRole("alert")).toContainText("Room not found");
});
