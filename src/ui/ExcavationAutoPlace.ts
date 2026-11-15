import Phaser from "phaser";
import { excavationAutoModeLabel, EXCAVATION_AUTO_MODES, type ExcavationAutoMode } from "../core/excavationAutoAssign";
import { drawGlyph } from "./glyphs";
import { chipPoints, drawLayer, drawShapeEdge, slantedRect } from "./holo";
import { CURRENCY_ICON_BY_WALLET } from "./currencyIcons";
import { RELIC_SORT_MENU, relicSortMenuHeight, relicSortMenuRowY } from "./relicGridLayout";
import { CONTROL_BAR } from "./SortControl";
import { Button } from "./Button";
import { squeezeTextToWidth } from "./textFit";
import { COLOR, textStyle } from "./theme";
import { pressIn, pressOut } from "./pressFeedback";
import { playFadeIn, playFadeOut } from "./screenTransition";
import { t } from "../i18n";

/**
 * 발굴 자동 배치 줄의 자리와 크기. 기준 칩과 실행 버튼이 같은 높이로 나란히 선다.
 *
 * 예전에는 버튼 안의 작은 부제와 ▶ 칸 하나로 기준을 돌려 골라, 무엇을 고를 수 있는지는 끝까지
 * 넘겨 봐야 알았고 두 버튼이 한 줄에 낑겨 보였다. 지금은 기준 칩이 **아래로 목록을 펼치고**
 * 줄마다 그 기준이 노리는 재화 그림이 선다.
 */
export const EXCAVATION_AUTO_PLACE = { height: 54, pickerWidth: 260, buttonWidth: 176, gap: 14, fontSize: 22, iconSize: 34 } as const;

/** 기준마다 줄에 세울 재화 그림. 골고루는 넷을 작게 겹쳐 「모두」를 말한다. */
function modeIcons(mode: ExcavationAutoMode): readonly string[] {
  if (mode === "balanced") return [CURRENCY_ICON_BY_WALLET.cheesecake, CURRENCY_ICON_BY_WALLET.rawStone, CURRENCY_ICON_BY_WALLET.gold, CURRENCY_ICON_BY_WALLET.gems];
  return [CURRENCY_ICON_BY_WALLET[mode]];
}

/** 그림 한 벌(여럿이면 조금씩 겹쳐)을 검은 복제 그림자와 함께 세운다. 차지한 폭을 돌려준다. */
function addModeIcons(scene: Phaser.Scene, parent: Phaser.GameObjects.Container, mode: ExcavationAutoMode, left: number, y: number, size: number): number {
  const icons = modeIcons(mode);
  const step = icons.length > 1 ? size * 0.52 : 0;
  icons.forEach((key, index) => {
    if (!scene.textures.exists(key)) return;
    const x = left + size / 2 + index * step;
    parent.add(scene.add.image(x + 2, y + 3, key).setDisplaySize(size, size).setTintFill(0x000000).setAlpha(0.5));
    parent.add(scene.add.image(x, y, key).setDisplaySize(size, size));
  });
  return size + step * (icons.length - 1);
}

export interface ExcavationAutoPlaceOptions {
  /** 줄의 오른쪽 끝과 세로 중심. 실행 버튼이 오른쪽, 기준 칩이 그 왼쪽에 선다. */
  readonly right: number;
  readonly y: number;
  readonly parent: Phaser.GameObjects.Container;
  readonly mode: ExcavationAutoMode;
  /** 목록에서 기준을 골랐을 때 — 고른 기준으로 곧바로 다시 배치한다. */
  readonly onPick: (mode: ExcavationAutoMode) => void;
  /** 실행 버튼 — 지금 기준으로 배치한다. */
  readonly onApply: () => void;
}

export class ExcavationAutoPlace {
  private menu?: Phaser.GameObjects.Container;

