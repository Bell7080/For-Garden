import Phaser from "phaser";
import type { KeywordManager } from "../managers/KeywordManager";
import type { EffectType, SkillIconAssetId } from "../core/types";
import { chipPoints, drawHairline, drawLayer, HOLO } from "./holo";
import type { PopupLayer } from "./PopupLayer";
import { FALLBACK_SKILL_ICON } from "./skillIcons";
import { COLOR, textStyle } from "./theme";

/** 데이터 효과 분류를 플레이어가 읽는 고정 라벨로 바꾼다. */
export const EFFECT_LABEL: Record<EffectType, string> = {
  physical: "물리 피해",
  magical: "마법 피해",
  fixed: "고정 피해",
  healing: "회복",
  buff: "강화",
};

/** 문자열 순서에 의존하지 않고 스킬 팝업의 각 요소를 직접 채우는 계약이다. */
export interface SkillInfoViewModel {
  name: string;
  /** 패시브 · 일반 공격 · 궁극기. */
  kindLabel: string;
  iconAssetId: SkillIconAssetId;
  effectType: EffectType;
  /** 배율이나 예상 피해처럼 한 줄로 읽는 수치. */
  valueLabel?: string;
  /** 궁극기만 갖는 소비 게이지. */
  gaugeCost?: number;
  /** `[[keyword]]` 문법을 쓸 수 있는 설명문. */
  description: string;
}

const POPUP = { width: 880, height: 620 } as const;

/**
 * 스킬 하나를 설명하는 정형 팝업.
 *
 * 패시브든 궁극기든 같은 자리에 같은 것이 온다 — 왼쪽 위 아이콘, 그 옆 분류와 이름, 아래
 * 한 줄 수치, 그 아래 설명문. 스킬마다 다른 배치를 만들지 않아야 플레이어가 두 번째 스킬부터는
 * 읽지 않고 찾아볼 수 있다.
 */
export function openSkillPopup(
  scene: Phaser.Scene,
  popups: PopupLayer,
  keywords: KeywordManager,
  skill: SkillInfoViewModel,
): void {
  popups.open({ width: POPUP.width, height: POPUP.height, tilt: -1.2 }, (body) => {
    const left = -POPUP.width / 2;
    const top = -POPUP.height / 2;

    // 아이콘 칩. 도감 스킬 목록과 같은 모양이라 어느 스킬을 눌렀는지 이어서 읽힌다.
    const iconSize = 132;
    const iconX = left + 96;
    const iconY = top + 108;
    body.add(drawLayer(scene, iconX, iconY, chipPoints(iconSize, iconSize, {
      bevel: { topLeft: iconSize * 0.26, topRight: 0, bottomRight: iconSize * 0.26, bottomLeft: 0 },
    }), { fill: 0x1a1f27, alpha: HOLO.glass, edge: COLOR.accent, edgeAlpha: 0.6 }));
    const texture = scene.textures.exists(skill.iconAssetId) ? skill.iconAssetId : FALLBACK_SKILL_ICON;
    body.add(scene.add.image(iconX, iconY, texture).setDisplaySize(iconSize * 0.62, iconSize * 0.62));

    // 분류와 이름. 궁극기는 소비 게이지를 분류 옆에 붙여 "얼마를 쓰는 기술인지"를 먼저 알린다.
    const textLeft = iconX + iconSize / 2 + 28;
    const kind = scene.add
      .text(textLeft, top + 62, skill.kindLabel, textStyle({ role: "emphasis", size: 26, color: COLOR.accentText }))
      .setOrigin(0, 0);
    body.add(kind);
    if (skill.gaugeCost !== undefined) {
      body.add(
        scene.add
          .text(kind.x + kind.width + 20, top + 64, `게이지 ${skill.gaugeCost}`, textStyle({ role: "body", size: 22, color: COLOR.inkDim }))
          .setOrigin(0, 0),
      );
    }
    body.add(scene.add.text(textLeft, top + 96, skill.name, textStyle({ role: "display", size: 46 })).setOrigin(0, 0));

    // 효과 분류와 수치는 한 줄에 둔다. 둘 다 "얼마나 세게, 어떤 식으로"를 말한다.
    const summary = [EFFECT_LABEL[skill.effectType], skill.valueLabel].filter(Boolean).join("   ·   ");
    body.add(scene.add.text(textLeft, top + 156, summary, textStyle({ role: "emphasis", size: 24 })).setOrigin(0, 0));

    body.add(drawHairline(scene, 0, top + 232, POPUP.width - 96, { color: COLOR.accent, alpha: 0.35 }));

    const description = keywords.layout(skill.description, { width: POPUP.width - 120, size: 28, lineSpacing: 10 });
    description.setPosition(left + 60, top + 268);
    body.add(description);

    body.add(
      scene.add
        .text(0, POPUP.height / 2 - 44, "강조된 말을 누르면 뜻이 열린다", textStyle({ role: "body", size: 20, color: COLOR.inkDim }))
        .setOrigin(0.5, 0.5),
    );
  });
}
