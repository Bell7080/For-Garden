import Phaser from "phaser";
import type { Element, Role } from "../core/types";
import { chipPoints, drawInnerVignette, drawLayer, drawShapeOutline } from "./holo";
import { FALLBACK_SKILL_ICON } from "./skillIcons";
import { skillArtFor, skillArtTint, SKILL_ART_WASH_ALPHA, type SkillArtSlot } from "./skillArt";
import { COLOR, textStyle } from "./theme";

/**
 * 스킬 아이콘 **액자** 한 장.
 *
 * 정보창 아래의 네 칸과 한계 돌파 표가 같은 한 장을 쓴다 — 두 곳이 따로 그리면 같은 궁극기가
 * 어디서는 크고 또렷하게, 어디서는 작고 흐리게 보인다(재화 액자를 한 장으로 모은 것과 같은
 * 이유다). 화면은 **무엇을 담을지와 크기만** 고르고 생김새는 여기서만 정한다.
 *
 * 이것은 화면의 **액자 예외**다 — 판때기와 달리 불투명하게 채우고 사방을 한 줄로 두른 뒤
 * 테두리 안쪽만 어둡게 눌러, 배경 원화 위에서 어디까지가 그림인지 또렷하게 만든다. 그림 한
 * 장을 담는 칸이라 이 예외를 쓴다.
 */
export interface SkillIconFrameOptions {
  /** 액자 한 변(px). */
  size: number;
  /** 어느 슬롯의 그림인가. 전용 아트가 없으면 공용 효과 아이콘으로 되돌아간다. */
  slot: SkillArtSlot;
  /** 전용 아트를 찾을 렐릭 id. */
  relicId: string;
  /** 전용 아트가 없을 때 쓸 공용 아이콘 텍스처 키. */
  fallbackIcon?: string;
  /** 흰 실루엣에 입히는 색. 속성·직군을 섞은 값이라 화면이 직접 고르지 않는다. */
  element: Element;
  role: Role;
  /** 액자 안 아래에 박는 이름(`일반 공격`·`궁극기`…). 비우면 그림만 담는다. */
  label?: string;
  /** 이 칸이 화면에서 가장 중요한 하나인지. 테두리와 글자가 강조색을 얻는다. */
  emphasis?: boolean;
  /**
   * 아직 열리지 않은 칸의 진하기. 비우면 흐리지 않는다.
   *
   * `boolean`이 아니라 **값**으로 받는다 — 얼마나 흐릴지는 그 화면이 무엇을 읽히려 하는지에
   * 달렸고, 한 값으로 못 박으면 액자가 주제인 자리(돌파 표)에서 그림을 알아볼 수 없다.
   */
  dimAlpha?: number;
}

/** 슬롯의 짧은 이름. 정보창 아이콘과 돌파 표가 같은 말을 쓰도록 한 표만 둔다. */
export const SKILL_SLOT_LABEL: Readonly<Record<SkillArtSlot, string>> = {
  passive: "패시브",
  basic: "일반 공격",
  ultimate: "궁극기",
  ferocity: "폭주",
};

