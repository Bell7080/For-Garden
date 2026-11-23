import Phaser from "phaser";
import { t } from "../i18n";
import type { Element, ExcavationProductionCurrency, ReachTier, RelicRarity, Role, SquadId } from "../core/types";
import { CURRENCY_ICON_BY_WALLET, type CurrencyIconKey } from "./currencyIcons";
import { PLAYABLE_RELICS } from "../data/relics";
import { SQUADS } from "../data/factions";
import { RARITY_TONE } from "./rarityMark";
import { squeezeTextToWidth } from "./textFit";
import { EMPTY_RELIC_FILTER, RELIC_FILTER_PRESET_AXES, relicFilterCount, toggleFilterValue, type RelicFilter, type RelicFilterAxis, type RelicFilterPreset } from "../core/relicFilter";
import { AffinityBadge } from "./AffinityBadge";
import { ELEMENT_ICON, ROLE_ICON, type AffinityIconKey } from "./affinityIcons";
import { chipPoints, drawLayer, drawShapeEdge, slantedRect, toPoints } from "./holo";
import { PopupLayer } from "./PopupLayer";
import { REACH_TONE, reachLabel } from "./statTones";
import { COLOR, textStyle } from "./theme";
import {
  RELIC_FILTER_POPUP,
  relicFilterChipX,
  relicFilterChipWidth,
  relicFilterPopupLayout,
} from "./relicGridLayout";
import { pressIn, pressOut } from "./pressFeedback";

const ELEMENTS: readonly Element[] = ["fire", "water", "grass", "earth", "wind"];
const ROLES: readonly Role[] = ["warrior", "tank", "assassin", "support"];
const REACHES: readonly ReachTier[] = ["melee", "mid", "ranged"];
const RARITIES: readonly RelicRarity[] = ["SSR", "SR", "R"];
/** 발굴이 캐는 네 재화. 순서는 발굴 자동 배치 기준 목록과 같다. */
const CURRENCIES: readonly ExcavationProductionCurrency[] = ["cheesecake", "rawStone", "gold", "gems"];
/** 소속 칩은 한 줄에 셋씩 — 스쿼드 이름이 길어 다섯을 한 줄에 두면 글자가 칸을 넘는다. */
const SQUAD_PER_ROW = 3;
/** 도감에 실제로 서는 개체가 속한 스쿼드만 고를 수 있다 — 아무도 없는 칸은 눌러도 목록이 비기만 한다. */
function playableSquads(): SquadId[] {
  const used = new Set(PLAYABLE_RELICS.map((relic) => relic.squad));
  return (Object.keys(SQUADS) as SquadId[]).filter((id) => used.has(id));
}

export { RELIC_FILTER_PRESET_AXES, type RelicFilterAxis, type RelicFilterPreset } from "../core/relicFilter";

/** 켜진 칩과 꺼진 칩. 색이 아니라 **밝기와 크기**로 가른다 — 화면 전체의 선택 규칙과 같다. */
const CHIP = { on: { fill: 0x1d2a38, alpha: 0.98, scale: 1.06 }, off: { fill: 0x080d13, alpha: 0.72, scale: 1 } } as const;

/** 판을 어디에 세우는가. `anchor`는 누른 칩 위·아래에 붙이고, `below`는 그 점 바로 아래로 판 윗변을 내린다. */
export type RelicFilterPlacement = { readonly anchor: { x: number; y: number } } | { readonly below: { x: number; y: number } };

/**
 * 목록을 좁히는 조건을 고르는 판.
 *
 * 축마다 한 줄이고, 한 축 안에서는 여럿을 켤 수 있다. 고른 것은 곧바로 목록에 반영된다 —
 * 「적용」을 따로 두면 무엇을 켜면 몇 장이 남는지 보이지 않아 눌러 보고 닫고 다시 여는 일이 된다.
 */
