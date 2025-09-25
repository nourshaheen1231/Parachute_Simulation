import * as THREE from 'three';
import { initWorld } from '/WorldManager.js';
import { loadModels } from '/ModelLoader.js';
import { setupControls } from '/Controls.js';
import { updateEnvironment } from './UpdateEnvironment';

import {
  updateSkydiverPhysics,
  updateParachuteParams,
  getTerminalVelocity,
  gravity,
  currentDrag,
  setParams,
  getShockForce,
  currentAlpha,
  currentBeta,
  currentLift,
  currentAcceleration,
  currentVelocity
} from '/physics.js';
import { deployParachute } from '/Animate.js';
import { currentGravityForce } from './physics';

let windArrow;
let radarCtx;
let speedLine;

let scene, camera, renderer, clock, skyboxes;
let skydiver, parachute, helicopter;
let velocity = new THREE.Vector3(0, 0, 0);
let wind = new THREE.Vector3(0, 0, 0);
let parachuteDeployed = false;
let mixer;
let animations = [];
let parachuteType = "circular";
let skydiverReleased = false;
let hasLanded = false;
let parachuteCircular, parachuteLifting;
let currentAnimationIndex = -1;


const followOffset = new THREE.Vector3(0, 15, -15);
let propeller;
let skydiverClone;
let hud;
let manualCamera = false;
// Rotation transition variables
let startRotation = new THREE.Euler();
let targetRotation = new THREE.Euler();
let rotationDuration = 2.0;
let rotationTimer = 0;
let rotating = false;

// --- Camera Controls 
const cameraSpeed = 20;
const keysPressed = {};


function init() {
  ({ scene, camera, renderer, clock, skyboxes } = initWorld());
  setupControls(camera, renderer.domElement);
  setupHUD();
  setupControlsUI();


  loadModels(scene, (originalSkydiver, loadedSkydiverClone, loadedParachuteCircular, loadedParachuteLifting, loadedHelicopter, loadedPropeller, loadedMixer, loadedAnimations) => {
    function createWindArrow() {
      const dir = wind.clone().normalize();
      const origin = new THREE.Vector3();
      const length = 5;
      const color = 0x00ff00;
      windArrow = new THREE.ArrowHelper(dir, origin, length, color);
      scene.add(windArrow);
    }
    createWindArrow();



    const trailMaterial = new THREE.LineBasicMaterial({ color: 0xff0000 });
    const trailGeometry = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
    speedLine = new THREE.Line(trailGeometry, trailMaterial);
    scene.add(speedLine);

    skydiver = originalSkydiver;
    skydiverClone = loadedSkydiverClone;
    mixer = loadedMixer;
    animations = loadedAnimations;
    parachuteCircular = loadedParachuteCircular;
    parachuteLifting = loadedParachuteLifting;
    helicopter = loadedHelicopter;
    propeller = loadedPropeller;

    const helicopterHeight = 1000;
    helicopter.position.set(0, helicopterHeight, 0);

    camera.position.set(0, helicopterHeight + 15, 50);
    camera.lookAt(0, helicopterHeight, 0);

    if (camera.controls) {
      camera.controls.target.set(0, helicopterHeight, 0);
      camera.controls.update();
    }

    window.addEventListener('keydown', onKeyDown);

    animate();
  });
}

// posessssssss
function setFreefallPose(delta = 0.016) {
  if (!skydiver) return;

  startRotation.copy(skydiver.rotation);
  targetRotation.set(Math.PI / 2, 0, 0);

  rotationTimer = 0;
  rotating = true;

  const skinned = skydiver.getObjectByProperty('type', 'SkinnedMesh');
  if (!skinned) return;
  const skeleton = skinned.skeleton;

  const leftArm = skeleton.getBoneByName("mixamorig_LeftArm");
  const rightArm = skeleton.getBoneByName("mixamorig_RightArm");
  const leftLeg = skeleton.getBoneByName("mixamorig_LeftUpLeg");
  const rightLeg = skeleton.getBoneByName("mixamorig_RightUpLeg");
  const torso = skeleton.getBoneByName("mixamorig_Spine");

  if (!leftArm || !rightArm || !leftLeg || !rightLeg) return;

  const time = performance.now() * 0.001;
  const sway = Math.sin(time * 3) * 0.1;

  leftArm.rotation.set(-Math.PI / 4, 0, Math.PI / 8 + sway);
  rightArm.rotation.set(-Math.PI / 4, 0, -Math.PI / 8 - sway);

  leftLeg.rotation.set(Math.PI / 8, 0, 0);
  rightLeg.rotation.set(Math.PI / 8, 0, 0);

  if (torso) torso.rotation.x = -Math.PI / 12;
}


