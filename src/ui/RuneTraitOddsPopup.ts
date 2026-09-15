import Phaser from "phaser";
import { t } from "../i18n";
import { runeRarityLabel } from "../core/runes";
import { RUNE_TRAIT_GRADES, RUNE_TRAIT_RULES } from "../core/runeTraits";
import { RUNE_TRAIT_DEFS, runeTraitValue } from "../data/runeTraits";
import { drawHairline } from "./holo";
import type { PopupLayer } from "./PopupLayer";
import { RUNE_ACCENT } from "./runeIcons";
import { runeTraitName } from "./runeTraitPresentation";
import { addSectionTitle } from "./SectionTitle";
import { COLOR, textStyle } from "./theme";

/**
 * 특성 확률 정보.
 *
 * **굴리기 전에 무엇이 나올 수 있고 얼마나 오르는지는 화면이 말해야 한다.** 등급 상승 확률과
 * 천장, 재해석 비용은 `RUNE_TRAIT_RULES` 한 표에서 그대로 읽고, 열두 종의 등급별 수치도
 * 정적 정의에서 읽는다 — 이 창이 숫자를 따로 적어 두면 밸런스를 고친 날 화면만 옛 값을 말한다.
 *
 * **창 높이는 손으로 적지 않고 쌓인 줄에서 거꾸로 구한다.** 특성이 늘면 그만큼 자란다.
 */

/** 창 안의 세로 리듬. 두 영역이 같은 줄 간격을 쓰므로 표가 한 장으로 읽힌다. */
const ODDS = {
  width: 920,
  padding: 44,
  /** 제목표가 걸터앉는 판 윗변에서 첫 줄까지. */
  headerRoom: 74,
  row: 50,
  sectionGap: 56,
  /** 표의 네 칸이 서는 x 비율(판 폭 기준). 왼쪽은 이름, 나머지 셋은 오른쪽 정렬이다. */
  columns: [0.0, 0.46, 0.7, 1.0],
} as const;

/** 소수점이 있는 값만 한 자리를 남긴다. `1.5`와 `10`이 한 줄에 같은 모양으로 서지 않게 한다. */
function traitValueLabel(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

/** 등급 색. 룬 희귀도와 같은 한 표를 읽는다 — 특성 등급 축을 새로 칠하지 않는다. */
function gradeHex(grade: (typeof RUNE_TRAIT_GRADES)[number]): string {
  return `#${RUNE_ACCENT[grade].toString(16).padStart(6, "0")}`;
}

/** 확률 정보 한 장을 연다. 읽기만 하는 창이라 뒤를 덮지 않고 누른 자리 위에 얹힌다. */
export function openRuneTraitOdds(options: { scene: Phaser.Scene; popups: PopupLayer; anchor?: { x: number; y: number } }): void {
  const { scene, popups } = options;
  const upgradeRows = RUNE_TRAIT_GRADES.length;
  const listRows = RUNE_TRAIT_DEFS.length;
  const height = ODDS.padding * 2 + ODDS.headerRoom
    + (upgradeRows + 1) * ODDS.row + ODDS.sectionGap + ODDS.headerRoom + listRows * ODDS.row;

  popups.open({
    width: ODDS.width,
    height,
    title: t("rune.trait.odds"),
    ...(options.anchor ? { anchor: options.anchor } : {}),
    backButton: true,
  }, (body) => {
    const left = -ODDS.width / 2 + ODDS.padding;
    const inner = ODDS.width - ODDS.padding * 2;
    const at = (ratio: number): number => left + inner * ratio;
    let y = -height / 2 + ODDS.padding;

    /* ── 등급 상승 ─────────────────────────────────────────────────────────── */
    addSectionTitle(scene, left, y, t("rune.trait.odds.upgradeTitle"), { size: 28, parent: body });
    y += ODDS.headerRoom;

    const head = (text: string, x: number, origin: number): void => {
      body.add(scene.add.text(x, y, text, textStyle({ role: "emphasis", size: 22, color: COLOR.inkDim })).setOrigin(origin, 0.5));
    };
    head(t("rune.trait.odds.colGrade"), at(ODDS.columns[0]), 0);
    head(t("rune.trait.odds.colChance"), at(ODDS.columns[1]), 1);
    head(t("rune.trait.odds.colPity"), at(ODDS.columns[2]), 1);
    head(t("rune.trait.odds.colCost"), at(ODDS.columns[3]), 1);
    y += ODDS.row * 0.7;
    body.add(drawHairline(scene, 0, y, inner, { color: COLOR.accent, alpha: 0.35 }));
    y += ODDS.row * 0.6;

    for (const grade of RUNE_TRAIT_GRADES) {
      const chance = RUNE_TRAIT_RULES.upgradeChance[grade];
      const pity = RUNE_TRAIT_RULES.pityThreshold[grade];
      // **전설은 오를 곳이 없다.** 확률 0과 천장 0을 그대로 적으면 "0%로 오른다"로 읽힌다.
      const top = chance <= 0;
      body.add(scene.add.text(at(ODDS.columns[0]), y, runeRarityLabel(grade),
        textStyle({ role: "emphasis", size: 26, color: gradeHex(grade) })).setOrigin(0, 0.5));
      // 역할은 삼항으로 고르지 않는다 — 검사가 소스에서 읽는 값이라 갈래마다 제 줄로 선다.
      const chanceText = top
        ? scene.add.text(at(ODDS.columns[1]), y, t("rune.trait.odds.max"), textStyle({ role: "body", size: 22, color: COLOR.inkDim }))
        : scene.add.text(at(ODDS.columns[1]), y, t("rune.trait.odds.percent", { percent: traitValueLabel(chance * 100) }),
          textStyle({ role: "display", size: 26, color: COLOR.ink }));
      body.add(chanceText.setOrigin(1, 0.5));
      body.add(scene.add.text(at(ODDS.columns[2]), y, top ? "" : t("rune.trait.odds.pity", { count: pity }),
        textStyle({ role: "body", size: 24, color: COLOR.inkDim })).setOrigin(1, 0.5));
      body.add(scene.add.text(at(ODDS.columns[3]), y, String(RUNE_TRAIT_RULES.rerollCost[grade]),
        textStyle({ role: "display", size: 26, color: COLOR.accentText })).setOrigin(1, 0.5));
      y += ODDS.row;
    }

    /* ── 특성 목록 ─────────────────────────────────────────────────────────── */
    y += ODDS.sectionGap;
    addSectionTitle(scene, left, y, t("rune.trait.odds.listTitle"), { size: 28, parent: body });
    y += ODDS.headerRoom;

    for (const def of RUNE_TRAIT_DEFS) {
      body.add(scene.add.text(at(ODDS.columns[0]), y, runeTraitName(def.id),
        textStyle({ role: "emphasis", size: 26, color: COLOR.ink })).setOrigin(0, 0.5));
      // 등급별 수치는 **오른쪽에서 왼쪽으로** 쌓는다. 단위는 그 특성의 설명이 말하므로 여기서는
      // 네 수만 세워, 등급 하나가 얼마나 더 주는지를 색과 나란함으로 읽게 한다.
      let x = at(ODDS.columns[3]);
      for (const grade of [...RUNE_TRAIT_GRADES].reverse()) {
        const value = scene.add.text(x, y, traitValueLabel(runeTraitValue(def.id, grade)),
          textStyle({ role: "display", size: 24, color: gradeHex(grade) })).setOrigin(1, 0.5);
        body.add(value);
        x -= value.width + 26;
      }
      y += ODDS.row;
    }
  });
}
