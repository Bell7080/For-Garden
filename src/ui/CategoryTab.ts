import Phaser from "phaser";
import { drawLayer, drawShapeEdge, slantedRect, toPoints } from "./holo";
import { COLOR, textStyle } from "./theme";

/**
 * 목록을 갈아 끼우는 **전환 라벨** 한 장.
 *
 * 가방의 네 탭과 상점의 세 탭이 같은 손짓으로 같은 일을 한다 — 지금 보는 목록을 통째로 바꾸는
 * 것이라 생김새도 한 곳에서 나온다. 두 화면 모두 목록이 **위**, 라벨이 **아래**라 이 프리팹은
 * 그 방향 하나만 그린다.
 *
 * **서류철 라벨이 아니다.** 네 모서리를 제각각 깎은 종이 탭에 갈색 면을 깔았던 때는 팔레트에
 * 없는 색이 화면에 하나 더 생겼고, 켜진 것과 꺼진 것이 둘 다 판때기라 무엇이 지금 열려 있는지
 * 크기로만 겨우 읽혔다. 지금은 **투영 장비의 스위치**다:
 *
 * - 꺼진 것은 **바닥에 눌린 어두운 유리면**이고 강조선이 없다.
 * - 켜진 것은 **목록 쪽으로 한 뼘 솟고**(`lift`) 윗변에 굵은 강조선이 흐른다 — 그 선이 곧
 *   이 라벨이 여는 목록의 밑변이라, 선 하나로 라벨과 목록이 한 덩어리가 된다.
 * - 켜진 것의 글자 왼쪽에는 **제목표와 같은 빗금**(`/`)이 선다. 판에 제목을 묶는 그 표식을
 *   그대로 써서, 지금 열린 목록의 이름표가 어느 것인지 같은 문법으로 말한다.
 *
 * 사방 외곽선도, 밑줄 상자도 두르지 않는다(화면 전체의 규칙). 가른 것은 **솟음·강조선·빗금·
 * 크기**뿐이다.
 */
export const CATEGORY_TAB = {
  labelSize: 28,
  /** 글자가 라벨 좌우 변에서 남겨야 하는 여백(빗금 자리를 포함한다). */
  padX: 30,
  /** 글자를 줄이는 하한. 더 줄이면 읽을 수 없어진다. */
  minScale: 0.66,
  /** 깎임 — 높이에 대한 비율. 판·버튼과 같은 기울기 체계를 쓴다. */
  slantRatio: 0.34,
  /** 켜진 라벨이 목록 쪽으로 솟는 높이. 밑변은 그대로 두고 윗변만 올라간다. */
  lift: 10,
  /** 윗변 강조선의 굵기. 켜진 것만 그린다. */
  edgeWidth: 5,
  /** 켜진 라벨의 빗금. 제목표(`addSectionTitle`)와 같은 표식이다. */
  mark: { width: 8, heightRatio: 0.44, gap: 12 },
  selectedScale: 1.06,
  pressedScale: 1.06,
  selectedPressedScale: 1.12,
} as const;

export interface CategoryTabOptions {
  x: number;
  /** 라벨 줄의 중심 y. 켜진 라벨은 이 자리를 지키고 윗변만 솟는다. */
  y: number;
  width: number;
  height: number;
  /** **이미 번역된 글자**다. 키를 넘기면 화면에 `inventory.tab.rune`이 그대로 선다. */
  label: string;
  selected: boolean;
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

  // 켜진 라벨은 **밑변을 그대로 두고 윗변만** 솟는다 — 가운데를 키우면 목록에서 멀어지는
  // 아래쪽까지 함께 자라 스위치가 아니라 커진 버튼으로 읽힌다.
  const lift = selected ? CATEGORY_TAB.lift : 0;
  const faceHeight = height + lift;
  const faceY = -lift / 2;
  const face = slantedRect(width, faceHeight, Math.round(faceHeight * CATEGORY_TAB.slantRatio));
  tab.add(drawLayer(scene, 0, faceY, face, {
    fill: selected ? 0x1b2836 : 0x080d13,
    alpha: selected ? 0.98 : 0.72,
  }));
  if (selected) {
    // 윗변의 굵은 강조선 — 이 선이 곧 라벨이 여는 목록의 밑변이다.
    tab.add(drawShapeEdge(scene, 0, faceY, face, "top", { color: COLOR.accent, alpha: 0.95, width: CATEGORY_TAB.edgeWidth }));
  }

  const label = scene.add
    .text(0, 1, options.label, textStyle({ role: "emphasis", size: CATEGORY_TAB.labelSize, color: selected ? COLOR.accentText : COLOR.inkDim }))
    .setOrigin(0.5);
  // 낱말 길이는 언어가 정하는데(`룬` 한 글자 ↔ `Consumable` 열 글자) 라벨 폭은 줄이 나눠 갖는
  // 고정값이다. 라벨을 넓히면 줄 전체가 판 밖으로 나가므로 글자만 가로로 줄인다.
  const markRoom = selected ? CATEGORY_TAB.mark.width + CATEGORY_TAB.mark.gap : 0;
  const room = (width - CATEGORY_TAB.padX - markRoom) / CATEGORY_TAB.selectedScale;
  if (label.width > room) label.setScale(Math.max(CATEGORY_TAB.minScale, room / label.width), 1);
  if (selected) {
    // 글자와 빗금을 한 덩어리로 재고 나서 가운데에 놓는다 — 빗금만 옆에 붙이면 글자가 오른쪽
    // 으로 밀려, 라벨을 고를 때마다 이름이 자리를 옮긴다.
    const span = label.displayWidth + CATEGORY_TAB.mark.width + CATEGORY_TAB.mark.gap;
    label.setX(-span / 2 + CATEGORY_TAB.mark.width + CATEGORY_TAB.mark.gap + label.displayWidth / 2);
    const markHeight = Math.round(height * CATEGORY_TAB.mark.heightRatio);
    const mark = scene.add.graphics();
    mark.fillStyle(COLOR.accent, 0.95);
    mark.fillPoints(
      toPoints(slantedRect(CATEGORY_TAB.mark.width, markHeight, Math.round(CATEGORY_TAB.mark.width * 0.9)))
        .map((point) => new Phaser.Geom.Point(point.x - span / 2 + CATEGORY_TAB.mark.width / 2, point.y + 1)),
      true,
    );
    tab.add(mark);
  }
  tab.add(label);

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
