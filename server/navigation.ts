import { BOUNDS, collisionBoxes, decks, rampHeight } from "../src/world/layout";
import { createPlayer, overlaps } from "../src/game/movement";
import type { Point } from "../src/game/heist";
interface Node extends Point {
  key: string;
  edges: number[];
}
const nodes: Node[] = [];
const columns = new Map<string, number[]>();
for (let x = BOUNDS.x0 + 1; x < BOUNDS.x1; x++)
  for (let z = BOUNDS.z0 + 1; z < BOUNDS.z1; z++) {
    const ramp = rampHeight(x, z);
    const heights = [
      ramp === null
        ? 0
        : Math.min(4.5, (Math.ceil((8 - z + 0.32) / 0.5) * 4.5) / 32),
    ];
    if (
      decks.some((s) => x >= s.x0 && x <= s.x1 && z >= s.z0 && z <= s.z1) &&
      !heights.includes(4.5)
    )
      heights.push(4.5);
    for (const y of heights) {
      const p = { ...createPlayer(), x, y, z };
      if (collisionBoxes.some((b) => overlaps(p, 1.8, b))) continue;
      const index = nodes.length;
      nodes.push({ x, y, z, key: `${x},${y},${z}`, edges: [] });
      const key = `${x},${z}`;
      columns.set(key, [...(columns.get(key) ?? []), index]);
    }
  }
for (const n of nodes)
  for (const [dx, dz] of [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ])
    for (const i of columns.get(`${n.x + dx},${n.z + dz}`) ?? [])
      if (Math.abs(nodes[i].y - n.y) < 0.34) n.edges.push(i);
function nearest(p: Point) {
  let best = 0,
    d = Infinity;
  nodes.forEach((n, i) => {
    const value = (n.x - p.x) ** 2 + (n.z - p.z) ** 2 + 9 * (n.y - p.y) ** 2;
    if (value < d) {
      d = value;
      best = i;
    }
  });
  return best;
}
export function findPath(from: Point, to: Point): Point[] {
  const start = nearest(from),
    end = nearest(to),
    queue = [start],
    prev = new Map<number, number>([[start, -1]]);
  for (let head = 0; head < queue.length; head++) {
    const at = queue[head];
    if (at === end) break;
    for (const next of nodes[at].edges)
      if (!prev.has(next)) {
        prev.set(next, at);
        queue.push(next);
      }
  }
  if (!prev.has(end)) return [];
  const path: Point[] = [];
  for (let i = end; i !== start; i = prev.get(i)!) {
    const { x, y, z } = nodes[i];
    path.unshift({ x, y, z });
  }
  return path;
}
export function hasSight(from: Point, to: Point) {
  const dx = to.x - from.x,
    dy = to.y - from.y,
    dz = to.z - from.z;
  for (const b of collisionBoxes) {
    let low = 0,
      high = 1;
    for (const [start, delta, min, max] of [
      [from.x, dx, b.x - b.w / 2, b.x + b.w / 2],
      [from.y, dy, b.y - b.h / 2, b.y + b.h / 2],
      [from.z, dz, b.z - b.d / 2, b.z + b.d / 2],
    ]) {
      if (Math.abs(delta) < 1e-8) {
        if (start > min && start < max) continue;
        low = 2;
        break;
      }
      const a = (min - start) / delta,
        c = (max - start) / delta;
      low = Math.max(low, Math.min(a, c));
      high = Math.min(high, Math.max(a, c));
    }
    if (low < high && high > 0.01 && low < 0.99) return false;
  }
  return true;
}
