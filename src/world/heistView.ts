import * as T from "three";
import { treasureModel } from "./exhibits";
function buildGuard() {
  const root = new T.Group();
  const navy = new T.MeshStandardMaterial({
    color: "#294e88",
    roughness: 0.85,
  });
  const black = new T.MeshStandardMaterial({ color: "#101923" });
  const skin = new T.MeshStandardMaterial({ color: "#c59a75" });
  const gold = new T.MeshStandardMaterial({
    color: "#ffcf45",
    emissive: "#ad6b00",
    emissiveIntensity: 0.25,
  });
  function part(
    w: number,
    h: number,
    d: number,
    x: number,
    y: number,
    z: number,
    mat: T.Material,
  ) {
    const m = new T.Mesh(new T.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z);
    m.castShadow = true;
    root.add(m);
    return m;
  }
  part(0.76, 0.72, 0.43, 0, 1.08, 0, navy);
  part(0.42, 0.42, 0.4, 0, 1.66, 0, skin);
  part(0.57, 0.18, 0.52, 0, 1.91, 0, navy);
  part(0.55, 0.055, 0.25, 0, 1.84, -0.3, black);
  part(0.13, 0.16, 0.035, -0.2, 1.22, -0.235, gold);
  part(0.77, 0.1, 0.45, 0, 0.77, 0, black);
  part(0.48, 0.07, 0.025, 0, 1.07, 0.23, gold);
  part(0.2, 0.65, 0.25, -0.49, 1.05, 0, navy);
  part(0.2, 0.65, 0.25, 0.49, 1.05, 0, navy);
  part(0.09, 0.55, 0.09, 0.55, 0.62, -0.12, black);
  const legs = [
    part(0.26, 0.66, 0.3, -0.2, 0.35, 0, black),
    part(0.26, 0.66, 0.3, 0.2, 0.35, 0, black),
  ];
  return { root, legs };
}
import { CAMERAS, LASERS, EXIT, JAIL, DIFFICULTIES } from "../game/heist";
import type { HeistState, Contract } from "../game/heist";
export class HeistView {
  root = new T.Group();
  private guards = new Map<string, ReturnType<typeof buildGuard>>();
  private cones = new Map<string, T.Mesh>();
  private loot = new Map<string, T.Group>();
  private clouds = new Map<string, T.Mesh>();
  private lasers: T.Mesh[] = [];
  private cameras: T.Mesh[] = [];
  private exit: T.Mesh;
  constructor(
    readonly id: string,
    h: HeistState,
    contract: Contract,
  ) {
    const material = (color: string, opacity = 1) =>
      new T.MeshStandardMaterial({
        color,
        roughness: 0.6,
        transparent: opacity < 1,
        opacity,
        depthWrite: opacity === 1,
      });
    const add = (
      geometry: T.BufferGeometry,
      mat: T.Material,
      x: number,
      y: number,
      z: number,
      parent: T.Group = this.root,
    ) => {
      const mesh = new T.Mesh(geometry, mat);
      mesh.position.set(x, y, z);
      parent.add(mesh);
      return mesh;
    };
    this.exit = add(
      new T.RingGeometry(1.7, 2.1, 40),
      new T.MeshBasicMaterial({
        color: "#ce9f65",
        side: T.DoubleSide,
        transparent: true,
        opacity: 0.8,
      }),
      EXIT.x,
      0.04,
      EXIT.z,
    );
    this.exit.rotation.x = -Math.PI / 2;
    const jail = add(
      new T.RingGeometry(1.3, 1.45, 4),
      new T.MeshBasicMaterial({ color: "#ec8b77", side: T.DoubleSide }),
      JAIL.x,
      0.04,
      JAIL.z,
    );
    jail.rotation.x = -Math.PI / 2;
    for (const l of h.loot) {
      const group = new T.Group();
      group.position.set(l.x, l.y, l.z);
      this.root.add(group);
      this.loot.set(l.id, group);
      add(
        new T.CylinderGeometry(0.42, 0.55, 0.35, 6),
        material("#304c50"),
        0,
        0.175,
        0,
        group,
      );
      if (l.kind === "terminal") {
        add(
          new T.BoxGeometry(0.65, 0.85, 0.35),
          material("#253b40"),
          0,
          0.65,
          0,
          group,
        );
        add(
          new T.BoxGeometry(0.5, 0.42, 0.38),
          new T.MeshStandardMaterial({
            color: "#83e5ce",
            emissive: "#268c72",
            emissiveIntensity: 0.8,
          }),
          0,
          0.83,
          0,
          group,
        );
      } else if (l.kind === "vault") {
        add(
          new T.BoxGeometry(1.2, 1.2, 1),
          material("#617477"),
          0,
          0.8,
          0,
          group,
        );
        const ring = add(
          new T.TorusGeometry(0.3, 0.055, 8, 16),
          material("#d5b66f"),
          0,
          0.9,
          0.52,
          group,
        );
        ring.rotation.z = 0.3;
      } else {
        const treasure = treasureModel(Number(l.id.split("-").at(-1)) || 0);
        treasure.position.y = 0.35;
        group.add(treasure);
      }
      const marker = add(
        new T.ConeGeometry(0.13, 0.3, 4),
        material("#e3cb88"),
        0,
        1.65,
        0,
        group,
      );
      marker.rotation.z = Math.PI;
    }
    for (const g of h.guards) {
      const avatar = buildGuard();
      this.root.add(avatar.root);
      this.guards.set(g.id, avatar);
      const geometry = new T.CircleGeometry(
        DIFFICULTIES[contract.difficulty].range,
        32,
        Math.PI * 0.15,
        Math.PI * 0.7,
      );
      const cone = add(
        geometry,
        new T.MeshBasicMaterial({
          color: "#ffb020",
          transparent: true,
          opacity: 0.22,
          side: T.DoubleSide,
          depthWrite: false,
        }),
        0,
        0.035,
        0,
      );
      cone.rotation.x = -Math.PI / 2;
      this.cones.set(g.id, cone);
    }
    for (const l of LASERS)
      for (const height of [0.55, 1.05]) {
        const beam = add(
          new T.CylinderGeometry(0.025, 0.025, l.w, 6),
          new T.MeshBasicMaterial({ color: "#ff5652" }),
          l.x,
          l.y + height,
          l.z,
        );
        beam.rotation.z = Math.PI / 2;
        this.lasers.push(beam);
      }
    for (const c of CAMERAS) {
      const camera = add(
        new T.BoxGeometry(0.45, 0.25, 0.55),
        material("#cf8e65"),
        c.x,
        c.y,
        c.z,
      );
      this.cameras.push(camera);
    }
  }
  update(h: HeistState, dt: number) {
    for (const g of h.guards) {
      const a = this.guards.get(g.id)!;
      a.root.position.lerp(
        new T.Vector3(g.x, g.y, g.z),
        1 - Math.exp(-16 * dt),
      );
      a.root.rotation.y = g.yaw;
      const stride = Math.sin(h.elapsed * 8) * 0.3;
      a.legs[0].rotation.x = stride;
      a.legs[1].rotation.x = -stride;
      const cone = this.cones.get(g.id)!;
      (cone.material as T.MeshBasicMaterial).opacity =
        g.mode === "chase" ? 0.34 : 0.22;
      cone.position.set(g.x, g.y + 0.04, g.z);
      cone.rotation.set(-Math.PI / 2, 0, g.yaw);
      (cone.material as T.MeshBasicMaterial).color.set(
        g.mode === "chase"
          ? "#ff304f"
          : g.mode === "investigate"
            ? "#ff781f"
            : "#ffb020",
      );
    }
    for (const l of h.loot) {
      const node = this.loot.get(l.id)!;
      node.visible = !l.taken;
      if (l.kind === "artifact") node.children[1].rotation.y = h.elapsed * 0.8;
    }
    for (const [id, cloud] of this.clouds)
      if (!h.smoke.some((s) => s.id === id)) {
        this.root.remove(cloud);
        cloud.geometry.dispose();
        (cloud.material as T.Material).dispose();
        this.clouds.delete(id);
      }
    for (const s of h.smoke) {
      let cloud = this.clouds.get(s.id);
      if (!cloud) {
        cloud = new T.Mesh(
          new T.SphereGeometry(3.2, 10, 7),
          new T.MeshBasicMaterial({
            color: "#b6c9bd",
            transparent: true,
            opacity: 0.36,
            depthWrite: false,
          }),
        );
        cloud.position.set(s.x, s.y + 0.8, s.z);
        cloud.scale.y = 0.6;
        this.root.add(cloud);
        this.clouds.set(s.id, cloud);
      }
      cloud.rotation.y = h.elapsed * 0.1;
    }
    for (const beam of this.lasers)
      beam.visible =
        h.elapsed > h.jamUntil && Math.floor(h.elapsed / 3) % 2 === 0;
    this.cameras.forEach((c, i) => {
      c.rotation.y = CAMERAS[i].yaw + Math.sin(h.elapsed * 0.45) * 0.75;
      (c.material as T.MeshStandardMaterial).color.set(
        h.elapsed < h.jamUntil ? "#548779" : "#cf8e65",
      );
    });
    (this.exit.material as T.MeshBasicMaterial).color.set(
      h.objectiveReady ? "#8ef1bc" : "#ce9f65",
    );
  }
  dispose() {
    this.root.traverse((o) => {
      if (o instanceof T.Mesh) {
        o.geometry.dispose();
        for (const m of Array.isArray(o.material) ? o.material : [o.material])
          m.dispose();
      }
    });
    this.root.removeFromParent();
  }
}