export function openRelicFilterPopup(
  scene: Phaser.Scene,
  popups: PopupLayer,
  placement: { x: number; y: number } | RelicFilterPlacement,
  current: () => RelicFilter,
  onChange: (filter: RelicFilter) => void,
  /** 어느 화면의 판인가. 축은 `RELIC_FILTER_PRESET_AXES`가 정한다. */
  preset: RelicFilterPreset = "full",
): void {
  const axes = RELIC_FILTER_PRESET_AXES[preset];
  const squads = axes.includes("squad") ? playableSquads() : [];
  const squadRows = Math.max(1, Math.ceil(squads.length / SQUAD_PER_ROW));
  const chipHeightOf = (axis: RelicFilterAxis): number =>
    axis === "element" || axis === "role" || axis === "currency" ? RELIC_FILTER_POPUP.iconChipHeight : RELIC_FILTER_POPUP.textChipHeight;
  // 축마다 첫 줄의 칸 번호. 소속처럼 여러 줄이면 첫 줄만 제목을 갖고 나머지는 이어 붙는다.
  const sections: { chipHeight: number; continued?: boolean }[] = [];
  const firstRow = new Map<RelicFilterAxis, number>();
  for (const axis of axes) {
    firstRow.set(axis, sections.length);
    const rows = axis === "squad" ? squadRows : 1;
    for (let row = 0; row < rows; row += 1) sections.push({ chipHeight: chipHeightOf(axis), continued: row > 0 });
  }
  const hasCondition = relicFilterCount(current()) > 0;
  const layout = relicFilterPopupLayout(sections, hasCondition);
  // 아래로 열 자리가 화면 밑동을 넘으면 누른 자리에 붙는 기본 배치로 돌아간다(판이 화면 밖으로 잘리지 않게).
  const fitsBelow = "below" in placement && placement.below.y + layout.height + 40 <= scene.scale.height;
  const where = "below" in placement
    ? fitsBelow ? { x: placement.below.x, y: placement.below.y + layout.height / 2 } : { anchor: placement.below }
    : { anchor: "anchor" in placement ? placement.anchor : placement };

  popups.open(
    {
      width: RELIC_FILTER_POPUP.width,
      height: layout.height,
      title: t("relics.filter"),
      ...where,
      closeOnBackdrop: true, backButton: true,
    },
    (body, close) => {
      const left = -RELIC_FILTER_POPUP.width / 2 + RELIC_FILTER_POPUP.padding;
      const label = (axis: RelicFilterAxis, text: string): number => {
        const section = layout.sections[firstRow.get(axis)!];
        body.add(scene.add.text(left, section.labelY, text, textStyle({ role: "display", size: 28, color: COLOR.accentText })).setOrigin(0, 0.5));
        return section.chipY;
      };

      for (const axis of axes) {
        if (axis === "specialty") {
          const y = label(axis, t("relics.filter.specialty"));
          addTextChip(scene, body, relicFilterChipX(0, 1), y, relicFilterChipWidth(1), t("relics.filter.specialtyOnly"), COLOR.accent,
            () => current().specialtyOnly,
            () => onChange({ ...current(), specialtyOnly: !current().specialtyOnly }));
        } else if (axis === "currency") {
          const y = label(axis, t("relics.filter.currency"));
          CURRENCIES.forEach((currency, index) => {
            addIconChip(scene, body, relicFilterChipX(index, CURRENCIES.length), y, relicFilterChipWidth(CURRENCIES.length), { currency: CURRENCY_ICON_BY_WALLET[currency] }, t(`excavation.auto.${currency}`),
              () => current().currencies.includes(currency),
              () => onChange({ ...current(), currencies: toggleFilterValue(current().currencies, currency) }));
          });
        } else if (axis === "rarity") {
          const y = label(axis, t("relics.filter.rarity"));
          RARITIES.forEach((rarity, index) => {
            addTextChip(scene, body, relicFilterChipX(index, RARITIES.length), y, relicFilterChipWidth(RARITIES.length), rarity, RARITY_TONE[rarity].chip,
              () => current().rarities.includes(rarity),
              () => onChange({ ...current(), rarities: toggleFilterValue(current().rarities, rarity) }));
          });
        } else if (axis === "element") {
          const y = label(axis, t("relics.filter.element"));
          ELEMENTS.forEach((element, index) => {
            addIconChip(scene, body, relicFilterChipX(index, ELEMENTS.length), y, relicFilterChipWidth(ELEMENTS.length), { affinity: ELEMENT_ICON[element] }, t(`element.${element}`),
              () => current().elements.includes(element),
              () => onChange({ ...current(), elements: toggleFilterValue(current().elements, element) }));
          });
        } else if (axis === "role") {
          const y = label(axis, t("relics.filter.role"));
          ROLES.forEach((role, index) => {
            addIconChip(scene, body, relicFilterChipX(index, ROLES.length), y, relicFilterChipWidth(ROLES.length), { affinity: ROLE_ICON[role] }, t(`role.${role}`),
              () => current().roles.includes(role),
              () => onChange({ ...current(), roles: toggleFilterValue(current().roles, role) }));
          });
        } else if (axis === "reach") {
          const y = label(axis, t("relics.filter.reach"));
          REACHES.forEach((reach, index) => {
            addTextChip(scene, body, relicFilterChipX(index, REACHES.length), y, relicFilterChipWidth(REACHES.length), reachLabel(reach), REACH_TONE[reach],
              () => current().reaches.includes(reach),
              () => onChange({ ...current(), reaches: toggleFilterValue(current().reaches, reach) }));
          });
        } else {
          label(axis, t("relics.filter.squad"));
          const first = firstRow.get(axis)!;
          squads.forEach((squad, index) => {
            const row = Math.floor(index / SQUAD_PER_ROW);
            const column = index % SQUAD_PER_ROW;
            addTextChip(scene, body, relicFilterChipX(column, SQUAD_PER_ROW), layout.sections[first + row].chipY, relicFilterChipWidth(SQUAD_PER_ROW), SQUADS[squad].name, COLOR.accent,
              () => current().squads.includes(squad),
              () => onChange({ ...current(), squads: toggleFilterValue(current().squads, squad) }));
          });
        }
      }

      // **걸린 조건이 없으면 그 줄 자체를 세우지 않는다.** 눌러도 아무 일이 없는 칸은 준비
      // 상태를 과장한다. 검색 글은 제 칸이 지우므로 여기서 건드리지 않는다.
      if (hasCondition) {
        const reset = scene.add.container(0, layout.resetY);
        const { height } = RELIC_FILTER_POPUP.reset;
        reset.add(drawLayer(scene, 0, 0, slantedRect(300, height, 16), { fill: 0x241a1e, alpha: 0.96, edge: 0xe23a46, edgeAlpha: 0.7 }));
        reset.add(scene.add.text(0, 0, t("relics.filter.reset"), textStyle({ role: "emphasis", size: 25, color: "#f1a3ab" })).setOrigin(0.5));
        const hit = scene.add.rectangle(0, 0, 300, height, 0xffffff, 0).setInteractive({ useHandCursor: true });
        hit.on("pointerdown", () => pressIn(reset));
        hit.on("pointerout", () => pressOut(reset, "normal", { pop: false }));
        hit.on("pointerup", () => {
          pressOut(reset);
          close();
          // 검색 글은 그대로 둔다 — 여기서 지우는 것은 이 판이 보여 준 축뿐이다.
          onChange({ ...EMPTY_RELIC_FILTER, query: current().query });
        });
        reset.add(hit);
        body.add(reset);
      }
    },
  );
}

