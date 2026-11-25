import { describe, it, expect } from "vitest";
import {
  createPlayer,
  stepPlayer,
  FIXED_DT,
  overlaps,
  HEIGHT,
} from "./movement";
import { collisionBoxes, UPPER } from "../world/layout";
import type { InputFrame, PlayerState, Box } from "./types";
const idle: InputFrame = {
  forward: 0,
  right: 0,
  yaw: 0,
  sprint: false,
  crouch: false,
  jump: false,
};
function advance(
  p: PlayerState,
  input: Partial<InputFrame>,
  seconds: number,
  boxes = collisionBoxes,
) {
  for (let i = 0; i < Math.round(seconds / FIXED_DT); i++)
    stepPlayer(p, { ...idle, ...input }, FIXED_DT, boxes);
}
describe("fixed-step player simulation", () => {
  it("spawns grounded and remains stable", () => {
    const p = createPlayer();
    advance(p, {}, 2);
    expect(p.y).toBe(0);
    expect(p.grounded).toBe(true);
  });
  it("walks at four metres per second", () => {
    const p = createPlayer();
    advance(p, { forward: 1 }, 1);
    expect(p.z).toBeCloseTo(8);
  });
  it("normalizes diagonal speed", () => {
    const p = createPlayer();
    advance(p, { forward: 1, right: 1 }, 1, []);
    expect(Math.hypot(p.x, p.z - 12)).toBeCloseTo(4);
  });
  it("sprints faster and crouch overrides sprint", () => {
    const p = createPlayer();
    advance(p, { forward: 1, sprint: true }, 1, []);
    expect(p.z).toBeCloseTo(5);
    const q = createPlayer();
    advance(q, { forward: 1, sprint: true, crouch: true }, 1, []);
    expect(q.z).toBeCloseTo(10);
    expect(q.sprinting).toBe(false);
  });
  it("moves relative to camera heading", () => {
    const p = createPlayer();
    advance(p, { forward: 1, yaw: Math.PI / 2 }, 1, []);
    expect(p.x).toBeCloseTo(-4);
    expect(p.z).toBeCloseTo(12);
  });
  it("jumps, cannot double jump, and lands", () => {
    const p = createPlayer();
    stepPlayer(p, { ...idle, jump: true });
    expect(p.vy).toBeGreaterThan(0);
    advance(p, {}, 0.1);
    const vy = p.vy;
    stepPlayer(p, { ...idle, jump: true });
    expect(p.vy).toBeLessThan(vy);
    advance(p, {}, 1);
    expect(p.y).toBe(0);
    expect(p.grounded).toBe(true);
  });
  it("does not jump while crouching", () => {
    const p = createPlayer();
    stepPlayer(p, { ...idle, crouch: true, jump: true });
    expect(p.y).toBe(0);
  });
  it("blocks outer walls even at sprint speed", () => {
    const p = createPlayer();
    p.x = 20; p.z = 16;
    advance(p, { right: 1, sprint: true }, 5);
    expect(p.x).toBeLessThanOrEqual(21.68);
    expect(p.x).toBeGreaterThan(21.5);
  });
  it("blocks exhibits", () => {
    const p = createPlayer();
    p.z = 3;
    advance(p, { forward: 1 }, 2);
    expect(p.z).toBeGreaterThanOrEqual(0.72);
    expect(collisionBoxes.some((b) => overlaps(p, HEIGHT, b))).toBe(false);
  });
  it("slides alongside walls", () => {
    const p = createPlayer();
    p.x = -21.6;
    p.z = 7;
    advance(p, { forward: 1, right: -1 }, 1);
    expect(p.z).toBeLessThan(5);
    expect(p.x).toBeGreaterThan(-21.7);
  });
  it("climbs the entire staircase and reaches upper deck", () => {
    const p = createPlayer();
    p.x = 9.5;
    p.z = 9;
    advance(p, { forward: 1 }, 5);
    expect(p.z).toBeCloseTo(-11);
    expect(p.y).toBeCloseTo(UPPER);
  });
  it("descends the entire staircase", () => {
    const p = createPlayer();
    p.x = 9.5;
    p.z = -9;
    p.y = UPPER;
    advance(p, { forward: -1 }, 5);
    expect(p.z).toBeCloseTo(11);
    expect(p.y).toBe(0);
  });
  it("blocks walking through the solid side of the staircase", () => {
    const p = createPlayer();
    p.x = 6.5;
    p.z = 0;
    advance(p, { right: 1 }, 2);
    expect(p.x).toBeLessThanOrEqual(7.68);
    expect(p.y).toBe(0);
  });
  it("keeps ground-floor players below upper slabs", () => {
    const p = createPlayer();
    p.x = -11;
    p.z = 10;
    advance(p, {}, 1);
    expect(p.y).toBe(0);
  });
  it("blocks the upper atrium railing", () => {
    const p = createPlayer();
    p.x = -9;
    p.y = UPPER;
    p.z = 6;
    advance(p, { right: 1 }, 2);
    expect(p.x).toBeLessThan(-7.3);
    expect(p.y).toBe(UPPER);
  });
  it("prevents standing up through a low ceiling", () => {
    const b: Box = {
      id: "ceiling",
      x: 0,
      y: 1.5,
      z: 12,
      w: 3,
      h: 0.2,
      d: 3,
      color: "",
    };
    const p = createPlayer();
    p.crouched = true;
    advance(p, {}, 0.1, [b]);
    expect(p.crouched).toBe(true);
  });
  it("stops upward velocity at ceilings", () => {
    const b: Box = {
      id: "ceiling",
      x: 0,
      y: 2.2,
      z: 12,
      w: 3,
      h: 0.2,
      d: 3,
      color: "",
    };
    const p = createPlayer();
    stepPlayer(p, { ...idle, jump: true }, FIXED_DT, [b]);
    advance(p, {}, 0.12, [b]);
    expect(p.y + HEIGHT).toBeLessThanOrEqual(2.1);
    expect(p.vy).toBeLessThanOrEqual(0);
  });
});