  constructor(private readonly scene: Phaser.Scene, private readonly options: ExcavationAutoPlaceOptions) {
    const { height, pickerWidth, buttonWidth, gap, fontSize, iconSize } = EXCAVATION_AUTO_PLACE;
    const { right, y, parent, mode } = options;
    parent.add(new Button(scene, right - buttonWidth / 2, y, {
      width: buttonWidth, height, fontSize, label: t("excavation.autoPlace"), icon: "auto",
      onClick: () => { this.closeMenu(); options.onApply(); },
    }));

    const pickerX = right - buttonWidth - gap - pickerWidth / 2;
    const shape = slantedRect(pickerWidth, height, 16);
    const picker = scene.add.container(pickerX, y);
    picker.add(drawLayer(scene, 0, 0, shape, { fill: CONTROL_BAR.fill, alpha: CONTROL_BAR.alpha }));
    picker.add(drawShapeEdge(scene, 0, 0, shape, "top", { color: COLOR.accent, alpha: 0.6, width: 3 }));
    const iconLeft = -pickerWidth / 2 + 24;
    const iconWidth = addModeIcons(scene, picker, mode, iconLeft, 0, iconSize);
    const labelLeft = iconLeft + iconWidth + 12;
    const caretX = pickerWidth / 2 - 30;
    const label = scene.add.text(labelLeft, 0, excavationAutoModeLabel(mode), textStyle({ role: "display", size: fontSize, color: COLOR.accentText })).setOrigin(0, 0.5);
    squeezeTextToWidth(label, caretX - 18 - labelLeft);
    picker.add(label);
    picker.add(drawGlyph(scene, "caret-down", caretX, 2, Math.round(fontSize * 0.96), COLOR.accent, 0.9, 3));
    const hit = scene.add.rectangle(0, 0, pickerWidth, height, 0xffffff, 0).setInteractive({ useHandCursor: true });
    hit.on("pointerdown", () => pressIn(picker));
    hit.on("pointerout", () => pressOut(picker, "normal", { pop: false }));
    hit.on("pointerup", () => { pressOut(picker); this.toggleMenu(pickerX); });
    picker.add(hit);
    parent.add(picker);
    picker.once(Phaser.GameObjects.Events.DESTROY, () => this.closeMenu());
  }

  /** 목록은 기준 칩 **바로 아래**에 붙는다. 바깥을 누르면 고르지 않고 닫힌다. */
  private toggleMenu(x: number): void {
    if (this.menu) { this.closeMenu(); return; }
    const { parent, y, mode } = this.options;
    const { height: rowHeight, pickerWidth: width, iconSize } = EXCAVATION_AUTO_PLACE;
    const count = EXCAVATION_AUTO_MODES.length;
    const height = relicSortMenuHeight(count);
    const menu = this.scene.add.container(x, y + rowHeight / 2 + 10 + height / 2);
    parent.add(menu);
    // 목록은 그 뒤에 세운 그리드 카드보다 위여야 한다 — 컨테이너 안에서는 깊이가 아니라 순서가 정한다.
    parent.bringToTop(menu);

    const backdrop = this.scene.add.rectangle(0, 0, 8000, 8000, 0x000000, 0).setInteractive();
    backdrop.on("pointerup", () => this.closeMenu());
    menu.add(backdrop);
    const shape = chipPoints(width, height, { bevel: { topLeft: width * 0.12, topRight: 0, bottomRight: width * 0.12, bottomLeft: 0 } });
    menu.add(drawLayer(this.scene, 0, 0, shape, { fill: 0x0b0f15, alpha: 0.97, edge: COLOR.accent, edgeAlpha: 0.6 }));
    const rowWidth = width - RELIC_SORT_MENU.padding * 2;
    EXCAVATION_AUTO_MODES.forEach((option, index) => {
      const rowY = relicSortMenuRowY(index, count);
      const on = option === mode;
      const size = on ? iconSize + 6 : iconSize;
      const iconLeft = -rowWidth / 2 + 18;
      const iconWidth = addModeIcons(this.scene, menu, option, iconLeft, rowY, size);
      const textLeft = iconLeft + iconWidth + 14;
      const text = this.scene.add.text(textLeft, rowY, excavationAutoModeLabel(option), textStyle({ role: "display", size: on ? 28 : 25, color: on ? COLOR.accentText : COLOR.inkDim })).setOrigin(0, 0.5);
      squeezeTextToWidth(text, rowWidth / 2 - 12 - textLeft);
      menu.add(text);
      if (on) menu.add(drawShapeEdge(this.scene, 0, rowY, slantedRect(rowWidth, RELIC_SORT_MENU.rowHeight, 12), "bottom", { color: COLOR.accent, alpha: 0.5, width: 3, inset: 24 }));
      const hit = this.scene.add.rectangle(0, rowY, rowWidth, RELIC_SORT_MENU.rowHeight, 0xffffff, 0).setInteractive({ useHandCursor: true });
      hit.on("pointerup", () => { this.closeMenu(); this.options.onPick(option); });
      menu.add(hit);
    });
    this.menu = menu;
    playFadeIn(this.scene, [menu], { rise: -10 });
  }

  closeMenu(): void {
    const menu = this.menu;
    this.menu = undefined;
    if (!menu) return;
    if (!menu.scene || !this.scene.sys.isActive()) { menu.destroy(); return; }
    menu.list.forEach((child) => (child as Phaser.GameObjects.GameObject).input && (child as Phaser.GameObjects.GameObject).disableInteractive());
    playFadeOut(this.scene, [menu], () => menu.destroy());
  }
}
