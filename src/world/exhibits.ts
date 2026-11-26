import * as T from "three";

// Lathed profiles give museum pieces continuous surfaces at a modest polygon cost.
export function treasureModel(index: number) {
  const group = new T.Group();
  const gold = new T.MeshStandardMaterial({
    color: "#c9a44d",
    metalness: 0.82,
    roughness: 0.24,
  });
  const ceramic = new T.MeshStandardMaterial({
    color: index % 2 ? "#d9d1b7" : "#285b72",
    metalness: 0.15,
    roughness: 0.3,
  });
  const profiles = [
    [
      [0.24, 0],
      [0.26, 0.06],
      [0.13, 0.12],
      [0.12, 0.4],
      [0.35, 0.55],
      [0.42, 0.8],
      [0.4, 0.86],
    ],
    [
      [0.2, 0],
      [0.27, 0.06],
      [0.36, 0.3],
      [0.32, 0.58],
      [0.14, 0.8],
      [0.13, 1],
      [0.21, 1.04],
    ],
    [
      [0.27, 0],
      [0.28, 0.08],
      [0.1, 0.15],
      [0.1, 0.48],
      [0.3, 0.55],
      [0.3, 0.62],
    ],
  ];
  const points = profiles[index % 3].map(([x, y]) => new T.Vector2(x, y));
  const vessel = new T.Mesh(
    new T.LatheGeometry(points, 32),
    index % 3 === 1 ? ceramic : gold,
  );
  vessel.castShadow = true;
  vessel.receiveShadow = true;
  group.add(vessel);
  if (index % 3 === 2) {
    const globe = new T.Mesh(
      new T.SphereGeometry(0.23, 24, 16),
      new T.MeshStandardMaterial({
        color: "#25486a",
        metalness: 0.55,
        roughness: 0.18,
      }),
    );
    globe.position.y = 0.85;
    group.add(globe);
    const ring = new T.Mesh(new T.TorusGeometry(0.27, 0.018, 8, 40), gold);
    ring.position.y = 0.85;
    ring.rotation.x = 0.6;
    group.add(ring);
  }
  return group;
}
export function stoneTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 256;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#c7c2b6";
  ctx.fillRect(0, 0, 256, 256);
  let seed = 179;
  const random = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  for (let i = 0; i < 6500; i++) {
    const shade = 130 + Math.floor(random() * 95);
    ctx.fillStyle = `rgba(${shade},${shade},${shade},.14)`;
    ctx.fillRect(random() * 256, random() * 256, 2, 2);
  }
  for (let i = 0; i < 16; i++) {
    ctx.beginPath();
    const y = random() * 256;
    ctx.moveTo(0, y);
    ctx.bezierCurveTo(80, y + random() * 60, 170, y - 40, 256, y + 25);
    ctx.strokeStyle = "rgba(90,85,75,.12)";
    ctx.lineWidth = 0.5 + random();
    ctx.stroke();
  }
  const tex = new T.CanvasTexture(canvas);
  tex.colorSpace = T.SRGBColorSpace;
  tex.wrapS = tex.wrapT = T.RepeatWrapping;
  return tex;
}
