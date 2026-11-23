import { describe, it, expect } from "vitest";
import { RoomStore, parseInput } from "./rooms";
import { NEUTRAL } from "../src/network/protocol";
function crew(count = 2) {
  const store = new RoomStore(100);
  const first = store.create("Host", "s0");
  for (let i = 1; i < count; i++)
    store.join(first.room.code, `Crew ${i}`, `s${i}`);
  for (const p of first.room.players.values()) p.ready = true;
  return { store, ...first };
}
describe("authoritative room lifecycle", () => {
  it("creates distinct six-character codes and private member credentials", () => {
    const { store, room } = crew();
    expect(room.code).toMatch(/^[A-F0-9]{6}$/);
    expect(store.create("Other", "x").room.code).not.toBe(room.code);
    expect(JSON.stringify(store.snapshot(room))).not.toContain("token");
  });
  it("rejects missing names, invalid codes and nonexistent rooms", () => {
    const store = new RoomStore();
    expect(() => store.create(" ", "s")).toThrow();
    expect(() => store.join("../", "a", "s")).toThrow();
    expect(() => store.join("ZZZZZZ", "a", "s")).toThrow("not found");
  });
  it("caps a room at four unique colors", () => {
    const { store, room } = crew(4);
    expect(() => store.join(room.code, "Fifth", "s5")).toThrow("full");
    expect(new Set([...room.players.values()].map((p) => p.color)).size).toBe(
      4,
    );
  });
  it("requires two ready members and host authority", () => {
    const { store, room, member } = crew(1);
    expect(() => store.start(room, member)).toThrow("two");
    const other = store.join(room.code, "Two", "s2").member;
    expect(() => store.start(room, other)).toThrow("host");
    expect(() => store.start(room, member)).toThrow("ready");
    other.ready = true;
    store.start(room, member);
    expect(room.phase).toBe("playing");
  });
  it("spawns members separately and rejects late joins", () => {
    const { store, room, member } = crew(4);
    store.start(room, member);
    expect(new Set([...room.players.values()].map((p) => p.state.x)).size).toBe(
      4,
    );
    expect(() => store.join(room.code, "Late", "s5")).toThrow("already");
  });
  it("moves by server time rather than packet count and clamps axes", () => {
    const { store, room, member } = crew();
    store.start(room, member);
    for (let i = 0; i < 100; i++)
      store.input(
        room,
        member,
        { seq: i, input: { ...NEUTRAL, forward: 100 } },
        100,
      );
    expect(member.state.z).toBe(12);
    for (let i = 0; i < 120; i++) store.tick(100);
    expect(member.state.z).toBeCloseTo(8);
  });
  it("ignores duplicate/out-of-order input and stale held keys", () => {
    const { store, room, member } = crew();
    store.start(room, member);
    store.input(
      room,
      member,
      { seq: 4, input: { ...NEUTRAL, forward: 1 } },
      100,
    );
    store.input(
      room,
      member,
      { seq: 3, input: { ...NEUTRAL, forward: -1 } },
      100,
    );
    expect(member.input.forward).toBe(1);
    store.tick(400);
    expect(member.state.z).toBe(12);
  });
  it("rejects malformed, nonfinite and nonboolean inputs", () => {
    for (const value of [
      null,
      {},
      { seq: 1, input: { ...NEUTRAL, yaw: Infinity } },
      { seq: 1, input: { ...NEUTRAL, forward: "1" } },
      { seq: 1, input: { ...NEUTRAL, jump: "yes" } },
      { seq: -1, input: NEUTRAL },
    ])
      expect(parseInput(value)).toBeNull();
  });
  it("keeps authoritative wall collisions", () => {
    const { store, room, member } = crew();
    store.start(room, member);
    store.input(
      room,
      member,
      { seq: 0, input: { ...NEUTRAL, right: 1, sprint: true } },
      100,
    );
    for (let i = 0; i < 600; i++) store.tick(100);
    expect(member.state.x).toBeLessThanOrEqual(13.68);
  });
  it("transfers host and resumes the same identity and position", () => {
    const { store, room, member } = crew();
    store.start(room, member);
    const id = member.id;
    member.state.z = 9;
    store.disconnect(room, member, 100);
    expect(room.hostId).not.toBe(id);
    const resumed = store.resume(room.code, member.token, "new", 150);
    expect(resumed.member.id).toBe(id);
    expect(resumed.member.state.z).toBe(9);
    expect(resumed.member.input).toEqual(NEUTRAL);
  });
  it("rejects wrong tokens and already-active token reuse", () => {
    const { store, room, member } = crew();
    expect(() => store.resume(room.code, member.token, "x", 0)).toThrow();
    store.disconnect(room, member, 0);
    expect(() => store.resume(room.code, "wrong", "x", 20)).toThrow();
  });
  it("expires disconnected seats and deletes empty rooms", () => {
    const { store, room } = crew();
    for (const p of room.players.values()) store.disconnect(room, p, 0);
    store.tick(101);
    expect(store.rooms.size).toBe(0);
  });
  it("host return to lobby clears readiness and restarts cleanly", () => {
    const { store, room, member } = crew();
    store.start(room, member);
    member.state.z = 3;
    store.lobby(room, member);
    expect([...room.players.values()].every((p) => !p.ready)).toBe(true);
    for (const p of room.players.values()) p.ready = true;
    store.start(room, member);
    expect(member.state.z).toBe(12);
  });
  it("leaving frees a slot without changing other rooms", () => {
    const { store, room, member } = crew(4);
    const other = store.create("Isolated", "i");
    store.remove(room, member);
    store.join(room.code, "Replacement", "r");
    expect(room.players.size).toBe(4);
    expect(other.room.players.size).toBe(1);
  });
  it("restores a held interaction after stale input without another key press", () => {
    const { store, room, member } = crew();
    store.start(room, member);
    store.input(
      room,
      member,
      { seq: 1, input: { ...NEUTRAL, interact: true } },
      100,
    );
    expect(member.holding).toBe(true);
    store.tick(400);
    expect(member.holding).toBe(false);
    store.input(
      room,
      member,
      { seq: 2, input: { ...NEUTRAL, interact: true } },
      450,
    );
    expect(member.holding).toBe(true);
    store.input(
      room,
      member,
      { seq: 3, input: { ...NEUTRAL, interact: false } },
      460,
    );
    expect(member.holding).toBe(false);
  });
});
