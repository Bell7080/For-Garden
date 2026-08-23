/** Phaser와 무관하게 직렬화할 수 있는 궁극기 컷인 연출 값이다. */
export interface UltimatePresentation {
  /** 원화가 화면 안으로 들어오는 수평 방향이다. */
  enterFrom: "left" | "right";
  /** 1280px 공용 원화 높이에 곱할 배율이다. */
  artworkScale: number;
  /** Puppet의 core 관절을 놓을 컷인 기준점이다. */
  artworkOrigin: { x: number; y: number };
  /** 전장 Puppet에 요청할 포효 계열 모션 키다. */
  roarMotion: "roar" | "attack";
  /** 진입 완료 뒤 원화와 이름을 보여 주는 시간이다. */
  cutInDurationMs: number;
  /** 컷인이 퇴장한 뒤 공격 판정을 내기 전의 여백이다. */
  preAttackDelayMs: number;
  /** 공격 직전 카메라 흔들림의 정규화된 강도다. */
  cameraShakeIntensity: number;
}

/** 신규 렐릭도 별도 설정 전까지 부담스럽지 않은 공용 연출로 안전하게 표시한다. */
export const DEFAULT_ULTIMATE_PRESENTATION: Readonly<UltimatePresentation> = Object.freeze({
  enterFrom: "left",
  artworkScale: 1,
  artworkOrigin: Object.freeze({ x: 650, y: 810 }),
  roarMotion: "roar",
  cutInDurationMs: 430,
  preAttackDelayMs: 90,
  cameraShakeIntensity: 0.006,
});

/** 현재 출시 렐릭의 개성을 조정하는 유일한 프레젠테이션 표다. */
export const ULTIMATE_PRESENTATIONS: Readonly<Record<string, UltimatePresentation>> = Object.freeze({
  rex: { ...DEFAULT_ULTIMATE_PRESENTATION, artworkScale: 1.08, cameraShakeIntensity: 0.012 },
  anky: { ...DEFAULT_ULTIMATE_PRESENTATION, enterFrom: "right", artworkScale: 0.96, preAttackDelayMs: 130, cameraShakeIntensity: 0.009 },
  spino: { ...DEFAULT_ULTIMATE_PRESENTATION, artworkScale: 1.04, artworkOrigin: { x: 680, y: 820 }, cameraShakeIntensity: 0.011 },
  luka: { ...DEFAULT_ULTIMATE_PRESENTATION, enterFrom: "right", artworkOrigin: { x: 620, y: 800 }, cutInDurationMs: 390 },
  dodo: { ...DEFAULT_ULTIMATE_PRESENTATION, artworkScale: 0.9, artworkOrigin: { x: 640, y: 790 }, cameraShakeIntensity: 0.005 },
  smilo: { ...DEFAULT_ULTIMATE_PRESENTATION, enterFrom: "right", artworkScale: 1.06, cutInDurationMs: 380, cameraShakeIntensity: 0.01 },
  quetz: { ...DEFAULT_ULTIMATE_PRESENTATION, artworkScale: 0.94, artworkOrigin: { x: 650, y: 760 }, cutInDurationMs: 470 },
  "husk-raptor": { ...DEFAULT_ULTIMATE_PRESENTATION, enterFrom: "right", cutInDurationMs: 360, cameraShakeIntensity: 0.008 },
  "husk-shell": { ...DEFAULT_ULTIMATE_PRESENTATION, artworkScale: 0.94, preAttackDelayMs: 120, cameraShakeIntensity: 0.008 },
  "husk-wing": { ...DEFAULT_ULTIMATE_PRESENTATION, enterFrom: "right", artworkScale: 0.92, artworkOrigin: { x: 650, y: 770 } },
});

/** 표에 아직 없는 ID는 공용 기본값을 반환해 콘텐츠 추가가 전투를 깨뜨리지 않게 한다. */
export function ultimatePresentationFor(relicId: string): Readonly<UltimatePresentation> {
  return ULTIMATE_PRESENTATIONS[relicId] ?? DEFAULT_ULTIMATE_PRESENTATION;
}
