/** Phaser에 의존하지 않는 외형 선택 팝업의 1080×1920 기준 배치 계약이다. */
export interface AppearanceBounds { left: number; top: number; right: number; bottom: number }

/** 중심 좌표와 크기를 실제 충돌 검사에 쓰는 외곽으로 바꾼다. */
export function appearanceBounds(x: number, y: number, width: number, height: number): AppearanceBounds {
  return { left: x - width / 2, top: y - height / 2, right: x + width / 2, bottom: y + height / 2 };
}

/** 변만 맞닿는 것은 허용하고, 실제 면적이 겹칠 때만 true다. */
export function appearanceBoundsOverlap(a: AppearanceBounds, b: AppearanceBounds): boolean {
  return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
}

/**
 * 팝업 제목/닫기 버튼을 위한 headroom까지 포함한 단일 배치표다.
 * 카드 윗부분의 약 절반을 이루는 176px `/` 절단은 장식이 아니라 전신의 어깨가 판 안으로
 * 들어가는 경계다. 값을 줄이면 평범한 팔각형 카드로 되돌아가므로 비율과 함께 고정한다.
 */
export const APPEARANCE_PANEL_LAYOUT = {
  width: 920,
  height: 1240,
  header: { height: 150, closeSize: 72 },
  card: {
    y: 60, width: 370, height: 720, centers: [-205, 205] as const,
    slashDepth: 176,
    overhang: 166,
    fullBody: { x: -18, groundY: 202, height: 650 },
    sd: { x: 126, groundY: 210, height: 184 },
    nameY: 274,
    statusY: 316,
  },
  action: { y: 504, width: 520, height: 96 },
} as const;

/** 테스트와 프리팹이 같은 배치표로 제목·전신·SD·문구의 실제 안전 영역을 계산한다. */
export function appearancePanelRegions() {
  const layout = APPEARANCE_PANEL_LAYOUT;
  const popupTop = -layout.height / 2;
  return {
    header: { left: -layout.width / 2, top: popupTop, right: layout.width / 2, bottom: popupTop + layout.header.height },
    cards: layout.card.centers.map((x) => appearanceBounds(x, layout.card.y, layout.card.width, layout.card.height)),
    action: appearanceBounds(0, layout.action.y, layout.action.width, layout.action.height),
    // Puppet은 alpha 경계로 높이를 맞추므로 캔버스 투명 여백과 무관하게 이 시각 영역에 선다.
    overhangs: layout.card.centers.map((x) => ({
      left: x - layout.card.width / 2,
      top: layout.card.y - layout.card.height / 2 - layout.card.overhang,
      right: x + layout.card.width / 2,
      bottom: layout.card.y - layout.card.height / 2,
    })),
    textBands: layout.card.centers.map((x) => appearanceBounds(x, layout.card.y + 296, layout.card.width - 32, 70)),
    sdFigures: layout.card.centers.map((x) => appearanceBounds(x + layout.card.sd.x, layout.card.y + layout.card.sd.groundY - layout.card.sd.height / 2, 110, layout.card.sd.height)),
  };
}