/** 아이콘이 위, 이름이 아래로 서는 칩. 속성·직군이 같은 한 장을 쓴다. */
function addIconChip(
  scene: Phaser.Scene,
  body: Phaser.GameObjects.Container,
  x: number,
  y: number,
  width: number,
  icon: { affinity: AffinityIconKey } | { currency: CurrencyIconKey },
  name: string,
  isOn: () => boolean,
  toggle: () => void,
): void {
  const height = RELIC_FILTER_POPUP.iconChipHeight;
  const chip = scene.add.container(x, y);
  const shape = chipPoints(width, height, { bevel: { topLeft: width * 0.2, topRight: 0, bottomRight: width * 0.2, bottomLeft: 0 } });
  const plate = drawLayer(scene, 0, 0, shape, { fill: CHIP.off.fill, alpha: CHIP.off.alpha, shadow: false });
  const edge = drawShapeEdge(scene, 0, 0, shape, "top", { color: COLOR.accent, alpha: 1, width: 5 });
  chip.add([plate, edge]);
  const iconSize = Math.min(58, width * 0.46);
  if ("affinity" in icon) chip.add(new AffinityBadge(scene, 0, -height * 0.16, icon.affinity, iconSize, 0.5));
  // 재화는 여러 색으로 그린 그림이라 칠하지 않고 그대로 세운다. 검은 복제 한 겹이 어두운 칩 위에서 실루엣을 띄운다.
  else if (scene.textures.exists(icon.currency)) {
    chip.add(scene.add.image(3, -height * 0.16 + 4, icon.currency).setDisplaySize(iconSize, iconSize).setTintFill(0x000000).setAlpha(0.55));
    chip.add(scene.add.image(0, -height * 0.16, icon.currency).setDisplaySize(iconSize, iconSize));
  }
  const text = scene.add.text(0, height * 0.3, name, textStyle({ role: "emphasis", size: 22, color: COLOR.inkDim })).setOrigin(0.5);
  chip.add(text);

  const points = toPoints(shape);
  const paint = (): void => {
    const on = isOn();
    // 판을 통째로 다시 칠한다 — Graphics는 이미 그린 면의 색만 갈아 끼울 수 없다.
    plate.clear();
    plate.fillStyle(on ? CHIP.on.fill : CHIP.off.fill, on ? CHIP.on.alpha : CHIP.off.alpha);
    plate.fillPoints(points, true);
    edge.setVisible(on);
    text.setColor(on ? COLOR.accentText : COLOR.inkDim);
    chip.setScale(on ? CHIP.on.scale : CHIP.off.scale);
  };
  paint();

  const hit = scene.add.rectangle(0, 0, width, height, 0xffffff, 0).setInteractive({ useHandCursor: true });
  hit.on("pointerup", () => { toggle(); paint(); });
  chip.add(hit);
  body.add(chip);
}

