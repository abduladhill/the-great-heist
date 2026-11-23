import { randomBytes } from "node:crypto";
import {
  existsSync,
  readFileSync,
  mkdirSync,
  writeFileSync,
  renameSync,
} from "node:fs";
import { dirname } from "node:path";
import { levelForXP } from "../src/game/heist";
import type { Profile } from "../src/game/heist";
const fresh = (): Profile => ({
  xp: 0,
  level: 1,
  wins: 0,
  heists: 0,
  cash: 0,
  mask: "ivory",
});
export class ProfileStore {
  private records: Record<string, Profile> = {};
  constructor(private file?: string) {
    if (file && existsSync(file)) {
      const data = JSON.parse(readFileSync(file, "utf8"));
      if (data && typeof data === "object") this.records = data;
    }
  }
  authenticate(key: unknown) {
    const known =
      typeof key === "string" &&
      /^[a-f0-9]{48}$/.test(key) &&
      Object.hasOwn(this.records, key);
    const token = known ? (key as string) : randomBytes(24).toString("hex");
    if (!known) {
      this.records[token] = fresh();
      this.save();
    }
    return { token, profile: this.records[token] };
  }
  get(key: string) {
    return this.records[key];
  }
  reward(key: string, won: boolean, xp: number, cash: number) {
    const p = this.records[key];
    if (!p) return;
    p.xp += xp;
    p.cash += cash;
    p.level = levelForXP(p.xp);
    p.heists++;
    if (won) p.wins++;
    this.save();
  }
  mask(key: string, value: unknown) {
    const p = this.records[key];
    if (!p) throw new Error("Profile unavailable.");
    if (value !== "ivory" && value !== "gold" && value !== "onyx")
      throw new Error("Unknown mask.");
    if ((value === "gold" && p.level < 3) || (value === "onyx" && p.level < 5))
      throw new Error("That mask is still locked.");
    p.mask = value;
    this.save();
  }
  private save() {
    if (!this.file) return;
    mkdirSync(dirname(this.file), { recursive: true });
    writeFileSync(`${this.file}.tmp`, JSON.stringify(this.records));
    renameSync(`${this.file}.tmp`, this.file);
  }
}
