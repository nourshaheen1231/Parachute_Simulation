import * as THREE from 'three';
import { velocity } from 'three/tsl'; //Vt

const gravity = 9.81; // m/s²
const airDensity = 1.225; // kg/m³ at sea level

let Cd = 1.0; // drag coefficient (without parachute)
let A = 1.0; // human cross-sectional area (m²)
let mass = 80; // kg
let parachuteTension = 1.0;
let alpha = 0; // pitch in degrees
let beta = 0;  // yaw in degrees
let parachuteDeployed = false;
let parachuteType = null; // "circular" or "lifting"
let targetBeta = 0;
let targetAlpha = 0;

let currentAlpha = 0;
let currentBeta = 0;
let currentDrag = new THREE.Vector3();
let currentLift = new THREE.Vector3();
let currentAcceleration = new THREE.Vector3();
let currentVelocity = new THREE.Vector3();
let currentGravityForce = new THREE.Vector3();
// --- Physics calculations ---

function getGravityForce() {
    return new THREE.Vector3(0, -mass * gravity, 0);
}

function getRelativeVelocity(velocity, wind) {
    return velocity.clone().sub(wind);
}

function getDragForce(velocity) {
    if (velocity.length() === 0) return new THREE.Vector3();
    const direction = velocity.clone().normalize().negate(); // drag opposes motion
    const dragMagnitude = 0.5 * airDensity * Cd * A * velocity.lengthSq();
    return direction.multiplyScalar(dragMagnitude);
}

function getLiftForce(velocity) {
    // Only for lifting parachute
    if (!parachuteDeployed || parachuteType !== "lifting") return new THREE.Vector3(0, 0, 0);

    const verticalSpeed = -velocity.y; // downward velocity
    if (verticalSpeed <= 0) return new THREE.Vector3(0, 0, 0);

    const liftMagnitude = 0.5 * airDensity * Cd * A * verticalSpeed * verticalSpeed;

    // الاتجاه الأساسي لقوة الرفع: للأعلى + للأمام
    let liftDirection = new THREE.Vector3(0, 1, 0.5).normalize();
    // تطبّق أولًا alpha (حول محور X = للخلف/للأمام)
    liftDirection.applyAxisAngle(new THREE.Vector3(1, 0, 0), THREE.MathUtils.degToRad(alpha));

    // ثم beta (حول محور Y = لليمين/اليسار)
    liftDirection.applyAxisAngle(new THREE.Vector3(0, 0, 1), THREE.MathUtils.degToRad(beta));

    return liftDirection.multiplyScalar(liftMagnitude);
}

function updateParachuteParams(type, deployed) {
    parachuteDeployed = deployed;
    parachuteType = deployed ? type : null;

    if (!deployed) {
        Cd = 1.0;
        A = 0.7;
        return;
    }

    if (type === "circular") {
        Cd = 1.75 * parachuteTension;
        A = 30 * parachuteTension;
    } else if (type === "lifting") {
        Cd = 1.5 * parachuteTension;
        A = 35 * parachuteTension;
    }
}


function updateSkydiverPhysics(skydiver, velocity, deltaTime, wind = new THREE.Vector3()) {
    const relativeVelocity = getRelativeVelocity(velocity, wind);

    const gravityForce = getGravityForce();
    const dragForce = getDragForce(relativeVelocity);
    const liftForce = getLiftForce(relativeVelocity);
    const totalForce = gravityForce.clone().add(dragForce).add(liftForce);
    const acceleration = totalForce.clone().divideScalar(mass);

    currentAlpha = alpha;
    currentBeta = beta;
    currentLift.copy(liftForce);
    currentDrag.copy(dragForce);
    currentAcceleration.copy(acceleration);
    currentVelocity.copy(velocity);
    currentGravityForce.copy(gravityForce);
    velocity.add(acceleration.multiplyScalar(deltaTime));
    skydiver.position.add(velocity.clone().multiplyScalar(deltaTime));

    const groundLevel = -1.5;
    if (skydiver.position.y <= groundLevel) {
        skydiver.position.y = groundLevel;
        velocity.set(0, 0, 0);
    }

    // إذا كان البيتا ≠ 0 → طبّق تسارع جانبي خفيف لمحاكاة انحراف
    if (parachuteDeployed && Math.abs(beta) > 0.1) {
        const sideAcceleration = 0.5 * Math.sin(THREE.MathUtils.degToRad(beta)); // القيمة تحدد شدة الانحراف
        velocity.x += sideAcceleration * deltaTime; // انحراف جانبي (على محور X)

        // دوران بسيط للموديل
        skydiver.rotation.z = -THREE.MathUtils.degToRad(beta) * 0.5;
    }
    const smoothing = 2; // قيمة 3-8 تقريباً جيدة
    beta = THREE.MathUtils.lerp(beta, targetBeta, deltaTime * smoothing);
    alpha = THREE.MathUtils.lerp(alpha, targetAlpha, deltaTime * smoothing);

    if (parachuteDeployed) {
        const currentX = skydiver.rotation.x;
        const targetX = THREE.MathUtils.degToRad(alpha);
        const smoothFactor = 2;
        skydiver.rotation.x = THREE.MathUtils.lerp(currentX, targetX, deltaTime * smoothFactor);
    }

    

}

// --- Utility functions ---

function getTerminalVelocity() {
    return Math.sqrt((2 * mass * gravity) / (Cd * A * airDensity));
}

function getShockForce(upwardAccel) {
    return mass * (gravity + upwardAccel);
}

function setParams(params) {
    if (typeof params.Cd === 'number') Cd = params.Cd;
    if (typeof params.A === 'number') A = params.A;
    if (typeof params.mass === 'number') mass = params.mass;
    if (typeof params.parachuteTension === 'number') parachuteTension = params.parachuteTension;
    if (typeof params.alpha === 'number') targetAlpha = params.alpha;
    if (typeof params.beta === 'number') targetBeta = params.beta;
}

export {
    updateSkydiverPhysics,
    updateParachuteParams,
    getTerminalVelocity,
    gravity,
    setParams,
    getShockForce,
    currentDrag,
    currentAlpha,
    currentBeta,
    currentLift,
    currentAcceleration,
    currentVelocity,
    currentGravityForce
};