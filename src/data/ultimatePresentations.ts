/** Phaser와 무관하게 직렬화할 수 있는 궁극기 연출 값이다. */
export interface UltimatePresentation {
  /** 전신 컷인이 화면 안으로 들어오는 수평 방향이다. */
  enterFrom: "left" | "right";
  /** 1280px 공용 원화 높이에 곱할 배율이다. */
  artworkScale: number;
  /** Puppet의 core 관절을 놓을 컷인 기준점이다. */
  artworkOrigin: { x: number; y: number };
  /**
   * 진입을 마친 컷인이 이름을 보여 주며 머무는 시간(ms).
   *
   * 컷인은 "누가 무엇을 쓰는가"를 알리는 한 장이다. 여기서 길어지면 전투가 매번 그만큼
   * 멈추므로, 읽을 수 있는 최소한만 머문다. 포효 같은 별도 대기는 두지 않는다.
   */
  cutInHoldMs: number;
  /**
   * 때리기 직전 SD가 커지는 배율.
   *
   * 전신 원화 컷인과 포효를 걷어낸 자리를 이 한 뼘이 대신한다. 화면을 덮는 연출은 한 번은
   * 멋있지만 전투 내내 반복되면 기다림이 된다. "누가 지금 크게 때리는가"만 알리면 충분하다.
   */
  zoomScale: number;
  /** 확대의 상대적인 무게감(ms). 전투 배속 환산은 BattleScene의 공용 시간축만 담당한다. */
  zoomMs: number;
  /** 공격 판정 직전 카메라 흔들림의 정규화된 강도다. */
  cameraShakeIntensity: number;
}

/** 신규 렐릭도 별도 설정 전까지 부담스럽지 않은 공용 연출로 안전하게 표시한다. */
export const DEFAULT_ULTIMATE_PRESENTATION: Readonly<UltimatePresentation> = Object.freeze({
  enterFrom: "left",
  artworkScale: 1,
  artworkOrigin: Object.freeze({ x: 650, y: 810 }),
  cutInHoldMs: 150,
  zoomScale: 1.22,
  // 확대는 공격 직전 가장 느리게 체감되므로 기존 130ms보다 짧은 기준을 둔다.
  zoomMs: 100,
  cameraShakeIntensity: 0.009,
});

/** 현재 출시 렐릭의 개성을 조정하는 유일한 프레젠테이션 표다. */
export const ULTIMATE_PRESENTATIONS: Readonly<Record<string, UltimatePresentation>> = Object.freeze({
  rex: { ...DEFAULT_ULTIMATE_PRESENTATION, artworkScale: 1.08, zoomScale: 1.3, cameraShakeIntensity: 0.013 },
  anky: { ...DEFAULT_ULTIMATE_PRESENTATION, enterFrom: "right", artworkScale: 0.96, zoomScale: 1.26, zoomMs: 115, cameraShakeIntensity: 0.012 },
  spino: { ...DEFAULT_ULTIMATE_PRESENTATION, artworkScale: 1.04, artworkOrigin: { x: 680, y: 820 }, zoomScale: 1.28, cameraShakeIntensity: 0.012 },
  luka: { ...DEFAULT_ULTIMATE_PRESENTATION, enterFrom: "right", artworkOrigin: { x: 620, y: 800 }, cutInHoldMs: 140, zoomScale: 1.18, zoomMs: 110 },
  dodo: { ...DEFAULT_ULTIMATE_PRESENTATION, artworkScale: 0.9, artworkOrigin: { x: 640, y: 790 }, zoomScale: 1.14, cameraShakeIntensity: 0.006 },
  smilo: { ...DEFAULT_ULTIMATE_PRESENTATION, enterFrom: "right", artworkScale: 1.06, cutInHoldMs: 140, zoomScale: 1.24, zoomMs: 115, cameraShakeIntensity: 0.011 },
  quetz: { ...DEFAULT_ULTIMATE_PRESENTATION, artworkScale: 0.94, artworkOrigin: { x: 650, y: 760 }, cutInHoldMs: 160, zoomScale: 1.16, cameraShakeIntensity: 0.008 },
  // 비공격 찬가는 강한 흔들림 대신 짧고 차분한 공용 placeholder 컷인을 사용한다.
  mette: { ...DEFAULT_ULTIMATE_PRESENTATION, enterFrom: "right", artworkScale: 0.96, cutInHoldMs: 170, zoomScale: 1.12, cameraShakeIntensity: 0.004 },
  "husk-raptor": { ...DEFAULT_ULTIMATE_PRESENTATION, enterFrom: "right", cutInHoldMs: 135, zoomScale: 1.2, zoomMs: 110, cameraShakeIntensity: 0.008 },
  "husk-shell": { ...DEFAULT_ULTIMATE_PRESENTATION, artworkScale: 0.94, zoomScale: 1.24, zoomMs: 115, cameraShakeIntensity: 0.009 },
  "husk-wing": { ...DEFAULT_ULTIMATE_PRESENTATION, enterFrom: "right", artworkScale: 0.92, artworkOrigin: { x: 650, y: 770 }, zoomScale: 1.16, cameraShakeIntensity: 0.007 },
  // 넓은 보스 전신은 컷인에서 한 단계 줄이고, 무거운 일격은 SD 확대와 흔들림으로 전달한다.
  pontus: { ...DEFAULT_ULTIMATE_PRESENTATION, artworkScale: 0.82, artworkOrigin: { x: 650, y: 800 }, zoomScale: 1.3, zoomMs: 120, cameraShakeIntensity: 0.014 },
});

/** 표에 아직 없는 ID는 공용 기본값을 반환해 콘텐츠 추가가 전투를 깨뜨리지 않게 한다. */
export function ultimatePresentationFor(relicId: string): Readonly<UltimatePresentation> {
  return ULTIMATE_PRESENTATIONS[relicId] ?? DEFAULT_ULTIMATE_PRESENTATION;
}