function setParachutePose(delta = 0.016) {
  if (!skydiver) return;

  startRotation.copy(skydiver.rotation);
  targetRotation.set(0, 0, 0);

  rotationTimer = 0;
  rotating = true;

  const skinned = skydiver.getObjectByProperty('type', 'SkinnedMesh');
  if (!skinned) return;
  const skeleton = skinned.skeleton;

  const leftArm = skeleton.getBoneByName("mixamorig_LeftArm");
  const rightArm = skeleton.getBoneByName("mixamorig_RightArm");
  const leftLeg = skeleton.getBoneByName("mixamorig_LeftUpLeg");
  const rightLeg = skeleton.getBoneByName("mixamorig_RightUpLeg");
  const torso = skeleton.getBoneByName("mixamorig_Spine");

  if (!leftArm || !rightArm || !leftLeg || !rightLeg) return;

  const time = performance.now() * 0.001;
  const sway = Math.sin(time * 2) * 0.05;

  leftArm.rotation.set(-Math.PI / 2.5, 0, -Math.PI / 8 + sway);
  rightArm.rotation.set(-Math.PI / 2.5, 0, Math.PI / 8 + sway);

  leftLeg.rotation.set(Math.PI / 10, 0, 0);
  rightLeg.rotation.set(Math.PI / 10, 0, 0);

  if (torso) torso.rotation.set(-Math.PI / 18 + sway, 0, 0);
}


function playAnimation(index) {
  if (!animations || !animations[index]) {
    console.warn('No animation at index', index);
    return;
  }

  mixer.stopAllAction();

  const action = mixer.clipAction(animations[index]);

  // JumpD (index 2)
  if (index === 2) {
    action.setLoop(THREE.LoopOnce, 1);
    action.clampWhenFinished = true;
    action.timeScale = 1.0;

    action.reset().play();
    console.log(`Playing JumpD animation`);

    action.onFinished = () => {
      console.log('JumpD finished → Switching to Idle');
      playAnimation(1); // Idle
      currentAnimationIndex = 1;
    };
  } else {
    action.setLoop(THREE.LoopRepeat);
    action.clampWhenFinished = false;
    action.timeScale = 1.0;

    action.reset().play();
    console.log(`Playing animation ${index}: ${animations[index].name}`);
  }

  currentAnimationIndex = index;
}


function updateAnimationByHeight(height) {
  const animationHeights = [
    { index: -1, triggerHeight: 1000 }, // FLYIDLE
    { index: 2, triggerHeight: 5 }, // JUMP DOWN
    { index: 1, triggerHeight: -1 }, // IDLE
  ];

  for (let i = 0; i < animationHeights.length; i++) {
    const { index, triggerHeight } = animationHeights[i];

    if ((index === 2 || index === 1) && !parachuteDeployed) {
      continue;
    }


    if (height <= triggerHeight && currentAnimationIndex < index) {
      playAnimation(index);
      currentAnimationIndex = index;

      if (index === 2) {
        const action = mixer.clipAction(animations[2]);
        action.setLoop(THREE.LoopOnce, 1);
        action.clampWhenFinished = true;
        action.reset().play();

        currentAnimationIndex = 2;

        action.onFinished = () => {
          playAnimation(1); // Idle
          currentAnimationIndex = 1;
        };

        return;
      }

    }
  }
}

function onKeyDown(e) {
  const key = e.key.toLowerCase();

  if (key === '1') {
    parachuteType = 'circular';
    return;
  }
  if (key === 'l') {
    parachuteType = 'lifting';
    return;
  }

  if (key === 'p' && !parachuteDeployed && skydiverReleased) {
    parachute = (parachuteType === 'circular') ? parachuteCircular : parachuteLifting;

    parachuteCircular.visible = (parachuteType === 'circular');
    parachuteLifting.visible = (parachuteType === 'lifting');

    deployParachute(parachute);
    updateParachuteParams(parachuteType, true);
    parachuteDeployed = true;
    getShockForce(30);

    setParachutePose();
  }

  if (key === 'r' && !skydiverReleased) {
    const worldPosition = new THREE.Vector3();
    helicopter.getWorldPosition(worldPosition);

    if (helicopter.children.includes(skydiverClone)) {
      helicopter.remove(skydiverClone);
    }

    if (!scene.children.includes(skydiver)) {
      scene.add(skydiver);
    }

    skydiver.position.copy(worldPosition).add(new THREE.Vector3(0, -2, 0));
    velocity.set(0, 0, 0);
    skydiverReleased = true;

    setFreefallPose();

    console.log('Skydiver released at', skydiver.position);
  }
}

