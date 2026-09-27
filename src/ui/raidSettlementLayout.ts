import type { RaidDto } from "../api/contracts";

/**
 * 레이드 정산 창의 자리 — Phaser를 모르는 순수 표.
 *
 * 공용 영수증(`RewardPopup`)은 "무엇을 받았나"만 말한다. 레이드 정산은 **왜 이만큼인가**가 함께
 * 서야 한다 — 받는 몫이 내가 민 만큼이라서다. 그래서 위에서부터 **기여도**(몇 위 · 전체 중 몇 %) →
 * **정산 보상** → **내 점수** 순으로 쌓는다. 모든 y는 창 윗변에서 잰 값이고, 창 높이는 마지막 줄에서
 * 거꾸로 구한다(`raidSettlementHeight`) — 손으로 적으면 줄을 옮길 때마다 아래 여백이 어긋난다.
 */
export const RAID_SETTLEMENT_POPUP = {
  width: 900,
  /** 보스 이름 · 난이도 · 결과 한 줄. 창 윗변의 제목표 아래. */
  head: { y: 82, nameSize: 40, tagSize: 26, gap: 18 },
  contribution: {
    titleY: 150,
    /** 왼쪽: 순위(크게) + 참가 인원. 오른쪽: 내 몫의 백분율과 그 막대. */
    rankY: 232, rankSize: 76, participantsY: 294, participantsSize: 24,
    shareY: 222, shareSize: 56, barY: 280, barWidth: 400, barHeight: 22,
    /** 왼쪽 묶음과 오른쪽 묶음의 가운데(창 가운데 기준 x). */
    leftX: -220, rightX: 170,
  },
  reward: { titleY: 350, frameY: 454, frame: 150, gap: 190 },
  score: { hairlineY: 562, labelY: 606, valueY: 668, labelSize: 26, valueSize: 64 },
  bottomPad: 64,
  /**
   * 「눌러서 닫기」 안내는 창 **바로 아래**에 선다. 공용 영수증처럼 화면 밑동에 두면 레이드 목록의
   * 소환 줄과 겹친다.
   */
  hintBelow: 64,
} as const;

/** 창 높이 — 내 점수 줄의 아래에서 여백만큼. */
export function raidSettlementHeight(): number {
  const { score, bottomPad } = RAID_SETTLEMENT_POPUP;
  return score.valueY + score.valueSize / 2 + bottomPad;
}

/** 창 가운데 기준 y. 표의 y는 윗변 기준이다. */
export function raidSettlementY(fromTop: number): number {
  return fromTop - raidSettlementHeight() / 2;
}

export interface RaidSettlementSummary {
  /** 내 순위. 목록에 내가 없으면(피해 0) 비운다. */
  rank?: number;
  /** 기여 목록에 선 사람 수(나 포함). */
  participants: number;
  /** 판 전체가 깎인 몫 중 내 몫(0~100). */
  sharePercent: number;
  score: number;
}

/**
 * 정산 창이 세울 수. 화면이 다시 계산하지 않도록 서버가 준 판(`RaidDto`)에서 읽기만 한다 — 순위는
 * 기여 목록의 내 줄, 몫은 내 피해 ÷ 판 전체가 깎인 양이다.
 */
export function raidSettlementSummary(raid: Pick<RaidDto, "entries" | "myDamage" | "dealtDamage">): RaidSettlementSummary {
  const mine = raid.entries.find((entry) => entry.isMe);
  const share = raid.dealtDamage > 0 ? Math.min(1, Math.max(0, raid.myDamage / raid.dealtDamage)) : 0;
  return {
    rank: mine?.rank,
    participants: raid.entries.length,
    sharePercent: Math.round(share * 1000) / 10,
    score: Math.max(0, Math.floor(raid.myDamage)),
  };
}
