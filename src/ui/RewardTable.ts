import Phaser from "phaser";
import { t } from "../i18n";
import type { DuelTierId } from "../core/duelArena";
import { addDuelTierEmblem } from "./DuelTierEmblem";
import { DUEL_TIER_COLOR } from "./duelLayout";
import { rankingMedal } from "./expeditionRankingLayout";
import { chipPoints, drawLayer, HOLO, slantedRect } from "./holo";
import { addFramedIcon } from "./itemFrame";
import type { PopupLayer } from "./PopupLayer";
import { REWARD_TABLE, rankBandLabel, rewardTablePlacement, rewardTableRewardX, rewardTableRowMetrics } from "./rewardTableLayout";
import { addSectionTitle } from "./SectionTitle";
import { squeezeTextToWidth } from "./textFit";
import { COLOR, textStyle } from "./theme";

/**
 * 보상표 창 한 장 — 주간 순위 보상(원정·결투장·아레나)과 티어 보상(결투장 시즌·아레나 주간)이 같은 양식을 쓴다.
 *
 * 위에서부터 **규칙 판**(마감·지급 조건) → (섹션 제목표) → 줄이다. 줄 하나는 왼쪽의 표식(티어 휘장 또는 순위 판),
 * 가운데의 이름·부가 줄, 오른쪽 끝에서 쌓이는 **보상 액자**다 — 보상을 「휘장 100 · 젬 150」처럼 글로 적던 때는
 * 같은 재화가 다른 화면에서는 액자로, 여기서만 문장으로 섰다. 내 자리 줄은 한 뼘 밝고 「현재」 표식을 단다.
 * 자리는 순수 배치표(`rewardTableLayout.ts`)가 갖는다.
 */
export type RewardTableBadge =
  | { kind: "tier"; tier: DuelTierId }
  | { kind: "rank"; from: number; upTo: number | null };

export interface RewardTableRow {
  badge: RewardTableBadge;
  title: string;
  sub?: string;
  subColor?: string;
  /** 오른쪽부터 쌓는다 — 가장 무거운 보상을 맨 앞에 둔다. */
  rewards: readonly { texture: string; amount: number }[];
  current?: boolean;
}

export interface RewardTableSpec {
  title: string;
  rules: string;
  sections: readonly { title?: string; rows: readonly RewardTableRow[] }[];
  compact?: boolean;
}

export function openRewardTable(scene: Phaser.Scene, popups: PopupLayer, spec: RewardTableSpec): void {
  const placement = rewardTablePlacement({ compact: spec.compact, sections: spec.sections.map((entry) => ({ rows: entry.rows.length, titled: Boolean(entry.title) })) });
  const { rowHeight } = rewardTableRowMetrics(spec.compact);
  popups.open({ width: REWARD_TABLE.width, height: placement.height, title: spec.title, dim: true, closeOnBackdrop: true }, (body) => {
    // 규칙 판 — 언제 마감하고 누가 받는지. 줄보다 옅은 유리 위에 흐린 글로 선다.
    body.add(drawLayer(scene, 0, placement.rulesY, chipPoints(REWARD_TABLE.rowWidth, REWARD_TABLE.rules.height, { bevel: 18 }), { fill: 0x0b1016, alpha: 0.72, shadow: false }));
    body.add(scene.add.text(0, placement.rulesY, spec.rules, textStyle({ role: "body", size: 24, color: COLOR.inkDim, wrap: REWARD_TABLE.rowWidth - 80, align: "center" })).setOrigin(0.5));
    spec.sections.forEach((section, sectionIndex) => {
      const place = placement.sections[sectionIndex];
      if (section.title && place.titleY !== null) addSectionTitle(scene, -REWARD_TABLE.rowWidth / 2, place.titleY, section.title, { size: 28, parent: body });
      section.rows.forEach((row, index) => paintRow(scene, body, place.rowYs[index], rowHeight, row));
    });
  });
}