// const baseWind = new THREE.Vector3(2, 0, 0);

// function updateWind(deltaTime) {
//   const time = performance.now() / 1000;
//   wind.set(
//     baseWind.x + Math.sin(time * 0.3) * 2.5,
//     Math.sin(time * 0.1) * 0.5,
//     Math.cos(time * 0.2) * 1.0
//   );
// }



function animate() {
  requestAnimationFrame(animate);
  const delta = clock.getDelta();
  let shakeIntensity = 0;

  if (propeller) propeller.rotation.z += delta * 10;
  if (rotating && skydiver) {
    rotationTimer += delta;
    const t = Math.min(rotationTimer / rotationDuration, 1);
    skydiver.rotation.set(
      THREE.MathUtils.lerp(startRotation.x, targetRotation.x, t),
      THREE.MathUtils.lerp(startRotation.y, targetRotation.y, t),
      THREE.MathUtils.lerp(startRotation.z, targetRotation.z, t)
    );
    if (t >= 1) rotating = false;
  }

  if (skydiverReleased && skydiver) {
    // --- Physics ---
    updateSkydiverPhysics(skydiver, velocity, delta, wind, parachuteDeployed);
    updateAnimationByHeight(skydiver.position.y);

    if (typeof applyWindEffect === "function") applyWindEffect();
    if (windArrow && typeof updateWindArrow === "function") updateWindArrow();

    if (speedLine && typeof updateSpeedLine === "function") updateSpeedLine();
    if (radarCtx && typeof updateRadar === "function") updateRadar();

    if (hud && typeof updateHUD === "function") updateHUD(skydiver.position.y, velocity.length());

    if (typeof updateEnvironment === "function") updateEnvironment(scene, skydiver.position.y, skyboxes);
    if (typeof updateAnimationByHeight === "function") updateAnimationByHeight(skydiver.position.y);

    if (!hasLanded && skydiver.position.y <= -1.49 && velocity.y === 0) {
      hud.innerHTML += `<br><b>Landing Complete</b>`;
      hasLanded = true;
      if (parachute) parachute.visible = false;
    }

    if (mixer) mixer.update(delta);

    if (skydiver && !manualCamera) {
      const offset = followOffset.clone().applyQuaternion(skydiver.quaternion);
      const desiredPosition = skydiver.position.clone().add(offset);

      const lookAtPos = skydiver.position.clone().add(velocity.clone().normalize().multiplyScalar(5));
      camera.lookAt(lookAtPos);
      if (!hasLanded) {
        const speed = velocity.length();
        const shakeIntensity = Math.min(speed / 50, 1);
        const shakeAmount = 0.5 * shakeIntensity;

        desiredPosition.x += (Math.random() - 0.5) * shakeAmount;
        desiredPosition.y += (Math.random() - 0.5) * shakeAmount;
        desiredPosition.z += (Math.random() - 0.5) * shakeAmount;
      }

      camera.position.lerp(desiredPosition, 0.1);

      camera.lookAt(skydiver.position);

      if (camera.controls) {
        camera.controls.target.copy(skydiver.position);
        camera.controls.update();
      }
    }
  }
  updateManualCamera(delta);
  if (typeof TWEEN !== "undefined") TWEEN.update();
  if (renderer && scene && camera) renderer.render(scene, camera);
}


function setupHUD() {
  hud = document.createElement('div');
  hud.id = "hud";

  hud.style.position = "fixed";
  hud.style.top = "20px";
  hud.style.left = "20px";
  hud.style.width = "260px";
  hud.style.padding = "15px 18px";
  hud.style.background = "rgba(15, 15, 30, 0.8)";
  hud.style.backdropFilter = "blur(10px)";
  hud.style.borderRadius = "12px";
  hud.style.boxShadow = "0 0 20px rgba(0, 255, 255, 0.3)";
  hud.style.color = "#0ff";
  hud.style.fontSize = "14px";
  hud.style.zIndex = "100";
  hud.style.userSelect = "none";

  document.body.appendChild(hud);

}





