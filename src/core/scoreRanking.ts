/**
 * 보스전 점수 랭킹 — 레이드(기여 피해)와 원정 폰토스(주간 최고 점수)가 같이 쓰는 순수 규칙이다.
 *
 * 순위는 「나보다 점수가 **많은** 사람 수 + 1」이다 — 같은 값은 앞지른 것이 아니다(`guildRace`와 같은 약속).
 * 화면은 이 값을 그리기만 하고 순위를 다시 세지 않는다.
 */
export interface ScoreRankPeer {
  id: string; name: string; score: number;
  /** 줄의 얼굴 — 프로필 사진·테두리, 사진이 없으면 공개된 애착 렐릭, 그것도 없으면 이름 첫 글자가 선다. */
  avatarRelicId?: string | null; frameId?: string | null; favoriteRelicId?: string;
}
export interface ScoreRankRow extends ScoreRankPeer {
  rank: number;
  isMe: boolean;
  /** 창 밖에서 맨 위에 붙박은 1위 줄 — 바로 아래 줄과 이어지지 않는다는 것을 화면이 틈으로 말한다. */
  pinned?: boolean;
}
export interface ScoreRankingView { rows: ScoreRankRow[]; myRank: number; participants: number }

/**
 * 내 위로 둘, 아래로 하나 — 난전을 가리지 않는 작은 띠에 서는 이웃의 수.
 *
 * **1위는 늘 선다.** 창이 1위에 닿지 않으면 맨 위 이웃 자리를 1위가 대신 맡는다 — 줄 수는 그대로이고,
 * 「누가 꼭대기에 있나」가 내 순위와 무관하게 읽힌다.
 */
export const SCORE_RANK_WINDOW = { above: 2, below: 1 } as const;
/** 내 줄의 고정 ID — 점수가 올라도 같은 줄로 남아야 위로 올라가는 모습이 이어진다. */
export const SCORE_RANK_ME_ID = "__me__";

const rankOf = (peers: readonly ScoreRankPeer[], score: number): number => 1 + peers.filter((peer) => peer.score > score).length;

export function scoreRankingView(peers: readonly ScoreRankPeer[], myName: string, myScore: number, window: { above: number; below: number } = SCORE_RANK_WINDOW): ScoreRankingView {
  const sorted = [...peers].sort((a, b) => b.score - a.score);
  const myRank = rankOf(sorted, myScore);
  const meIndex = sorted.filter((peer) => peer.score >= myScore).length;
  const list: ScoreRankRow[] = [
    ...sorted.slice(0, meIndex).map((peer) => ({ ...peer, rank: rankOf(sorted, peer.score) + (myScore > peer.score ? 1 : 0), isMe: false })),
    { id: SCORE_RANK_ME_ID, name: myName, score: myScore, rank: myRank, isMe: true },
    ...sorted.slice(meIndex).map((peer) => ({ ...peer, rank: rankOf(sorted, peer.score) + (myScore > peer.score ? 1 : 0), isMe: false })),
  ];
  const from = Math.max(0, meIndex - window.above);
  const to = Math.min(list.length, meIndex + 1 + window.below);
  const rows = from > 0 ? [{ ...list[0], pinned: true }, ...list.slice(from + 1, to)] : list.slice(from, to);
  return { rows, myRank, participants: list.length };
}

/**
 * 순위가 `from`에서 `to`까지 오르는 동안 화면에 찍을 숫자들(큰 순위 → 작은 순위).
 * 사람이 수백이면 한 칸씩 찍지 않고 `maxFrames` 이하로 고르게 건너뛴다 — 끝 값은 늘 `to`다.
 */
export function rankClimbFrames(from: number, to: number, maxFrames = 12): number[] {
  const start = Math.max(1, Math.round(from));
  const end = Math.max(1, Math.round(to));
  if (start <= end) return [end];
  const span = start - end;
  const count = Math.min(span, Math.max(1, maxFrames - 1));
  const frames: number[] = [start];
  for (let i = 1; i <= count; i += 1) frames.push(Math.round(start - (span * i) / count));
  return frames.filter((rank, index) => index === 0 || rank !== frames[index - 1]);
}
