import Phaser from "phaser";
import { t } from "../i18n";
import { joinClockChoice, splitClockChoices, wheelSlotStyle, wheelSnapTarget, wrapIndex } from "../core/wheelPicker";
import { drawLayer, drawShapeEdge, slantedRect, toPoints } from "./holo";
import type { PopupLayer } from "./PopupLayer";
import { SETTINGS_PICKER, settingsChoicePickerHeight, settingsChoiceRowY } from "./settingsLayout";
import { squeezeTextToWidth } from "./textFit";
import { COLOR, textStyle } from "./theme";

export interface ChoicePickerOptions<T> {
  readonly title: string;
  readonly value: T;
  readonly choices: readonly T[];
  readonly display: (value: T) => string;
  readonly onPick: (value: T) => void;
}

/**
 * 고를 것이 여럿인 설정 — **누르면 목록이 열리고 거기서 고른다.**
 *
 * 누를 때마다 다음 값으로 돌던 때는 언어처럼 선택지가 여럿인 줄을 원하는 값이 나올 때까지 몇 번이고
 * 눌러야 했고, 지나쳐 버리면 한 바퀴를 더 돌아야 했다. 지금 값은 **솟은 판 · 빗금 · 강조색**으로
 * 서고(목록 탭과 같은 문법), 한 줄을 누르면 그 값으로 바뀌며 닫힌다.
 */
export function openChoicePicker<T>(scene: Phaser.Scene, popups: PopupLayer, options: ChoicePickerOptions<T>): void {
  const { width, row } = SETTINGS_PICKER;
  const count = options.choices.length;
  popups.open({ width, height: settingsChoicePickerHeight(count), title: options.title, dim: true, closeOnBackdrop: true }, (body, close) => {
    options.choices.forEach((choice, index) => {
      const y = settingsChoiceRowY(index, count);
      const on = choice === options.value;
      const node = scene.add.container(0, y);
      const shape = slantedRect(row.width, row.height, 16);
      node.add(drawLayer(scene, 0, 0, shape, { fill: on ? 0x1b2836 : 0x0c1118, alpha: on ? 0.96 : 0.82 }));
      if (on) {
        node.add(drawShapeEdge(scene, 0, 0, shape, "top", { color: COLOR.accent, alpha: 0.95, width: 4 }));
        // 제목표·목록 탭과 같은 빗금 — 지금 고른 줄을 같은 문법으로 말한다.
        const slash = scene.add.graphics();
        slash.fillStyle(COLOR.accent, 0.95);
        slash.fillPoints(toPoints(slantedRect(10, row.height * 0.5, 7)).map((point) => new Phaser.Geom.Point(point.x - row.width / 2 + 34, point.y)), true);
        node.add(slash);
      }
      const style = on ? textStyle({ role: "display", size: 32, color: COLOR.accentText }) : textStyle({ role: "emphasis", size: 29, color: COLOR.ink });
      const label = scene.add.text(0, 0, options.display(choice), style).setOrigin(0.5);
      squeezeTextToWidth(label, row.width - 120, 0.8);
      node.add(label);
      const hit = scene.add.rectangle(0, 0, row.width, row.height, 0xffffff, 0).setInteractive({ useHandCursor: true });
      hit.on("pointerdown", () => node.setScale(1.04));
      hit.on("pointerout", () => node.setScale(1));
      hit.on("pointerup", () => {
        node.setScale(1);
        close();
        if (choice !== options.value) options.onPick(choice);
      });
      node.add(hit);
      body.add(node);
    });
  });
}

export interface ClockPickerOptions {
  readonly title: string;
  /** `HH:MM`. */
  readonly value: string;
  readonly choices: readonly string[];
  readonly onPick: (value: string) => void;
}

/**
 * 시각 설정 — **타이머를 맞추듯 두 바퀴를 굴려** 고른다.
 *
 * 30분 간격 마흔여덟 값을 한 번씩 눌러 넘기던 때는 23:00을 고르려면 마흔여섯 번을 눌러야 했다.
 * 시·분을 따로 굴리고, 가운데 띠에 선 값이 고른 값이다. 굴리는 동안에는 바뀌지 않고 「확인」에서만
 * 저장한다 — 굴리다 지나친 값이 그때마다 저장되면 알림 설정이 굴린 만큼 흔들린다.
 */