function updateHUD(height, speed) {
  hud.innerHTML = `
    <div style="font-weight:700; font-size:16px; margin-bottom:8px; color:#0ff;">🪂 Skydiver HUD</div>
    
    <div><b>Height:</b> ${height.toFixed(1)} m</div>
    <div><b>Speed:</b> ${speed.toFixed(1)} m/s</div>
    <div><b>Velocity:</b> (${currentVelocity.x.toFixed(1)}, ${currentVelocity.y.toFixed(1)}, ${currentVelocity.z.toFixed(1)})</div>
    <div><b>Accel:</b> (${currentAcceleration.x.toFixed(1)}, ${currentAcceleration.y.toFixed(1)}, ${currentAcceleration.z.toFixed(1)})</div>
    
    <hr style="border:none; border-top:1px solid rgba(0,255,255,0.2); margin:8px 0;">
    
    <div style="font-weight:700; color:#0ff;">⚡ Forces</div>
    <div><b>Lift:</b> (${currentLift.x.toFixed(2)}, ${currentLift.y.toFixed(2)}, ${currentLift.z.toFixed(2)})</div>
    <div><b>Drag:</b> (${currentDrag.x.toFixed(2)}, ${currentDrag.y.toFixed(2)}, ${currentDrag.z.toFixed(2)})</div>
    <div><b>Gravity Force:</b> (${currentGravityForce.x.toFixed(2)}, ${currentGravityForce.y.toFixed(2)}, ${currentGravityForce.z.toFixed(2)})</div>
    
    <hr style="border:none; border-top:1px solid rgba(0,255,255,0.2); margin:8px 0;">
    
    <div style="font-weight:700; color:#0ff;">🎛 Parachute</div>
    <div><b>Status:</b> ${parachuteDeployed ? '<span style="color:#0f0;">Deployed</span>' : '<span style="color:#f33;">Not Deployed</span>'}</div>
    <div><b>Type:</b> ${parachuteType}</div>
    <div><b>Pitch:</b> ${currentAlpha.toFixed(1)}°</div>
    <div><b>Yaw:</b> ${currentBeta.toFixed(1)}°</div>
    
    <hr style="border:none; border-top:1px solid rgba(0,255,255,0.2); margin:8px 0;">
    
    <div style="font-weight:700; color:#0ff;">📍 Position</div>
    <div><b>X:</b> ${skydiver.position.x.toFixed(1)} m</div>
    <div><b>Z:</b> ${skydiver.position.z.toFixed(1)} m</div>
  `;
}

function setupControlsUI() {
  const container = document.createElement('div');
  container.id = "controlsUI";
  container.style.position = 'absolute';
  container.style.top = '20px';
  container.style.right = '20px';
  container.style.color = '#0ff';
  container.style.padding = '15px 20px';
  container.style.fontSize = '14px';
  container.style.zIndex = '101';
  container.style.userSelect = 'none';
  container.style.borderRadius = '12px';
  container.style.lineHeight = '1.5em';
  container.style.letterSpacing = '0.5px';
  container.style.background = 'rgba(15, 15, 30, 0.55)';
  container.style.backdropFilter = 'blur(10px)';
  container.style.boxShadow = '0 0 20px rgba(0, 255, 255, 0.4)';
  container.style.border = '1px solid rgba(0, 255, 255, 0.4)';
  container.style.maxWidth = '250px';

  // Title
  const title = document.createElement('div');
  title.textContent = "⚙️ Controls";
  title.style.fontWeight = "700";
  title.style.fontSize = "16px";
  title.style.marginBottom = "8px";
  title.style.color = "#0ff";
  container.appendChild(title);

  // Restart button
  const restartBtn = document.createElement('button');
  restartBtn.textContent = 'Restart Simulation';
  restartBtn.style.width = '100%';
  restartBtn.style.marginTop = '10px';
  restartBtn.style.padding = '8px';
  restartBtn.style.fontSize = '14px';
  restartBtn.style.cursor = 'pointer';
  restartBtn.style.borderRadius = '8px';
  restartBtn.style.border = '1px solid rgba(0,255,255,0.6)';
  restartBtn.style.background = 'rgba(0, 255, 255, 0.1)';
  restartBtn.style.color = '#0ff';
  restartBtn.style.transition = 'all 0.2s ease';
  restartBtn.onmouseover = () => restartBtn.style.background = 'rgba(0, 255, 255, 0.25)';
  restartBtn.onmouseout = () => restartBtn.style.background = 'rgba(0, 255, 255, 0.1)';
  restartBtn.onclick = restartSimulation;

  function createInput(labelText, defaultValue, min, max, step, onChange) {
    const wrapper = document.createElement('div');
    wrapper.style.marginBottom = '10px';

    const label = document.createElement('label');
    label.textContent = labelText;
    label.style.display = 'block';
    label.style.marginBottom = '3px';
    label.style.color = '#0ff';

    const input = document.createElement('input');
    input.type = 'number';
    input.value = defaultValue;
    input.min = min;
    input.max = max;
    input.step = step;
    input.style.width = '100%';
    input.style.padding = '5px';
    input.style.borderRadius = '6px';
    input.style.border = '1px solid rgba(0,255,255,0.4)';
    input.style.background = 'rgba(0, 255, 255, 0.1)';
    input.style.color = '#0ff';

    input.addEventListener('input', () => {
      onChange(parseFloat(input.value));
    });

    wrapper.appendChild(label);
    wrapper.appendChild(input);
    return wrapper;
  }

  container.appendChild(createInput('Drag Coefficient (Cd)', 1.0, 0, 5, 0.01, val => setParams({ Cd: val })));
  container.appendChild(createInput('Cross-sectional Area (A)', 1.0, 0.1, 50, 0.1, val => setParams({ A: val })));
  container.appendChild(createInput('Mass (kg)', 80, 10, 200, 1, val => setParams({ mass: val })));
  container.appendChild(createInput('Parachute Tension', 1.0, 0.1, 5, 0.01, val => setParams({ ParachuteTension: val })));
  container.appendChild(createInput('Pitch (alpha °)', 0, -90, 90, 1, val => setParams({ alpha: val })));
  container.appendChild(createInput('Yaw (beta °)', 0, -180, 180, 1, val => setParams({ beta: val })));
  container.appendChild(createInput('Wind Speed (m/s)', 0, -20, 20, 0.1, val => { wind.x = val; }));

  container.appendChild(restartBtn);
  document.body.appendChild(container);
}

