import Phaser from "phaser";
import { t } from "../i18n";
import type { Element, ReachTier, Role } from "../core/types";
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

const ELEMENTS: readonly Element[] = ["fire", "water", "grass", "earth", "wind"];
const ROLES: readonly Role[] = ["warrior", "tank", "assassin", "support"];
const REACHES: readonly ReachTier[] = ["melee", "mid", "ranged"];

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
): void {
  const sections = [
    { chipHeight: RELIC_FILTER_POPUP.iconChipHeight },
    { chipHeight: RELIC_FILTER_POPUP.iconChipHeight },
    { chipHeight: RELIC_FILTER_POPUP.textChipHeight },
  ];
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

      label(layout.sections[0].labelY, t("relics.filter.element"));
      ELEMENTS.forEach((element, index) => {
        addIconChip(scene, body, relicFilterChipX(index, ELEMENTS.length), layout.sections[0].chipY, relicFilterChipWidth(ELEMENTS.length), ELEMENT_ICON[element], t(`element.${element}`),
          () => current().elements.includes(element),
          () => onChange({ ...current(), elements: toggleFilterValue(current().elements, element) }));
      });

      label(layout.sections[1].labelY, t("relics.filter.role"));
      ROLES.forEach((role, index) => {
        addIconChip(scene, body, relicFilterChipX(index, ROLES.length), layout.sections[1].chipY, relicFilterChipWidth(ROLES.length), ROLE_ICON[role], t(`role.${role}`),
          () => current().roles.includes(role),
          () => onChange({ ...current(), roles: toggleFilterValue(current().roles, role) }));
      });

      label(layout.sections[2].labelY, t("relics.filter.reach"));
      REACHES.forEach((reach, index) => {
        addTextChip(scene, body, relicFilterChipX(index, REACHES.length), layout.sections[2].chipY, relicFilterChipWidth(REACHES.length), reachLabel(reach), REACH_TONE[reach],
          () => current().reaches.includes(reach),
          () => onChange({ ...current(), reaches: toggleFilterValue(current().reaches, reach) }));
      });

      // **걸린 조건이 없으면 그 줄 자체를 세우지 않는다.** 눌러도 아무 일이 없는 칸은 준비
      // 상태를 과장한다. 검색 글은 제 칸이 지우므로 여기서 건드리지 않는다.
      if (hasCondition) {
        const reset = scene.add.container(0, layout.resetY);
        const { height } = RELIC_FILTER_POPUP.reset;
        reset.add(drawLayer(scene, 0, 0, slantedRect(300, height, 16), { fill: 0x241a1e, alpha: 0.96, edge: 0xe23a46, edgeAlpha: 0.7 }));
        reset.add(scene.add.text(0, 0, t("relics.filter.reset"), textStyle({ role: "emphasis", size: 25, color: "#f1a3ab" })).setOrigin(0.5));
        const hit = scene.add.rectangle(0, 0, 300, height, 0xffffff, 0).setInteractive({ useHandCursor: true });
        hit.on("pointerdown", () => reset.setScale(1.08));
        hit.on("pointerout", () => reset.setScale(1));
        hit.on("pointerup", () => {
          reset.setScale(1);
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
