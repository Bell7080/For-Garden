import Phaser from "phaser";
import { squeezeTextToWidth } from "./textFit";
import { SETTINGS_TEXT } from "./settingsLayout";
import { COLOR, textStyle } from "./theme";
import { pressIn, pressOut } from "./pressFeedback";

/** 줄 하나의 폭과, 이름과 값 사이에 반드시 남기는 틈. */
const ROW = { width: 900, gap: 28 } as const;

/** 허용 선택지를 순환하며 행 전체를 최소 터치 영역으로 제공하는 선택 행이다. */
export class SettingsSelectRow<T extends string | number> extends Phaser.GameObjects.Container {
  constructor(scene: Phaser.Scene, x: number, y: number, label: string, value: T, choices: readonly T[], onChange: (value: T) => void, display: (value: T) => string = String) {
    super(scene, x, y);
    const name = scene.add.text(0, 0, label, textStyle({ role: "body", size: SETTINGS_TEXT.label })).setOrigin(0, 0.5);
    this.add(name);
    const shown = scene.add.text(ROW.width, 0, display(value), textStyle({ role: "emphasis", size: SETTINGS_TEXT.value, color: COLOR.accentText })).setOrigin(1, 0.5); this.add(shown);
    /*
     * **이름이 값 위로 올라타지 않게 한다.**
     *
     * 낱말 길이는 언어가 정한다 — 「연구 연출 단축」이 영어에서는 `Shorten Research Sequence`이고,
     * 값도 `Default`처럼 길어질 수 있다. 남는 자리는 그 둘이 함께 정하므로 값이 바뀔 때마다
     * 다시 잰다. 크기를 낮추지 않고 가로로만 누르는 것은 줄이 여럿 쌓인 목록이라, 한 줄만
     * 글자가 작아지면 그 줄이 덜 중요한 것처럼 읽히기 때문이다.
     */
    const fitName = (): void => { squeezeTextToWidth(name, ROW.width - shown.width - ROW.gap, 0.8); };
    fitName();
    // 기존 행의 홀로그램 강조색과 눌림 확대를 그대로 두고 표시 문구만 선택적으로 번역한다.
    const hit = scene.add.rectangle(450, 0, ROW.width, 88, 0xffffff, 0).setInteractive({ useHandCursor: true });
    hit.on("pointerdown", () => pressIn(this));
    hit.on("pointerup", () => {
      pressOut(this);
      value = choices[(choices.indexOf(value) + 1) % choices.length];
      shown.setText(display(value));
      fitName();
      onChange(value);
    });
    this.add(hit); scene.add.existing(this);
  }
}