export function openClockPicker(scene: Phaser.Scene, popups: PopupLayer, options: ClockPickerOptions): void {
  const { width, clock } = SETTINGS_PICKER;
  const { hours, minutes } = splitClockChoices(options.choices);
  const [hour = hours[0], minute = minutes[0]] = options.value.split(":");
  popups.open({ width, height: clock.height, title: options.title, dim: true, closeOnBackdrop: true }, (body, close) => {
    const centerY = clock.centerY;
    // 가운데 띠 — 여기 선 값이 고른 값이다.
    const band = slantedRect(clock.bandWidth, clock.rowHeight, 16);
    body.add(drawLayer(scene, 0, centerY, band, { fill: 0x1b2836, alpha: 0.9 }));
    body.add(drawShapeEdge(scene, 0, centerY, band, "top", { color: COLOR.accent, alpha: 0.8, width: 3 }));
    body.add(drawShapeEdge(scene, 0, centerY, band, "bottom", { color: COLOR.accent, alpha: 0.8, width: 3 }));
    const hourWheel = new ClockWheel(scene, body, -clock.columnGap, centerY, hours, Math.max(0, hours.indexOf(hour)));
    const minuteWheel = new ClockWheel(scene, body, clock.columnGap, centerY, minutes, Math.max(0, minutes.indexOf(minute)));
    body.add(scene.add.text(0, centerY - 4, ":", textStyle({ role: "display", size: clock.fontSize, color: COLOR.accentText })).setOrigin(0.5));

    const button = scene.add.container(0, clock.height / 2 - clock.confirm.bottom - clock.confirm.height / 2);
    button.add(drawLayer(scene, 0, 0, slantedRect(clock.confirm.width, clock.confirm.height, 18), { fill: 0x273646, alpha: 0.98, edge: COLOR.accent, edgeAlpha: 0.8 }));
    button.add(scene.add.text(0, 0, t("settings.picker.confirm"), textStyle({ role: "display", size: 30, color: COLOR.accentText })).setOrigin(0.5));
    const hit = scene.add.rectangle(0, 0, clock.confirm.width, clock.confirm.height, 0xffffff, 0).setInteractive({ useHandCursor: true });
    hit.on("pointerdown", () => button.setScale(1.08));
    hit.on("pointerout", () => button.setScale(1));
    hit.on("pointerup", () => {
      button.setScale(1);
      const picked = joinClockChoice(options.choices, hourWheel.value(), minuteWheel.value());
      close();
      if (picked !== options.value) options.onPick(picked);
    });
    button.add(hit);
    body.add(button);
  });
}

/**
 * 바퀴 하나. 칸을 미리 다 세우지 않고 **보이는 일곱 칸의 글자만 갈아 끼운다** — 마스크 없이도 위아래
 * 끝이 옅어지며 사라지고(`wheelSlotStyle`), 기하 마스크가 컨테이너 이동을 물려받지 않아 떠오르는
 * 팝업에서 어긋나는 문제도 없다.
 */
class ClockWheel {
  private position: number;
  private readonly slots: Phaser.GameObjects.Text[] = [];
  private tween?: Phaser.Tweens.Tween;
  private velocity = 0;
  private lastMove = 0;

  constructor(private readonly scene: Phaser.Scene, parent: Phaser.GameObjects.Container, private readonly x: number, private readonly y: number, private readonly values: readonly string[], index: number) {
    this.position = index;
    const { clock } = SETTINGS_PICKER;
    for (let k = -3; k <= 3; k += 1) {
      const slot = scene.add.text(x, y, "", textStyle({ role: "display", size: clock.fontSize, color: COLOR.ink })).setOrigin(0.5);
      this.slots.push(slot);
      parent.add(slot);
    }
    const hit = scene.add.rectangle(x, y, clock.columnWidth, clock.rowHeight * 5, 0xffffff, 0).setInteractive({ draggable: true, useHandCursor: true });
    let lastY = 0;
    hit.on("dragstart", (pointer: Phaser.Input.Pointer) => {
      this.tween?.stop();
      lastY = pointer.y;
      this.velocity = 0;
      this.lastMove = scene.time.now;
    });
    hit.on("drag", (pointer: Phaser.Input.Pointer) => {
      const delta = -(pointer.y - lastY) / clock.rowHeight;
      lastY = pointer.y;
      const now = scene.time.now;
      const seconds = Math.max(0.001, (now - this.lastMove) / 1000);
      this.lastMove = now;
      // 마지막 몇 프레임의 속도만 남긴다 — 멈췄다 뗀 손이 예전 속도로 튕기지 않게.
      this.velocity = this.velocity * 0.4 + (delta / seconds) * 0.6;
      this.position += delta;
      this.render();
    });
    hit.on("dragend", () => {
      const idle = (scene.time.now - this.lastMove) / 1000;
      this.settle(wheelSnapTarget(this.position, idle > 0.08 ? 0 : this.velocity));
    });
    // 한 칸 누르기로도 움직인다 — 위 칸을 누르면 한 칸 앞으로, 아래 칸이면 한 칸 뒤로.
    hit.on("pointerup", (pointer: Phaser.Input.Pointer) => {
      if (pointer.getDistance() > 8) return;
      const local = hit.getWorldTransformMatrix().applyInverse(pointer.x, pointer.y);
      const step = Math.round(local.y / clock.rowHeight);
      if (step !== 0) this.settle(Math.round(this.position) + step);
    });
    hit.on("wheel", (_pointer: Phaser.Input.Pointer, _dx: number, dy: number) => this.settle(Math.round(this.position) + Math.sign(dy)));
    parent.add(hit);
    this.render();
  }

  value(): string {
    return this.values[wrapIndex(Math.round(this.position), this.values.length)];
  }

  private settle(target: number): void {
    this.tween?.stop();
    const from = this.position;
    this.tween = this.scene.tweens.addCounter({
      from: 0, to: 1, duration: 160 + Math.min(420, Math.abs(target - from) * 45), ease: "Cubic.easeOut",
      onUpdate: (tween) => { this.position = from + (target - from) * (tween.getValue() ?? 0); this.render(); },
      onComplete: () => { this.position = target; this.render(); },
    });
  }

  private render(): void {
    const { clock } = SETTINGS_PICKER;
    const base = Math.floor(this.position);
    const frac = this.position - base;
    this.slots.forEach((slot, i) => {
      const k = i - 3;
      const offset = k - frac;
      const { alpha, scale } = wheelSlotStyle(offset);
      const centered = Math.abs(offset) < 0.5;
      slot.setText(this.values[wrapIndex(base + k, this.values.length)])
        .setPosition(this.x, this.y + offset * clock.rowHeight)
        .setAlpha(alpha).setScale(scale)
        .setColor(centered ? COLOR.accentText : COLOR.ink);
    });
  }
}
