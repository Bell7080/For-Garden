import { audioManager } from "../managers/AudioManager";
import Phaser from "phaser";
import { motionPolicy } from "../core/settings";
import { session } from "../state/session";
import { drawGlyph } from "./glyphs";

/**
 * 출석 도장 — 받은 칸에 **쾅** 찍히는 마름모 인장.
 *
 * 화면 전체의 규칙대로 동그라미가 아니라 마름모이고, 살짝 기울어 손으로 찍은 것처럼 앉는다. 찍히는 순간은
 * 크게 들렸다가 내려꽂혀 한 번 눌리고(겹쳐 밝아지는 합성을 쓰지 않는다), 마름모 조각이 **위로** 튀며 화면이
 * 짧게 떨린다. 3배속이 없는 화면이지만 한 프레임만 떼어 봐도 「찍혔다」가 읽히도록 잔상 대신 크기로 말한다.
 */
export const ATTENDANCE_STAMP = {
  rotation: -0.2,
  /** 들렸을 때의 배율과 내려꽂히는 시간. */
  lift: 2.6,
  slamMs: 170,
  /** 박힌 뒤 한 번 눌렸다 돌아오는 배율. */
  squash: 0.9,
  settleMs: 160,
  shards: 6,
  shardDistance: 70,
  shake: { duration: 140, intensity: 0.006 },
} as const;

/** 인장 한 장을 그린다(움직임 없이). 이미 받은 칸은 이 모습 그대로 서 있다. */
export function addAttendanceStamp(scene: Phaser.Scene, x: number, y: number, size: number, color: number): Phaser.GameObjects.Container {
  const stamp = scene.add.container(x, y).setRotation(ATTENDANCE_STAMP.rotation);
  const r = size / 2;
  const diamond = (scale: number) => [0, -r * scale, r * scale, 0, 0, r * scale, -r * scale, 0];
  const toPoints = (flat: number[]) => {
    const points: Phaser.Geom.Point[] = [];
    for (let index = 0; index < flat.length; index += 2) points.push(new Phaser.Geom.Point(flat[index], flat[index + 1]));
    return points;
  };
  const plate = scene.add.graphics();
  // 아래로 민 검은 복제가 판에서 떼어 놓고, 면 · 안쪽 테 두 겹이 인장의 각인처럼 읽힌다.
  plate.fillStyle(0x000000, 0.45).fillPoints(toPoints(diamond(1).map((value, index) => value + (index % 2 ? 6 : 3))), true);
  plate.fillStyle(color, 0.92).fillPoints(toPoints(diamond(1)), true);
  plate.lineStyle(Math.max(3, size * 0.05), 0x05070a, 0.55).strokePoints(toPoints(diamond(0.76)), true);
  stamp.add(plate);
  stamp.add(drawGlyph(scene, "check", 0, 0, size * 0.46, 0x05070a, 0.9, Math.max(4, size * 0.08)));
  return stamp;
}

/**
 * 인장을 찍는다. 다 박힌 순간 `onImpact`를, 눌림까지 끝나면 `onDone`을 부른다. 움직임 줄이기에서는 들리는
 * 높이와 흔들림을 줄이고 조각을 띄우지 않는다.
 */
export function playAttendanceStamp(
  scene: Phaser.Scene,
  parent: Phaser.GameObjects.Container,
  x: number,
  y: number,
  size: number,
  color: number,
  callbacks: { onImpact?: () => void; onDone?: () => void } = {},
): Phaser.GameObjects.Container {
  const motion = motionPolicy(session.settings);
  const stamp = addAttendanceStamp(scene, x, y, size, color);
  parent.add(stamp);
  const lift = 1 + (ATTENDANCE_STAMP.lift - 1) * motion.nonEssentialDistanceFactor;
  stamp.setScale(lift).setAlpha(0);
  scene.tweens.add({
    targets: stamp, scale: 1, alpha: 1, duration: ATTENDANCE_STAMP.slamMs, ease: "Cubic.easeIn",
    onComplete: () => {
      audioManager?.playUi("attendance.stamp");
      callbacks.onImpact?.();
      if (motion.cameraShakeFactor > 0) scene.cameras.main.shake(ATTENDANCE_STAMP.shake.duration, ATTENDANCE_STAMP.shake.intensity * motion.cameraShakeFactor);
      if (motion.nonEssentialRepeatFactor > 0) burstShards(scene, parent, x, y, size, color);
      scene.tweens.add({
        targets: stamp, scaleX: ATTENDANCE_STAMP.squash + 0.14, scaleY: ATTENDANCE_STAMP.squash, duration: ATTENDANCE_STAMP.settleMs / 2,
        yoyo: true, ease: "Quad.easeOut", onComplete: () => { stamp.setScale(1); callbacks.onDone?.(); },
      });
    },
  });
  return stamp;
}

/** 인장 둘레로 마름모 조각이 위로 튀었다 스러진다. 난수 없이 번호에서 방향을 정한다. */
function burstShards(scene: Phaser.Scene, parent: Phaser.GameObjects.Container, x: number, y: number, size: number, color: number): void {
  const count = ATTENDANCE_STAMP.shards;
  for (let index = 0; index < count; index += 1) {
    // 위쪽 반원(-160°~-20°)에 고르게 편다 — 발밑으로 쏟아지면 「흘렸다」로 보인다.
    const angle = Phaser.Math.DegToRad(-160 + (140 * index) / (count - 1));
    const shard = scene.add.graphics({ x, y });
    const w = size * (index % 2 ? 0.08 : 0.11);
    const h = w * 1.7;
    shard.fillStyle(color, 0.95).fillPoints([new Phaser.Geom.Point(0, -h), new Phaser.Geom.Point(w, -h * 0.1), new Phaser.Geom.Point(0, h * 0.8), new Phaser.Geom.Point(-w * 0.9, 0)], true);
    shard.setRotation(angle + Math.PI / 2);
    parent.add(shard);
    const distance = ATTENDANCE_STAMP.shardDistance * (index % 2 ? 0.8 : 1.1) + size * 0.3;
    scene.tweens.add({
      targets: shard, x: x + Math.cos(angle) * distance, y: y + Math.sin(angle) * distance, alpha: 0, scale: 0.5,
      duration: 420 + index * 20, ease: "Cubic.easeOut", onComplete: () => shard.destroy(),
    });
  }
}
