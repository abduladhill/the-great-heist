import type { Box, Surface } from "../game/types";
export const UPPER = 4.5;
export const SPAWN = { x: 0, y: 0, z: 12 };
export const STAIR = { x0: 8, x1: 11, z0: -8, z1: 8 };
export const decks: Surface[] = [
  { x0: -14, x1: 14, z0: -16, z1: -8, height: UPPER },
  { x0: -14, x1: -7, z0: -8, z1: 10, height: UPPER },
  { x0: 12, x1: 14, z0: -8, z1: 10, height: UPPER },
  { x0: -14, x1: 14, z0: 10, z1: 16, height: UPPER },
];
const box = (
  id: string,
  x: number,
  y: number,
  z: number,
  w: number,
  h: number,
  d: number,
  color = "#52666a",
): Box => ({ id, x, y, z, w, h, d, color });
export const solids: Box[] = [
  box("west wall", -14.25, 4.5, 0, 0.5, 9, 32.5),
  box("east wall", 14.25, 4.5, 0, 0.5, 9, 32.5),
  box("north wall", 0, 4.5, -16.25, 28, 9, 0.5),
  box("south wall", 0, 4.5, 16.25, 28, 9, 0.5),
  ...decks.map((s, i) =>
    box(
      `upper slab ${i}`,
      (s.x0 + s.x1) / 2,
      UPPER - 0.18,
      (s.z0 + s.z1) / 2,
      s.x1 - s.x0,
      0.36,
      s.z1 - s.z0,
      "#adb7ae",
    ),
  ),
  box("west gallery partition", -7, 1.8, -3, 0.35, 3.6, 10),
  box("west gallery partition south", -7, 1.8, 10, 0.35, 3.6, 3),
  box("north gallery left", -9, 1.8, -8, 10, 3.6, 0.35),
  box("north gallery right", 9, 1.8, -8, 10, 3.6, 0.35),
  box("atrium exhibit", 0, 0.65, -1, 2.8, 1.3, 2.8, "#d5c8aa"),
  ...[-11, -3, 5].map((x, i) =>
    box(`north plinth ${i}`, x, 0.65, -12, 1.7, 1.3, 1.7, "#c8c1b0"),
  ),
  box("west plinth", -11, 0.65, 2, 1.7, 1.3, 1.7, "#c8c1b0"),
  ...[-10, -2, 6].map((x, i) =>
    box(`upper plinth ${i}`, x, UPPER + 0.65, -12.5, 1.7, 1.3, 1.7, "#c8c1b0"),
  ),
  box("upper west plinth", -11, UPPER + 0.65, 2, 1.7, 1.3, 1.7, "#c8c1b0"),
  ...[-5, 5].flatMap((x) =>
    [-6, 8].map((z) =>
      box(`column ${x} ${z}`, x, 4.3, z, 0.65, 8.6, 0.65, "#b9b9a8"),
    ),
  ),
  box("west atrium rail", -7, 5.1, 1, 0.18, 1.2, 18, "#b89b62"),
  box("north atrium rail", 0.5, 5.1, -8, 15, 1.2, 0.18, "#b89b62"),
  box("south atrium rail", 2.5, 5.1, 10, 19, 1.2, 0.18, "#b89b62"),
  box("east atrium rail", 12, 5.1, 1, 0.18, 1.2, 18, "#b89b62"),
];
// Continuous invisible stair ramp; visual treads are generated from the same bounds.
export function rampHeight(x: number, z: number): number | null {
  return x >= STAIR.x0 && x <= STAIR.x1 && z >= STAIR.z0 && z <= STAIR.z1
    ? ((STAIR.z1 - z) / (STAIR.z1 - STAIR.z0)) * UPPER
    : null;
}
export function floorHeight(x: number, z: number, feet: number): number {
  let y = 0;
  for (const s of decks)
    if (
      x >= s.x0 &&
      x <= s.x1 &&
      z >= s.z0 &&
      z <= s.z1 &&
      s.height <= feet + 0.32
    )
      y = Math.max(y, s.height);
  const ramp = rampHeight(x, z);
  if (ramp !== null && ramp <= feet + 0.32) y = Math.max(y, ramp);
  return y;
}
export const stairRails: Box[] = Array.from({ length: 32 }, (_, i) => {
  const z = 7.75 - i * 0.5,
    h = ((8 - z) / 16) * UPPER;
  return [
    box(`stair left ${i}`, 7.9, h + 0.6, z, 0.18, 1.2, 0.5, "#b89b62"),
    box(`stair right ${i}`, 11.1, h + 0.6, z, 0.18, 1.2, 0.5, "#b89b62"),
  ];
}).flat();
export const stairSteps: Box[] = Array.from({ length: 32 }, (_, i) => {
  const height = ((i + 1) * UPPER) / 32;
  return box(
    `stair tread ${i}`,
    9.5,
    height / 2,
    7.75 - i * 0.5,
    3,
    height,
    0.5,
    "#c4c5b8",
  );
});
export const collisionBoxes = [...solids, ...stairRails, ...stairSteps];
