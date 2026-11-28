import Phaser from "phaser";
import { bondGaugeSegments, bondLevelForXp } from "../core/bond";
import { motionPolicy } from "../core/settings";
import { session } from "../state/session";
import { drawGlyph } from "./glyphs";
import { HoloBar } from "./holo";
import { COLOR, textStyle } from "./theme";

/**
 * 결과판 SD 이름줄 아래의 **작은 유대 줄** — 이 판이 올린 유대가 차오른다.
 *
 * 연구원 경험치 블록(`PlayerExpGainRow`)과 같은 문법을 작게 줄였다: 하트 + 유대 레벨 수 → 줄.
 * 줄은 판 전 값에서 차오르고, 레벨이 오르면 끝까지 찼다가 비워지며 레벨 수가 튀고 「UP!」이 하트
 * 바로 위에 선다(하트는 이름줄보다 바깥이라 글자와 겹치지 않는다 — 옆에 두면 이웃 SD의 줄을 덮는다). 오른 몫(`+N`)은 줄 오른쪽 끝에 톡 튀어나온다 — 위로 띄우면 이름줄을 덮는다. 판의 주인공은 SD와 보상이라
 * 크게 세우지 않는다. 움직임 줄이기에서는 끝난 모습으로 선다.
 */
export const BOND_GAIN_GAUGE = {
  /** 이름줄 아래 줄의 y(결과판 몸판 기준, SD 바닥선에서 잰다). */
  belowGround: 64,
  heart: 22,
  levelSize: 21,
  bar: { height: 10, side: 64, mvp: 96 },
  gap: 6,
  gainSize: 19,
  upSize: 19,
  startDelayMs: 520,
  fullSegmentMs: 620,
  minSegmentMs: 180,
} as const;

export interface BondGain { beforeXp: number; afterXp: number; }

export function addBondGainGauge(scene: Phaser.Scene, body: Phaser.GameObjects.Container, x: number, y: number, gain: BondGain, mvp: boolean): void {
  const L = BOND_GAIN_GAUGE;
  const row = scene.add.container(x, y);
  body.add(row);
  const barWidth = mvp ? L.bar.mvp : L.bar.side;
  const level = scene.add.text(0, 0, "", textStyle({ role: "display", size: L.levelSize, color: COLOR.bondText })).setOrigin(0, 0.5);
  level.setStroke("#000000", 4);
  const setLevel = (value: number): void => { level.setText(String(value)); };
  setLevel(bondLevelForXp(gain.beforeXp));
  const gainText = scene.add.text(0, 0, `+${(gain.afterXp - gain.beforeXp).toLocaleString()}`, textStyle({ role: "display", size: L.gainSize, color: COLOR.bondText }))
    .setOrigin(0, 0.5).setStroke("#000000", 4);
  // 하트 + 레벨 수 + 줄 + 오른 몫을 한 덩어리로 재서 SD 아래 가운데에 놓는다. 레벨 수 폭은 두 자리 기준으로 잡아 오를 때 줄이 밀리지 않는다.
  const levelWidth = Math.max(level.width, L.levelSize * 1.2);
  const total = L.heart + 4 + levelWidth + L.gap + barWidth + L.gap + gainText.width;
  const left = -total / 2;
  const heartX = left + L.heart / 2;
  row.add(drawGlyph(scene, "heart", heartX, 0, L.heart, COLOR.bond, 0.95));
  level.setX(left + L.heart + 4);
  row.add(level);
  const barX = left + L.heart + 4 + levelWidth + L.gap + barWidth / 2;
  const bar = new HoloBar(scene, barX, 0, barWidth, L.bar.height, { color: COLOR.bond, trackAlpha: 0.85, outline: true, ticks: 4 }).addTo(row);
  gainText.setX(barX + barWidth / 2 + L.gap);
  row.add(gainText);

  const segments = bondGaugeSegments(gain.beforeXp, gain.afterXp);
  const levelsGained = bondLevelForXp(gain.afterXp) - bondLevelForXp(gain.beforeXp);
  bar.setValue(segments[0]?.from ?? 0);
  const still = motionPolicy(session.settings).nonEssentialDistanceFactor === 0;

  let announced = false;
  const announce = (): void => {
    if (announced || levelsGained <= 0) return;
    announced = true;
    const up = scene.add.text(heartX, -L.heart - 2, "UP!", textStyle({ role: "display", size: L.upSize, color: COLOR.bondText })).setOrigin(0.5).setAngle(-6);
    up.setStroke("#3a0a10", 5);
    row.add(up);
    if (still) return;
    up.setScale(0.4);
    scene.tweens.add({ targets: up, scale: 1, duration: 260, ease: "Back.Out" });
    scene.tweens.add({ targets: level, scale: { from: 1.45, to: 1 }, duration: 260, ease: "Back.Out" });
  };
  const finish = (): void => {
    bar.setValue(segments[segments.length - 1]?.to ?? 1);
    setLevel(bondLevelForXp(gain.afterXp));
    announce();
  };
  if (still) { finish(); return; }

  // 오른 몫은 줄이 차오르기 시작하는 순간 톡 튀어나온다.
  gainText.setAlpha(0).setScale(0.5);
  scene.tweens.add({ targets: gainText, alpha: 1, scale: 1, duration: 280, delay: L.startDelayMs, ease: "Back.Out" });

  // 첫 구간의 기다림은 씬 시계가 아니라 트윈의 `delay`다(결과판이 서는 전투 화면은 씬 시계가 멈춘다).
  const run = (index: number): void => {
    if (!row.active) return;
    const segment = segments[index];
    if (!segment) { finish(); return; }
    const counter = { ratio: segment.from };
    const duration = Math.max(L.minSegmentMs, L.fullSegmentMs * Math.abs(segment.to - segment.from));
    scene.tweens.add({
      targets: counter, ratio: segment.to, duration, delay: index === 0 ? L.startDelayMs : 0, ease: index === segments.length - 1 ? "Cubic.Out" : "Sine.In",
      onUpdate: () => { if (row.active) bar.setValue(counter.ratio); },
      onComplete: () => {
        if (!row.active) return;
        const next = segments[index + 1];
        if (next) { setLevel(next.level); announce(); bar.setValue(next.from); }
        run(index + 1);
      },
    });
  };
  run(0);
}
