import Phaser from "phaser";
import { motionPolicy } from "../core/settings";
import { session } from "../state/session";
import { chipPoints, drawInnerVignette, drawLayer, drawShapeInnerGlow, drawShapeOutline } from "./holo";
import { addRuneHeartSilhouette } from "./runeIcons";

/**
 * 룬이 들어갈 빈 칸 하나 — 특성 연구대와 합성대가 같은 한 장을 쓴다.
 *
 * **빈 칸도 액자다.** 반투명 사각형 하나만 두던 때는 그 자리가 「무엇을 넣는 칸」인지도, 눌러야 하는
 * 것인지도 말하지 않아 배경 위에 뚫린 검은 구멍으로 읽혔다. 지금은 룬이 들어오면 서는 액자
 * (`addRuneFrame`)와 **같은 실루엣·같은 사방 외곽선·같은 안쪽 비네트**로 서서, 들어올 것과 자리가 한
 * 모양이다. 안에는 세 조각을 합친 하트가 옅게 파여 있어 「룬이 들어간다」를 그림이 말하고, 그 위의
 * 더하기 하나가 「누르면 넣는다」를 말한다. 안쪽 빛이 느리게 숨 쉬어 누를 자리가 먼저 눈에 걸린다
 * (움직임 줄이기에서는 멈춘 채 선다). 바깥 두 모서리의 짧은 표식은 판의 모서리 표식과 같은 결이다.
 */
export const RUNE_SOCKET = {
  /** 깎임(한 변 대비) — 룬 액자와 같다. */
  bevel: 0.2,
  fill: 0x0a0f16,
  heartAlpha: 0.2,
  /** 더하기 한 획의 길이·굵기(한 변 대비). */
  plusArm: 0.2,
  plusWidth: 0.045,
  breatheMs: 1300,
  bracketArm: 0.14,
  bracketGap: 9,
} as const;

export function addRuneSocket(scene: Phaser.Scene, x: number, y: number, size: number, tone: number): Phaser.GameObjects.Container {
  const S = RUNE_SOCKET;
  const socket = scene.add.container(x, y);
  const cut = size * S.bevel;
  const shape = chipPoints(size, size, { bevel: { topLeft: cut, topRight: 0, bottomRight: cut, bottomLeft: 0 } });
  socket.add(drawLayer(scene, 0, 0, shape, { fill: S.fill, alpha: 0.96, shadow: { x: 4, y: 6 } }));
  socket.add(drawInnerVignette(scene, 0, 0, shape, { strength: 0.55 }));
  socket.add(addRuneHeartSilhouette(scene, size, tone, S.heartAlpha));
  const glow = drawShapeInnerGlow(scene, 0, 0, shape, { color: tone, strength: 0.4, depth: 0.28 });
  socket.add(glow);
  socket.add(drawShapeOutline(scene, 0, 0, shape, { color: tone, alpha: 0.7, width: 3 }));

  // 더하기 — 검은 획을 먼저 깔아 하트 실루엣 위에서도 떨어져 보이게 한다.
  const arm = size * S.plusArm;
  const stroke = Math.max(6, size * S.plusWidth);
  const plus = scene.add.graphics();
  plus.fillStyle(0x05070a, 0.85);
  plus.fillRect(-arm - 3, -stroke / 2 - 3, arm * 2 + 6, stroke + 6);
  plus.fillRect(-stroke / 2 - 3, -arm - 3, stroke + 6, arm * 2 + 6);
  plus.fillStyle(tone, 1);
  plus.fillRect(-arm, -stroke / 2, arm * 2, stroke);
  plus.fillRect(-stroke / 2, -arm, stroke, arm * 2);
  socket.add(plus);

  // 덜 깎인 두 모서리(오른쪽 위·왼쪽 아래) 바깥의 표식.
  const h = size / 2 + S.bracketGap;
  const a = size * S.bracketArm;
  const marks = scene.add.graphics();
  marks.lineStyle(3, tone, 0.8);
  marks.strokePoints([new Phaser.Geom.Point(h - a, -h), new Phaser.Geom.Point(h, -h), new Phaser.Geom.Point(h, -h + a)], false);
  marks.strokePoints([new Phaser.Geom.Point(-h + a, h), new Phaser.Geom.Point(-h, h), new Phaser.Geom.Point(-h, h - a)], false);
  socket.add(marks);

  if (motionPolicy(session.settings).nonEssentialRepeatFactor > 0) {
    glow.setAlpha(0.35);
    scene.tweens.add({ targets: glow, alpha: 1, duration: S.breatheMs, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
    scene.tweens.add({ targets: [plus, marks], alpha: 0.6, duration: S.breatheMs, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
  }
  return socket;
}
