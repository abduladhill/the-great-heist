import { randomUUID } from "node:crypto";
import {
  DIFFICULTIES,
  EXIT,
  JAIL,
  TERMINALS,
  VAULT,
  CAMERAS,
  LASERS,
  distance,
} from "../src/game/heist";
import type { Point, Guard, HeistState, Loot, Gadget } from "../src/game/heist";
import type { Room, ServerMember } from "./rooms";
import { findPath, hasSight } from "./navigation";
const ROUTES: Point[][] = [
  [
    { x: 3, y: 0, z: -5 },
    { x: 3, y: 0, z: 4 },
    { x: -3, y: 0, z: 4 },
    { x: -3, y: 0, z: -5 },
  ],
  [
    { x: 9, y: 4.5, z: -11 },
    { x: -5, y: 4.5, z: -10 },
    { x: -11, y: 4.5, z: -5 },
    { x: -11, y: 4.5, z: 7 },
  ],
  [
    { x: -11, y: 0, z: -14 },
    { x: 6, y: 0, z: -14 },
    { x: 0, y: 0, z: -10 },
  ],
  [
    { x: -11, y: 4.5, z: 13 },
    { x: 3, y: 4.5, z: 13 },
    { x: 13, y: 4.5, z: 4 },
  ],
];
const ARTIFACTS: Point[] = [
  { x: -3, y: 0, z: 5 },
  { x: 3, y: 0, z: -5 },
  { x: -11, y: 0, z: 4 },
  { x: 5, y: 0, z: -14 },
  { x: -3, y: 4.5, z: -10 },
  { x: -11, y: 4.5, z: 5 },
  { x: 5, y: 4.5, z: 13 },
  { x: 11, y: 4.5, z: -12 },
];
interface Brain {
  route: number;
  waypoint: number;
  path: Point[];
  nextPlan: number;
  lastSeen: Point;
  searchUntil: number;
}
export class HeistDirector {
  state: HeistState;
  private brains = new Map<string, Brain>();
  private laserCooldown = new Map<string, number>();
  constructor(
    private room: Room,
    private reward: (
      p: ServerMember,
      won: boolean,
      xp: number,
      cash: number,
    ) => void,
  ) {
    const rules = DIFFICULTIES[room.contract.difficulty];
    const count = room.players.size;
    const loot: Loot[] =
      room.contract.mission === "artifacts"
        ? ARTIFACTS.map((p, i) => ({
            ...p,
            id: `artifact-${i}`,
            name: `Artifact ${i + 1}`,
            kind: "artifact",
            taken: false,
          }))
        : (room.contract.mission === "vault"
            ? TERMINALS.slice(0, 2)
            : TERMINALS
          ).map((p, i) => ({
            ...p,
            id: `terminal-${i}`,
            name: `Archive ${i + 1}`,
            kind: "terminal",
            taken: false,
          }));
    if (room.contract.mission === "vault")
      loot.push({
        ...VAULT,
        id: "vault",
        name: "The Aurelia Crown",
        kind: "vault",
        taken: false,
      });
    const guards = ROUTES.slice(0, rules.guards).map((route, i): Guard => ({
      id: `guard-${i}`,
      ...route[0],
      yaw: 0,
      mode: "patrol",
      target: null,
      alert: 0,
    }));
    for (const [i, g] of guards.entries())
      this.brains.set(g.id, {
        route: i,
        waypoint: 1,
        path: [],
        nextPlan: 0,
        lastSeen: { ...g },
        searchUntil: 0,
      });
    this.state = {
      id: randomUUID(),
      elapsed: 0,
      duration: rules.time,
      alarm: 0,
      alarmTriggered: false,
      lockdown: null,
      loot,
      guards,
      smoke: [],
      jamUntil: 0,
      objectiveReady: false,
      progress: 0,
      target:
        room.contract.mission === "artifacts" ? Math.min(6, 2 + count) : 3,
      result: null,
      notice: "Stay quiet. Your crew needs to make it out together.",
    };
  }
  private active(p: ServerMember) {
    return !!p.socketId && !p.operative.captured && !p.operative.escaped;
  }
  private covered(p: Point) {
    return this.state.smoke.some(
      (s) => Math.abs(p.y - s.y) < 2 && distance(p, s) < 3.2,
    );
  }
  private raise(value: number) {
    this.state.alarm = Math.min(100, this.state.alarm + value);
  }
  gadget(p: ServerMember, gadget: Gadget) {
    const h = this.state,
      o = p.operative;
    if (!this.active(p) || h.result)
      throw new Error("You cannot use a gadget now.");
    if (gadget !== "smoke" && gadget !== "jammer")
      throw new Error("Unknown gadget.");
    if (o[gadget] <= 0)
      throw new Error(
        "No charges available. Unlock smoke at level 2 and jammer at level 3.",
      );
    if (h.elapsed < o.cooldown)
      throw new Error("Wait for your gadget cooldown.");
    o[gadget]--;
    o.cooldown = h.elapsed + 2;
    if (gadget === "smoke") {
      h.smoke.push({ ...p.state, id: randomUUID(), until: h.elapsed + 8 });
      o.exposure = 0;
      h.notice = `${p.name} deployed smoke. Break line of sight.`;
    } else {
      h.jamUntil = h.elapsed + 12;
      h.notice = `${p.name} jammed cameras and lasers for 12 seconds.`;
    }
  }
  private capture(p: ServerMember) {
    p.operative.captured = true;
    p.operative.exposure = 100;
    p.holding = false;
    Object.assign(p.state, JAIL, { vy: 0, moving: false, sprinting: false });
    this.raise(20);
    this.state.notice = `${p.name} was captured. Hold E beside them in the southwest holding area to rescue.`;
  }
  private finish(won: boolean, reason: string) {
    const h = this.state;
    if (h.result) return;
    const m = DIFFICULTIES[this.room.contract.difficulty].multiplier;
    const xp = won
      ? Math.round((250 + (h.alarmTriggered ? 0 : 75)) * m)
      : Math.round(h.progress * 20 * m);
    const cash = won ? Math.round((400 + h.progress * 80) * m) : 0;
    h.result = { won, reason, xp, cash };
    this.room.phase = "results";
    for (const p of this.room.players.values()) {
      p.holding = false;
      p.input.forward = 0;
      p.input.right = 0;
      p.state.moving = false;
      this.reward(p, won, xp, cash);
    }
  }
  private interaction(p: ServerMember, dt: number) {
    const h = this.state,
      o = p.operative;
    let id: string | null = null,
      duration = 1;
    const rescue = [...this.room.players.values()].find(
      (q) =>
        q.id !== p.id &&
        q.operative.captured &&
        distance(p.state, q.state) < 2.2,
    );
    let target: Loot | undefined;
    if (rescue) {
      id = `rescue-${rescue.id}`;
      duration = 3;
    } else if (h.objectiveReady && distance(p.state, EXIT) < 2.5) {
      id = "escape";
      duration = 1.5;
    } else {
      target = h.loot.find(
        (l) =>
          !l.taken &&
          distance(p.state, l) < 2 &&
          hasSight(
            { ...p.state, y: p.state.y + 0.8 },
            { ...l, y: l.y + 0.8 },
          ) &&
          (l.kind !== "vault" ||
            h.loot.filter((x) => x.kind === "terminal").every((x) => x.taken)),
      );
      if (target) {
        id = target.id;
        duration =
          target.kind === "terminal" ? 4 : target.kind === "vault" ? 3 : 1.2;
      }
    }
    if (!p.holding || !id || p.state.sprinting) {
      o.interaction = id;
      o.progress = 0;
      return;
    }
    if (o.interaction !== id) o.progress = 0;
    o.interaction = id;
    o.progress += dt / duration;
    if (o.progress < 1) return;
    o.progress = 0;
    p.holding = false;
    if (rescue) {
      rescue.operative.captured = false;
      rescue.operative.exposure = 0;
      rescue.operative.immuneUntil = h.elapsed + 5;
      h.notice = `${p.name} rescued ${rescue.name}.`;
    } else if (id === "escape") {
      o.escaped = true;
      h.notice = `${p.name} reached the getaway. Bring the rest of the crew.`;
    } else if (target && !target.taken) {
      target.taken = true;
      h.notice = `${p.name} secured ${target.name}.`;
    }
  }
  step(dt: number) {
    const h = this.state;
    if (h.result) return;
    h.elapsed += dt;
    h.smoke = h.smoke.filter((s) => s.until > h.elapsed);
    const rules = DIFFICULTIES[this.room.contract.difficulty];
    const players = [...this.room.players.values()];
    const active = players.filter((p) => this.active(p));
    const detected = new Set<string>();
    for (const g of h.guards) {
      const brain = this.brains.get(g.id)!;
      let seen: ServerMember | undefined;
      for (const p of active) {
        if (
          p.operative.immuneUntil > h.elapsed ||
          this.covered(p.state) ||
          this.covered(g)
        )
          continue;
        const d = distance(g, p.state),
          range = rules.range * (p.state.crouched ? 0.58 : 1);
        const angle = Math.atan2(-(p.state.x - g.x), -(p.state.z - g.z));
        const facing = Math.cos(angle - g.yaw) > 0.45;
        const los = hasSight(
          { ...g, y: g.y + 1.4 },
          { ...p.state, y: p.state.y + (p.state.crouched ? 0.7 : 1.35) },
        );
        if (
          d < range &&
          Math.abs(g.y - p.state.y) < 1.6 &&
          los &&
          (facing || d < 1.5 || g.mode === "chase")
        ) {
          seen = p;
          break;
        }
        if (p.state.sprinting && d < 5 && Math.abs(g.y - p.state.y) < 1.5) {
          brain.lastSeen = { ...p.state };
          brain.searchUntil = h.elapsed + 4;
          g.mode = "investigate";
        }
      }
      if (seen) {
        g.target = seen.id;
        g.mode = "chase";
        detected.add(seen.id);
        brain.lastSeen = { ...seen.state };
        brain.searchUntil = h.elapsed + 5;
        g.alert = 1;
        if (distance(g, seen.state) < 0.85 && seen.operative.exposure > 25)
          this.capture(seen);
      } else {
        g.target = null;
        g.mode = h.elapsed < brain.searchUntil ? "investigate" : "patrol";
        g.alert = Math.max(0, g.alert - dt * 0.4);
      }
      let destination = brain.lastSeen;
      if (g.mode === "patrol") {
        const route = ROUTES[brain.route];
        destination = route[brain.waypoint];
        if (distance(g, destination) < 0.7) {
          brain.waypoint = (brain.waypoint + 1) % route.length;
          destination = route[brain.waypoint];
        }
      }
      if (h.elapsed >= brain.nextPlan) {
        brain.path = findPath(g, destination);
        brain.nextPlan = h.elapsed + 0.6;
      }
      const next = brain.path[0];
      if (next) {
        const d = distance(g, next),
          step = rules.speed * (g.mode === "chase" ? 1.25 : 0.65) * dt;
        if (d <= step) {
          Object.assign(g, next);
          brain.path.shift();
        } else {
          g.x += ((next.x - g.x) / d) * step;
          g.y += ((next.y - g.y) / d) * step;
          g.z += ((next.z - g.z) / d) * step;
        }
        g.yaw = Math.atan2(-(next.x - g.x), -(next.z - g.z));
      }
    }
    for (const p of active) {
      const o = p.operative;
      if (o.captured) continue;
      let spotted = detected.has(p.id);
      if (
        h.jamUntil < h.elapsed &&
        !this.covered(p.state) &&
        o.immuneUntil < h.elapsed
      ) {
        for (const c of CAMERAS) {
          const angle = c.yaw + Math.sin(h.elapsed * 0.45) * 0.75;
          const target = { ...p.state, y: p.state.y + 1 };
          const bearing = Math.atan2(-(p.state.x - c.x), -(p.state.z - c.z));
          if (
            Math.abs(c.y - target.y) < 2.5 &&
            distance(c, target) < 9 &&
            Math.cos(bearing - angle) > 0.78 &&
            hasSight(c, target)
          )
            spotted = true;
        }
        if (Math.floor(h.elapsed / 3) % 2 === 0)
          for (const l of LASERS)
            if (
              Math.abs(p.state.y - l.y) < 0.5 &&
              Math.abs(p.state.z - l.z) < 0.22 &&
              Math.abs(p.state.x - l.x) < l.w / 2 &&
              (this.laserCooldown.get(p.id) ?? 0) < h.elapsed
            ) {
              this.raise(18);
              o.exposure = Math.min(100, o.exposure + 20);
              this.laserCooldown.set(p.id, h.elapsed + 2);
              h.notice = "Laser trip! The alarm is rising.";
            }
      }
      o.exposure = Math.max(
        0,
        Math.min(100, o.exposure + (spotted ? rules.detect : -22) * dt),
      );
      if (spotted) this.raise(8 * dt);
      if (o.exposure >= 100) {
        this.capture(p);
        continue;
      }
      this.interaction(p, dt);
    }
    h.progress = h.loot.filter((l) => l.taken).length;
    h.objectiveReady =
      this.room.contract.mission === "artifacts"
        ? h.progress >= h.target
        : h.loot.every((l) => l.taken);
    if (!detected.size) h.alarm = Math.max(0, h.alarm - dt * 1.5);
    if (h.alarm >= 99 && !h.alarmTriggered) {
      h.alarmTriggered = true;
      h.lockdown = h.elapsed + 90;
      h.notice = "LOCKDOWN: 90 seconds to finish and escape!";
    }
    if (players.length && players.every((p) => p.operative.escaped)) {
      this.finish(true, "The whole crew escaped with the objective.");
      return;
    }
    const remaining = players.filter((p) => !p.operative.escaped);
    if (remaining.length && remaining.every((p) => p.operative.captured)) {
      this.finish(false, "The remaining crew was captured.");
      return;
    }
    if (
      h.elapsed >= h.duration ||
      (h.lockdown !== null && h.elapsed >= h.lockdown)
    )
      this.finish(false, "The museum locked down before the crew escaped.");
  }
}