function restartSimulation() {
  if (!scene || !helicopter || !skydiver || !skydiverClone) return;
  if (scene.children.includes(skydiver)) {
    scene.remove(skydiver);
  }
  if (!helicopter.children.includes(skydiverClone)) {
    helicopter.add(skydiverClone);
  }
  velocity.set(0, 0, 0);
  wind.set(2, 0, 0);
  setParams({
    Cd: 1.0,
    A: 1.0,
    mass: 80,
    ParachuteTension: 1.0,
    alpha: 0,
    beta: 0
  });

  const helicopterHeight = 1000;
  helicopter.position.set(0, helicopterHeight, 0);

  camera.position.set(0, helicopterHeight + 15, 50);
  camera.lookAt(0, helicopterHeight, 0);
  if (camera.controls) {
    camera.controls.target.set(0, helicopterHeight, 0);
    camera.controls.update();
  }

  parachuteDeployed = false;
  skydiverReleased = false;
  hasLanded = false;
  parachute = null;
  parachuteCircular.visible = false;
  parachuteLifting.visible = false;

  if (mixer) mixer.stopAllAction();
  updateHUD(helicopter.position.y, 0);
  console.log("Simulation please work");
}

window.addEventListener("keydown", (e) => {
  const key = e.key.toLowerCase();
  keysPressed[key] = true;

  if (parachuteType == "lifting" && parachuteDeployed) {
    if (key === 'q') {
      setParams({ beta: -25 });
    }
    if (key === 'e') {
      setParams({ beta: 25 });
    }

    if (key === 'o') {
      setParams({ alpha: -25 });
    }
    if (key === 'l') {
      setParams({ alpha: 25 });
    }

  }

  if (key === "c") {
    manualCamera = !manualCamera;
    console.log(`Manual camera: ${manualCamera ? "ON" : "OFF"}`);
  }
});

window.addEventListener("keyup", (e) => {
  const key = e.key.toLowerCase();
  keysPressed[e.key.toLowerCase()] = false;
  if (key === 'q' || key === 'e') {
    setParams({ beta: 0 }); // العودة إلى الوضع المستقيم
  }
  if (key === 'o' || key === 'l') {
    setParams({ alpha: 0 }); // العودة إلى الوضع المستقيم
  }
});

function updateManualCamera(delta) {
  if (!manualCamera || !camera) return;
  const moveSpeed = cameraSpeed * delta;
  const forward = new THREE.Vector3();
  const right = new THREE.Vector3();
  camera.getWorldDirection(forward);
  forward.y = 0;
  forward.normalize();
  right.crossVectors(forward, camera.up).normalize();
  if (keysPressed["w"]) camera.position.add(forward.clone().multiplyScalar(moveSpeed));
  if (keysPressed["s"]) camera.position.add(forward.clone().multiplyScalar(-moveSpeed));
  if (keysPressed["a"]) camera.position.add(right.clone().multiplyScalar(-moveSpeed));
  if (keysPressed["d"]) camera.position.add(right.clone().multiplyScalar(moveSpeed));
  if (keysPressed[" "]) camera.position.y += moveSpeed;
  if (keysPressed["shift"]) camera.position.y -= moveSpeed;
}

init(); 
