import * as T from "three";
import { treasureModel, stoneTexture } from "./exhibits";
import { BOUNDS, solids, stairSteps, STAIR, UPPER } from "./layout";

export function buildMuseum(scene: T.Scene) {
  const materials = new Map<string, T.MeshStandardMaterial>();
  function mat(color: string, metalness = 0) {
    const key = color + metalness;
    if (!materials.has(key))
      materials.set(
        key,
        new T.MeshStandardMaterial({ color, roughness: 0.72, metalness }),
      );
    return materials.get(key)!;
  }
  function cube(
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    d: number,
    color: string,
  ) {
    const mesh = new T.Mesh(new T.BoxGeometry(w, h, d), mat(color));
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);
    return mesh;
  }
  function label(
    text: string,
    x: number,
    y: number,
    z: number,
    width = 4,
    rotation = 0,
  ) {
    const canvas = document.createElement("canvas");
    canvas.width = 1024;
    canvas.height = 160;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#132b30";
    ctx.fillRect(0, 0, 1024, 160);
    ctx.fillStyle = "#dac28e";
    ctx.font = "500 54px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(text, 512, 98);
    const texture = new T.CanvasTexture(canvas);
    texture.colorSpace = T.SRGBColorSpace;
    const mesh = new T.Mesh(
      new T.PlaneGeometry(width, (width * 160) / 1024),
      new T.MeshBasicMaterial({ map: texture }),
    );
    mesh.position.set(x, y, z);
    mesh.rotation.y = rotation;
    scene.add(mesh);
  }
  cube(0, -0.22, -8, 72, 0.44, 72, "#bbb5a7");
  const stone = stoneTexture();
  const floorMaterial = new T.MeshStandardMaterial({
    map: stone,
    color: "#ddd7c9",
    roughness: 0.34,
  });
  const tiles = new T.InstancedMesh(
    new T.BoxGeometry(1.98, 0.02, 1.98),
    floorMaterial,
    1296,
  );
  const matrix = new T.Matrix4();
  let tileIndex = 0;
  for (let x = BOUNDS.x0 + 1; x < BOUNDS.x1; x += 2)
    for (let z = BOUNDS.z0 + 1; z < BOUNDS.z1; z += 2) {
      matrix.makeTranslation(x, 0.005, z);
      tiles.setMatrixAt(tileIndex++, matrix);
    }
  tiles.receiveShadow = true;
  scene.add(tiles);
  for (const side of [-1, 1]) {
    label(
      side < 0 ? "WORLD ANTIQUITIES" : "ROYAL TREASURY",
      side * 29,
      3,
      -43.7,
      10,
    );
    for (const z of [-30, -14, 4, 18]) {
      const exhibit = treasureModel(Math.abs(z) % 3);
      exhibit.position.set(side * 30, 1.3, z);
      scene.add(exhibit);
      const glass = new T.Mesh(
        new T.BoxGeometry(2.65, 1.8, 2.05),
        new T.MeshPhysicalMaterial({
          color: "#dceaf0",
          transparent: true,
          opacity: 0.12,
          roughness: 0.08,
          metalness: 0.05,
          depthWrite: false,
        }),
      );
      glass.position.set(side * 30, 2.2, z);
      scene.add(glass);
      cube(side * 30, 3.14, z, 2.8, 0.08, 2.2, "#574f43");
      label("AURELIA COLLECTION", side * 30, 1.05, z + 1.12, 2);
    }
    for (const z of [-38, -22, -6, 10, 24]) {
      cube(side * 35.7, 3, z, 0.25, 5, 1, "#d8d0bb");
      cube(side * 30, 6.5, z, 8, 0.12, 0.18, "#c9b681");
    }
  }
  label("03 / ANTIQUITIES", -18, 2.8, -27.8, 6);
  label("04 / MODERN ART", 18, 2.8, -27.8, 6);
  label("05 / RESEARCH ARCHIVES", 0, 2.8, -27.8, 9);
  for (const x of [-18, 18]) {
    for (const z of [-10, 8]) {
      const exhibit = new T.Mesh(
        new T.IcosahedronGeometry(0.85, 0),
        mat(x < 0 ? "#d2ad65" : "#63b8c0", 0.4),
      );
      exhibit.position.set(x, 2.45, z);
      exhibit.castShadow = true;
      scene.add(exhibit);
    }
    const light = new T.PointLight("#d8e8ff", 35, 25, 2);
    light.position.set(x, 5, -2);
    scene.add(light);
  }
  for (const b of solids) {
    if (b.id.includes("rail")) {
      cube(b.x, b.y + 0.5, b.z, b.w, 0.09, b.d, b.color);
      const longX = b.w > b.d,
        length = longX ? b.w : b.d;
      for (let n = -length / 2; n <= length / 2; n += 1.2)
        cube(
          b.x + (longX ? n : 0),
          b.y,
          b.z + (longX ? 0 : n),
          0.065,
          1.1,
          0.065,
          "#354e50",
        );
    } else cube(b.x, b.y, b.z, b.w, b.h, b.d, b.color);
  }
  // Stone steps with brass nosings and sloped handrails.
  for (let i = 0; i < 32; i++) {
    const height = ((i + 1) * UPPER) / 32,
      z = 7.75 - i * 0.5;
    const step = stairSteps[i];
    cube(step.x, step.y, step.z, step.w, step.h, step.d, step.color);
    cube(9.5, height + 0.008, z + 0.22, 3, 0.018, 0.045, "#b4985f");
    if (i % 3 === 0)
      for (const x of [7.9, 11.1])
        cube(x, height + 0.5, z, 0.07, 1, 0.07, "#29484a");
  }
  for (const x of [7.9, 11.1]) {
    const rail = cube(
      x,
      UPPER / 2 + 1.1,
      0,
      0.1,
      0.1,
      Math.hypot(STAIR.z1 - STAIR.z0, UPPER),
      "#c7ad76",
    );
    rail.rotation.x = Math.atan(UPPER / 16);
  }
  // Decorative coffer beams preserve the open atrium view.
  for (const x of [-12, -6, 0, 6, 12])
    cube(x, 8.7, 0, 0.18, 0.3, 32, "#223d43");
  for (const z of [-14, -7, 0, 7, 14])
    cube(0, 8.7, z, 28, 0.3, 0.18, "#223d43");
  for (const x of [-35.94, 35.94])
    for (const z of [-12, -4, 4, 12]) {
      cube(x, 6.6, z, 0.06, 2.7, 2.9, "#193a45");
      cube(x, 6.6, z, 0.08, 0.08, 3, "#d1bd8e");
    }
  // Central, faceted sculpture: procedural geometry, no external asset requests.
  const gold = mat("#d3a747", 0.65);
  const gem = new T.Mesh(new T.SphereGeometry(.92, 40, 24), gold);
  gem.position.set(0, 2.7, -1);
  gem.rotation.set(0.3, 0.4, 0.2);
  gem.castShadow = true;
  scene.add(gem);
  const ring = new T.Mesh(new T.TorusGeometry(1.55, 0.045, 6, 48), gold);
  ring.position.copy(gem.position);
  ring.rotation.x = 0.55;
  scene.add(ring);
  for (const [i, b] of solids
    .filter((b) => b.id.includes("plinth"))
    .entries()) {
    const sculpture = treasureModel(i);
    sculpture.position.set(b.x, b.y + b.h / 2, b.z);
    scene.add(sculpture);
  }
  // Paintings, benches and plants are set against walls, outside walkways.
  for (const x of [-11, -5, 1, 7, 12])
    for (const y of [2.2, 6.7]) {
      cube(x, y, -15.92, 2.3, 2, 0.12, "#bda16c");
      cube(x, y, -15.83, 2.05, 1.75, 0.06, "#254d52");
      const art = new T.Mesh(new T.CircleGeometry(0.55, 5), mat("#c68d5d"));
      art.position.set(x, y, -15.78);
      scene.add(art);
    }
  label("AURELIA  /  MUSEUM OF WONDERS", 0, 7.65, -15.9, 11);
  label("01   ·   ANTIQUITIES", -9, 3.1, -7.8, 4.5);
  label("02   ·   UPPER GALLERY", 0, 5.8, -8.05, 5);
  label("UPPER GALLERY   ↗", 10.8, 2.8, 10.1, 4, Math.PI);
  label("AURELIA", 0, 3, 15.9, 6, Math.PI);
  cube(0, 0.018, 11, 5, 0.025, 7, "#2d6866");
  for (const x of [-2.4, 2.4]) cube(x, 0.035, 11, 0.035, 0.02, 7, "#cfb57e");
  const ambient = new T.HemisphereLight("#d8e9ed", "#64766d", 2.2);
  scene.add(ambient);
  const sun = new T.DirectionalLight("#ffe1ad", 3.1);
  sun.position.set(10, 40, 15);
  sun.castShadow = true;
  sun.shadow.mapSize.set(4096, 4096);
  Object.assign(sun.shadow.camera, {
    left: -26,
    right: 26,
    top: 28,
    bottom: -28,
    near: 1,
    far: 120,
  });
  sun.shadow.normalBias = 0.08;
  scene.add(sun);
  const fill = new T.DirectionalLight("#7dbac5", 1.5);
  fill.position.set(-10, 10, -15);
  scene.add(fill);
  const glow = new T.PointLight("#ffc66e", 14, 12, 2);
  glow.position.set(0, 4, -1);
  scene.add(glow);
  return { gem, ring };
}

