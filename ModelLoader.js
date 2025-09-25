import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import * as THREE from 'three';

export function loadModels(scene, callback) {
  const loader = new GLTFLoader();

  loader.load('public/models/helicopter.glb', (helicopterGLTF) => {
    const helicopter = helicopterGLTF.scene;
    helicopter.scale.set(10, 10, 10);

    let propeller = null;
    helicopter.traverse((child) => {
      if (child.isMesh && child.name === 'Cube_4') {
        propeller = child;
      }
    });

    loader.load('public/models/skydiver.glb', (skydiverGLTF) => {
      const originalSkydiver = skydiverGLTF.scene;
      const skydiverClone = originalSkydiver.clone();

      originalSkydiver.scale.set(4, 4, 4);
      skydiverClone.scale.set(0.5, 0.5, 0.5);
      skydiverClone.position.set(0, -2, 0);

      const animations = skydiverGLTF.animations;
      console.log('Available animations:', animations.map(a => a.name));

      const mixer = new THREE.AnimationMixer(originalSkydiver);
      window.anim = animations;

      loader.load('public/models/parachute_circular.glb', (circularGLTF) => {
        const parachuteCircular = circularGLTF.scene;
        parachuteCircular.visible = false;
        parachuteCircular.position.set(0, 2.3, 0);

        loader.load('public/models/parachute_lifting.glb', (liftingGLTF) => {
          const parachuteLifting = liftingGLTF.scene;
          parachuteLifting.visible = false;
          parachuteLifting.position.set(0, 1.4, -0.2);
          // parachuteLifting.rotation.set(0.2, Math.PI / 1.2, 0.2);
          parachuteLifting.scale.set(0.3, 0.3, 0.3);

          originalSkydiver.add(parachuteCircular);
          originalSkydiver.add(parachuteLifting);

          helicopter.add(skydiverClone);
          scene.add(helicopter);

          callback(originalSkydiver, skydiverClone, parachuteCircular, parachuteLifting, helicopter, propeller, mixer, animations);
        });
      });
    });
  });

  ////////grass
  const gridSize = 55;
  const spacing = 54;

  loader.load('public/models/grass/scene.gltf', (gltf) => {
    const originalModel = gltf.scene;
    originalModel.scale.set(3, 3, 3);

    for (let i = -55; i < gridSize; i++) {
      for (let j = -55; j < gridSize; j++) {
        const clone = originalModel.clone(true);
        clone.position.set(i * spacing, -0.5, j * spacing);
        scene.add(clone);
      }
    }

  });


  ///////trees
  const gridSize2 = 55;
  const spacing2 = 54;
  const occupiedPositions = new Set(); // To store reserved locations

  const treeLoader1 = new GLTFLoader();
  const treeLoader2 = new GLTFLoader();
  const houseLoader = new GLTFLoader();

  Promise.all([
    new Promise((resolve) => treeLoader1.load('public/models/tree2/scene.gltf', (gltf) => resolve(gltf.scene))),
    new Promise((resolve) => treeLoader2.load('public/models/tree/scene.gltf', (gltf) => resolve(gltf.scene)))
  ]).then(([treeModel1, treeModel2]) => {
    for (let i = -gridSize2; i < gridSize2; i++) {
      for (let j = -gridSize2; j < gridSize2; j++) {
        if (Math.random() < 0.1) {
          const offsetX = (Math.random() - 0.5) * spacing2;
          const offsetZ = (Math.random() - 0.5) * spacing2;
          const posX = i * spacing2 + offsetX;
          const posZ = j * spacing2 + offsetZ;

          const key = `${Math.round(posX)},${Math.round(posZ)}`;
          if (occupiedPositions.has(key)) continue;

          const useTree1 = Math.random() < 0.7;
          const treeModel = useTree1 ? treeModel1 : treeModel2;
          const treeClone = treeModel.clone(true);

          treeClone.position.set(posX, 0.1, posZ);

          let scale;
          if (useTree1) {
            scale = 3 + Math.random() * 3;
          } else {
            scale = 0.2 + Math.random() * 0.2;
          }

          treeClone.scale.set(scale, scale, scale);
          treeClone.rotation.y = Math.random() * Math.PI * 2;

          scene.add(treeClone);
          occupiedPositions.add(key);
        }
      }
    }

    ////////house
    houseLoader.load('public/models/wooden_cabin.glb', (gltf) => {
      const houseModel = gltf.scene;

      const textureLoader = new THREE.TextureLoader();
      const woodTexture = textureLoader.load('/models/table/textures/wood2.jpeg');

      const tableLoader = new GLTFLoader();
      tableLoader.load('public/models/table/scene.gltf', (tableGltf) => {
        const tableModel = tableGltf.scene;

        tableModel.traverse((child) => {
          if (child.isMesh) {
            child.material = new THREE.MeshStandardMaterial({
              map: woodTexture,
              roughness: 0.6,
              metalness: 0.1
            });
          }
        });

        for (let i = -gridSize2; i < gridSize2; i++) {
          for (let j = -gridSize2; j < gridSize2; j++) {
            if (Math.random() < 0.08) {
              const offsetX = (Math.random() - 0.5) * spacing2 * 0.3;
              const offsetZ = (Math.random() - 0.5) * spacing2 * 0.3;
              const posX = i * spacing2 + offsetX;
              const posZ = j * spacing2 + offsetZ;

              const key = `${Math.round(posX)},${Math.round(posZ)}`;
              if (occupiedPositions.has(key)) continue;

              const houseClone = houseModel.clone(true);
              houseClone.position.set(posX, 0.1, posZ);
              const fixedScale = 0.07;
              houseClone.scale.set(fixedScale, fixedScale, fixedScale);
              houseClone.rotation.y = (Math.random() - 0.5) * Math.PI * 0.5;

              scene.add(houseClone);
              occupiedPositions.add(key);

              if (Math.random() < 0.5) {
                const tableClone = tableModel.clone(true);

                const angle = houseClone.rotation.y;
                const distance = 19;

                const offsetX = Math.sin(angle) * distance;
                const offsetZ = -Math.cos(angle) * distance;

                tableClone.position.set(posX + offsetX, 0.1, posZ + offsetZ);
                tableClone.rotation.y = angle;
                tableClone.scale.set(5, 5, 5);

                scene.add(tableClone);
              }
            }
          }
        }
      });
    });
  });

  ////////cloud
  const cloudLoader = new GLTFLoader();
  cloudLoader.load('public/models/cloud/scene.gltf', (cloudGltf) => {
    const cloudModel = cloudGltf.scene;

    const cloudCount = 25;
    const skyArea = 1200;
    for (let i = 0; i < cloudCount; i++) {
      const cloudClone = cloudModel.clone(true);

      const posX = (Math.random() - 0.5) * skyArea;
      const posY = 380 + Math.random() * 50;
      const posZ = (Math.random() - 0.5) * skyArea;
      cloudClone.position.set(posX, posY, posZ);

      const scale = 3 + Math.random() * 12;
      cloudClone.scale.set(scale, scale, scale);

      cloudClone.rotation.y = Math.random() * Math.PI * 2;

      scene.add(cloudClone);
    }
  });


}
