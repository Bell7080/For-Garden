import Phaser from "phaser";
import { t, type TextKey } from "../i18n";
import type { KeywordManager } from "../managers/KeywordManager";
import type { KeywordDef } from "../data/keywords";
import type { CombatStatusEffect, EffectType, SkillIconAssetId, Ultimate } from "../core/types";
import { chipPoints, drawHairline, drawInnerVignette, drawLayer, drawShapeOutline } from "./holo";
import type { PopupLayer } from "./PopupLayer";
import { FALLBACK_SKILL_ICON } from "./skillIcons";
import { SKILL_ART_WASH_ALPHA } from "./skillArt";
import { damageHealingLabel, recoveryLabel, skillKeywordLayoutOptions, statusEffectLabel, targetingLabel } from "./skillPresentation";
import { COLOR, textStyle } from "./theme";

/** 데이터 효과 분류를 플레이어가 읽는 고정 라벨로 바꾼다. */
const EFFECT_KEY: Record<EffectType, TextKey> = {
  physical: "skill.effect.physical",
  magical: "skill.effect.magical",
  fixed: "skill.effect.fixed",
  healing: "skill.effect.healing",
  buff: "skill.effect.buff",
};

/** 상수가 아니라 함수다 — 모듈이 읽히는 순간의 문구로 굳으면 언어를 바꿔도 옛 이름으로 남는다. */
export function effectLabel(effect: EffectType): string { return t(EFFECT_KEY[effect]); }

/** 문자열 순서에 의존하지 않고 스킬 팝업의 각 요소를 직접 채우는 계약이다. */
export interface SkillInfoViewModel {
  name: string;
  /** 패시브 · 일반 공격 · 궁극기. */
  kindLabel: string;
  iconAssetId: SkillIconAssetId;
  /** 전용 스킬 일러스트의 텍스처 키. 없으면 공용 효과 아이콘으로 되돌린다. */
  art?: string;
  /** 속성·직군을 섞은 필터 색. 흰 실루엣 일러스트에만 입힌다. */
  tint?: number;
  effectType: EffectType;
  /** 배율이나 예상 피해처럼 한 줄로 읽는 수치. */
  valueLabel?: string;
  /** 표시 수치를 눌렀을 때 해당 스킬의 능력치 출처와 배율을 설명한다. */
  contextualKeywords?: readonly KeywordDef[];
  /** 뜻풀이 대신 전용 창을 여는 용어. 쿠로·시로처럼 쪽지 한 장으로 다 말할 수 없는 태그가 쓴다. */
  keywordActions?: Readonly<Record<string, () => void>>;
  /** 코어의 대상 선택 계약. 반경 같은 개발 단위는 표시하지 않는다. */
  targeting?: Ultimate["targeting"];
  /** 코어가 실제 적용하는 상태 효과와 지속 시간이다. */
  statusEffects?: readonly CombatStatusEffect[];
  /** 지속 회복처럼 상태 효과 목록 밖에 있는 유지 시간이다. */
  durationSeconds?: number;
  /** 매초 회복하는 최대 체력 비율이다. 패시브 정의의 현재 값을 전달받는다. */
  recoveryPercent?: number;
  /** 과잉 피해를 제외한 실제 HP 피해에서 회복하는 비율이다. */
  damageHealingPercent?: number;
  /** 궁극기만 갖는 소비 게이지. */
  gaugeCost?: number;
  /** `[[keyword]]` 문법을 쓸 수 있는 설명문. */
  description: string;
  /**
   * 한계 돌파로 **이 슬롯에 붙은** 효과 한 줄.
   *
   * 본문에 이어 붙이지 않고 한 줄 띄워 노란 글씨로 세운다 — 별을 올려 받은 몫은 원래 스킬이
   * 하는 일이 아니라 그 위에 얹힌 것이라, 같은 색으로 이어지면 처음부터 있던 효과로 읽힌다.
   * 열리지 않은 별의 효과는 여기 오지 않는다(`isBreakthroughSlotOpen`).
   */
  breakthroughEffect?: string;
}