export function buildPlayer(color = "#4aa89d") {
  const root = new T.Group(),
    body = new T.Group();
  root.add(body);
  const dark = new T.MeshStandardMaterial({ color: "#172c37", roughness: 0.9 });
  const mask = new T.MeshStandardMaterial({ color: "#d9d2bb", roughness: 0.8 });
  const teal = new T.MeshStandardMaterial({
    color,
    roughness: 0.65,
  });
  function part(
    w: number,
    h: number,
    d: number,
    x: number,
    y: number,
    z: number,
    material: T.Material,
  ) {
    const m = new T.Mesh(new T.BoxGeometry(w, h, d), material);
    m.position.set(x, y, z);
    m.castShadow = true;
    body.add(m);
    return m;
  }
  part(0.58, 0.65, 0.35, 0, 1.02, 0, dark);
  part(0.47, 0.45, 0.42, 0, 1.58, 0, dark);
  part(0.38, 0.22, 0.025, 0, 1.56, -0.222, mask);
  part(0.26, 0.065, 0.03, 0, 1.6, -0.24, dark);
  part(0.43, 0.48, 0.25, 0, 1.05, 0.27, teal);
  part(0.6, 0.1, 0.37, 0, 0.78, 0, teal);
  const legs = [
    part(0.22, 0.65, 0.25, -0.17, 0.35, 0, dark),
    part(0.22, 0.65, 0.25, 0.17, 0.35, 0, dark),
  ];
  const arms = [
    part(0.18, 0.62, 0.23, -0.4, 1.02, 0, dark),
    part(0.18, 0.62, 0.23, 0.4, 1.02, 0, dark),
  ];
  return { root, body, legs, arms, accent: teal, face: mask };
}
