import TWEEN from '@tweenjs/tween.js';

export function deployParachute(parachute, parachuteType) {
  if (parachute.visible) return;

  parachute.visible = true;
  parachute.scale.set(0.1, 0.1, 0.1);

  new TWEEN.Tween(parachute.scale)
    .to({ x: targetScale, y: targetScale, z: targetScale }, 800)
    .easing(TWEEN.Easing.Elastic.Out)
    .start();
}
