/** Serializable boundary: rendering and future transport consume snapshots, not meshes. */
export interface PlayerState {
  x: number;
  y: number;
  z: number;
  vy: number;
  yaw: number;
  grounded: boolean;
  crouched: boolean;
  moving: boolean;
  sprinting: boolean;
}
export interface InputFrame {
  forward: number;
  right: number;
  yaw: number;
  sprint: boolean;
  crouch: boolean;
  jump: boolean;
  interact?: boolean;
}
export interface Box {
  id: string;
  x: number;
  y: number;
  z: number;
  w: number;
  h: number;
  d: number;
  color: string;
}
export interface Surface {
  x0: number;
  x1: number;
  z0: number;
  z1: number;
  height: number;
}
export type Mode = "menu" | "playing" | "paused";
export interface HudState {
  x: number;
  z: number;
  floor: string;
  stance: string;
  fps: number;
}
