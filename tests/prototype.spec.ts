import { test, expect } from "@playwright/test";
test("museum renders; real keyboard movement, stance, pause, stairs and reset work", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "Enter the museum" }),
  ).toBeEnabled();
  await expect(page.locator("canvas")).toBeVisible();
  await page.waitForTimeout(1500);
  await page.screenshot({ path: "test-results/menu.png" });
  await page.getByRole("button", { name: "Field guide" }).click();
  await expect(
    page.getByRole("heading", { name: "Know your moves." }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Got it" }).click();
  await page.getByRole("button", { name: "Enter the museum" }).click();
  const dot = page.locator(".map circle").last();
  const coord = async (axis: "cx" | "cy") =>
    Number(await dot.getAttribute(axis));
  await page.keyboard.down("KeyW");
  await expect.poll(() => coord("cy")).toBeLessThan(11);
  await page.keyboard.up("KeyW");
  await page.keyboard.down("KeyC");
  await expect(page.locator(".player-card")).toContainText("Crouching");
  await page.keyboard.up("KeyC");
  await page.keyboard.press("Space");
  await expect(page.locator(".player-card")).toContainText("Airborne");
  await expect(page.locator(".player-card")).toContainText("Standing");
  await page.keyboard.down("ShiftLeft");
  await page.keyboard.down("KeyD");
  await expect(page.locator(".player-card")).toContainText("Sprinting");
  await page.keyboard.up("KeyD");
  await page.keyboard.up("ShiftLeft");
  await page.screenshot({ path: "test-results/ground-floor.png" });
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("heading", { name: "Heist on hold." }),
  ).toBeVisible();
  await page.waitForTimeout(200);
  const paused = await coord("cy");
  await page.keyboard.down("KeyW");
  await page.waitForTimeout(400);
  await page.keyboard.up("KeyW");
  expect(await coord("cy")).toBe(paused);
  await page.getByRole("button", { name: "Return to entrance" }).click();
  await expect.poll(() => coord("cy")).toBe(12);
  // Walk a real route from spawn to the eastern stair, without teleporting.
  await page.keyboard.down("KeyD");
  await expect
    .poll(() => coord("cx"), { timeout: 15000, intervals: [50] })
    .toBeGreaterThan(9.3);
  await page.keyboard.up("KeyD");
  await page.keyboard.down("KeyW");
  await expect
    .poll(() => coord("cy"), { timeout: 20000, intervals: [100] })
    .toBeLessThan(-9);
  await page.keyboard.up("KeyW");
  await expect(page.locator(".museum-title")).toContainText("Upper gallery");
  await page.screenshot({ path: "test-results/upper-gallery.png" });
  await page.keyboard.down("KeyS");
  await expect
    .poll(() => coord("cy"), { timeout: 20000, intervals: [100] })
    .toBeGreaterThan(9);
  await page.keyboard.up("KeyS");
  await expect(page.locator(".museum-title")).toContainText("Ground floor");
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Main menu", exact: false }).click();
  await expect(
    page.getByRole("button", { name: "Enter the museum" }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});
test("mouse fallback turns movement and losing focus pauses safely", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Element.prototype.requestPointerLock = async () => {
      throw new Error("Pointer lock unavailable for fallback test");
    };
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Enter the museum" }).click();
  await expect(page.locator(".look-hint")).toBeVisible();
  await page.mouse.move(650, 450);
  await page.mouse.down();
  await page.mouse.move(950, 450, { steps: 10 });
  await page.mouse.up();
  await page.keyboard.down("KeyW");
  await expect
    .poll(async () =>
      Number(await page.locator(".map circle").last().getAttribute("cx")),
    )
    .toBeGreaterThan(0.5);
  await page.keyboard.up("KeyW");
  await page.evaluate(() => window.dispatchEvent(new Event("blur")));
  await expect(
    page.getByRole("heading", { name: "Heist on hold." }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Resume exploration" }).click();
  await expect(page.locator(".player-card")).toContainText("Standing");
  await page.setViewportSize({ width: 1024, height: 720 });
  await expect(page.locator("canvas")).toHaveJSProperty("clientWidth", 1024);
  await page.screenshot({ path: "test-results/compact-desktop.png" });
});
