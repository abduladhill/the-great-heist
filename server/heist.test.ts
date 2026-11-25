import { describe, it, expect } from "vitest";
import { RoomStore } from "./rooms";
import { findPath, hasSight } from "./navigation";
import { EXIT, JAIL, DIFFICULTIES } from "../src/game/heist";
function setup(
  mission: "artifacts" | "vault" | "data" | "annex" = "artifacts",
  solo = true,
) {
  const store = new RoomStore();
  const { room, member } = store.create("Test", "one", undefined, solo);
  store.configure(room, member, { mission, difficulty: "easy" });
  member.ready = true;
  if (!solo) {
    const p = store.join(room.code, "Two", "two").member;
    p.ready = true;
  }
  store.start(room, member);
  return { store, room, member, director: room.director! };
}
function advance(d: ReturnType<typeof setup>["director"], seconds: number) {
  for (let i = 0; i < seconds * 20; i++) d.step(0.05);
}
function collect(f: ReturnType<typeof setup>, id: string) {
  const item = f.director.state.loot.find((l) => l.id === id)!;
  Object.assign(f.member.state, item);
  f.member.operative.immuneUntil = 1000;
  f.member.holding = true;
  advance(f.director, 5);
}
describe("museum heist rules", () => {
  it("finds a navigable route between both floors", () => {
    const path = findPath({ x: 0, y: 0, z: 12 }, { x: -11, y: 4.5, z: 7 });
    expect(path.length).toBeGreaterThan(20);
    expect(path.some((n) => n.y > 0 && n.y < 4.5)).toBe(true);
    expect(path.at(-1)?.y).toBe(4.5);
  });
  it("blocks vision through partitions and upper floor slabs", () => {
    expect(hasSight({ x: -9, y: 1, z: 0 }, { x: -5, y: 1, z: 0 })).toBe(false);
    expect(hasSight({ x: -11, y: 1, z: 6 }, { x: -11, y: 6, z: 6 })).toBe(
      false,
    );
    expect(hasSight({ x: 0, y: 1, z: 12 }, { x: 0, y: 1, z: 5 })).toBe(true);
  });
  it("requires nearby held interaction and prevents duplicate loot", () => {
    const f = setup();
    f.member.holding = true;
    advance(f.director, 2);
    expect(f.director.state.progress).toBe(0);
    collect(f, "artifact-0");
    expect(f.director.state.progress).toBe(1);
    f.member.holding = true;
    advance(f.director, 3);
    expect(f.director.state.progress).toBe(1);
  });
  it("wins artifact mission, awards XP once and unlocks smoke", () => {
    const f = setup();
    for (const l of f.director.state.loot.slice(0, 3)) collect(f, l.id);
    expect(f.director.state.objectiveReady).toBe(true);
    Object.assign(f.member.state, EXIT);
    f.member.holding = true;
    advance(f.director, 2);
    expect(f.room.phase).toBe("results");
    expect(f.director.state.result?.won).toBe(true);
    expect(f.member.profile.level).toBe(2);
    const xp = f.member.profile.xp;
    advance(f.director, 5);
    expect(f.member.profile.xp).toBe(xp);
    f.store.lobby(f.room, f.member);
    f.member.ready = true;
    f.store.start(f.room, f.member);
    expect(f.member.operative.smoke).toBe(2);
  });
  it("requires terminals before vault and completes the vault mission", () => {
    const f = setup("vault");
    collect(f, "vault");
    expect(f.director.state.progress).toBe(0);
    collect(f, "terminal-0");
    collect(f, "terminal-1");
    collect(f, "vault");
    expect(f.director.state.objectiveReady).toBe(true);
  });
  it("completes all three data archives", () => {
    const f = setup("data");
    for (const l of f.director.state.loot) collect(f, l.id);
    expect(f.director.state.progress).toBe(3);
    expect(f.director.state.objectiveReady).toBe(true);
  });
  it("rescues captured teammates with a timed interaction", () => {
    const f = setup("data", false);
    const teammate = [...f.room.players.values()][1];
    teammate.operative.captured = true;
    Object.assign(teammate.state, JAIL);
    Object.assign(f.member.state, { ...JAIL, x: JAIL.x + 1 });
    f.member.holding = true;
    advance(f.director, 3.5);
    expect(teammate.operative.captured).toBe(false);
    expect(teammate.operative.immuneUntil).toBeGreaterThan(
      f.director.state.elapsed,
    );
  });
  it("requires every crewmate to extract", () => {
    const f = setup("data", false);
    for (const l of f.director.state.loot) l.taken = true;
    Object.assign(f.member.state, EXIT);
    f.member.holding = true;
    advance(f.director, 2);
    expect(f.room.phase).toBe("playing");
    const other = [...f.room.players.values()][1];
    Object.assign(other.state, EXIT);
    other.holding = true;
    advance(f.director, 2);
    expect(f.director.state.result?.won).toBe(true);
  });
  it("fails when time runs out or all remaining players are captured", () => {
    const f = setup();
    f.director.state.elapsed = f.director.state.duration - 0.01;
    advance(f.director, 0.1);
    expect(f.director.state.result?.won).toBe(false);
    const q = setup();
    q.member.operative.captured = true;
    advance(q.director, 0.1);
    expect(q.director.state.result?.reason).toContain("captured");
  });
  it("enforces gadget unlocks, charges and cooldowns", () => {
    const f = setup();
    expect(() => f.director.gadget(f.member, "smoke")).toThrow("charges");
    f.member.operative.smoke = 2;
    f.member.operative.jammer = 1;
    f.director.gadget(f.member, "smoke");
    expect(f.director.state.smoke.length).toBe(1);
    expect(() => f.director.gadget(f.member, "jammer")).toThrow("cooldown");
    advance(f.director, 2.1);
    f.director.gadget(f.member, "jammer");
    expect(f.director.state.jamUntil).toBeGreaterThan(
      f.director.state.elapsed + 11,
    );
    expect(f.member.operative.jammer).toBe(0);
  });
  it("raises detection from guard vision, while smoke breaks sight", () => {
    const f = setup();
    const g = f.director.state.guards[0];
    Object.assign(f.member.state, { x: g.x, y: g.y, z: g.z - 2 });
    f.member.operative.immuneUntil = 0;
    advance(f.director, 0.3);
    expect(f.member.operative.exposure).toBeGreaterThan(0);
    f.member.operative.smoke = 1;
    f.director.gadget(f.member, "smoke");
    advance(f.director, 0.3);
    expect(f.member.operative.exposure).toBe(0);
  });
  it("scales patrol count and time with difficulty", () => {
    for (const difficulty of ["easy", "normal", "hard"] as const) {
      const f = setup();
      f.store.lobby(f.room, f.member);
      f.store.configure(f.room, f.member, { mission: "data", difficulty });
      f.member.ready = true;
      f.store.start(f.room, f.member);
      expect(f.room.heist!.guards.length).toBe(DIFFICULTIES[difficulty].guards);
      expect(f.room.heist!.duration).toBe(DIFFICULTIES[difficulty].time);
    }
  });
  it("patrols move and investigate sprint noise", () => {
    const f = setup();
    const g = f.director.state.guards[0],
      initial = { ...g };
    advance(f.director, 1);
    expect(Math.hypot(g.x - initial.x, g.z - initial.z)).toBeGreaterThan(0.1);
    Object.assign(f.member.state, {
      x: g.x + 1,
      y: g.y,
      z: g.z + 3,
      sprinting: true,
    });
    f.member.operative.immuneUntil = 0;
    advance(f.director, 0.05);
    expect(["investigate", "chase"]).toContain(g.mode);
  });
});

