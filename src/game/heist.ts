export type Mission = "artifacts" | "vault" | "data" | "annex" | "training";
export type Difficulty = "easy" | "normal" | "hard";
export type Gadget = "smoke" | "jammer";
export interface Point {
  x: number;
  y: number;
  z: number;
}
export interface Profile {
  xp: number;
  level: number;
  wins: number;
  heists: number;
  cash: number;
  mask: "ivory" | "gold" | "onyx";
}
export interface Contract {
  mission: Mission;
  difficulty: Difficulty;
  solo: boolean;
}
export interface Loot extends Point {
  id: string;
  name: string;
  kind: "artifact" | "terminal" | "vault";
  taken: boolean;
}
export interface Guard extends Point {
  id: string;
  yaw: number;
  mode: "patrol" | "investigate" | "chase";
  target: string | null;
  alert: number;
}
export interface Smoke extends Point {
  id: string;
  until: number;
}
export interface HeistState {
  id: string;
  elapsed: number;
  duration: number;
  alarm: number;
  alarmTriggered: boolean;
  lockdown: number | null;
  loot: Loot[];
  guards: Guard[];
  smoke: Smoke[];
  jamUntil: number;
  objectiveReady: boolean;
  progress: number;
  target: number;
  result: null | { won: boolean; reason: string; xp: number; cash: number };
  notice: string;
}
export interface Operative {
  captured: boolean;
  escaped: boolean;
  exposure: number;
  smoke: number;
  jammer: number;
  immuneUntil: number;
  cooldown: number;
  interaction: string | null;
  progress: number;
}
export const freshOperative = (): Operative => ({
  captured: false,
  escaped: false,
  exposure: 0,
  smoke: 0,
  jammer: 0,
  immuneUntil: 4,
  cooldown: 0,
  interaction: null,
  progress: 0,
});
export const DEFAULT_CONTRACT: Contract = {
  mission: "artifacts",
  difficulty: "normal",
  solo: false,
};
export const DIFFICULTIES = {
  easy: {
    label: "Easy",
    guards: 2,
    range: 6,
    speed: 2.3,
    detect: 24,
    time: 540,
    multiplier: 1,
  },
  normal: {
    label: "Normal",
    guards: 3,
    range: 8,
    speed: 2.9,
    detect: 36,
    time: 420,
    multiplier: 1.5,
  },
  hard: {
    label: "Hard",
    guards: 4,
    range: 10,
    speed: 3.5,
    detect: 48,
    time: 300,
    multiplier: 2,
  },
};
export const MISSIONS: Record<Mission, { title: string; description: string }> =
  {
    artifacts: {
      title: "The Golden Collection",
      description:
        "Steal the marked artifacts, then bring the whole crew to the entrance.",
    },
    vault: {
      title: "The Crown Jewel",
      description:
        "Hack two terminals, unlock the upstairs vault and steal the crown.",
    },
    data: {
      title: "Ghost in the System",
      description:
        "Download all three archives across both floors, then escape.",
    },
    annex: {
      title: "The Research Wing",
      description:
        "Breach three research archives in the north annex. Hold E together at an archive to hack faster, then extract.",
    },
    training: {
      title: "Practice",
      description: "Explore together without guards, objectives or rewards.",
    },
  };
export const EXIT: Point = { x: 0, y: 0, z: 13 };
export const JAIL: Point = { x: -11, y: 0, z: 12 };
export const TERMINALS: Point[] = [
  { x: -11, y: 0, z: 6 },
  { x: 3, y: 0, z: -14 },
  { x: -11, y: 4.5, z: 7 },
];
export const VAULT: Point = { x: 10, y: 4.5, z: -14 };
export const CAMERAS = [
  { x: 3, y: 2.8, z: -7, yaw: 0 },
  { x: -9, y: 7.3, z: -9, yaw: Math.PI },
];
export const LASERS = [
  { x: 0, y: 0, z: -8, w: 5 },
  { x: 9.5, y: 4.5, z: -9, w: 3 },
];
export const levelForXP = (xp: number) => 1 + Math.floor(Math.max(0, xp) / 250);
export function distance(a: Point, b: Point) {
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
}
