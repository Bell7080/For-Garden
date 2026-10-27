import Phaser from "phaser";
import { session } from "../state/session";

/**
 * 실시간 아레나의 색 한 벌.
 *
 * 결투장(금빛·붉은 도전)과 같은 선택판에 나란히 서는 **다른 콘텐츠**라, 입구·로비·매칭·밴픽 화면이
 * 모두 같은 보랏빛으로 묶여야 "여기부터 아레나"가 읽힌다. 화면마다 보라를 다시 고르면 같은 아레나가
 * 화면마다 다른 보라로 선다 — 값은 이 표 하나가 갖는다.
 */
export const ARENA_TONE = {
  /** 화면 바탕을 누르는 짙은 가지빛. */
  deep: 0x12081f,
  /** 판때기 면. */
  panel: 0x1c0f31,
  /** 강조선·버튼. */
  accent: 0xa874ff,
  accentText: "#d6bcff",
  /** 겹쳐 밝히는 빛. */
  glow: 0x7b3dff,
  /** 맞부딪히는 순간의 분홍 섬광. */
  spark: 0xff6fb8,
  sparkText: "#ff9fd0",
  /** 확정 버튼(밴·픽)의 면. */
  confirm: 0x8a4dff,
  /** 밴 표식. 적 체력과 같은 계열이지만 더 밝아 보라 바탕 위에서 먼저 읽힌다. */
  ban: 0xff3b5c,
  banText: "#ff7088",
  /** 내 편(아래) 칸의 강조. 전투의 아군 체력과 같은 초록 계열이다. */
  ally: 0x6fe0a0,
  allyText: "#9ff0c2",
  /** 상대 편(위) 칸의 강조. */
  foe: 0xff6f8f,
  foeText: "#ff9fb3",
} as const;

/**
 * 아레나 화면의 바탕: 짙은 보라 막 + 비스듬한 마름모 무늬 + 가장자리 빛.
 *
 * 무늬는 한 장의 그래픽으로 한 번만 그린다(매 프레임 다시 그리지 않는다). 움직임 줄이기가 켜져
 * 있지 않으면 무늬 층만 천천히 흐른다.
 */
export function addArenaBackdrop(scene: Phaser.Scene, depth = -28, alpha = 0.8): Phaser.GameObjects.Container {
  const root = scene.add.container(0, 0).setDepth(depth);
  root.add(scene.add.rectangle(540, 960, 1080, 1920, ARENA_TONE.deep, alpha));
  const pattern = scene.add.graphics();
  const step = 120;
  for (let row = -2; row < 1920 / (step / 2) + 2; row += 1) {
    for (let col = -1; col < 1080 / step + 2; col += 1) {
      const x = col * step + (row % 2 === 0 ? 0 : step / 2);
      const y = row * (step / 2);
      const size = (row + col) % 3 === 0 ? 9 : 5;
      pattern.fillStyle(ARENA_TONE.accent, (row + col) % 3 === 0 ? 0.16 : 0.08);
      pattern.fillPoints([
        new Phaser.Geom.Point(x, y - size),
        new Phaser.Geom.Point(x + size * 0.8, y),
        new Phaser.Geom.Point(x, y + size),
        new Phaser.Geom.Point(x - size * 0.8, y),
      ], true);
    }
  }
  // 비스듬한 띠 셋 — 맞부딪히는 두 편의 기세를 화면 전체에 깐다.
  const stripes = scene.add.graphics();
  [[-200, 0.07], [260, 0.05], [760, 0.08]].forEach(([offset, a]) => {
    stripes.fillStyle(ARENA_TONE.glow, a);
    stripes.fillPoints([
      new Phaser.Geom.Point(offset, 1920), new Phaser.Geom.Point(offset + 180, 1920),
      new Phaser.Geom.Point(offset + 180 + 760, 0), new Phaser.Geom.Point(offset + 760, 0),
    ], true);
  });
  root.add([stripes, pattern]);
  if (!session.settings.accessibility.reduceMotion) {
    scene.tweens.add({ targets: pattern, y: step, duration: 9000, repeat: -1, ease: "Linear" });
  }
  // 위아래 가장자리에 보랏빛이 고인다.
  const edge = scene.add.graphics();
  for (let i = 0; i < 12; i += 1) {
    edge.fillStyle(ARENA_TONE.glow, 0.035);
    edge.fillRect(0, 0, 1080, 40 + i * 22);
    edge.fillRect(0, 1920 - 40 - i * 22, 1080, 40 + i * 22);
  }
  root.add(edge);
  return root;
}

/** 확정 버튼처럼 눌러야 할 것을 숨 쉬게 한다. 움직임 줄이기에서는 멈춘 채 선다. */
export function pulseTarget(scene: Phaser.Scene, target: Phaser.GameObjects.Components.Transform & Phaser.GameObjects.GameObject, amount = 0.05): Phaser.Tweens.Tween | undefined {
  if (session.settings.accessibility.reduceMotion) return undefined;
  return scene.tweens.add({ targets: target, scale: 1 + amount, duration: 520, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
}
