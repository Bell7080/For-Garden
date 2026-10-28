import Phaser from "phaser";
import { t } from "../i18n";
import { RailButton } from "./RailButton";
import { COLOR, textStyle } from "./theme";

/**
 * 순위·순위 보상 칩 한 벌 — 결투장·아레나·고대 지층·원정이 모두 이 둘을 쓴다.
 *
 * 화면마다 「순위」를 칩으로, 「주간 보상」을 라벨 버튼으로 저마다 세우던 때는 같은 "몇 등이고 무엇을 받나"가
 * 어디서는 왼쪽 아이콘, 어디서는 가운데 글자 버튼이었다. 생김새(크기·아이콘·색)는 여기 한 곳이 갖고,
 * 화면은 **필요한 것만 더한다** — 순위 칩의 내 등수 글, 보상 칩의 기간(주간·월간)·빨간 점 같은 것.
 */

/** 순위 보상의 기간 — 칩 이름과 보상표 제목이 함께 바뀐다. */
export type RankRewardPeriod = "weekly" | "monthly";

/** 칩 한 변. 연구소·고고학의 상점 칩과 같은 크기다. */
export const RANKING_CHIP_SIZE = 104;

/** 순위표 창 안의 보상 칩 자리 — 판 왼쪽 변과 윗변에서 잰 칩 가운데. 결투장·아레나·고대 지층·원정 순위표가 같은 값을 쓴다. */
export const RANKING_POPUP_REWARD_CHIP = { left: 96, top: 82 } as const;

/** 보상 칩 이름 — 보상표 창의 제목도 같은 말을 쓴다. */
export const rankRewardLabel = (period: RankRewardPeriod): string => t(period === "monthly" ? "ranking.reward.monthly" : "ranking.reward.weekly");

export interface RankChipOptions {
  size?: number;
  onClick: () => void;
  /** 칩 오른쪽에 서는 내 등수. 비우면 글을 세우지 않는다(나중에 `setRank`로 채운다). */
  rank?: number | null;
  /** 등수 글의 색 — 화면의 강조색(아레나는 제 색)을 따른다. */
  rankColor?: string;
}

export interface RankChip {
  chip: RailButton;
  /** 내 등수를 다시 적는다. `null`이면 「순위 없음」, `undefined`면 비운다(읽지 못한 자리는 상태 문구로 채우지 않는다). */
  setRank(rank: number | null | undefined): void;
  setDepth(depth: number): RankChip;
}

/** 왼쪽 위 「순위」 칩 + 그 오른쪽의 내 등수. 누르면 그 화면의 순위표가 열린다. */
export function addRankChip(scene: Phaser.Scene, parent: Phaser.GameObjects.Container | null, x: number, y: number, options: RankChipOptions): RankChip {
  const size = options.size ?? RANKING_CHIP_SIZE;
  const chip = new RailButton(scene, x, y, { icon: "ranking", label: t("duel.link.ranking"), size, onClick: options.onClick });
  const text = scene.add.text(x + size / 2 + 18, y, "", textStyle({ role: "display", size: 30, color: options.rankColor ?? COLOR.accentText }))
    .setOrigin(0, 0.5).setStroke("#05070a", 6);
  parent?.add([chip, text]);
  const handle: RankChip = {
    chip,
    setRank(rank) {
      if (!text.active) return;
      text.setText(rank === undefined ? "" : rank === null ? t("duel.rank.none") : t("duel.rank.value", { rank: rank.toLocaleString() }));
    },
    setDepth(depth) { chip.setDepth(depth); text.setDepth(depth); return handle; },
  };
  if (options.rank !== undefined) handle.setRank(options.rank);
  return handle;
}

export interface RankRewardChipOptions {
  period: RankRewardPeriod;
  size?: number;
  onClick: () => void;
}

/**
 * 「주간 보상」·「월간 보상」 칩 — 순위가 마감되면 받는 보상표를 연다. 금빛(`accent`)은 보상을 뜻하는 색이라
 * 순위 칩(회색)과 나란히 서도 "보는 것"과 "받는 것"이 갈린다. 순위표 창 안에서는 왼쪽 위, 화면에서는 순위 칩 아래다.
 */
export function addRankRewardChip(scene: Phaser.Scene, parent: Phaser.GameObjects.Container | null, x: number, y: number, options: RankRewardChipOptions): RailButton {
  const chip = new RailButton(scene, x, y, { icon: "rank-reward", label: rankRewardLabel(options.period), size: options.size ?? RANKING_CHIP_SIZE, accent: true, onClick: options.onClick });
  parent?.add(chip);
  return chip;
}
