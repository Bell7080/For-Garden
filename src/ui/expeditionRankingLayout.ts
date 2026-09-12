import type { ExpeditionLeaderboardEntry } from "../api/contracts";
import type { TextKey } from "../i18n";

/**
 * 원정 주간 기록 순위표의 **순수 규칙** — 자리, 메달, 그리고 아직 없는 이용자 풀을 채우는 표본.
 *
 * Phaser 없이 읽히는 값만 둔다. 줄이 판 안에 드는지, 100등까지 흐르는 길이가 맞는지, 금·은·동이
 * 1·2·3등에만 붙는지를 화면을 띄우지 않고 테스트로 고정하기 위해서다.
 */

/** 순위표가 한 번에 보여 주는 최대 등수. 아래로 내려 여기까지 읽는다. */
export const RANKING_VISIBLE_RANKS = 100;

/** 줄 하나와 스크롤 창의 자리. `y`는 팝업 가운데가 0인 로컬 좌표다. */
export const RANKING_LIST = {
  rowWidth: 860,
  rowHeight: 104,
  rowGap: 14,
  /** 목록이 흐르는 창. 제목·부제 아래에서 시작해 판 아래 여백 위에서 끝난다. */
  viewport: { top: -640, bottom: 742 },
  /** 줄 안의 자리 — 등수, 얼굴, 이름, 점수. */
  rankX: -386,
  faceX: -286,
  faceSize: 82,
  nameX: -216,
  scoreX: 392,
} as const;

/**
 * 1·2·3등의 금·은·동.
 *
 * **등수를 숫자로만 두지 않는다.** 순위표에서 가장 먼저 읽히는 것은 "누가 위에 있나"이고,
 * 그 셋만 색을 가지면 나머지 줄을 세지 않고도 단에 오른 사람이 보인다. 색은 등급 보석
 * (`RARITY_GEM`)과 같은 결의 금·은·동 한 쌍씩이며, 그 아래 줄은 지금까지의 회색 그대로다.
 */
export const RANKING_MEDALS = [
  { rank: 1, fill: 0x3a2f16, edge: 0xe8c25a, text: "#f5d98a", label: "ranking.medal.1" },
  { rank: 2, fill: 0x2b2f36, edge: 0xc3ccd6, text: "#dfe6ee", label: "ranking.medal.2" },
  { rank: 3, fill: 0x33251b, edge: 0xc08652, text: "#e0a274", label: "ranking.medal.3" },
] as const satisfies ReadonlyArray<{ rank: number; fill: number; edge: number; text: string; label: TextKey }>;

export type RankingMedal = (typeof RANKING_MEDALS)[number];

/** 그 등수의 메달. 4등부터는 없다. */
export function rankingMedal(rank: number): RankingMedal | undefined {
  return RANKING_MEDALS.find((medal) => medal.rank === rank);
}

/** 줄 `index`(0부터)의 중심 y. 목록 컨테이너 안의 좌표다. */
export function rankingRowY(index: number): number {
  return index * (RANKING_LIST.rowHeight + RANKING_LIST.rowGap) + RANKING_LIST.rowHeight / 2;
}

export interface RankingScrollMetrics {
  /** 창의 높이와 중심. 마스크와 입력면이 같은 값을 쓴다. */
  viewportHeight: number;
  viewportCenterY: number;
  /** 목록 컨테이너가 처음 서는 y. */
  startY: number;
  /** 끌어 올릴 수 있는 한계(음수). 마지막 줄이 창 아래에 닿으면 멈춘다. */
  minY: number;
}

/** 줄 수에서 창 크기와 스크롤 한계를 구한다. 줄이 적으면 아예 움직이지 않는다. */
export function rankingScrollMetrics(rows: number): RankingScrollMetrics {
  const { viewport, rowHeight, rowGap } = RANKING_LIST;
  const viewportHeight = viewport.bottom - viewport.top;
  const content = Math.max(0, rows) * (rowHeight + rowGap) - (rows > 0 ? rowGap : 0);
  return {
    viewportHeight,
    viewportCenterY: (viewport.top + viewport.bottom) / 2,
    startY: viewport.top,
    minY: Math.min(0, viewportHeight - content),
  };
}

/**
 * 아직 실제 이용자 풀이 없는 단일 계정 서버라, 순위표가 늘 여럿 있는 것처럼 보이도록 표본을
 * 만들어 채운다. 실제 서버가 다수 이용자 기록을 반환하면 이 보정은 통째로 지운다.
 *
 * 이름은 **고정 표본 목록을 돌려 쓰고 호수를 붙인다** — 난수로 지으면 열 때마다 다른 사람이
 * 서서 "어제보다 몇 등 올랐나"를 읽을 수 없다.
 */
// 계정 이름이라 번역하지 않는다 — 실제 이용자 풀이 생기면 서버가 주는 이름이 그대로 선다.
const PLACEHOLDER_NAMES = [
  "하늘정원", "이끼연구소", "물결관측소", "돌숲기록실", "잿빛표본실",
  "고요한둥지", "첫서리연구반", "붉은등대", "모래시계반", "깊은뿌리",
] as const;

/** 표본이 세우는 얼굴. 실제 이용자 풀이 생기면 이 목록도 함께 지운다. */
const PLACEHOLDER_FACES = ["rex", "anky", "dodo", "spino", "mette", "tia", "parua", "luka", "maki", "stella"] as const;

/** 표본 한 사람. 점수는 내 기록을 기준으로 위아래로 고르게 흩어진다. */
export function placeholderRankingEntries(bestScore: number, count: number): ExpeditionLeaderboardEntry[] {
  const baseline = bestScore > 0 ? bestScore : 1_400;
  return Array.from({ length: Math.max(0, count) }, (_, index) => {
    const name = PLACEHOLDER_NAMES[index % PLACEHOLDER_NAMES.length];
    const house = Math.floor(index / PLACEHOLDER_NAMES.length) + 1;
    // 1등은 내 기록의 1.6배쯤이고 뒤로 갈수록 고르게 낮아진다.
    const score = Math.round(baseline * (1.6 - (index / Math.max(1, count)) * 1.35));
    return {
      rank: 0, playerId: `preview-${index}`,
      displayName: house === 1 ? name : `${name} ${house}호`,
      score: Math.max(1, score), achievedAt: "", isMe: false,
      // 표본도 얼굴을 갖는다 — 순위표가 화면에서 스스로 개체를 고르지 않게 서버 쪽 계약과
      // 같은 자리에 담아 둔다. 목록은 이 값이 있을 때만 액자를 세운다.
      favoriteRelicId: PLACEHOLDER_FACES[index % PLACEHOLDER_FACES.length],
    };
  });
}

/** 서버 기록과 표본을 합쳐 점수순으로 등수를 매긴다. 같은 점수는 서버가 먼저 적은 쪽이 위다. */
export function rankedLeaderboard(entries: readonly ExpeditionLeaderboardEntry[], limit = RANKING_VISIBLE_RANKS): ExpeditionLeaderboardEntry[] {
  return [...entries]
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((entry, index) => ({ ...entry, rank: index + 1 }));
}
