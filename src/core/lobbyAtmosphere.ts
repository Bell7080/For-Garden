import { presentationPolicy, type GraphicsQuality } from "./settings";

/**
 * 로비 분위기 층의 값.
 *
 * 애착 렐릭 뒤에 속성·직군 혼합색 **역광 한 장**을 깔고, 그 둘레로 **빛 알갱이**가 천천히 떠오른다.
 * 둘 다 캐릭터(idle 모션)와 아무 계산도 주고받지 않는다 — 역광은 한 번 구운 흰 그림에 색만 입힌
 * 정지 이미지이고, 알갱이는 emitter 하나가 알아서 돌린다. 그래서 idle이 바뀌어도 다시 구울
 * 것이 없고, 개체를 바꿀 때는 색만 갈아 끼운다.
 */
export const LOBBY_ATMOSPHERE = {
  /** 역광: 몸통 뒤에서 번지는 빛. 캐릭터보다 먼저 읽히면 안 되므로 옅다. */
  glow: { x: 540, y: 960, width: 1240, height: 1560, alpha: 0.32, breathAlpha: 0.1, breathMs: 5200 },
  /** 빛 알갱이: 위로 천천히 뜨다 사라진다. 상한은 동시에 살아 있는 수다. */
  motes: {
    max: 24,
    zone: { x: 60, y: 300, width: 960, height: 1500 },
    lifeMs: [7000, 11000],
    rise: [14, 34],
    drift: [-10, 10],
    scale: [0.16, 0.4],
    alpha: 0.75,
  },
} as const;

export interface LobbyAtmospherePlan {
  /** 정지한 역광은 움직임이 없으므로 늘 서 있다. */
  glow: true;
  /** 역광이 숨 쉬듯 오르내리는가. 움직임 줄이기에서는 멈춘다. */
  breathing: boolean;
  /** 동시에 떠 있을 알갱이 수. 0이면 emitter를 세우지 않는다. */
  motes: number;
}

/** 절전·품질·움직임 감소에서 이 층이 쓸 작업량을 정한다. */
export function lobbyAtmospherePlan(input: { particleFactor: number; quality: GraphicsQuality; reduceMotion: boolean }): LobbyAtmospherePlan {
  const ratio = presentationPolicy(input.quality).particleRatio;
  const count = Math.round(LOBBY_ATMOSPHERE.motes.max * Math.max(0, input.particleFactor) * ratio);
  return { glow: true, breathing: !input.reduceMotion, motes: count };
}

/** 알갱이 하나가 살아 있는 평균 시간에서, 정해진 수가 유지되는 생성 간격(ms)을 구한다. */
export function moteFrequencyMs(motes: number): number {
  const [min, max] = LOBBY_ATMOSPHERE.motes.lifeMs;
  return motes <= 0 ? 0 : (min + max) / 2 / motes;
}
