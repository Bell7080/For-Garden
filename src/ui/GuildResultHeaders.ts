import Phaser from "phaser";
import type { GuildBadge } from "../core/guildBadge";
import type { GuildWarResultView } from "../api/guildContracts";
import { t } from "../i18n";
import { COLOR, textStyle } from "./theme";
import { chipPoints, drawLayer, drawHairline } from "./holo";
import { addGuildBadge } from "./GuildBadge";
import { rankingMedal } from "./expeditionRankingLayout";
import { squeezeTextToWidth } from "./textFit";
import { drawGlyph } from "./glyphs";
import type { RewardPopupHeader } from "./RewardPopup";

/**
 * 길드 결과 영수증의 머리 블록 — 길드전 대치 · 수호전 순위 메달 · 길드 레벨 판.
 *
 * 결과를 문장 한 줄로 적던 때는 승패·점수·받은 코인이 같은 무게의 글자라 무엇을 받았는지 먼저 읽히지 않았다.
 * 결과는 머리 블록이 그림으로 말하고, 받은 것은 영수증 줄의 액자가 말한다(`openRewardPopup`의 `header`).
 */

/** 결과 도장의 색 — 승리 호박 · 패배 다홍 · 부전승 하늘 · 기권 회색. */
const OUTCOME_TONE: Record<GuildWarResultView["outcome"], { fill: number; text: string }> = {
  win: { fill: COLOR.raritySSR, text: "#ffd98a" },
  loss: { fill: COLOR.danger, text: "#ff9a8a" },
  bye: { fill: COLOR.exchange, text: COLOR.exchangeText },
  forfeit: { fill: COLOR.inkDimHex, text: COLOR.inkDim },
};

/** 상대 길드의 문장은 결과에 실려 오지 않으므로 같은 자리에 회색 방패 실루엣을 세운다. */
const UNKNOWN_BADGE: GuildBadge = { shape: "shield", shapeColor: "ink", icon: "sword", iconColor: "silver" };

const WAR = { height: 400, badge: 128, sideX: 300, rowY: 46, nameY: 140, nameWidth: 230, stampY: -128, score: { big: 84, small: 52, width: 176 } } as const;

/** 도장 한 장 — 결과 낱말이 비스듬한 판 위에 크게 박힌다. 쾅 내려앉는 연출은 움직임 줄이기에서 생략한다. */
function addOutcomeStamp(scene: Phaser.Scene, body: Phaser.GameObjects.Container, y: number, label: string, tone: { fill: number; text: string }, reduced: boolean): void {
  const stamp = scene.add.container(0, y);
  const word = scene.add.text(0, 0, label, textStyle({ role: "display", size: 76, color: tone.text })).setOrigin(0.5).setStroke("#0a0e14", 10).setShadow(0, 6, "#000000", 6, false, true);
  const width = Math.max(300, word.width + 120);
  stamp.add(drawLayer(scene, 0, 0, chipPoints(width, 112, { bevel: { topLeft: 26, bottomRight: 26 } }), { fill: tone.fill, alpha: 0.22, edge: tone.fill, edgeWidth: 5 }));
  stamp.add(word);
  stamp.setAngle(-4);
  body.add(stamp);
  if (reduced) return;
  stamp.setScale(1.7).setAlpha(0);
  scene.tweens.add({ targets: stamp, scale: 1, alpha: 1, duration: 280, delay: 120, ease: "Back.Out" });
}

/** 길드 한 편 — 문장과 이름. 이름은 칸 폭을 넘으면 가로로만 누른다. */
function addSide(scene: Phaser.Scene, body: Phaser.GameObjects.Container, x: number, y: number, badge: GuildBadge, name: string, dim: boolean, lit?: number): void {
  // 이긴 쪽 문장 뒤에 그 판의 색으로 은은한 빛무리가 번진다 — 문장이 「불이 켜진」 쪽으로 읽힌다.
  if (lit !== undefined) {
    const glow = scene.add.graphics();
    for (let i = 0; i < 4; i += 1) {
      const r = WAR.badge * (0.92 - i * 0.14);
      glow.fillStyle(lit, 0.1 + i * 0.04);
      glow.fillPoints([new Phaser.Geom.Point(x, y - r), new Phaser.Geom.Point(x + r * 0.9, y), new Phaser.Geom.Point(x, y + r), new Phaser.Geom.Point(x - r * 0.9, y)], true);
    }
    body.add(glow);
  }
  const view = addGuildBadge(scene, body, x, y, badge, WAR.badge);
  if (dim) view.setAlpha(0.55);
  const label = scene.add.text(x, y + WAR.nameY - WAR.rowY, name, textStyle({ role: "emphasis", size: 28, color: dim ? COLOR.inkDim : COLOR.ink })).setOrigin(0.5).setShadow(0, 3, "#000000", 4, false, true);
  squeezeTextToWidth(label, WAR.nameWidth);
  body.add(label);
}