/**
 * 쪽지의 폭과 **글 위에 쌓이는 높이**.
 *
 * 높이를 손으로 적지 않는다 — 본문이 몇 줄인지는 개체마다 다르고 언어마다 또 다르다.
 * 620으로 못 박아 두었을 때는 짧은 일반 공격 설명 아래가 통째로 비었고(돌파 줄까지 붙으면
 * 그 아래로 한 뼘 더), 반대로 긴 문장은 안내 줄을 파고들었다. 지금은 실제로 그린 글의 높이를
 * 재서 거꾸로 구한다.
 */
const POPUP = {
  width: 880,
  /** 본문 글이 시작하는 y(판 윗변 기준). 그 위는 아이콘·이름·요약 줄이 쓰는 고정 높이다. */
  descriptionY: 268,
  /** 본문 아래끝에서 안내 줄까지, 그리고 안내 줄에서 판 밑변까지. */
  hintGap: 30,
  hintBottom: 44,
  /** 아이콘 칩과 이름 줄이 들어가는 최소 높이. 한 줄짜리 설명이 판을 이보다 짧게 만들지 않는다. */
  minHeight: 400,
} as const;

/**
 * 돌파로 붙은 줄이 차지하는 몫. 있을 때만 그 높이가 판에 더해진다.
 *
 * **이름표 문구는 여기 두지 않는다** — 모듈을 읽는 순간의 언어로 굳어, 나중에 언어를 바꿔도
 * 그 한 줄만 처음 언어로 남는다. 그릴 때 `t()`로 고른다.
 */
