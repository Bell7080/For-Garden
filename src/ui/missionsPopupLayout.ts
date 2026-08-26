/** 임무 팝업의 세로 영역은 팝업 본문 원점(화면 중앙)을 기준으로 한 표에서 관리한다. */
export const MISSIONS_POPUP_LAYOUT = {
  popup: { widthInset: 70, heightInset: 210 },
  // 대형 제목의 글자 높이 아래에 숨 쉴 틈을 두되, 상태 줄은 탭 입력면 위에서 끝난다.
  header: { statusX: 450, statusY: -755 },
  tabs: { centerY: -665, centerX: 245, width: 420, height: 82 },
  research: { barY: -455, barHeight: 24, frameOffsetY: -70, frameSize: 82, frameOutlineWidth: 4, safeInsetX: 28, endpointGap: 12, labelOffsetY: 56 },
  list: { firstCardY: -255, cardGap: 190, cardWidth: 900, cardHeight: 150 },
  footer: { buttonY: 720, buttonWidth: 650, buttonHeight: 105 },
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
  labelX: number;
  stageXs: number[];
  frameBounds: LayoutBounds[];
}

/**
 * 팝업 내부 안전 영역에서 액자 외곽선 반지름과 추가 여백을 먼저 제외한 뒤 게이지를 놓는다.
 * 따라서 최소·최대 임계값 액자가 게이지 양끝에 와도 팝업 가장자리와 endpointGap만큼 떨어진다.
 */
export function researchTrackLayout(popupWidth: number, thresholds: readonly number[]): ResearchTrackLayout {
  const { research } = MISSIONS_POPUP_LAYOUT;
  const safeLeft = -popupWidth / 2 + research.safeInsetX;
  const safeRight = popupWidth / 2 - research.safeInsetX;
  // RewardFrame 외곽선은 도형 밖으로 선의 절반만큼 뻗으므로 그 반폭도 실제 반지름에 포함한다.
  const frameRadius = research.frameSize / 2 + research.frameOutlineWidth / 2;
  const endpointReserve = frameRadius + research.endpointGap;
  // HoloBar의 평행사변형은 명목 폭보다 양쪽에 slant/2만큼 더 뻗으므로 실제 도형 외곽도 예약한다.
  const barVisualInset = Math.min(12, research.barHeight) / 2;
  const barLeft = safeLeft + endpointReserve + barVisualInset;
  const barWidth = Math.max(0, safeRight - safeLeft - (endpointReserve + barVisualInset) * 2);
  const barX = barLeft + barWidth / 2;
  const minimum = Math.min(...thresholds);
  const maximum = Math.max(...thresholds);
  // 단계가 하나뿐인 비정상/축소 데이터도 왼쪽 끝이라는 예측 가능한 위치에 안전하게 둔다.
  const stageXs = thresholds.map((threshold) => barLeft + barWidth * (maximum === minimum ? 0 : (threshold - minimum) / (maximum - minimum)));
  const frameY = research.barY + research.frameOffsetY;
  const frameBounds = stageXs.map((centerX) => ({ left: centerX - frameRadius, top: frameY - frameRadius, right: centerX + frameRadius, bottom: frameY + frameRadius }));
  return {
    safeBounds: { left: safeLeft, top: Number.NEGATIVE_INFINITY, right: safeRight, bottom: Number.POSITIVE_INFINITY },
    // bounds는 중심선 폭이 아니라 기울어진 홈/채움이 차지하는 실제 가로 외곽이다.
    barBounds: { left: barLeft - barVisualInset, top: research.barY - research.barHeight / 2, right: barLeft + barWidth + barVisualInset, bottom: research.barY + research.barHeight / 2 },
    barX, barWidth, labelX: barLeft - barVisualInset, stageXs, frameBounds,
  };
}

/** 탭과 연구도 보상 액자의 외곽선까지 포함해 충돌 검증에서 사용하는 bounds를 만든다. */
export function missionsPopupCollisionBounds(): { tabs: LayoutBounds[]; researchFrames: LayoutBounds[] } {
  const { tabs } = MISSIONS_POPUP_LAYOUT;
  const tabHalfWidth = tabs.width / 2; const tabHalfHeight = tabs.height / 2;
  const tabBounds = (centerX: number): LayoutBounds => ({ left: centerX - tabHalfWidth, top: tabs.centerY - tabHalfHeight, right: centerX + tabHalfWidth, bottom: tabs.centerY + tabHalfHeight });
  // RewardFrame의 선은 도형 경계 바깥으로 절반만큼 뻗으므로 액자 반지름에 선 반폭을 더한다.
  const popupWidth = BASE_POPUP_WIDTH_FOR_COLLISION;
  const track = researchTrackLayout(popupWidth, [20, 120]);
  return {
    tabs: [tabBounds(-tabs.centerX), tabBounds(tabs.centerX)],
    // 첫 단계와 마지막 단계가 탭에 가장 가까운 수평 극단이므로 두 bounds면 전 구간을 검증할 수 있다.
    researchFrames: track.frameBounds,
  };
}

// 충돌 도우미의 기본 폭은 실제 BASE_WIDTH(1080)에서 팝업 inset(70)을 뺀 값이다.
const BASE_POPUP_WIDTH_FOR_COLLISION = 1010;

/** 두 bounds가 변까지 맞닿는 경우를 포함해 실제 면적이 교차하는지 판정한다. */
export function boundsIntersect(a: LayoutBounds, b: LayoutBounds): boolean {
  return a.left <= b.right && a.right >= b.left && a.top <= b.bottom && a.bottom >= b.top;
}