/** 길드전 결과 — 도장 → 두 길드가 마주 보는 점수 대치 → 길드전 점수 증감. */
export function guildWarResultHeader(scene: Phaser.Scene, mine: { name: string; badge: GuildBadge }, result: GuildWarResultView): RewardPopupHeader {
  return {
    height: WAR.height,
    draw: (body, cy, reduced) => {
      const tone = OUTCOME_TONE[result.outcome];
      addOutcomeStamp(scene, body, cy + WAR.stampY, t(`guild.war.result.${result.outcome}`), tone, reduced);
      const rowY = cy + WAR.rowY;
      const won = result.outcome === "win" || result.outcome === "bye";
      // 이긴 쪽의 문장에 불이 켜지고 진 쪽이 가라앉는다 — 상대가 이긴 판에서 우리 문장만 밝으면 결과와 어긋난다.
      const theirsLit = result.outcome === "loss";
      addSide(scene, body, -WAR.sideX, rowY, mine.badge, mine.name, theirsLit, result.outcome === "win" ? COLOR.hpFill : undefined);
      addSide(scene, body, WAR.sideX, rowY, UNKNOWN_BADGE, result.opponentName ?? t("guild.war.result.noOpponent"), !theirsLit, theirsLit ? 0xe05a4a : undefined);
      // 점수 대치 — 이긴 쪽의 수가 크게 선다. 우리가 이기면 우리 수가 초록, 상대가 이기면 상대 수가 붉다. 진 쪽은 작고 흐리다.
      const mineWins = result.outcome === "win";
      const theirsWin = result.outcome === "loss";
      const big = WAR.score.big;
      const small = WAR.score.small;
      const mineText = scene.add.text(-20, rowY - 10, result.myPoints.toLocaleString(), textStyle({ role: "display", size: mineWins ? big : small, color: mineWins ? COLOR.hpText : won ? tone.text : COLOR.inkDim })).setOrigin(1, 0.5).setStroke("#0a0e14", 8);
      const colon = scene.add.text(0, rowY - 14, ":", textStyle({ role: "display", size: 56, color: COLOR.accentText })).setOrigin(0.5);
      const theirsText = scene.add.text(20, rowY - 10, result.theirPoints.toLocaleString(), textStyle({ role: "display", size: theirsWin ? big : small, color: theirsWin ? COLOR.dangerText : COLOR.inkDim })).setOrigin(0, 0.5).setStroke("#0a0e14", 8);
      if (mineWins) mineText.setShadow(0, 0, COLOR.hpText, 14, true, true);
      if (theirsWin) theirsText.setShadow(0, 0, COLOR.dangerText, 14, true, true);
      squeezeTextToWidth(mineText, WAR.score.width);
      squeezeTextToWidth(theirsText, WAR.score.width);
      body.add([mineText, colon, theirsText]);
      // 길드전 점수 증감은 지갑에 들어오는 재화가 아니므로 액자가 아니라 칩 한 장이다.
      const up = result.delta >= 0;
      const deltaLabel = t("guild.war.result.delta", { delta: `${up ? "+" : ""}${result.delta.toLocaleString()}` });
      const chipY = rowY + 78;
      const chipText = scene.add.text(0, chipY, deltaLabel, textStyle({ role: "emphasis", size: 26, color: up ? COLOR.hpText : COLOR.dangerText })).setOrigin(0.5);
      const chipWidth = Math.min(340, chipText.width + 56);
      body.add(drawLayer(scene, 0, chipY, chipPoints(chipWidth, 50, { bevel: { topLeft: 12, bottomRight: 12 } }), { fill: 0x0a0e14, alpha: 0.7, shadow: false, edge: up ? COLOR.hpFill : COLOR.danger }));
      squeezeTextToWidth(chipText, chipWidth - 30);
      body.add(chipText);
    },
  };
}

const GUARD = { height: 300, plate: { width: 360, height: 210 } } as const;

