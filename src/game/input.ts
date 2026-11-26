import type { InputFrame } from "./types";
export class InputController {
  private keys = new Set<string>();
  private jump = false;
  tactical = true;
  yaw = 0;
  pitch = 0.27;
  active = false;
  private down = (e: KeyboardEvent) => {
    if (!this.active) return;
    if (
      [
        "Space",
        "ControlLeft",
        "ControlRight",
        "KeyW",
        "KeyA",
        "KeyS",
        "KeyD",
        "ArrowLeft",
        "ArrowRight",
        "ArrowUp",
        "ArrowDown",
      ].includes(e.code)
    )
      e.preventDefault();
    if (e.code === "KeyV" && !e.repeat) {
      this.tactical = !this.tactical;

    }
    if (e.code === "Space" && !e.repeat) this.jump = true;
    this.keys.add(e.code);
  };
  private up = (e: KeyboardEvent) => {
    this.keys.delete(e.code);
  };
  private mouse = (e: MouseEvent) => {
    if (this.active && (document.pointerLockElement || (e.buttons & 3) !== 0)) {
      this.yaw -= e.movementX * 0.0025;
      this.pitch = Math.max(
        -0.15,
        Math.min(1.1, this.pitch + e.movementY * 0.0025),
      );
    }
  };
  clear = () => {
    this.keys.clear();
    this.jump = false;
  };
  constructor() {
    window.addEventListener("keydown", this.down);
    window.addEventListener("keyup", this.up);
    window.addEventListener("mousemove", this.mouse);
    window.addEventListener("blur", this.clear);
  }
  sample(dt: number): InputFrame {
    if (this.keys.has("ArrowLeft")) this.yaw += dt * 1.7;
    if (this.keys.has("ArrowRight")) this.yaw -= dt * 1.7;
    const frame = {
      forward: Number(this.keys.has("KeyW")) - Number(this.keys.has("KeyS")),
      right: Number(this.keys.has("KeyD")) - Number(this.keys.has("KeyA")),
      yaw: this.yaw,
      sprint: this.keys.has("ShiftLeft") || this.keys.has("ShiftRight"),
      crouch:
        this.keys.has("ControlLeft") ||
        this.keys.has("ControlRight") ||
        this.keys.has("KeyC"),
      jump: this.jump,
      interact: this.keys.has("KeyE"),
    };
    this.jump = false;
    return frame;
  }
  dispose() {
    window.removeEventListener("keydown", this.down);
    window.removeEventListener("keyup", this.up);
    window.removeEventListener("mousemove", this.mouse);
    window.removeEventListener("blur", this.clear);
  }
}
