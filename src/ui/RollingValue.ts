import Phaser from "phaser";
import { recallRoll, rememberRoll, rollEndpoints, rollText } from "../core/valueRoll";
import { session } from "../state/session";

/** 숫자가 구르는 시간과 맥동의 세기. 재화는 자주 바뀌므로 길게 끌지 않고, 어느 화면에서나 같다. */
export const ROLL = { ms: 620, punch: 1.26, punchMs: 110, settleMs: 520, gain: "#9dffb8", loss: "#ff9a9a" } as const;

export interface RollingValueOptions {
  /**
   * 자리 이름. 주면 칸이 다시 서도 마지막에 보인 글자에서 이어 굴러 간다(`recallRoll`).
   * 한 번 세워 두고 `setText`만 부르는 칸은 주지 않아도 된다.
   */
  memoryKey?: string;
  /** 글자가 바뀔 때마다 부른다 — 폭이 바뀌면 다시 정렬해야 하는 칸(가운데 묶음)이 쓴다. */
  onChange?: () => void;
}

/**
 * 재화·수치 글자 한 줄에 **롤링**을 입히는 공용 프리팹.
 *
 * 값이 바뀌면 숫자가 굴러 새 값에 닿고, 칸이 한 번 부풀었다 찰랑이며 가라앉는다. 늘면 연둣빛,
 * 줄면 붉은빛이 잠깐 비친다. 부르는 쪽은 예전처럼 `setText`·`setColor`만 부르면 된다 — 재화 칸이든
 * 창 안의 큰 수든 같은 손맛이라 화면마다 제 나름의 카운터를 만들지 않는다. 처음 적는 글자(기억이
 * 없을 때)·움직임 줄이기·테스트 빌드에서는 바로 적는다. 굴리는 첫 숫자 덩어리의 꼴(쉼표·K/M·`/상한`)은
 * 새 글자를 그대로 따른다(`rollText`).
 */
export function attachRoll(value: Phaser.GameObjects.Text, options: RollingValueOptions = {}): Phaser.GameObjects.Text {
  const plain = value.setText.bind(value);
  const paintColor = value.setColor.bind(value);
  const baseScaleX = value.scaleX;
  const baseScaleY = value.scaleY;
  let baseColor = String(value.style.color ?? "#ffffff");
  let shown = value.text;
  let target = value.text;
  let roll: Phaser.Tweens.Tween | undefined;
  let punch: Phaser.Tweens.Tween | undefined;
  const settleScale = (): void => { value.setScale(baseScaleX, baseScaleY); };

  value.setColor = (color) => {
    baseColor = String(color);
    // 굴리는 동안은 늘고 줆의 빛이 우선이고, 끝나면 이 색으로 돌아온다.
    if (!roll) paintColor(baseColor);
    return value;
  };

  const set = (text: string | string[]): Phaser.GameObjects.Text => {
    const next = Array.isArray(text) ? text.join("\n") : text;
    if (next === target) return value;
    const from = shown;
    target = next;
    if (options.memoryKey) rememberRoll(options.memoryKey, next);
    roll?.remove(); punch?.remove(); roll = undefined; punch = undefined;
    const still = from === "" || session.settings.accessibility.reduceMotion || import.meta.env?.MODE === "test" || !value.active;
    const ends = still ? undefined : rollEndpoints(from, next);
    if (!ends) { shown = next; settleScale(); paintColor(baseColor); plain(next); options.onChange?.(); return value; }
    const [start, end] = ends;
    paintColor(end > start ? ROLL.gain : ROLL.loss);
    const counter = { v: start };
    roll = value.scene.tweens.add({
      targets: counter, v: end, duration: ROLL.ms, ease: "Cubic.Out",
      onUpdate: () => { shown = rollText(next, counter.v); plain(shown); options.onChange?.(); },
      onComplete: () => { shown = next; plain(next); paintColor(baseColor); roll = undefined; options.onChange?.(); },
    });
    punch = value.scene.tweens.add({
      targets: value, scaleX: baseScaleX * ROLL.punch, scaleY: baseScaleY * ROLL.punch, duration: ROLL.punchMs, ease: "Quad.Out",
      onComplete: () => {
        punch = value.scene.tweens.add({ targets: value, scaleX: baseScaleX, scaleY: baseScaleY, duration: ROLL.settleMs, ease: "Elastic.Out", easeParams: [1, 0.35], onComplete: () => { punch = undefined; } });
      },
    });
    return value;
  };
  value.setText = set;

  // 지난번 보인 글자가 있으면 거기서 이어 굴러 간다. 빈 글자로 태어난 칸(재화 칸)은 첫 `setText`가,
  // 글자를 들고 태어난 칸(창 안의 수)은 지금 글자가 그 새 값이다.
  const initial = value.text;
  const remembered = options.memoryKey ? recallRoll(options.memoryKey) : undefined;
  if (remembered !== undefined && remembered !== initial) {
    shown = remembered; target = remembered; plain(remembered);
    if (initial !== "") set(initial);
  } else if (options.memoryKey && initial !== "") rememberRoll(options.memoryKey, initial);
  value.once(Phaser.GameObjects.Events.DESTROY, () => { roll?.remove(); punch?.remove(); });
  return value;
}
