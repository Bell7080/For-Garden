import Phaser from "phaser";
import type { CharacterTag } from "./characterTags";
import { chipPoints, drawLayer } from "./holo";
import { textStyle } from "./theme";

/**
 * 이름 아래 **해시태그 한 줄**(`#원거리 #범위공격 #딜러`). 정보창·적 정보창·소환수 창이 같은 한 장을 쓴다.
 *
 * 스킬 요약 칩(`SkillTagRow`)보다 한 단계 가볍다 — 그림 칸이 없고 `#`과 낱말만 서며, 바탕은 옅은 어두운
 * 유리다. 이름과 속성·직군 뱃지가 먼저 읽히고 태그는 그 아래에서 "무엇을 하는 몸인가"를 거든다.
 *
 * **한 줄만 쓴다.** 넘치면 줄을 바꾸지 않고 뒤쪽 태그(특징)부터 걷는다 — 두 줄이 되면 그 아래 개체번호
 * 줄과 표식 칩을 밀어낸다. 순서가 중요도 순(`characterTags`)이라 걷히는 것은 늘 덜 중요한 쪽이다.
 */
export const CHARACTER_TAG_ROW = {
  /** 칩 높이 = 글자 크기 × 이 비. */
  heightRatio: 1.6,
  gap: 6,
  /** 칩 안 좌우 여백 = 글자 크기 × 이 비. */
  pad: 0.38,
} as const;

/** 태그 색을 흰빛 쪽으로 당긴 낱말 색. `#`만 제 색 그대로 선다. */
function lighten(color: number, amount: number): string {
  const r = (color >> 16) & 0xff, g = (color >> 8) & 0xff, b = color & 0xff;
  const mix = (c: number) => Math.round(c + (255 - c) * amount);
  return `#${((mix(r) << 16) | (mix(g) << 8) | mix(b)).toString(16).padStart(6, "0")}`;
}

function hex(color: number): string {
  return `#${color.toString(16).padStart(6, "0")}`;
}

/** 원점은 첫 칩의 왼쪽 끝, 세로 가운데다. 컨테이너 `width`가 실제로 쓴 폭이다. */
export function addCharacterTagRow(scene: Phaser.Scene, tags: readonly CharacterTag[], options: { size: number; maxWidth: number }): Phaser.GameObjects.Container {
  const row = scene.add.container(0, 0);
  const { size } = options;
  const height = Math.round(size * CHARACTER_TAG_ROW.heightRatio);
  const pad = Math.round(size * CHARACTER_TAG_ROW.pad);
  let x = 0;
  for (const tag of tags) {
    const hash = scene.add.text(0, 0, "#", textStyle({ role: "display", size, color: hex(tag.tone) })).setOrigin(0, 0.5);
    const label = scene.add.text(0, 0, tag.text, textStyle({ role: "emphasis", size, color: lighten(tag.tone, 0.55) })).setOrigin(0, 0.5);
    const width = Math.ceil(pad + hash.width + 2 + label.width + pad);
    if (x + width > options.maxWidth) {
      hash.destroy();
      label.destroy();
      break;
    }
    const chip = scene.add.container(x + width / 2, 0);
    const bevel = Math.round(height * 0.28);
    const shape = chipPoints(width, height, { bevel: { topLeft: bevel, topRight: 0, bottomRight: bevel, bottomLeft: 0 } });
    chip.add(drawLayer(scene, 0, 0, shape, { fill: 0x0b1018, alpha: 0.72, shadow: { x: 0, y: 3 } }));
    chip.add(drawLayer(scene, 0, 0, shape, { fill: tag.tone, alpha: 0.14, shadow: false }));
    hash.setPosition(-width / 2 + pad, 0);
    label.setPosition(hash.x + hash.width + 2, 0);
    chip.add([hash, label]);
    row.add(chip);
    x += width + CHARACTER_TAG_ROW.gap;
  }
  row.setSize(Math.max(0, x - CHARACTER_TAG_ROW.gap), height);
  return row;
}