function paintRow(scene: Phaser.Scene, parent: Phaser.GameObjects.Container, y: number, height: number, row: RewardTableRow): void {
  const tone = row.badge.kind === "tier" ? DUEL_TIER_COLOR[row.badge.tier] : undefined;
  const medal = row.badge.kind === "rank" && row.badge.upTo === row.badge.from ? rankingMedal(row.badge.from) : undefined;
  const accent = tone?.fill ?? medal?.edge ?? COLOR.panelEdge;
  const holder = scene.add.container(0, y);
  parent.add(holder);
  holder.add(drawLayer(scene, 0, 0, chipPoints(REWARD_TABLE.rowWidth, height), {
    fill: row.current ? 0x263844 : medal?.fill ?? 0x151b23,
    alpha: HOLO.glass,
    edge: row.current ? COLOR.accent : accent,
    edgeAlpha: row.current ? 0.95 : tone || medal ? 0.55 : 0.25,
    glow: row.current ? { color: COLOR.accent, strength: 0.22, height: 0.75 } : medal ? { color: medal.edge, strength: 0.16, height: 0.6 } : undefined,
  }));

  const badgeSize = Math.round(height * 0.72);
  if (row.badge.kind === "tier") {
    addDuelTierEmblem(scene, holder, REWARD_TABLE.badgeX, 0, badgeSize, row.badge.tier);
  } else {
    // 순위 판 — 1·2·3등만 금·은·동, 구간은 같은 판에 흐린 테두리다.
    const plate = { width: 118, height: Math.round(height * 0.6) };
    holder.add(drawLayer(scene, REWARD_TABLE.badgeX, 0, slantedRect(plate.width, plate.height, 12), {
      fill: medal?.fill ?? 0x0b1016, alpha: 0.95, edge: medal?.edge ?? COLOR.panelEdge, edgeAlpha: medal ? 0.95 : 0.6, shadow: false,
    }));
    const label = rankBandLabel(row.badge.from, row.badge.upTo);
    holder.add(squeezeTextToWidth(scene.add.text(REWARD_TABLE.badgeX, 0, label, textStyle({ role: "display", size: medal ? 36 : 30, color: medal?.text ?? COLOR.ink })).setOrigin(0.5), plate.width - 16));
  }

  const textWidth = rewardTableRewardX(row.rewards.length - 1) - REWARD_TABLE.reward.size / 2 - 20 - REWARD_TABLE.textX;
  const titleColor = row.current ? COLOR.accentText : tone?.text ?? medal?.text ?? COLOR.ink;
  holder.add(squeezeTextToWidth(scene.add.text(REWARD_TABLE.textX, row.sub ? -height * 0.17 : 0, row.title, textStyle({ role: "display", size: 30, color: titleColor })).setOrigin(0, 0.5), textWidth));
  if (row.sub) holder.add(squeezeTextToWidth(scene.add.text(REWARD_TABLE.textX, height * 0.2, row.sub, textStyle({ role: "body", size: 22, color: row.subColor ?? COLOR.inkDim })).setOrigin(0, 0.5), textWidth));

  const frame = Math.min(REWARD_TABLE.reward.size, height - 20);
  row.rewards.forEach((reward, index) => {
    addFramedIcon(scene, holder, rewardTableRewardX(index), 0, frame, reward.texture, { amount: reward.amount.toLocaleString() });
  });

  if (row.current) {
    // 「현재」 표식은 줄의 왼쪽 위 모서리에 걸터앉는다 — 판과 같은 방향(왼쪽 위·오른쪽 아래)으로만 깎는다.
    const tag = REWARD_TABLE.currentTag;
    const x = -REWARD_TABLE.rowWidth / 2 + tag.width / 2 + 26;
    const tagY = -height / 2;
    holder.add(drawLayer(scene, x, tagY, chipPoints(tag.width, tag.height, { bevel: { topLeft: 10, bottomRight: 10 } }), { fill: COLOR.accent, alpha: 0.96, shadow: false }));
    holder.add(scene.add.text(x, tagY, t("rewardTable.current"), textStyle({ role: "emphasis", size: 20, color: "#05070a" })).setOrigin(0.5));
  }
}
