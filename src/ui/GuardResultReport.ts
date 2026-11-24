import Phaser from "phaser";
import { t } from "../i18n";
import type { GuardReport, GuardReportStat } from "../core/guildGuardReport";
import { motionPolicy } from "../core/settings";
import { settingsManager } from "../managers/SettingsManager";
import { chipPoints, drawLayer, HoloBar } from "./holo";
import { rankingMedal } from "./expeditionRankingLayout";
import { squeezeTextToWidth } from "./textFit";
import { COLOR, textStyle } from "./theme";
import { GUARD_REPORT_LAYOUT, guardReportRowY } from "./guardResultReportLayout";

/** 막대 색 — 점수는 강조색, 웨이브는 푸른빛, 처치는 붉은빛. 셋이 같은 색이면 어느 막대가 무엇인지 글자를 읽어야 안다. */
const STAT_TONE: Record<GuardReportStat["key"], number> = { score: COLOR.accent, wave: COLOR.exchange, kills: 0xd9725f };
/** 순위 줄 막대 — 나는 강조색, 남은 옅은 회색. */
const ROW_TONE = { me: COLOR.accent, other: 0x8b96a6 } as const;
/** 막대가 차오르는 박자. 판이 뜬 뒤 한 박자 쉬고 줄마다 조금씩 어긋난다. */
const GROW = { delayMs: 260, staggerMs: 120, durationMs: 720 } as const;

/**
 * 수호전 결과판의 **성적 블록** — 점수 · 웨이브 · 처치가 저마다 막대로 서고, 그 아래 오늘 길드원 순위가 같은 문법의
 * 막대 줄로 선다(2026-11-24 응태 요청). 값과 몫은 `buildGuardReport`가 정하고 여기서는 그리기만 한다.
 */
export function addGuardResultReport(scene: Phaser.Scene, body: Phaser.GameObjects.Container, report: GuardReport): void {
  const still = motionPolicy(settingsManager.get()).nonEssentialRepeatFactor === 0;
  const grow = (bar: HoloBar, fill: number, order: number): void => {
    if (still || fill <= 0) { bar.setValue(fill); return; }
    bar.setValue(0);
    scene.tweens.addCounter({
      from: 0, to: fill, duration: GROW.durationMs, delay: GROW.delayMs + order * GROW.staggerMs, ease: "Cubic.Out",
      onUpdate: (tween) => { bar.setValue(tween.getValue() ?? fill); },
    });
  };

  const S = GUARD_REPORT_LAYOUT.stats;
  report.stats.forEach((stat, index) => {
    const x = (index - 1) * S.cellGap;
    body.add(scene.add.text(x, S.y + S.labelDy, t(`guild.guard.report.${stat.key}`), textStyle({ role: "body", size: S.labelSize, color: COLOR.inkDim })).setOrigin(0.5));
    const value = scene.add.text(x, S.y + S.valueDy, stat.value.toLocaleString(), textStyle({ role: "display", size: S.valueSize, color: COLOR.ink })).setOrigin(0.5);
    value.setStroke("#000000", 6).setShadow(0, 4, "#000000", 4, false, true);
    body.add(squeezeTextToWidth(value, S.barWidth));
    const bar = new HoloBar(scene, x, S.y + S.barDy, S.barWidth, S.barHeight, { color: STAT_TONE[stat.key], trackAlpha: 0.82, outline: true, ticks: stat.ticks, glow: { spread: 6, alpha: 0.2 } }).addTo(body);
    grow(bar, stat.fill, index);
    const caption = statCaption(stat, report);
    if (caption) {
      const line = scene.add.text(x, S.y + S.captionDy, caption.text, caption.strong
        ? textStyle({ role: "emphasis", size: S.captionSize, color: COLOR.accentText })
        : textStyle({ role: "body", size: S.captionSize, color: COLOR.inkDim })).setOrigin(0.5);
      if (caption.strong) line.setStroke("#000000", 4);
      body.add(squeezeTextToWidth(line, S.barWidth + 30));
    }
  });

  if (report.rows.length === 0) return;
  const R = GUARD_REPORT_LAYOUT.ranking;
  const header = scene.add.text(R.left, R.headerY, `/ ${t("guild.guard.report.ranking")}`, textStyle({ role: "emphasis", size: R.headerSize, color: COLOR.accentText })).setOrigin(0, 0.5);
  body.add(header);
  if (report.guildRank !== null) {
    body.add(scene.add.text(R.right, R.headerY, t("guild.guard.report.guildRank", { rank: report.guildRank }), textStyle({ role: "emphasis", size: R.headerSize, color: COLOR.ink })).setOrigin(1, 0.5));
  }
  const barWidth = R.barRight - R.barLeft;
  report.rows.forEach((row, index) => {
    const y = guardReportRowY(index);
    if (row.isMe) {
      // 내 줄만 옅은 띠를 깐다 — 테두리 없이 면 한 장(판 안 강조의 공용 문법).
      const width = R.right - R.left + 24;
      body.add(drawLayer(scene, (R.left + R.right) / 2, y, chipPoints(width, R.rowHeight + 4, { bevel: { topLeft: 10, bottomRight: 10 } }), { fill: COLOR.accent, alpha: 0.16, shadow: false }));
    }
    const medal = rankingMedal(row.rank);
    body.add(scene.add.text(R.rankX, y, t("guild.guard.result.rank", { rank: row.rank }), textStyle({ role: "display", size: R.rowSize, color: medal?.text ?? COLOR.inkDim })).setOrigin(0.5));
    const name = scene.add.text(R.nameX, y, row.name, row.isMe
      ? textStyle({ role: "emphasis", size: R.rowSize, color: COLOR.accentText })
      : textStyle({ role: "body", size: R.rowSize, color: COLOR.ink })).setOrigin(0, 0.5);
    body.add(squeezeTextToWidth(name, R.nameWidth - (row.climbed > 0 ? 44 : 0)));
    if (row.climbed > 0) {
      body.add(scene.add.text(R.nameX + Math.min(name.displayWidth, R.nameWidth - 44) + 8, y, `▲${row.climbed}`, textStyle({ role: "emphasis", size: R.rowSize - 2, color: "#8fdc8a" })).setOrigin(0, 0.5));
    }
    const bar = new HoloBar(scene, R.barLeft + barWidth / 2, y, barWidth, R.barHeight, { color: row.isMe ? ROW_TONE.me : ROW_TONE.other, trackAlpha: 0.7 }).addTo(body);
    grow(bar, row.fill, report.stats.length + index);
    body.add(scene.add.text(R.right, y, row.score.toLocaleString(), textStyle({ role: "display", size: R.rowSize, color: row.isMe ? COLOR.accentText : COLOR.ink })).setOrigin(1, 0.5));
  });
}

/** 막대 아래 곁말 한 줄 — 점수는 최고 기록 여부, 웨이브는 마지막 웨이브의 적 레벨, 처치는 들어온 적 중 몇 %인가. */
function statCaption(stat: GuardReportStat, report: GuardReport): { text: string; strong: boolean } | undefined {
  switch (stat.key) {
    case "score":
      if (report.newBest) return { text: t("guild.guard.report.newBest"), strong: true };
      return report.best > 0 ? { text: t("guild.guard.report.todayBest", { score: report.best.toLocaleString() }), strong: false } : undefined;
    case "wave":
      return report.waveLevel > 0 ? { text: t("guild.guard.report.waveLevel", { level: report.waveLevel }), strong: false } : undefined;
    case "kills":
      return report.spawned > 0 ? { text: t("guild.guard.report.killRate", { percent: Math.round(stat.fill * 100) }), strong: false } : undefined;
  }
}
