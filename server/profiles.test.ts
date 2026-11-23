import { it, expect } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ProfileStore } from "./profiles";
it("persists XP, cash, wins, unlocks and equipped mask across server restarts", () => {
  const dir = mkdtempSync(join(tmpdir(), "heist-profile-"));
  try {
    const file = join(dir, "profiles.json"),
      store = new ProfileStore(file);
    const first = store.authenticate("");
    expect(() => store.mask(first.token, "gold")).toThrow("locked");
    store.reward(first.token, true, 650, 800);
    store.mask(first.token, "gold");
    const reloaded = new ProfileStore(file).authenticate(first.token);
    expect(reloaded.profile).toMatchObject({
      xp: 650,
      level: 3,
      wins: 1,
      heists: 1,
      cash: 800,
      mask: "gold",
    });
    expect(reloaded.token).toBe(first.token);
    expect(new ProfileStore(file).authenticate("forged").profile.xp).toBe(0);
  } finally {
    if (!dir.startsWith(join(tmpdir(), "heist-profile-")))
      throw new Error("Unexpected test directory.");
    rmSync(dir, { recursive: true, force: true });
  }
});
