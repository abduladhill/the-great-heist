import type { Box, InputFrame, PlayerState } from "./types";
import { collisionBoxes, floorHeight, SPAWN } from "../world/layout";
export const FIXED_DT = 1 / 120;
export const RADIUS = 0.32;
export const HEIGHT = 1.8;
export const CROUCH_HEIGHT = 1.1;
export function createPlayer(): PlayerState {
  return {
    ...SPAWN,
    vy: 0,
    yaw: 0,
    grounded: true,
    crouched: false,
    moving: false,
    sprinting: false,
  };
}
export function overlaps(p: PlayerState, height: number, b: Box): boolean {
  return (
    p.x + RADIUS > b.x - b.w / 2 &&
    p.x - RADIUS < b.x + b.w / 2 &&
    p.z + RADIUS > b.z - b.d / 2 &&
    p.z - RADIUS < b.z + b.d / 2 &&
    p.y + height > b.y - b.h / 2 + 0.001 &&
    p.y < b.y + b.h / 2 - 0.001
  );
}
export function stepPlayer(
  p: PlayerState,
  input: InputFrame,
  dt = FIXED_DT,
  boxes = collisionBoxes,
): void {
  p.crouched =
    input.crouch || (p.crouched && boxes.some((b) => overlaps(p, HEIGHT, b)));
  const height = p.crouched ? CROUCH_HEIGHT : HEIGHT;
  const norm = Math.max(1, Math.hypot(input.forward, input.right));
  p.moving = norm > 0 && (input.forward !== 0 || input.right !== 0);
  p.sprinting = input.sprint && !p.crouched && p.moving;
  const speed = p.crouched ? 2 : p.sprinting ? 7 : 4;
  const dx =
    ((Math.cos(input.yaw) * input.right - Math.sin(input.yaw) * input.forward) /
      norm) *
    speed *
    dt;
  const dz =
    ((-Math.sin(input.yaw) * input.right -
      Math.cos(input.yaw) * input.forward) /
      norm) *
    speed *
    dt;
  if (p.moving) p.yaw = Math.atan2(-dx, -dz);
  if (input.jump && p.grounded && !p.crouched) {
    p.vy = 6.2;
    p.grounded = false;
  }
  for (const [axis, delta] of [
    ["x", dx],
    ["z", dz],
  ] as const) {
    const old = p[axis],
      oldY = p.y;
    p[axis] += delta;
    const floor = floorHeight(p.x, p.z, p.y);
    if (p.grounded && floor >= p.y && floor - p.y <= 0.32) p.y = floor;
    const blocking = boxes.filter((b) => overlaps(p, height, b));
    if (blocking.length && p.grounded) {
      const top = Math.max(...blocking.map((b) => b.y + b.h / 2));
      if (top > p.y && top - p.y <= 0.32) p.y = top;
    }
    if (boxes.some((b) => overlaps(p, height, b))) {
      p[axis] = old;
      p.y = oldY;
    }
  }
  const previousY = p.y;
  p.vy -= 18 * dt;
  p.y += p.vy * dt;
  let landed = false;
  for (const b of boxes) {
    if (!overlaps(p, height, b)) continue;
    if (p.vy > 0 && previousY + height <= b.y - b.h / 2 + 0.01) {
      p.y = b.y - b.h / 2 - height;
      p.vy = 0;
    } else if (p.vy <= 0 && previousY >= b.y + b.h / 2 - 0.01) {
      p.y = b.y + b.h / 2;
      p.vy = 0;
      landed = true;
    }
  }
  const floor = floorHeight(p.x, p.z, Math.max(previousY, p.y));
  if (p.y <= floor) {
    p.y = floor;
    p.vy = 0;
    p.grounded = true;
  } else p.grounded = landed;
  if (p.y < -10) Object.assign(p, createPlayer());
}
