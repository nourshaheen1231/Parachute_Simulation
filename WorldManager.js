import * as THREE from 'three';
import { EXRLoader } from 'three/examples/jsm/loaders/EXRLoader.js';

export function initWorld() {
  const scene = new THREE.Scene();

  // camera
  const camera = new THREE.PerspectiveCamera(
    75,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
  );
  camera.position.set(0, 5, 10);

  //renderer
  const renderer = new THREE.WebGLRenderer({ antialias: false });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.physicallyCorrectLights = true;
  renderer.toneMapping = THREE.LinearToneMapping;
  document.body.appendChild(renderer.domElement);

  // lights
  const sun = new THREE.DirectionalLight(0xffffff, 2);
  sun.position.set(100, 200, 100);
  scene.add(sun);

  const fillLight = new THREE.DirectionalLight(0xffffff, 0.5);
  fillLight.position.set(-50, 50, -50);
  scene.add(fillLight);

  scene.add(new THREE.AmbientLight(0xffffff, 0.3));

  // sky bye
  new EXRLoader()
    .setPath('/textures/')
    .load('sky.exr', (texture) => {
      texture.mapping = THREE.EquirectangularReflectionMapping;
      scene.background = texture;
      scene.environment = texture;
    });

  // ground
  const textureLoader = new THREE.TextureLoader();
  const groundTextures = {
    map: textureLoader.load('/textures/wispy-grass-meadow_albedo.png'),
    aoMap: textureLoader.load('/textures/wispy-grass-meadow_ao.png'),
    normalMap: textureLoader.load('/textures/wispy-grass-meadow_normal-dx.png'),
    roughnessMap: textureLoader.load('/textures/wispy-grass-meadow_roughness.png'),
  };

  // Tile the ground textures
  Object.values(groundTextures).forEach(tex => {
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(50, 50);
  });

  const groundMaterial = new THREE.MeshStandardMaterial({
    map: groundTextures.map,
    aoMap: groundTextures.aoMap,
    normalMap: groundTextures.normalMap,
    roughnessMap: groundTextures.roughnessMap,
    metalness: 0,
    roughness: 1,
  });

  // Ground plane
  const groundGeo = new THREE.PlaneGeometry(10000, 10000, 128, 128);
  const ground = new THREE.Mesh(groundGeo, groundMaterial);
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -1.5;
  scene.add(ground);

  // ====== CLOCK ======
  const clock = new THREE.Clock();
  const skyboxes = {};

  return { scene, camera, renderer, clock, skyboxes };
}
