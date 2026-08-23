/** Phaser와 무관하게 직렬화할 수 있는 궁극기 연출 값이다. */
export interface UltimatePresentation {
  /**
   * 때리기 직전 SD가 커지는 배율.
   *
   * 전신 원화 컷인과 포효를 걷어낸 자리를 이 한 뼘이 대신한다. 화면을 덮는 연출은 한 번은
   * 멋있지만 전투 내내 반복되면 기다림이 된다. "누가 지금 크게 때리는가"만 알리면 충분하다.
   */
  zoomScale: number;
  /** 커지고 다시 돌아오는 데 각각 걸리는 시간(ms). */
  zoomMs: number;
  /** 공격 판정 직전 카메라 흔들림의 정규화된 강도다. */
  cameraShakeIntensity: number;
}

/** 신규 렐릭도 별도 설정 전까지 부담스럽지 않은 공용 연출로 안전하게 표시한다. */
export const DEFAULT_ULTIMATE_PRESENTATION: Readonly<UltimatePresentation> = Object.freeze({
  zoomScale: 1.22,
  zoomMs: 130,
  cameraShakeIntensity: 0.009,
});

/** 현재 출시 렐릭의 개성을 조정하는 유일한 프레젠테이션 표다. */
export const ULTIMATE_PRESENTATIONS: Readonly<Record<string, UltimatePresentation>> = Object.freeze({
  rex: { ...DEFAULT_ULTIMATE_PRESENTATION, zoomScale: 1.3, cameraShakeIntensity: 0.013 },
  anky: { ...DEFAULT_ULTIMATE_PRESENTATION, zoomScale: 1.26, zoomMs: 150, cameraShakeIntensity: 0.012 },
  spino: { ...DEFAULT_ULTIMATE_PRESENTATION, zoomScale: 1.28, cameraShakeIntensity: 0.012 },
  luka: { ...DEFAULT_ULTIMATE_PRESENTATION, zoomScale: 1.18, zoomMs: 110 },
  dodo: { ...DEFAULT_ULTIMATE_PRESENTATION, zoomScale: 1.14, cameraShakeIntensity: 0.006 },
  smilo: { ...DEFAULT_ULTIMATE_PRESENTATION, zoomScale: 1.24, zoomMs: 115, cameraShakeIntensity: 0.011 },
  quetz: { ...DEFAULT_ULTIMATE_PRESENTATION, zoomScale: 1.16, cameraShakeIntensity: 0.008 },
  "husk-raptor": { ...DEFAULT_ULTIMATE_PRESENTATION, zoomScale: 1.2, zoomMs: 110, cameraShakeIntensity: 0.008 },
  "husk-shell": { ...DEFAULT_ULTIMATE_PRESENTATION, zoomScale: 1.24, zoomMs: 150, cameraShakeIntensity: 0.009 },
  "husk-wing": { ...DEFAULT_ULTIMATE_PRESENTATION, zoomScale: 1.16, cameraShakeIntensity: 0.007 },
});

/** 표에 아직 없는 ID는 공용 기본값을 반환해 콘텐츠 추가가 전투를 깨뜨리지 않게 한다. */
export function ultimatePresentationFor(relicId: string): Readonly<UltimatePresentation> {
  return ULTIMATE_PRESENTATIONS[relicId] ?? DEFAULT_ULTIMATE_PRESENTATION;
}
