import Phaser from "phaser";
import { squeezeTextToWidth } from "./textFit";
import { SETTINGS_TEXT } from "./settingsLayout";
import { drawGlyph } from "./glyphs";
import type { PopupLayer } from "./PopupLayer";
import { openChoicePicker, openClockPicker } from "./SettingsPicker";
import { COLOR, textStyle } from "./theme";

/** 줄 하나의 폭과, 이름과 값 사이에 반드시 남기는 틈. 값 오른쪽에는 목록을 여는 표식이 선다. */
const ROW = { width: 900, gap: 28, caret: 34 } as const;

/**
 * 고를 것이 여럿인 설정 줄 — **누르면 고르는 창이 열린다**(`SettingsPicker`).
 *
 * 누를 때마다 다음 값으로 돌던 때는 원하는 값을 지나치면 한 바퀴를 더 돌아야 했다. 시각은 목록이
 * 아니라 바퀴(`picker: "clock"`)로 고른다. 값 오른쪽의 작은 ▾가 이 줄이 창을 연다는 것을 말한다.
 */
export class SettingsSelectRow<T extends string | number> extends Phaser.GameObjects.Container {
  constructor(scene: Phaser.Scene, popups: PopupLayer, x: number, y: number, label: string, value: T, choices: readonly T[], onChange: (value: T) => void, display: (value: T) => string = String, picker: "list" | "clock" = "list") {
    super(scene, x, y);
    const name = scene.add.text(0, 0, label, textStyle({ role: "body", size: SETTINGS_TEXT.label })).setOrigin(0, 0.5);
    this.add(name);
    const shown = scene.add.text(ROW.width - ROW.caret, 0, display(value), textStyle({ role: "emphasis", size: SETTINGS_TEXT.value, color: COLOR.accentText })).setOrigin(1, 0.5); this.add(shown);
    this.add(drawGlyph(scene, "caret-down", ROW.width - ROW.caret / 2 + 4, 2, 24, COLOR.accent, 0.85, 3));
    /*
     * **이름이 값 위로 올라타지 않게 한다.**
     *
     * 낱말 길이는 언어가 정한다 — 「연구 연출 단축」이 영어에서는 `Shorten Research Sequence`이고,
     * 값도 `Default`처럼 길어질 수 있다. 남는 자리는 그 둘이 함께 정하므로 값이 바뀔 때마다
     * 다시 잰다. 크기를 낮추지 않고 가로로만 누르는 것은 줄이 여럿 쌓인 목록이라, 한 줄만
     * 글자가 작아지면 그 줄이 덜 중요한 것처럼 읽히기 때문이다.
     */
    const fitName = (): void => { squeezeTextToWidth(name, ROW.width - ROW.caret - shown.width - ROW.gap, 0.8); };
    fitName();
    // 기존 행의 홀로그램 강조색과 눌림 확대를 그대로 두고 표시 문구만 선택적으로 번역한다.
    const hit = scene.add.rectangle(450, 0, ROW.width, 88, 0xffffff, 0).setInteractive({ useHandCursor: true });
    hit.on("pointerdown", () => this.setScale(1.03));
    const pick = (next: T): void => {
      value = next;
      if (!this.active) return;
      shown.setText(display(value));
      fitName();
      onChange(value);
    };
    hit.on("pointerout", () => this.setScale(1));
    hit.on("pointerup", () => {
      this.setScale(1);
      if (picker === "clock") {
        openClockPicker(scene, popups, { title: label, value: String(value), choices: choices.map(String), onPick: (next) => pick(choices.find((choice) => String(choice) === next) ?? value) });
        return;
      }
      openChoicePicker(scene, popups, { title: label, value, choices, display, onPick: pick });
    });
    this.add(hit); scene.add.existing(this);
  }
}
