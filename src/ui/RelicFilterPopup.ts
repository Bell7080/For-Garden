import Phaser from "phaser";
import { t } from "../i18n";
import type { Element, ReachTier, RelicRarity, Role, SquadId } from "../core/types";
import { PLAYABLE_RELICS } from "../data/relics";
import { SQUADS } from "../data/factions";
import { RARITY_TONE } from "./rarityMark";
import { squeezeTextToWidth } from "./textFit";
import { EMPTY_RELIC_FILTER, relicFilterCount, toggleFilterValue, type RelicFilter } from "../core/relicFilter";
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
/** 소속 칩은 한 줄에 셋씩 — 스쿼드 이름이 길어 다섯을 한 줄에 두면 글자가 칸을 넘는다. */
const SQUAD_PER_ROW = 3;
/** 도감에 실제로 서는 개체가 속한 스쿼드만 고를 수 있다 — 아무도 없는 칸은 눌러도 목록이 비기만 한다. */
function playableSquads(): SquadId[] {
  const used = new Set(PLAYABLE_RELICS.map((relic) => relic.squad));
  return (Object.keys(SQUADS) as SquadId[]).filter((id) => used.has(id));
}

/** 켜진 칩과 꺼진 칩. 색이 아니라 **밝기와 크기**로 가른다 — 화면 전체의 선택 규칙과 같다. */
const CHIP = { on: { fill: 0x1d2a38, alpha: 0.98, scale: 1.06 }, off: { fill: 0x080d13, alpha: 0.72, scale: 1 } } as const;

/**
 * 목록을 좁히는 조건을 고르는 판.
 *
 * 세 축(속성·직군·사거리)이 각각 한 줄이고, 한 축 안에서는 여럿을 켤 수 있다. 고른 것은
 * 곧바로 목록에 반영된다 — 「적용」을 따로 두면 무엇을 켜면 몇 장이 남는지 보이지 않아
 * 눌러 보고 닫고 다시 여는 일이 된다.
 */
export function openRelicFilterPopup(
  scene: Phaser.Scene,
  popups: PopupLayer,
  anchor: { x: number; y: number },
  current: () => RelicFilter,
  onChange: (filter: RelicFilter) => void,
  /**
   * `battle`이면 편성 화면용 — 전투에 필요한 세 축(속성·직군·사거리)만 세운다. 등급과 소속은 편성을
   * 고르는 데 쓰이지 않고 판만 길게 만든다.
   */
  mode: "full" | "battle" = "full",
): void {
  const battle = mode === "battle";
  const squads = battle ? [] : playableSquads();
  const squadRows = Math.max(1, Math.ceil(squads.length / SQUAD_PER_ROW));
  // 순서: (등급) · 속성 · 직군 · 사거리 · (소속)(여러 줄이면 첫 줄만 제목을 갖는다).
  const sections = [
    ...(battle ? [] : [{ chipHeight: RELIC_FILTER_POPUP.textChipHeight }]),
    { chipHeight: RELIC_FILTER_POPUP.iconChipHeight },
    { chipHeight: RELIC_FILTER_POPUP.iconChipHeight },
    { chipHeight: RELIC_FILTER_POPUP.textChipHeight },
    ...(battle ? [] : Array.from({ length: squadRows }, (_, row) => ({ chipHeight: RELIC_FILTER_POPUP.textChipHeight, continued: row > 0 }))),
  ];
  const at = battle ? { element: 0, role: 1, reach: 2 } : { rarity: 0, element: 1, role: 2, reach: 3, squad: 4 };
  const hasCondition = relicFilterCount(current()) > 0;
  const layout = relicFilterPopupLayout(sections, hasCondition);

  popups.open(
    {
      width: RELIC_FILTER_POPUP.width,
      height: layout.height,
      title: t("relics.filter"),
      anchor,
      closeOnBackdrop: true, hideCloseButton: true,
    },
    (body, close) => {
      const left = -RELIC_FILTER_POPUP.width / 2 + RELIC_FILTER_POPUP.padding;
      const label = (y: number, text: string): void => {
        body.add(scene.add.text(left, y, text, textStyle({ role: "display", size: 28, color: COLOR.accentText })).setOrigin(0, 0.5));
      };

      if (!battle) label(layout.sections[0].labelY, t("relics.filter.rarity"));
      if (!battle) RARITIES.forEach((rarity, index) => {
        addTextChip(scene, body, relicFilterChipX(index, RARITIES.length), layout.sections[0].chipY, relicFilterChipWidth(RARITIES.length), rarity, RARITY_TONE[rarity].chip,
          () => current().rarities.includes(rarity),
          () => onChange({ ...current(), rarities: toggleFilterValue(current().rarities, rarity) }));
      });

      label(layout.sections[at.element].labelY, t("relics.filter.element"));
      ELEMENTS.forEach((element, index) => {
        addIconChip(scene, body, relicFilterChipX(index, ELEMENTS.length), layout.sections[at.element].chipY, relicFilterChipWidth(ELEMENTS.length), ELEMENT_ICON[element], t(`element.${element}`),
          () => current().elements.includes(element),
          () => onChange({ ...current(), elements: toggleFilterValue(current().elements, element) }));
      });

      label(layout.sections[at.role].labelY, t("relics.filter.role"));
      ROLES.forEach((role, index) => {
        addIconChip(scene, body, relicFilterChipX(index, ROLES.length), layout.sections[at.role].chipY, relicFilterChipWidth(ROLES.length), ROLE_ICON[role], t(`role.${role}`),
          () => current().roles.includes(role),
          () => onChange({ ...current(), roles: toggleFilterValue(current().roles, role) }));
      });

      label(layout.sections[at.reach].labelY, t("relics.filter.reach"));
      REACHES.forEach((reach, index) => {
        addTextChip(scene, body, relicFilterChipX(index, REACHES.length), layout.sections[at.reach].chipY, relicFilterChipWidth(REACHES.length), reachLabel(reach), REACH_TONE[reach],
          () => current().reaches.includes(reach),
          () => onChange({ ...current(), reaches: toggleFilterValue(current().reaches, reach) }));
      });

      if (!battle) label(layout.sections[4].labelY, t("relics.filter.squad"));
      squads.forEach((squad, index) => {
        const row = Math.floor(index / SQUAD_PER_ROW);
        const column = index % SQUAD_PER_ROW;
        addTextChip(scene, body, relicFilterChipX(column, SQUAD_PER_ROW), layout.sections[4 + row].chipY, relicFilterChipWidth(SQUAD_PER_ROW), SQUADS[squad].name, COLOR.accent,
          () => current().squads.includes(squad),
          () => onChange({ ...current(), squads: toggleFilterValue(current().squads, squad) }));
      });

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
          // 검색 글은 그대로 둔다 — 여기서 지우는 것은 이 판이 보여 준 세 축뿐이다.
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
  icon: AffinityIconKey,
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
  const badge = new AffinityBadge(scene, 0, -height * 0.16, icon, Math.min(58, width * 0.46), 0.5);
  chip.add(badge);
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
function addTextChip(
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
