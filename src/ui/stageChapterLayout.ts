/** 챕터 이동 버튼이 출전 중앙과 공용 우하단 뒤로가기를 피하도록 고정한 모바일 안전 배치다. */
export function stageChapterNavigationLayout(width: number, height: number) {
  const edgeInset = 170;
  return {
    previous: { x: edgeInset, y: height - 320, width: 250, height: 78 },
    next: { x: width - edgeInset, y: height - 320, width: 250, height: 78 },
  } as const;
}
