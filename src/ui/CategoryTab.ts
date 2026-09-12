import Phaser from "phaser";
import { chipPoints, drawHairline, drawLayer } from "./holo";
import { COLOR, textStyle } from "./theme";

/**
 * 목록을 갈아 끼우는 **서류철 라벨** 한 장.
 *
 * 가방의 네 탭과 상점의 세 탭이 같은 손짓으로 같은 일을 한다 — 지금 보는 목록을 통째로
 * 바꾸는 것이라 생김새도 같아야 한다. 화면마다 제 나름의 탭을 그리면 같은 조작이 어디서는
 * 돌출된 라벨, 어디서는 맨 글자가 된다.
 *
 * 사방선 대신 **서로 다른 깎임**으로 라벨의 방향을 만들고, 선택은 색이 아니라 **크기와
 * 강조색**이 말한다(밑줄 상자를 두지 않는 화면 전체의 규칙이다).
 */
export const CATEGORY_TAB = {
  labelSize: 27,
  /** 글자가 라벨 좌우 변에서 남겨야 하는 여백. 넘치면 이만큼을 뺀 자리에 맞춰 줄인다. */
  padX: 22,
  /** 글자를 줄이는 하한. 더 줄이면 읽을 수 없어진다. */
  minScale: 0.68,
  selectedScale: 1.1,
  pressedScale: 1.08,
  selectedPressedScale: 1.14,
} as const;

export interface CategoryTabOptions {
  x: number;
  y: number;
  width: number;
  height: number;
  /** **이미 번역된 글자**다. 키를 넘기면 화면에 `inventory.tab.rune`이 그대로 선다. */
  label: string;
  selected: boolean;
  /** 오른쪽에 다음 탭이 있으면 그 사이에 짧은 세로 머리선을 세운다. */
  divider?: number;
  onSelect: () => void;
}

/** 라벨 한 장을 세운다. 되돌려 받는 컨테이너는 부른 쪽이 소유한다. */
export function addCategoryTab(
  scene: Phaser.Scene,
  parent: Phaser.GameObjects.Container | undefined,
  options: CategoryTabOptions,
): Phaser.GameObjects.Container {
  const { width, height, selected } = options;
  const tab = scene.add.container(options.x, options.y);
  const face = chipPoints(width, height, { bevel: { topLeft: 18, topRight: 0, bottomRight: 14, bottomLeft: 4 } });
  tab.add(drawLayer(scene, 0, 0, face, {
    fill: selected ? 0x3b3326 : 0x2b3037,
    alpha: selected ? 0.98 : 0.92,
    edge: selected ? COLOR.accent : COLOR.panelEdge,
    edgeAlpha: selected ? 0.9 : 0.7,
  }));
  const label = scene.add
    .text(0, 1, options.label, textStyle({ role: "emphasis", size: CATEGORY_TAB.labelSize, color: selected ? COLOR.accentText : COLOR.inkDim }))
    .setOrigin(0.5);
  // 낱말 길이는 언어가 정하는데(`룬` 한 글자 ↔ `Consumable` 열 글자) 라벨 폭은 줄이 나눠 갖는
  // 고정값이다. 라벨을 넓히면 줄 전체가 판 밖으로 나가므로 글자만 가로로 줄인다.
  const room = (width - CATEGORY_TAB.padX) / CATEGORY_TAB.selectedScale;
  if (label.width > room) label.setScale(Math.max(CATEGORY_TAB.minScale, room / label.width), 1);
  tab.add(label);
  if (options.divider !== undefined) {
    tab.add(drawHairline(scene, width / 2 + options.divider / 2, 0, height * 0.52, { color: COLOR.panelEdge, alpha: 0.55 }).setRotation(Math.PI / 2));
  }
  const restingScale = selected ? CATEGORY_TAB.selectedScale : 1;
  tab.setScale(restingScale);
  // 글자가 아니라 면 전체가 입력을 받아 가장자리에서도 같은 눌림과 결과를 준다.
  const hit = scene.add.rectangle(0, 0, width, height, 0xffffff, 0).setInteractive({ useHandCursor: true });
  hit.on("pointerdown", () => tab.setScale(selected ? CATEGORY_TAB.selectedPressedScale : CATEGORY_TAB.pressedScale));
  hit.on("pointerout", () => tab.setScale(restingScale));
  hit.on("pointerup", () => { tab.setScale(restingScale); options.onSelect(); });
  tab.add(hit);
  if (parent) parent.add(tab);
  return tab;
}