/** 수호전 순위 보상 — 금·은·동(4위부터 회색) 메달 판에 순위가 크게 선다. */
export function guildGuardRewardHeader(scene: Phaser.Scene, rank: number): RewardPopupHeader {
  return {
    height: GUARD.height,
    draw: (body, cy, reduced) => {
      const medal = rankingMedal(rank);
      const fill = medal?.fill ?? 0x1c232d;
      const edge = medal?.edge ?? COLOR.inkDimHex;
      const plate = scene.add.container(0, cy);
      plate.add(drawLayer(scene, 0, 0, chipPoints(GUARD.plate.width, GUARD.plate.height, { bevel: { topLeft: 34, bottomRight: 34 } }), { fill, alpha: 0.92, edge, edgeWidth: 5, glow: { color: edge, strength: 0.4 } }));
      plate.add(scene.add.text(0, -58, t("guild.guard.result.label"), textStyle({ role: "emphasis", size: 26, color: COLOR.inkDim })).setOrigin(0.5));
      const rankText = scene.add.text(0, 22, t("guild.guard.result.rank", { rank: rank.toLocaleString() }), textStyle({ role: "display", size: 96, color: medal?.text ?? COLOR.ink })).setOrigin(0.5).setStroke("#0a0e14", 10).setShadow(0, 6, "#000000", 6, false, true);
      squeezeTextToWidth(rankText, GUARD.plate.width - 50);
      plate.add(rankText);
      body.add(plate);
      if (reduced) return;
      plate.setScale(0.6).setAlpha(0);
      scene.tweens.add({ targets: plate, scale: 1, alpha: 1, duration: 320, ease: "Back.Out" });
    },
  };
}

const LEVEL = { badge: { width: 300, height: 150 }, rowHeight: 64, rowGap: 12, rowWidth: 720, listTop: 150 } as const;

/** 길드 레벨 업 — 레벨 판이 앞 레벨에서 새 레벨로 넘어가고, 새로 열리거나 커진 혜택이 줄 판으로 쌓인다. */
export function guildLevelUpHeader(scene: Phaser.Scene, from: number, to: number, gained: readonly string[]): RewardPopupHeader {
  const listHeight = gained.length > 0 ? 56 + gained.length * (LEVEL.rowHeight + LEVEL.rowGap) : 0;
  const height = LEVEL.listTop + listHeight;
  return {
    height,
    draw: (body, cy, reduced) => {
      const top = cy - height / 2;
      const badgeY = top + LEVEL.badge.height / 2 - 10;
      body.add(drawLayer(scene, 0, badgeY, chipPoints(LEVEL.badge.width, LEVEL.badge.height - 30, { bevel: { topLeft: 26, bottomRight: 26 } }), { fill: 0x2a2416, alpha: 0.92, edge: COLOR.accent, edgeWidth: 4, glow: { color: COLOR.accent, strength: 0.35 } }));
      const before = scene.add.text(-70, badgeY, `LV.${from}`, textStyle({ role: "display", size: 34, color: COLOR.inkDim })).setOrigin(0.5);
      const arrow = drawGlyph(scene, "page-next", -6, badgeY, 30, COLOR.accent);
      const after = scene.add.text(70, badgeY, `LV.${to}`, textStyle({ role: "display", size: 52, color: COLOR.accentText })).setOrigin(0.5).setStroke("#0a0e14", 8);
      body.add([before, arrow, after]);
      if (!reduced) {
        after.setScale(1.6).setAlpha(0);
        scene.tweens.add({ targets: after, scale: 1, alpha: 1, duration: 300, delay: 200, ease: "Back.Out" });
      }
      if (gained.length === 0) return;
      const listTop = top + LEVEL.listTop;
      body.add(drawHairline(scene, 0, listTop - 6, LEVEL.rowWidth, { color: COLOR.accent, alpha: 0.35 }));
      body.add(scene.add.text(-LEVEL.rowWidth / 2, listTop + 22, t("guild.levelUp.gained"), textStyle({ role: "emphasis", size: 24, color: COLOR.accentText })).setOrigin(0, 0.5));
      gained.forEach((line, index) => {
        const y = listTop + 56 + index * (LEVEL.rowHeight + LEVEL.rowGap) + LEVEL.rowHeight / 2;
        const row = scene.add.container(0, y);
        row.add(drawLayer(scene, 0, 0, chipPoints(LEVEL.rowWidth, LEVEL.rowHeight, { bevel: { topLeft: 14, bottomRight: 14 } }), { fill: 0x0f141b, alpha: 0.78, shadow: false }));
        row.add(drawGlyph(scene, "check", -LEVEL.rowWidth / 2 + 40, 0, 30, COLOR.hpFill));
        const text = scene.add.text(-LEVEL.rowWidth / 2 + 76, 0, line, textStyle({ role: "body", size: 26, color: COLOR.ink })).setOrigin(0, 0.5);
        squeezeTextToWidth(text, LEVEL.rowWidth - 100);
        row.add(text);
        body.add(row);
        if (reduced) return;
        row.setAlpha(0).setX(-30);
        scene.tweens.add({ targets: row, alpha: 1, x: 0, duration: 240, delay: 360 + index * 70, ease: "Cubic.Out" });
      });
    },
  };
}