/** 액자 한 장을 만들어 컨테이너로 돌려준다. 부른 쪽이 자리를 잡고 입력을 붙인다. */
export function addSkillIconFrame(scene: Phaser.Scene, options: SkillIconFrameOptions): Phaser.GameObjects.Container {
  const { size, emphasis = false } = options;
  const frame = scene.add.container(0, 0);
  const tint = skillArtTint(options.element, options.role);
  const chip = chipPoints(size, size, {
    bevel: { topLeft: size * SKILL_ICON_FRAME.bevel, topRight: 0, bottomRight: size * SKILL_ICON_FRAME.bevel, bottomLeft: 0 },
  });
  // 판을 불투명하게 채운다. 배경 원화가 비쳐 보이면 그림 두 장이 겹쳐 무엇이 스킬인지 흐려진다.
  frame.add(drawLayer(scene, 0, 0, chip, {
    fill: emphasis ? 0x241f16 : 0x11161d,
    alpha: 1,
    edge: COLOR.accent,
    edgeAlpha: emphasis ? 0.9 : 0.45,
  }));
  // 그림이 앉는 안쪽 칸. 이름이 들어갈 만큼 아래를 남기고 위쪽으로 올려 붙인다.
  const innerSize = size - SKILL_ICON_FRAME.innerInset;
  const innerHeight = innerSize - (options.label ? SKILL_ICON_FRAME.labelRoom : 0);
  const inner = chipPoints(innerSize, innerHeight, {
    bevel: { topLeft: innerSize * 0.22, topRight: 0, bottomRight: innerSize * 0.22, bottomLeft: 0 },
  });
  const innerY = options.label ? -SKILL_ICON_FRAME.labelRoom / 2.4 : 0;
  frame.add(drawLayer(scene, 0, innerY, inner, { fill: 0x05080c, alpha: 1, shadow: false }));
  const art = skillArtFor(options.relicId, options.slot);
  // 그림 자리에 같은 색을 아주 옅게 깔아 아이콘이 색판 위에 앉은 것처럼 보이게 한다. 전용
  // 아트가 없는 개체도 같은 색판을 깐다 — 그림만 공용 아이콘일 뿐 액자는 같은 체계여야 한다.
  frame.add(drawLayer(scene, 0, innerY, inner, { fill: tint, alpha: art ? SKILL_ART_WASH_ALPHA : SKILL_ART_WASH_ALPHA * 0.7, shadow: false }));
  frame.add(drawInnerVignette(scene, 0, innerY, inner, { strength: 0.55 }));
  const fallback = options.fallbackIcon && scene.textures.exists(options.fallbackIcon) ? options.fallbackIcon : FALLBACK_SKILL_ICON;
  const texture = art ?? fallback;
  const ratio = art ? SKILL_ICON_FRAME.artRatio : SKILL_ICON_FRAME.iconRatio;
  const image = scene.add.image(0, innerY - 2, texture).setDisplaySize(size * ratio, size * ratio);
  // 전용 일러스트는 흰 실루엣이라 여기서 속성·직군을 섞은 색을 입는다.
  if (art) image.setTint(tint);
  frame.add(image);
  if (options.label) {
    // 액자 안의 이름은 그림 다음으로 먼저 읽히는 것이라 굵고 크게 둔다.
    const color = emphasis ? COLOR.accentText : COLOR.ink;
    frame.add(scene.add
      .text(0, size / 2 - SKILL_ICON_FRAME.labelBaseline, options.label, textStyle({ role: "display", size: Math.round(size * SKILL_ICON_FRAME.labelRatio), color }))
      .setOrigin(0.5));
  }
  // 액자 테두리. 채운 판 위에 한 줄을 얹어 배경 원화와 확실히 갈라 놓는다.
  frame.add(drawShapeOutline(scene, 0, 0, chip, { color: COLOR.accent, alpha: emphasis ? 0.75 : 0.42, width: 3 }));
  if (options.dimAlpha !== undefined) frame.setAlpha(options.dimAlpha);
  return frame;
}

/**
 * 액자 한 장의 비례.
 *
 * 전부 **한 변에 대한 비율**이다 — 정보창은 150px, 돌파 표는 그보다 작은 칸을 쓰는데 값을
 * 픽셀로 두면 작은 칸에서 이름이 액자를 넘고 그림이 테두리에 닿는다.
 */
const SKILL_ICON_FRAME = {
  bevel: 0.26,
  /** 안쪽 칸이 액자 변에서 들어오는 거리(px). 테두리 두께와 안쪽 비네트가 앉는 자리다. */
  innerInset: 16,
  /** 이름이 들어갈 아래 여백(px). 이름이 없으면 그림 칸이 그만큼 커진다. */
  labelRoom: 14,
  labelBaseline: 27,
  labelRatio: 0.167,
  artRatio: 0.74,
  iconRatio: 0.52,
} as const;

export { SKILL_ICON_FRAME };