it("research wing archives are reachable through both annex entrances", () => {
  for (const x of [-11, 11]) {
    const path = findPath({ x, y: 0, z: -14 }, { x, y: 0, z: -21 });
    expect(path.at(-1)?.z).toBe(-21);
    expect(path.some((p) => Math.abs(p.x) >= 7 && Math.abs(p.x) <= 9)).toBe(
      true,
    );
  }
});
it("research contract can be completed solo", () => {
  const f = setup("annex");
  for (const l of f.director.state.loot) collect(f, l.id);
  advance(f.director, 0.1);
  expect(f.director.state.objectiveReady).toBe(true);
});
it("nearby teammates accelerate terminal hacking", () => {
  const f = setup("annex", false);
  const target = f.director.state.loot[0];
  for (const p of f.room.players.values()) {
    Object.assign(p.state, target);
    p.holding = true;
    p.operative.immuneUntil = 1000;
  }
  advance(f.director, 2.8);
  expect(target.taken).toBe(true);
});

it("expanded wings connect to the lobby and research archives", () => {
  for(const to of [{x:-18,y:0,z:4},{x:18,y:0,z:4},{x:-18,y:0,z:-22},{x:18,y:0,z:-22},{x:0,y:0,z:-25}]) {
    const path=findPath({x:0,y:0,z:12},to);
    expect(path.at(-1)).toMatchObject(to);
  }
});
