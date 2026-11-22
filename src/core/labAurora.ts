import type { GraphicsQuality } from "./settings";

/**
 * 연구소 모집 원화 위에 깔리는 오로라 일렁임의 값(응태 요청 2026-11-22 — 「자원을 많이 쓰지 않는 선에서 오로라 같은 일렁임」).
 *
 * **가볍게 그리는 방법이 이 층의 전부다.** 셰이더는 화면 크기가 아니라 작은 버퍼(`buffer` — 화면 띠의 1/6)에만 돌고,
 * 그 결과 한 장을 화면의 위쪽 띠(`band`)에 늘려 얹는다. 오로라는 본래 흐릿한 빛이라 낮은 해상도를 선형 보간으로 늘려도
 * 결이 상하지 않는다. 버퍼를 다시 그리는 것도 매 프레임이 아니라 `hz`번이다 — 움직임이 느려 30번이면 충분하다.
 * 화면이 덮이거나(연출·결과판) 씬을 떠나면 그리지 않는다.
 *
 * 세기는 배너의 결(`LabAuroraTone`)이 정한다 — 상시는 잔잔하게, 한정 픽업은 한 단계 화려하게.
 */
export const LAB_AURORA = {
  /** 셰이더가 실제로 그리는 버퍼. 화면 띠보다 6배 작다. */
  buffer: { width: 180, height: 176 },
  /** 화면에 얹는 띠 — 모집 원화의 위쪽(제목 뒤 하늘)부터 가슴께까지. 아래 버튼·확정 판에는 걸치지 않는다. */
  band: { x: 540, y: 0, width: 1080, height: 1060 },
  /** 띠가 들어설 때 녹아 드는 시간. */
  fadeInMs: 900,
} as const;

/** 배너의 결과 같은 이름 — 색과 세기를 고른다. */
export type LabAuroraTone = "welcome" | "standard" | "limited" | "moonlit";

export interface LabAuroraPalette {
  /** 오로라 띠의 세 색 — 아래 뿌리(a) → 가운데(b) → 끝(c). 0~1 RGB. */
  colors: readonly [readonly [number, number, number], readonly [number, number, number], readonly [number, number, number]];
  /** 전체 세기(0~1). 셰이더가 알파에 곱한다. */
  intensity: number;
  /** 반짝임 세기(0이면 반짝이지 않는다). */
  sparkle: number;
}

const rgb = (hex: number): readonly [number, number, number] => [((hex >> 16) & 255) / 255, ((hex >> 8) & 255) / 255, (hex & 255) / 255];

/**
 * 결 네 벌. 상시는 들뜨지 않게 옅고 반짝임이 없으며, 한정(호박석·달빛)은 색이 진하고 별빛이 반짝인다.
 * 색은 모집판 제목의 흐름(`BANNER_TONE`)과 같은 계열에서 골라 원화와 따로 놀지 않게 한다.
 */
export const LAB_AURORA_PALETTE: Record<LabAuroraTone, LabAuroraPalette> = {
  standard: { colors: [rgb(0x3fe0b0), rgb(0x5fc8ff), rgb(0xb48cff)], intensity: 0.55, sparkle: 0 },
  welcome: { colors: [rgb(0xff9fb8), rgb(0xff7ad0), rgb(0xb07cff)], intensity: 0.65, sparkle: 0.35 },
  limited: { colors: [rgb(0xffc94a), rgb(0xff7a4a), rgb(0xff4fa0)], intensity: 0.75, sparkle: 0.7 },
  moonlit: { colors: [rgb(0x4fe3ff), rgb(0x7c8cff), rgb(0xd27cff)], intensity: 0.75, sparkle: 0.7 },
};

export interface LabAuroraPlan {
  /** 이 층을 세우는가. 낮음 품질은 세우지 않는다. */
  enabled: boolean;
  /** 움직이는가. 움직임 줄이기에서는 한 장만 그려 멈춘 오로라로 둔다. */
  animate: boolean;
  /** 버퍼를 초당 몇 번 다시 그리나. 절전은 절반이다. */
  hz: number;
}

/** 그래픽 품질·절전·움직임 줄이기에서 이 층이 쓸 작업량을 정한다. */
export function labAuroraPlan(input: { quality: GraphicsQuality; powerSaving: boolean; reduceMotion: boolean }): LabAuroraPlan {
  if (input.quality === "low") return { enabled: false, animate: false, hz: 0 };
  if (input.reduceMotion) return { enabled: true, animate: false, hz: 0 };
  return { enabled: true, animate: true, hz: input.powerSaving ? 15 : 30 };
}

/** 지난 그리기에서 이만큼 지났으면 다시 그린다. `hz`가 0이면 다시 그리지 않는다. */
export function labAuroraDue(elapsedMs: number, hz: number): boolean {
  return hz > 0 && elapsedMs >= 1000 / hz - 1;
}
