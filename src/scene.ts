import {
  AmbientLight,
  BoxGeometry,
  Color,
  CylinderGeometry,
  DirectionalLight,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  Scene,
  Vector3
} from "three";
import type { CaseColumn, ChipColor } from "./sorting";

export interface RoomScene {
  chipMeshes: Mesh[];
  caseColumns: Mesh[];
  columns: CaseColumn[];
  chipSpawnColors: ChipColor[];
  chipHeight: number;
  columnStackBaseY: number;
  holdOffset: Vector3;
}

const CHIP_COLORS: Record<ChipColor, number> = {
  white: 0xf2f2eb,
  black: 0x1b1b1d,
  red: 0xba2d2d,
  green: 0x2f8c42
};

const CHIP_COLOR_ORDER: ChipColor[] = ["white", "black", "red", "green"];

const CHIPS_PER_COLOR = 4;
const TOTAL_CHIPS = CHIP_COLOR_ORDER.length * CHIPS_PER_COLOR;
const CHIP_HEIGHT = 0.06;

export function setupScene(scene: Scene): RoomScene {
  scene.background = new Color("#2d3e52");

  const floor = new Mesh(
    new PlaneGeometry(18, 18),
    new MeshStandardMaterial({ color: "#4b4035", roughness: 0.95 })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = 0;
  floor.receiveShadow = true;
  scene.add(floor);

  const wallMaterial = new MeshStandardMaterial({ color: "#5b4a40", roughness: 0.9 });
  const wallGeometry = new BoxGeometry(18, 3.2, 0.2);

  const backWall = new Mesh(wallGeometry, wallMaterial);
  backWall.position.set(0, 1.6, -9);

  const frontWall = new Mesh(wallGeometry, wallMaterial);
  frontWall.position.set(0, 1.6, 9);

  const sideWallGeometry = new BoxGeometry(0.2, 3.2, 18);
  const leftWall = new Mesh(sideWallGeometry, wallMaterial);
  leftWall.position.set(-9, 1.6, 0);

  const rightWall = new Mesh(sideWallGeometry, wallMaterial);
  rightWall.position.set(9, 1.6, 0);

  scene.add(backWall, frontWall, leftWall, rightWall);

  const tableHeight = 0.8;
  const table = new Mesh(
    new CylinderGeometry(2.9, 2.9, 0.22, 48),
    new MeshStandardMaterial({ color: "#195f2d", roughness: 0.78 })
  );
  table.position.set(0, tableHeight, -2.5);
  table.receiveShadow = true;
  scene.add(table);

  const tableRim = new Mesh(
    new CylinderGeometry(3.05, 3.05, 0.08, 48),
    new MeshStandardMaterial({ color: "#3d2f23", roughness: 0.7 })
  );
  tableRim.position.set(0, tableHeight + 0.15, -2.5);
  scene.add(tableRim);

  const columns: CaseColumn[] = CHIP_COLOR_ORDER.map((acceptsColor, index) => ({
    id: `column-${acceptsColor}`,
    columnIndex: index,
    acceptsColor
  }));

  const caseColumns: Mesh[] = [];
  const caseBase = new Mesh(
    new BoxGeometry(3.3, 0.18, 0.9),
    new MeshStandardMaterial({ color: "#2e2520", roughness: 0.82 })
  );
  caseBase.position.set(0, tableHeight + 0.2, -4.9);
  scene.add(caseBase);

  const columnWidth = 0.68;
  const columnHeight = 0.72;
  const columnDepth = 0.65;
  const columnSpacing = 0.78;
  const columnCenterZ = -4.9;
  const columnStackBaseY = tableHeight + 0.26;

  columns.forEach((column, index) => {
    const mesh = new Mesh(
      new BoxGeometry(columnWidth, columnHeight, columnDepth),
      new MeshStandardMaterial({
        color: CHIP_COLORS[column.acceptsColor],
        roughness: 0.32,
        metalness: 0.05,
        transparent: true,
        opacity: 0.34
      })
    );
    mesh.position.set((index - 1.5) * columnSpacing, tableHeight + 0.48, columnCenterZ);
    mesh.userData.columnIndex = column.columnIndex;
    scene.add(mesh);
    caseColumns.push(mesh);

    const label = new Mesh(
      new BoxGeometry(0.48, 0.1, 0.08),
      new MeshBasicMaterial({ color: CHIP_COLORS[column.acceptsColor] })
    );
    label.position.set(mesh.position.x, tableHeight + 0.92, columnCenterZ + 0.44);
    scene.add(label);
  });

  const chipMeshes: Mesh[] = [];
  const chipSpawnColors: ChipColor[] = [];
  for (let index = 0; index < TOTAL_CHIPS; index += 1) {
    const color = CHIP_COLOR_ORDER[Math.floor(index / CHIPS_PER_COLOR)] as ChipColor;
    const ring = index % 2 === 0 ? 1.25 : 1.75;
    const angle = index * ((Math.PI * 2) / TOTAL_CHIPS);
    const chipMesh = new Mesh(
      new CylinderGeometry(0.17, 0.17, CHIP_HEIGHT, 36),
      new MeshStandardMaterial({
        color: CHIP_COLORS[color],
        roughness: 0.52,
        metalness: color === "black" ? 0.2 : 0.07
      })
    );
    chipMesh.rotation.x = Math.PI / 2;
    chipMesh.position.set(
      Math.cos(angle) * ring,
      tableHeight + 0.14,
      -2.5 + Math.sin(angle) * ring
    );
    scene.add(chipMesh);
    chipMeshes.push(chipMesh);
    chipSpawnColors.push(color);
  }

  const ambientLight = new AmbientLight(0xffffff, 0.45);
  const directionalLight = new DirectionalLight(0xffffff, 0.85);
  directionalLight.position.set(4, 6, 2);
  scene.add(ambientLight, directionalLight);

  return {
    chipMeshes,
    caseColumns,
    columns,
    chipSpawnColors,
    chipHeight: CHIP_HEIGHT,
    columnStackBaseY,
    holdOffset: new Vector3(0.33, -0.17, -0.74)
  };
}
