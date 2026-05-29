import {
  AmbientLight,
  Box3,
  BufferGeometry,
  BoxGeometry,
  Color,
  CylinderGeometry,
  DirectionalLight,
  Group,
  Material,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Object3D,
  PlaneGeometry,
  Scene,
  Vector3
} from "three";
import { MTLLoader } from "three/addons/loaders/MTLLoader.js";
import { OBJLoader } from "three/addons/loaders/OBJLoader.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { toWallInnerBounds } from "./roomBounds";
import type { CaseColumn, ChipColor } from "./sorting";
import type { PhysicsEnvironment } from "./physics";

import chipMtlUrl from "../assets/models/chip.mtl?url";
import chipObjUrl from "../assets/models/chip.obj?url";
import tableMtlUrl from "../assets/models/table.mtl?url";
import tableObjUrl from "../assets/models/table.obj?url";

export interface RoomScene {
  chipMeshes: Mesh[];
  caseColumns: Mesh[];
  columns: CaseColumn[];
  chipSpawnColors: ChipColor[];
  chipHeight: number;
  columnStackBaseY: number;
  holdOffset: Vector3;
  usingExternalAssets: boolean;
  physicsEnvironment: PhysicsEnvironment;
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
export const CHIP_HEIGHT = 0.06;
const CHIP_RADIUS = 0.17;
const TABLE_TARGET_DIAMETER = 5.8;
const TABLE_RADIUS = TABLE_TARGET_DIAMETER / 2;
const TABLE_CENTER_X = 0;
const TABLE_CENTER_Z = -2.5;

type ChipAsset = { objUrl: string; mtlUrl: string };
type ChipPrototype = { geometry: BufferGeometry; material: Material | Material[] };

const CHIP_ASSET: ChipAsset = { objUrl: chipObjUrl, mtlUrl: chipMtlUrl };
const TABLE_ASSET = { objUrl: tableObjUrl, mtlUrl: tableMtlUrl };

function recolorChipMaterial(material: Material, color: ChipColor): void {
  if (!("color" in material) || !(material.color instanceof Color)) {
    return;
  }

  if (material.name === "white") {
    material.color.set(0xf2f2eb);
    return;
  }

  material.color.set(CHIP_COLORS[color]);
}

function applyChipPalette(root: Object3D, color: ChipColor): void {
  root.traverse((node) => {
    if (!(node instanceof Mesh)) {
      return;
    }

    if (Array.isArray(node.material)) {
      node.material.forEach((material) => recolorChipMaterial(material, color));
      return;
    }

    recolorChipMaterial(node.material, color);
  });
}

export function scaleFactorForTargetHeight(measuredHeight: number, targetHeight: number): number {
  if (measuredHeight <= 0 || !Number.isFinite(measuredHeight)) {
    throw new Error(`Invalid measured chip height: ${measuredHeight}`);
  }
  if (targetHeight <= 0 || !Number.isFinite(targetHeight)) {
    throw new Error(`Invalid target chip height: ${targetHeight}`);
  }
  return targetHeight / measuredHeight;
}

export function scaleFactorForTargetSpan(measuredSpan: number, targetSpan: number): number {
  if (measuredSpan <= 0 || !Number.isFinite(measuredSpan)) {
    throw new Error(`Invalid measured span: ${measuredSpan}`);
  }
  if (targetSpan <= 0 || !Number.isFinite(targetSpan)) {
    throw new Error(`Invalid target span: ${targetSpan}`);
  }
  return targetSpan / measuredSpan;
}

async function loadObjWithMtl(objUrl: string, mtlUrl: string): Promise<Group> {
  const mtlLoader = new MTLLoader();
  const materials = await mtlLoader.loadAsync(mtlUrl);
  materials.preload();

  const objLoader = new OBJLoader();
  objLoader.setMaterials(materials);
  return objLoader.loadAsync(objUrl);
}

function normalizeObjectAroundOrigin(root: Object3D): void {
  const box = new Box3().setFromObject(root);
  const size = box.getSize(new Vector3());
  const scale = scaleFactorForTargetHeight(size.y, CHIP_HEIGHT);
  root.scale.setScalar(scale);
  root.updateMatrixWorld(true);

  const scaledBox = new Box3().setFromObject(root);
  const center = scaledBox.getCenter(new Vector3());
  root.position.sub(center);
  root.updateMatrixWorld(true);
}

function cloneMaterialOrArray(material: Material | Material[]): Material | Material[] {
  if (Array.isArray(material)) {
    return material.map((entry) => entry.clone());
  }
  return material.clone();
}

function mergedMeshFromObject(root: Object3D): ChipPrototype {
  const geometries: BufferGeometry[] = [];
  const materials: Material[] = [];

  root.updateMatrixWorld(true);
  root.traverse((node) => {
    if (!(node instanceof Mesh) || !(node.geometry instanceof BufferGeometry)) {
      return;
    }

    const transformed = node.geometry.clone();
    transformed.applyMatrix4(node.matrixWorld);
    const material = Array.isArray(node.material) ? node.material[0] : node.material;
    if (!material) {
      return;
    }

    materials.push(material.clone());
    geometries.push(transformed);
  });

  if (geometries.length === 0 || materials.length === 0) {
    throw new Error("Loaded OBJ has no mesh geometry.");
  }

  const merged = mergeGeometries(geometries, true);
  geometries.forEach((geometry) => geometry.dispose());
  if (!merged) {
    throw new Error("Could not merge loaded chip geometry.");
  }

  merged.computeBoundingBox();
  merged.computeBoundingSphere();
  return {
    geometry: merged,
    material: materials.length === 1 ? materials[0] : materials
  };
}

function meshFromSingleObjectNode(root: Object3D): ChipPrototype | null {
  const meshes: Mesh[] = [];
  root.traverse((node) => {
    if (node instanceof Mesh && node.geometry instanceof BufferGeometry) {
      meshes.push(node);
    }
  });

  if (meshes.length !== 1) {
    return null;
  }

  const [singleMesh] = meshes;
  if (!singleMesh) {
    return null;
  }

  const geometry = singleMesh.geometry.clone();
  geometry.applyMatrix4(singleMesh.matrixWorld);
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();

  return {
    geometry,
    material: cloneMaterialOrArray(singleMesh.material)
  };
}

function proceduralChipGeometry(): BufferGeometry {
  return new CylinderGeometry(CHIP_RADIUS, CHIP_RADIUS, CHIP_HEIGHT, 36);
}

async function loadTableModel(): Promise<Group> {
  const model = await loadObjWithMtl(TABLE_ASSET.objUrl, TABLE_ASSET.mtlUrl);
  const box = new Box3().setFromObject(model);
  const size = box.getSize(new Vector3());
  const measuredSpan = Math.max(size.x, size.z);
  if (measuredSpan <= 0) {
    throw new Error("Invalid table model horizontal span.");
  }

  const scale = scaleFactorForTargetSpan(measuredSpan, TABLE_TARGET_DIAMETER);
  model.scale.setScalar(scale);
  model.updateMatrixWorld(true);

  const scaledBox = new Box3().setFromObject(model);
  const scaledCenter = scaledBox.getCenter(new Vector3());
  // Keep original vertical profile but center table footprint around scene origin.
  model.position.x -= scaledCenter.x;
  model.position.z -= scaledCenter.z;
  model.updateMatrixWorld(true);

  model.traverse((node) => {
    if (!(node instanceof Mesh)) {
      return;
    }

    node.castShadow = false;
    node.receiveShadow = true;
  });

  return model;
}

async function loadChipPrototypes(): Promise<Record<ChipColor, ChipPrototype>> {
  // Load the chip model once
  const model = await loadObjWithMtl(CHIP_ASSET.objUrl, CHIP_ASSET.mtlUrl);
  normalizeObjectAroundOrigin(model);
  
  // Extract geometry (shared by all chips)
  const directMesh = meshFromSingleObjectNode(model);
  const basePrototype = directMesh ?? mergedMeshFromObject(model);
  
  // Create a prototype for each color with the shared geometry
  const prototypes: Record<ChipColor, ChipPrototype> = {} as Record<ChipColor, ChipPrototype>;
  for (const color of CHIP_COLOR_ORDER) {
    // Clone the model to apply color-specific materials
    const coloredModel = model.clone(true);
    applyChipPalette(coloredModel, color);
    
    // Extract materials for this color
    const coloredDirectMesh = meshFromSingleObjectNode(coloredModel);
    const coloredPrototype = coloredDirectMesh ?? mergedMeshFromObject(coloredModel);
    
    // Use shared geometry but color-specific material
    prototypes[color] = {
      geometry: basePrototype.geometry,
      material: coloredPrototype.material
    };
  }
  
  return prototypes;
}

function addFallbackTable(scene: Scene, tableHeight: number): void {
  const tableCylinderHeight = 0.22;
  const table = new Mesh(
    new CylinderGeometry(TABLE_RADIUS, TABLE_RADIUS, tableCylinderHeight, 48),
    new MeshStandardMaterial({ color: "#195f2d", roughness: 0.78 })
  );
  table.position.set(TABLE_CENTER_X, tableHeight - tableCylinderHeight / 2, TABLE_CENTER_Z);
  table.receiveShadow = true;
  scene.add(table);

  const rimHeight = 0.12;
  const tableRim = new Mesh(
    new CylinderGeometry(TABLE_RADIUS + 0.15, TABLE_RADIUS + 0.15, rimHeight, 48),
    new MeshStandardMaterial({ color: "#3d2f23", roughness: 0.7 })
  );
  tableRim.position.set(
    TABLE_CENTER_X,
    tableHeight - tableCylinderHeight / 2 - rimHeight / 2 - 0.02,
    TABLE_CENTER_Z
  );
  scene.add(tableRim);
}

export async function setupScene(scene: Scene): Promise<RoomScene> {
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
  let usingExternalAssets = true;
  try {
    const tableModel = await loadTableModel();
    const tableBounds = new Box3().setFromObject(tableModel);
    const yOffset = tableHeight - tableBounds.max.y;
    tableModel.position.set(TABLE_CENTER_X, yOffset, TABLE_CENTER_Z);
    scene.add(tableModel);
  } catch {
    usingExternalAssets = false;
    addFallbackTable(scene, tableHeight);
  }

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
  let chipPrototypes: Record<ChipColor, ChipPrototype>;
  try {
    chipPrototypes = await loadChipPrototypes();
  } catch {
    usingExternalAssets = false;
    chipPrototypes = {
      white: {
        geometry: proceduralChipGeometry(),
        material: new MeshStandardMaterial({ color: CHIP_COLORS.white, roughness: 0.52, metalness: 0.07 })
      },
      black: {
        geometry: proceduralChipGeometry(),
        material: new MeshStandardMaterial({ color: CHIP_COLORS.black, roughness: 0.52, metalness: 0.2 })
      },
      red: {
        geometry: proceduralChipGeometry(),
        material: new MeshStandardMaterial({ color: CHIP_COLORS.red, roughness: 0.52, metalness: 0.07 })
      },
      green: {
        geometry: proceduralChipGeometry(),
        material: new MeshStandardMaterial({ color: CHIP_COLORS.green, roughness: 0.52, metalness: 0.07 })
      }
    };
  }

  const tableSurfaceY = tableHeight;
  for (let index = 0; index < TOTAL_CHIPS; index += 1) {
    const color = CHIP_COLOR_ORDER[Math.floor(index / CHIPS_PER_COLOR)] as ChipColor;
    const ring = index % 2 === 0 ? 1.25 : 1.75;
    const angle = index * ((Math.PI * 2) / TOTAL_CHIPS);
    const prototype = chipPrototypes[color];
    const chipMesh = new Mesh(prototype.geometry, prototype.material);
    chipMesh.position.set(
      Math.cos(angle) * ring,
      tableSurfaceY + CHIP_HEIGHT / 2 + 0.01,
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
    holdOffset: new Vector3(0.33, -0.17, -0.74),
    usingExternalAssets,
    physicsEnvironment: {
      floorY: 0,
      tableTopY: tableHeight,
      tableCenterX: TABLE_CENTER_X,
      tableCenterZ: TABLE_CENTER_Z,
      tableRadius: TABLE_RADIUS,
      wallBounds: toWallInnerBounds()
    }
  };
}
