/** 임무 팝업의 세로 영역은 팝업 본문 원점(화면 중앙)을 기준으로 한 표에서 관리한다. */
export const MISSIONS_POPUP_LAYOUT = {
  popup: { widthInset: 70, heightInset: 210 },
  header: { statusX: 450, statusY: -770 },
  tabs: { centerY: -665, centerX: 245, width: 420, height: 82 },
  research: { barX: -390, barY: -455, barWidth: 780, barHeight: 24, frameOffsetY: -70, frameSize: 82, frameOutlineWidth: 4, labelX: -440, labelOffsetY: 56 },
  list: { firstCardY: -255, cardGap: 190, cardWidth: 900, cardHeight: 150 },
  footer: { buttonY: 720, buttonWidth: 650, buttonHeight: 105 },
} as const;

/** 중심과 반지름/반폭을 모두 반영한 실제 축 정렬 bounds다. */
export interface LayoutBounds { left: number; top: number; right: number; bottom: number }

/** 탭과 연구도 보상 액자의 외곽선까지 포함해 충돌 검증에서 사용하는 bounds를 만든다. */
export function missionsPopupCollisionBounds(): { tabs: LayoutBounds[]; researchFrames: LayoutBounds[] } {
  const { tabs, research } = MISSIONS_POPUP_LAYOUT;
  const tabHalfWidth = tabs.width / 2; const tabHalfHeight = tabs.height / 2;
  const tabBounds = (centerX: number): LayoutBounds => ({ left: centerX - tabHalfWidth, top: tabs.centerY - tabHalfHeight, right: centerX + tabHalfWidth, bottom: tabs.centerY + tabHalfHeight });
  // RewardFrame의 선은 도형 경계 바깥으로 절반만큼 뻗으므로 액자 반지름에 선 반폭을 더한다.
  const frameRadius = research.frameSize / 2 + research.frameOutlineWidth / 2;
  const frameY = research.barY + research.frameOffsetY;
  const frameBounds = (centerX: number): LayoutBounds => ({ left: centerX - frameRadius, top: frameY - frameRadius, right: centerX + frameRadius, bottom: frameY + frameRadius });
  return {
    tabs: [tabBounds(-tabs.centerX), tabBounds(tabs.centerX)],
    // 첫 단계와 마지막 단계가 탭에 가장 가까운 수평 극단이므로 두 bounds면 전 구간을 검증할 수 있다.
    researchFrames: [frameBounds(research.barX), frameBounds(research.barX + research.barWidth)],
  };
}

/** 두 bounds가 변까지 맞닿는 경우를 포함해 실제 면적이 교차하는지 판정한다. */
export function boundsIntersect(a: LayoutBounds, b: LayoutBounds): boolean {
  return a.left <= b.right && a.right >= b.left && a.top <= b.bottom && a.bottom >= b.top;
}