/** 글자만 서는 칩. 사거리는 아이콘이 없어 이름이 제 색으로 선다. */
export function addTextChip(
  scene: Phaser.Scene,
  body: Phaser.GameObjects.Container,
  x: number,
  y: number,
  width: number,
  name: string,
  tone: number,
  isOn: () => boolean,
  toggle: () => void,
): void {
  const height = RELIC_FILTER_POPUP.textChipHeight;
  const chip = scene.add.container(x, y);
  const shape = slantedRect(width, height, 16);
  const plate = drawLayer(scene, 0, 0, shape, { fill: CHIP.off.fill, alpha: CHIP.off.alpha, shadow: false });
  const edge = drawShapeEdge(scene, 0, 0, shape, "top", { color: tone, alpha: 1, width: 5 });
  const text = scene.add.text(0, 0, name, textStyle({ role: "display", size: 27, color: COLOR.inkDim })).setOrigin(0.5);
  // 스쿼드 이름처럼 긴 낱말은 칸을 넘지 않게 가로로만 누른다(크기를 줄이면 한 줄에서 칩마다 무게가 갈린다).
  squeezeTextToWidth(text, width - 36);
  chip.add([plate, edge, text]);

  const points = toPoints(shape);
  const paint = (): void => {
    const on = isOn();
    plate.clear();
    plate.fillStyle(on ? CHIP.on.fill : CHIP.off.fill, on ? CHIP.on.alpha : CHIP.off.alpha);
    plate.fillPoints(points, true);
    edge.setVisible(on);
    text.setColor(on ? `#${tone.toString(16).padStart(6, "0")}` : COLOR.inkDim);
    chip.setScale(on ? CHIP.on.scale : CHIP.off.scale);
  };
  paint();

  const hit = scene.add.rectangle(0, 0, width, height, 0xffffff, 0).setInteractive({ useHandCursor: true });
  hit.on("pointerup", () => { toggle(); paint(); });
  chip.add(hit);
  body.add(chip);
}
