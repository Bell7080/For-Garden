import Phaser from "phaser";
import { t } from "../i18n";
import { duelDivisionNumeral, duelStanding } from "../core/duelArena";
import { duelGaugeSteps, type DuelGaugeStep } from "../core/duelStandingTrack";
import { motionPolicy } from "../core/settings";
import { session } from "../state/session";
import { addDuelTierEmblem } from "./DuelTierEmblem";
import { DUEL_TIER_COLOR } from "./duelLayout";
import { HoloBar } from "./holo";
import { COLOR, textStyle } from "./theme";

/** 결투 결과판이 서는 점수 변화. 서버 영수증(`ResolveDuelResponse`)에서 그대로 온다. */
export interface DuelStandingResult {
  scoreBefore: number;
  scoreAfter: number;
  /** 연승 보너스가 얹힌 판이면 그 몫과 연승 수. */
  streakBonus: number;
  winStreak: number;
}

/**
 * 결투 결과판의 티어 블록 — 휘장 · 티어와 단계 · 점수 게이지(끝에 다음 휘장) · 점수 증감.
 *
 * 로비의 표기(`DuelScene.paintStanding`)와 같은 휘장·색·게이지를 쓰되 **가운데 정렬**로 세운다
 * (경험치 블록 `PlayerExpGainRow`와 같은 자리). 게이지는 이전 점수에서 차오르거나 줄어들고, 단계를
 * 넘으면 줄이 끝까지 찼다가 비워지며 휘장이 튄다 — 레벨업 연출과 같은 문법이다. 증감 숫자는 그동안
 * 0에서 굴러 최종값에 닿는다. 움직임 줄이기에서는 끝난 모습으로 선다.
 */
export const DUEL_STANDING_ROW = {
  emblem: { y: 0, size: 100 },
  name: { y: 78, size: 40 },
  gauge: { y: 126, width: 440, height: 22, nextSize: 46, nextGap: 18 },
  delta: { y: 184, size: 44 },
  streak: { y: 226, size: 22 },
  /** 블록이 차지하는 높이(휘장 위끝 ~ 연승 줄 아래끝). */
  height: 252,
  fullStepMs: 700,
  minStepMs: 220,
  startDelayMs: 360,
} as const;

