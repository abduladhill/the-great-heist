import * as T from "three";
import { buildMuseum, buildPlayer } from "../world/museum";
import { collisionBoxes } from "../world/layout";
import { createPlayer, FIXED_DT, stepPlayer } from "./movement";
import { InputController } from "./input";
import type { HudState, Mode } from "./types";
import { MultiplayerClient } from "../network/client";
import { NEUTRAL } from "../network/protocol";
import type { Member } from "../network/protocol";
import { HeistView } from "../world/heistView";

export class GameEngine {
  readonly player = createPlayer();
  readonly input = new InputController();
  private scene = new T.Scene();
  private camera = new T.PerspectiveCamera(58, 1, 0.07, 100);
  private renderer: T.WebGLRenderer;
  private avatar = buildPlayer();
  private mode: Mode = "menu";
  private resizeObserver: ResizeObserver;
  private previous = 0;
  private accumulator = 0;
  private hudTimer = 0;
  private elapsed = 0;
  private target = new T.Vector3();
  private desired = new T.Vector3();
  private direction = new T.Vector3();
  private hit = new T.Vector3();
  private ray = new T.Ray();
  private cameraBoxes = collisionBoxes.map(
    (b) =>
      new T.Box3(
        new T.Vector3(
          b.x - b.w / 2 - 0.12,
          b.y - b.h / 2 - 0.12,
          b.z - b.d / 2 - 0.12,
        ),
        new T.Vector3(
          b.x + b.w / 2 + 0.12,
          b.y + b.h / 2 + 0.12,
          b.z + b.d / 2 + 0.12,
        ),
      ),
  );
  private artifacts: ReturnType<typeof buildMuseum>;
  private multiplayer: MultiplayerClient | null = null;
  private remote = new Map<string, ReturnType<typeof buildPlayer>>();
  private networkTimer = 0;
  private jumpQueued = false;
  private heistView: HeistView | null = null;
  setMultiplayer(client: MultiplayerClient | null) {
    this.multiplayer = client;
    this.networkTimer = 0;
    this.jumpQueued = false;
    this.clearRemotes();
    if (!client) {
      this.heistView?.dispose();
      this.heistView = null;
    }
  }
  private disposeAvatar(avatar: ReturnType<typeof buildPlayer>) {
    this.scene.remove(avatar.root);
    const materials = new Set<T.Material>();
    avatar.root.traverse((o) => {
      if (o instanceof T.Mesh) {
        o.geometry.dispose();
        for (const m of Array.isArray(o.material) ? o.material : [o.material])
          materials.add(m);
      }
    });
    materials.forEach((m) => m.dispose());
  }
  private clearRemotes() {
    for (const a of this.remote.values()) this.disposeAvatar(a);
    this.remote.clear();
  }
  private animateAvatar(
    avatar: ReturnType<typeof buildPlayer>,
    member: Member,
    dt: number,
  ) {
    const p = member.state;
    avatar.root.position.lerp(
      new T.Vector3(p.x, p.y, p.z),
      1 - Math.exp(-18 * dt),
    );
    const delta = Math.atan2(
      Math.sin(p.yaw - avatar.root.rotation.y),
      Math.cos(p.yaw - avatar.root.rotation.y),
    );
    avatar.root.rotation.y += delta * (1 - Math.exp(-18 * dt));
    avatar.body.scale.y = p.crouched ? 0.6 : 1;
    const stride = p.moving
      ? Math.sin(this.elapsed * (p.sprinting ? 15 : 10)) * 0.45
      : 0;
    avatar.legs[0].rotation.x = stride;
    avatar.legs[1].rotation.x = -stride;
    avatar.arms[0].rotation.x = -stride;
    avatar.arms[1].rotation.x = stride;
  }
  constructor(
    private host: HTMLDivElement,
    private onHud: (s: HudState) => void,
  ) {
    this.renderer = new T.WebGLRenderer({
      antialias: true,
      powerPreference: "high-performance",
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = T.PCFSoftShadowMap;
    this.renderer.toneMapping = T.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
    this.renderer.domElement.setAttribute(
      "aria-label",
      "Interactive 3D museum",
    );
    host.appendChild(this.renderer.domElement);
    this.scene.background = new T.Color("#18343e");
    this.scene.fog = new T.Fog("#29464a", 30, 65);
    this.artifacts = buildMuseum(this.scene);
    this.scene.add(this.avatar.root);
    this.resizeObserver = new ResizeObserver(this.resize);
    this.resizeObserver.observe(host);
    this.resize();
    this.renderer.setAnimationLoop(this.frame);
  }
  private resize = () => {
    const w = this.host.clientWidth,
      h = this.host.clientHeight;
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  };
  setMode(mode: Mode) {
    this.mode = mode;
    this.input.active = mode === "playing";
    this.input.clear();
    this.accumulator = 0;
    if (mode !== "playing") {
      this.jumpQueued = false;
      this.multiplayer?.send({ ...NEUTRAL, yaw: this.input.yaw });
      this.multiplayer?.interact(false);
    }
  }
  reset() {
    Object.assign(this.player, createPlayer());
    this.input.yaw = 0;
    this.input.pitch = 0.27;
    this.camera.position.set(0, 3.5, 15);
    this.avatar.accent.color.set("#4aa89d");
  }
  private frame = (time: number) => {
    const dt = Math.min((time - this.previous) / 1000 || 0, 0.05);
    this.previous = time;
    this.elapsed += dt;
    const network = this.multiplayer;
    if (network?.room) {
      const me = network.room.players.find((p) => p.id === network.playerId);
      if (me) {
        Object.assign(this.player, me.state);
        this.avatar.accent.color.set(me.color);
        this.avatar.face.color.set(
          me.profile.mask === "gold"
            ? "#e5b856"
            : me.profile.mask === "onyx"
              ? "#292333"
              : "#d9d2bb",
        );
        this.avatar.root.visible = !me.operative.escaped;
      }
      if (network.room.heist) {
        if (this.heistView?.id !== network.room.heist.id) {
          this.heistView?.dispose();
          this.heistView = new HeistView(
            network.room.heist.id,
            network.room.heist,
            network.room.contract,
          );
          this.scene.add(this.heistView.root);
        }
        this.heistView.update(network.room.heist, dt);
      } else if (this.heistView) {
        this.heistView.dispose();
        this.heistView = null;
      }
      const frame =
        this.mode === "playing" && network.connected
          ? this.input.sample(dt)
          : { ...NEUTRAL, yaw: this.input.yaw };
      this.jumpQueued ||= frame.jump;
      this.networkTimer += dt;
      if (this.networkTimer >= 1 / 30) {
        network.send({ ...frame, jump: this.jumpQueued });
        this.jumpQueued = false;
        this.networkTimer = 0;
      }
      const others = network.room.players.filter(
        (p) => p.id !== network.playerId,
      );
      for (const [id, a] of this.remote)
        if (!others.some((p) => p.id === id)) {
          this.disposeAvatar(a);
          this.remote.delete(id);
        }
      for (const member of others) {
        let a = this.remote.get(member.id);
        if (!a) {
          a = buildPlayer(member.color);
          a.root.position.set(member.state.x, member.state.y, member.state.z);
          this.scene.add(a.root);
          this.remote.set(member.id, a);
        }
        a.root.visible = network.room.phase === "playing";
        a.root.visible &&= !member.operative.escaped;
        a.face.color.set(
          member.profile.mask === "gold"
            ? "#e5b856"
            : member.profile.mask === "onyx"
              ? "#292333"
              : "#d9d2bb",
        );
        this.animateAvatar(a, member, dt);
      }
    } else if (this.mode === "playing") {
      this.avatar.root.visible = true;
      this.accumulator += dt;
      while (this.accumulator >= FIXED_DT) {
        stepPlayer(this.player, this.input.sample(FIXED_DT));
        this.accumulator -= FIXED_DT;
      }
    }
    const p = this.player;
    if (network?.room)
      this.avatar.root.position.lerp(
        new T.Vector3(p.x, p.y, p.z),
        1 - Math.exp(-22 * dt),
      );
    else this.avatar.root.position.set(p.x, p.y, p.z);
    this.avatar.root.rotation.y = p.yaw;
    this.avatar.body.scale.y = p.crouched ? 0.6 : 1;
    const stride =
      this.mode === "playing" && p.moving
        ? Math.sin(this.elapsed * (p.sprinting ? 15 : 10)) * 0.45
        : 0;
    this.avatar.legs[0].rotation.x = stride;
    this.avatar.legs[1].rotation.x = -stride;
    this.avatar.arms[0].rotation.x = -stride;
    this.avatar.arms[1].rotation.x = stride;
    this.artifacts.gem.rotation.y = this.elapsed * 0.15;
    this.artifacts.ring.rotation.z = this.elapsed * 0.08;
    if (this.mode === "menu") {
      this.camera.position.set(
        11 + Math.sin(this.elapsed * 0.07) * 1.2,
        7.4,
        13,
      );
      this.camera.lookAt(-1, 2, -3);
    } else {
      this.target
        .copy(this.avatar.root.position)
        .add(new T.Vector3(0, p.crouched ? 0.85 : 1.4, 0));
      const yaw = this.input.yaw,
        pitch = this.input.pitch;
      this.desired
        .set(
          Math.sin(yaw) * Math.cos(pitch) * 5.2,
          Math.sin(pitch) * 5.2,
          Math.cos(yaw) * Math.cos(pitch) * 5.2,
        )
        .add(this.target);
      this.direction.copy(this.desired).sub(this.target).normalize();
      this.ray.set(this.target, this.direction);
      let distance = 5.2;
      for (const box of this.cameraBoxes) {
        if (this.ray.intersectBox(box, this.hit))
          distance = Math.min(
            distance,
            Math.max(0.2, this.hit.distanceTo(this.target) - 0.15),
          );
      }
      this.desired.copy(this.target).addScaledVector(this.direction, distance);
      this.camera.position.lerp(this.desired, 1 - Math.exp(-14 * dt));
      // Recheck the smoothed position so orbiting around corners never passes through walls.
      this.direction.copy(this.camera.position).sub(this.target);
      const smoothDistance = this.direction.length();
      this.direction.normalize();
      this.ray.set(this.target, this.direction);
      let safeDistance = smoothDistance;
      for (const box of this.cameraBoxes)
        if (this.ray.intersectBox(box, this.hit))
          safeDistance = Math.min(
            safeDistance,
            Math.max(0.2, this.hit.distanceTo(this.target) - 0.15),
          );
      this.camera.position
        .copy(this.target)
        .addScaledVector(this.direction, safeDistance);
      this.camera.lookAt(this.target);
    }
    this.renderer.render(this.scene, this.camera);
    this.hudTimer += dt;
    if (this.hudTimer > 0.12) {
      this.hudTimer = 0;
      this.onHud({
        x: p.x,
        z: p.z,
        floor:
          p.y > 3.8
            ? "Upper gallery"
            : p.x > 7 && p.z < 8 && p.z > -8
              ? "Grand staircase"
              : "Ground floor",
        stance: !p.grounded
          ? "Airborne"
          : p.crouched
            ? "Crouching"
            : p.sprinting
              ? "Sprinting"
              : p.moving
                ? "Walking"
                : "Standing",
        fps: Math.round(1 / Math.max(dt, 0.001)),
      });
    }
  };
  dispose() {
    this.heistView?.dispose();
    this.renderer.setAnimationLoop(null);
    this.resizeObserver.disconnect();
    this.input.dispose();
    const geometries = new Set<T.BufferGeometry>(),
      materials = new Set<T.Material>(),
      textures = new Set<T.Texture>();
    this.scene.traverse((object) => {
      if (object instanceof T.Mesh) {
        geometries.add(object.geometry);
        for (const m of Array.isArray(object.material)
          ? object.material
          : [object.material]) {
          materials.add(m);
          for (const value of Object.values(m))
            if (value instanceof T.Texture) textures.add(value);
        }
      }
    });
    geometries.forEach((g) => g.dispose());
    materials.forEach((m) => m.dispose());
    textures.forEach((t) => t.dispose());
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