const BREAKTHROUGH_LINE = { gap: 34, labelTop: 8, labelGap: 10, size: 25 } as const;

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
  /** 누른 아이콘 자리와 눌린 상태를 되돌릴 콜백. 쪽지가 그 위에 얹히게 한다. */
  from?: { x: number; y: number; onClose?: () => void },
): void {
  // **판을 열기 전에 글을 먼저 그려 높이를 잰다.** `PopupLayer.open`은 높이를 미리 받으므로,
  // 본문을 나중에 채우면 그 길이를 판이 알 수 없다. 여기서 만든 컨테이너를 그대로 판에 넣어
  // 두 번 그리지 않는다.
  const description = keywords.layout(skill.description, skillKeywordLayoutOptions(skill, {
    width: POPUP.width - 120, size: 28, lineSpacing: 10,
  }));
  const breakthrough = skill.breakthroughEffect === undefined ? undefined : keywords.layout(skill.breakthroughEffect, skillKeywordLayoutOptions(skill, {
    width: POPUP.width - 120, size: 26, lineSpacing: 10, color: COLOR.accentText,
  }));
  const breakthroughLabelHeight = breakthrough === undefined ? 0 : Math.round(BREAKTHROUGH_LINE.size * 1.4);
  const breakthroughBlock = breakthrough === undefined ? 0
    : BREAKTHROUGH_LINE.gap + BREAKTHROUGH_LINE.labelTop + breakthroughLabelHeight + BREAKTHROUGH_LINE.labelGap + breakthrough.height;
  const height = Math.max(
    POPUP.minHeight,
    POPUP.descriptionY + description.height + breakthroughBlock + POPUP.hintGap + POPUP.hintBottom,
  );
  popups.open({
    width: POPUP.width,
    height,
    tilt: -1.2,
    anchor: from && { x: from.x, y: from.y },
    onClose: from?.onClose,
  }, (body) => {
    const left = -POPUP.width / 2;
    const top = -height / 2;

    // 아이콘 칩. 도감 스킬 목록과 같은 모양이라 어느 스킬을 눌렀는지 이어서 읽힌다.
    const iconSize = 132;
    const iconX = left + 96;
    const iconY = top + 108;
    const chip = chipPoints(iconSize, iconSize, {
      bevel: { topLeft: iconSize * 0.26, topRight: 0, bottomRight: iconSize * 0.26, bottomLeft: 0 },
    });
    // 도감 아이콘과 같은 액자다 — 불투명한 판, 안쪽으로 스미는 어둠, 사방 한 줄.
    body.add(drawLayer(scene, iconX, iconY, chip, { fill: 0x11161d, alpha: 1, edge: COLOR.accent, edgeAlpha: 0.6 }));
    const art = skill.art && scene.textures.exists(skill.art) ? skill.art : undefined;
    if (art && skill.tint !== undefined) body.add(drawLayer(scene, iconX, iconY, chip, { fill: skill.tint, alpha: SKILL_ART_WASH_ALPHA, shadow: false }));
    body.add(drawInnerVignette(scene, iconX, iconY, chip, { strength: 0.55 }));
    const texture = art ?? (scene.textures.exists(skill.iconAssetId) ? skill.iconAssetId : FALLBACK_SKILL_ICON);
    const image = scene.add.image(iconX, iconY, texture).setDisplaySize(iconSize * (art ? 0.82 : 0.62), iconSize * (art ? 0.82 : 0.62));
    if (art && skill.tint !== undefined) image.setTint(skill.tint);
    body.add(image);
    body.add(drawShapeOutline(scene, iconX, iconY, chip, { color: COLOR.accent, alpha: 0.55, width: 3 }));

    // 분류와 이름. 궁극기는 소비 게이지를 분류 옆에 붙여 "얼마를 쓰는 기술인지"를 먼저 알린다.
    const textLeft = iconX + iconSize / 2 + 28;
    const kind = scene.add
      .text(textLeft, top + 62, skill.kindLabel, textStyle({ role: "emphasis", size: 26, color: COLOR.accentText }))
      .setOrigin(0, 0);
    body.add(kind);
    if (skill.gaugeCost !== undefined) {
      body.add(
        scene.add
          .text(kind.x + kind.width + 20, top + 64, t("skill.gauge", { cost: skill.gaugeCost }), textStyle({ role: "body", size: 22, color: COLOR.inkDim }))
          .setOrigin(0, 0),
      );
    }
    body.add(scene.add.text(textLeft, top + 96, skill.name, textStyle({ role: "display", size: 46 })).setOrigin(0, 0));

    // 효과 분류와 수치는 한 줄에 둔다. 둘 다 "얼마나 세게, 어떤 식으로"를 말한다.
    const summary = [
      effectLabel(skill.effectType), skill.valueLabel, targetingLabel(skill.targeting),
      ...((skill.statusEffects ?? []).map(statusEffectLabel)),
      skill.durationSeconds === undefined ? undefined : t("skill.duration", { seconds: skill.durationSeconds }),
      recoveryLabel(skill.recoveryPercent),
      damageHealingLabel(skill.damageHealingPercent),
    ].filter(Boolean).join("   ·   ");
    // 실제 수치도 설명문과 같은 키워드 레이아웃을 써서, 누르면 산출 근거를 확인할 수 있게 한다.
    const summaryText = keywords.layout(summary, skillKeywordLayoutOptions(skill, {
      width: 560, size: 24, lineSpacing: 4,
    }));
    summaryText.setPosition(textLeft, top + 156);
    body.add(summaryText);

    body.add(drawHairline(scene, 0, top + 232, POPUP.width - 96, { color: COLOR.accent, alpha: 0.35 }));

    // 폭주·보호막처럼 동적 수치가 본문에 있는 경우에도 요약과 같은 사전을 넘겨 밑줄과 입력을 붙인다.
    description.setPosition(left + 60, top + POPUP.descriptionY);
    body.add(description);

    // **돌파로 붙은 줄은 한 줄 띄우고 노랗게 선다.** 본문 바로 아래에 같은 색으로 이으면
    // 처음부터 있던 효과로 읽히므로, 별 표식과 같은 금색 이름표를 앞에 세워 "나중에 얹힌
    // 것"임을 한눈에 알린다.
    if (breakthrough) {
      const gapY = description.y + description.height + BREAKTHROUGH_LINE.gap;
      body.add(drawHairline(scene, 0, gapY - 12, POPUP.width - 96, { color: COLOR.accent, alpha: 0.28 }));
      const mark = scene.add
        .text(left + 60, gapY + BREAKTHROUGH_LINE.labelTop, t("info.breakthrough"), textStyle({ role: "display", size: BREAKTHROUGH_LINE.size, color: COLOR.accentText }))
        .setOrigin(0, 0);
      body.add(mark);
      body.add(breakthrough.setPosition(left + 60, gapY + BREAKTHROUGH_LINE.labelTop + breakthroughLabelHeight + BREAKTHROUGH_LINE.labelGap));
    }

    body.add(
      scene.add
        .text(0, height / 2 - POPUP.hintBottom, t("skill.keywordHint"), textStyle({ role: "body", size: 20, color: COLOR.inkDim }))
        .setOrigin(0.5, 0.5),
    );
  });
}
