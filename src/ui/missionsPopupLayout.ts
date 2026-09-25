/**
 * 임무 팝업의 자리는 팝업 본문 원점(화면 중앙)을 기준으로 이 표 하나가 갖는다.
 *
 * 위에서부터 **연구도 무대 → 임무 목록 → 하단 줄(기간 탭 · 일괄 수령)** 순이다. 기간을 고르는
 * 탭은 가방·상점과 같은 전환 라벨이라 목록 **아래**에 선다 — 목록을 통째로 갈아 끼우는 조작은
 * 어느 화면에서나 같은 자리에서 해야 한다.
 */
export const MISSIONS_POPUP_LAYOUT = {
  popup: { widthInset: 70, heightInset: 210 },
  /**
   * 연구도 무대. 그 기간에 무엇을 향해 가는지가 이 화면의 첫 줄이라 게이지를 크게 세우고,
   * 단계 보상 액자를 그 위에 마디마다 올린다.
   */
  research: {
    panelY: -612, panelHeight: 306,
    /** 머리 줄 — 왼쪽에 연구도 수치, 오른쪽에 초기화까지 남은 시간. */
    headerY: -728,
    frameY: -636, frameSize: 92, frameOutlineWidth: 4,
    barY: -552, barHeight: 30,
    thresholdY: -514,
    safeInsetX: 64,
    /** 마지막 마디의 액자 오른쪽 위에 붙는 곁들임 액자(58)의 반폭까지 비워 둔다. */
    endpointGap: 34,
  },
  list: { firstCardY: -352, cardGap: 176, cardWidth: 920, cardHeight: 156 },
  /**
   * 하단 두 줄 — 기간 전환 라벨이 위, **모두 받기가 그 아래 가운데**다. 받기는 이 판의 주 조작이라
   * 가운데에 서고, 오른쪽 아래 구석은 판 밖 뒤로가기의 자리라 비워 둔다.
   */
  footer: {
    tabY: 662,
    tab: { width: 210, height: 84, gap: 12 },
    claim: { x: 0, y: 778, width: 380, height: 92 },
  },
} as const;

/** 중심과 반지름/반폭을 모두 반영한 실제 축 정렬 bounds다. */
export interface LayoutBounds { left: number; top: number; right: number; bottom: number }

/** Phaser 객체 없이 팝업 너비와 임계값만으로 연구도 가로 배치를 확정한다. */
export interface ResearchTrackLayout {
  safeBounds: LayoutBounds;
  barBounds: LayoutBounds;
  /** HoloBar가 요구하는 중심 좌표다. 왼쪽 경계를 중심으로 넘기면 폭의 절반이 팝업 밖으로 샌다. */
  barX: number;
  barWidth: number;
  /** 게이지의 왼쪽 끝(0점). */
  barLeft: number;
  stageXs: number[];
  frameBounds: LayoutBounds[];
}

/**
 * 게이지는 **0에서 시작해 마지막 임계값에서 끝난다.** 마디는 그 사이의 제 비율 자리에 선다 —
 * 첫 마디를 왼쪽 끝에 붙이면 "처음부터 하나는 받은 것"처럼 읽힌다.
 *
 * 마지막 마디의 액자는 게이지 오른쪽 끝에 걸리므로, 액자 반지름과 여백만큼 안쪽에서 게이지를 끝낸다.
 */
export function researchTrackLayout(popupWidth: number, thresholds: readonly number[]): ResearchTrackLayout {
  const { research } = MISSIONS_POPUP_LAYOUT;
  const safeLeft = -popupWidth / 2 + research.safeInsetX;
  const safeRight = popupWidth / 2 - research.safeInsetX;
  // RewardFrame 외곽선은 도형 밖으로 선의 절반만큼 뻗으므로 그 반폭도 실제 반지름에 포함한다.
  const frameRadius = research.frameSize / 2 + research.frameOutlineWidth / 2;
  // HoloBar의 평행사변형은 명목 폭보다 양쪽에 slant/2만큼 더 뻗으므로 실제 도형 외곽도 예약한다.
  const barVisualInset = Math.min(12, research.barHeight) / 2;
  const barLeft = safeLeft + barVisualInset;
  const barRight = safeRight - frameRadius - research.endpointGap;
  const barWidth = Math.max(0, barRight - barLeft);
  const barX = barLeft + barWidth / 2;
  const maximum = Math.max(1, ...thresholds);
  const stageXs = thresholds.map((threshold) => barLeft + (barWidth * Math.max(0, threshold)) / maximum);
  const frameBounds = stageXs.map((centerX) => ({ left: centerX - frameRadius, top: research.frameY - frameRadius, right: centerX + frameRadius, bottom: research.frameY + frameRadius }));
  return {
    safeBounds: { left: safeLeft, top: Number.NEGATIVE_INFINITY, right: safeRight, bottom: Number.POSITIVE_INFINITY },
    // bounds는 중심선 폭이 아니라 기울어진 홈/채움이 차지하는 실제 가로 외곽이다.
    barBounds: { left: barLeft - barVisualInset, top: research.barY - research.barHeight / 2, right: barLeft + barWidth + barVisualInset, bottom: research.barY + research.barHeight / 2 },
    barX, barWidth, barLeft, stageXs, frameBounds,
  };
}

/** 하단 기간 탭 하나의 중심. */
export function missionsTabX(index: number): number {
  const { tab } = MISSIONS_POPUP_LAYOUT.footer;
  // 라벨 둘이 판 가운데를 기준으로 좌우 대칭으로 선다 — 아래 받기 버튼과 같은 축이다.
  return (index - 0.5) * (tab.width + tab.gap);
}

/** 두 bounds가 변까지 맞닿는 경우를 포함해 실제 면적이 교차하는지 판정한다. */
export function boundsIntersect(a: LayoutBounds, b: LayoutBounds): boolean {
  return a.left <= b.right && a.right >= b.left && a.top <= b.bottom && a.bottom >= b.top;
}
