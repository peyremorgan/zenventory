import {
  AmbientLight,
  BoxGeometry,
  Color,
  DirectionalLight,
  Mesh,
  MeshStandardMaterial,
  PlaneGeometry,
  Scene,
  Vector3
} from "three";

export interface RoomScene {
  itemMesh: Mesh;
  shelfMesh: Mesh;
  holdOffset: Vector3;
  placePosition: Vector3;
}

export function setupScene(scene: Scene): RoomScene {
  scene.background = new Color("#3f5871");

  const floor = new Mesh(
    new PlaneGeometry(12, 12),
    new MeshStandardMaterial({ color: "#87765f", roughness: 0.95 })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = 0;
  floor.receiveShadow = true;
  scene.add(floor);

  const wallMaterial = new MeshStandardMaterial({ color: "#5f4a3b", roughness: 0.9 });
  const wallGeometry = new BoxGeometry(12, 3, 0.2);

  const backWall = new Mesh(wallGeometry, wallMaterial);
  backWall.position.set(0, 1.5, -6);

  const frontWall = new Mesh(wallGeometry, wallMaterial);
  frontWall.position.set(0, 1.5, 6);

  const sideWallGeometry = new BoxGeometry(0.2, 3, 12);
  const leftWall = new Mesh(sideWallGeometry, wallMaterial);
  leftWall.position.set(-6, 1.5, 0);

  const rightWall = new Mesh(sideWallGeometry, wallMaterial);
  rightWall.position.set(6, 1.5, 0);

  scene.add(backWall, frontWall, leftWall, rightWall);

  const shelfMesh = new Mesh(
    new BoxGeometry(1.6, 1.4, 0.5),
    new MeshStandardMaterial({ color: "#3f2b1f", roughness: 0.8 })
  );
  shelfMesh.position.set(0, 0.7, -4.2);
  scene.add(shelfMesh);

  const itemMesh = new Mesh(
    new BoxGeometry(0.36, 0.5, 0.08),
    new MeshStandardMaterial({ color: "#3d2f26", roughness: 0.7 })
  );
  itemMesh.position.set(0, 0.35, -2.2);
  scene.add(itemMesh);

  const ambientLight = new AmbientLight(0xffffff, 0.45);
  const directionalLight = new DirectionalLight(0xffffff, 0.85);
  directionalLight.position.set(3, 5, 2);
  scene.add(ambientLight, directionalLight);

  return {
    itemMesh,
    shelfMesh,
    holdOffset: new Vector3(0.3, -0.15, -0.8),
    placePosition: new Vector3(0, 0.95, -4.2)
  };
}