export function addDuelStandingRow(scene: Phaser.Scene, body: Phaser.GameObjects.Container, y: number, result: DuelStandingResult): void {
  const L = DUEL_STANDING_ROW;
  const block = scene.add.container(0, y);
  body.add(block);
  const steps = duelGaugeSteps(result.scoreBefore, result.scoreAfter);
  const delta = result.scoreAfter - result.scoreBefore;
  const still = motionPolicy(session.settings).nonEssentialDistanceFactor === 0;
  const gaugeX = -(L.gauge.nextSize + L.gauge.nextGap) / 2;

  const bar = new HoloBar(scene, gaugeX, L.gauge.y, L.gauge.width, L.gauge.height, { color: DUEL_TIER_COLOR[steps[0]?.tierId ?? "bronze"].fill, outline: true, ticks: 3, trackAlpha: 0.82, shadow: {} }).addTo(block);
  const gaugeLabel = scene.add.text(gaugeX, L.gauge.y, "", textStyle({ role: "display", size: 24, color: COLOR.ink })).setOrigin(0.5).setStroke("#05070a", 5);
  block.add(gaugeLabel);
  let emblem: Phaser.GameObjects.Container | undefined;
  let nextEmblem: Phaser.GameObjects.Container | undefined;
  let nameText: Phaser.GameObjects.Text | undefined;
  let shown: DuelGaugeStep | undefined;

  /** 줄이 바뀌는 순간에만 다시 세운다 — 같은 줄 안의 차오름은 게이지와 점수 글자만 움직인다. */
  const mount = (step: DuelGaugeStep, pop: boolean): void => {
    shown = step;
    const tone = DUEL_TIER_COLOR[step.tierId];
    emblem?.destroy(); nextEmblem?.destroy(); nameText?.destroy();
    emblem = addDuelTierEmblem(scene, block, 0, L.emblem.y, L.emblem.size, step.tierId, step.division);
    nameText = scene.add.text(0, L.name.y, `${t(`duel.tier.${step.tierId}`)} ${duelDivisionNumeral(step.division)}`.trim(), textStyle({ role: "display", size: L.name.size, color: tone.text }))
      .setOrigin(0.5).setShadow(0, 4, "#05070a", 6, false, true);
    block.add(nameText);
    if (!step.top) {
      const next = duelStanding(step.ceil);
      nextEmblem = addDuelTierEmblem(scene, block, gaugeX + L.gauge.width / 2 + L.gauge.nextGap + L.gauge.nextSize / 2, L.gauge.y, L.gauge.nextSize, next.tier.id, next.division);
    }
    if (pop && !still) {
      scene.tweens.add({ targets: [emblem, nameText], scale: { from: 1.3, to: 1 }, duration: 280, ease: "Back.Out" });
    }
  };
  const setRatio = (step: DuelGaugeStep, ratio: number): void => {
    bar.setValue(step.top ? 1 : ratio, DUEL_TIER_COLOR[step.tierId].fill);
    gaugeLabel.setText(step.top ? t("duel.gauge.max") : `${Math.round(step.floor + ratio * (step.ceil - step.floor)).toLocaleString()} / ${step.ceil.toLocaleString()}`);
  };

  // 증감 — 오르면 강조색, 내리면 붉은색. 점수는 경고가 아니라 결과라 크기만 키우고 반짝이지 않는다.
  const gain = delta >= 0;
  const deltaText = scene.add.text(0, L.delta.y, "", textStyle({ role: "display", size: L.delta.size, color: gain ? COLOR.accentText : COLOR.dangerText }))
    .setOrigin(0.5).setShadow(0, 4, "#000000", 6, false, true);
  block.add(deltaText);
  const setDelta = (value: number): void => { deltaText.setText(`${value >= 0 ? "+" : "-"}${Math.abs(Math.round(value))}`); };
  if (result.streakBonus > 0) {
    block.add(scene.add.text(0, L.streak.y, t("duel.result.streak", { streak: result.winStreak, bonus: result.streakBonus }), textStyle({ role: "body", size: L.streak.size, color: COLOR.inkDim })).setOrigin(0.5));
  }

  const last = steps[steps.length - 1];
  const first = steps[0];
  if (!first || !last) return;
  mount(first, false);
  setRatio(first, first.from);
  setDelta(0);
  const finish = (): void => {
    if (!block.active) return;
    if (shown !== last) mount(last, false);
    setRatio(last, last.to);
    setDelta(delta);
  };
  if (still) { finish(); return; }

  const total = steps.reduce((sum, step) => sum + Math.max(L.minStepMs, L.fullStepMs * Math.abs(step.to - step.from)), 0);
  const counter = { value: 0 };
  scene.tweens.add({ targets: counter, value: delta, duration: total, delay: L.startDelayMs, ease: "Sine.Out", onUpdate: () => { if (block.active) setDelta(counter.value); } });
  const run = (index: number): void => {
    if (!block.active) return;
    const step = steps[index];
    if (!step) { finish(); return; }
    if (shown !== step) mount(step, index > 0);
    const ratio = { value: step.from };
    scene.tweens.add({
      targets: ratio, value: step.to, duration: Math.max(L.minStepMs, L.fullStepMs * Math.abs(step.to - step.from)), delay: index === 0 ? L.startDelayMs : 0,
      ease: index === steps.length - 1 ? "Cubic.Out" : "Sine.In",
      onUpdate: () => { if (block.active) setRatio(step, ratio.value); },
      onComplete: () => run(index + 1),
    });
  };
  run(0);
}
