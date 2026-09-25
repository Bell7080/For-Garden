/**
 * 새로 만난 렐릭의 소개 장면 — 자리와 박자.
 *
 * 뽑기에서 **처음 만난 개체**의 카드가 뒤집히기 직전에 한 번 돈다. 두 막이다:
 *
 * 1. **목소리** — 배경과 어둠만 깔린 빈 화면에 그 개체의 한마디가 스르륵 번진다. 카드를 보기
 *    전에 "새로 온 누군가다"가 먼저 읽힌다.
 * 2. **등장** — 화면이 화아악 밝아지며 전신·SD·등급·이름·속성·직군·오각형이 한꺼번에 선다.
 *
 * **SSR은 구도부터 다르다.** 같은 판에 색만 바꾸면 등급이 연출의 무게로 읽히지 않는다 — SSR은
 * 전신이 화면 밖까지 크게 오른쪽으로 비켜 서고, 비스듬한 황금 띠와 빛줄기·세로 표식이 깔리며,
 * 섬광이 두 번 치고 화면이 흔들린다. SR·R은 가운데에 반듯하게 서고 가로 띠 하나만 깐다.
 *
 * Phaser 없이 읽히도록 값만 둔다 — 화면과 회귀 테스트가 같은 표를 읽어야 자리가 갈리지 않는다.
 */

import type { RelicRarity } from "../core/types";

export const SHOWCASE_SIZE = { width: 1080, height: 1920 } as const;

/**
 * 화면을 덮는 층이 화면 밖으로 더 뻗는 폭.
 *
 * 등장 순간의 흔들림은 카메라를 흔드므로, 화면에 딱 맞춘 층은 흔들리는 순간 가장자리에 빈 띠를
 * 드러낸다 — 화면보다 넓은 등급색 띠만 그 너머로 삐져나와 옆 테두리가 샛노랗게 번쩍였다. 어둠·
 * 배경 원화·비네트·섬광·밑동 어둠이 모두 이만큼 더 뻗는다. 흔들림(SSR 0.8% ≈ 9px)과 등장 때
 * 무대가 부풀었다 가라앉는 몫을 넉넉히 덮는다(대사 화면의 `DIALOGUE_OVERSCAN`과 같은 이유다).
 */
export const SHOWCASE_OVERSCAN = 64;

/** 목소리 막. 대사가 번지는 자리와 박자다. */
export const SHOWCASE_VOICE = {
  y: 900,
  wrap: 860,
  /** 왼쪽에서 오른쪽으로 걷히며 번지는 시간. */
  wipeMs: 760,
  /** 다 번진 뒤 저절로 다음 막으로 넘어가기까지. 누르면 곧바로 넘어간다. */
  holdMs: 1300,
  /** 대사 밑으로 뻗는 한 줄. */
  line: { width: 420, gap: 70, ms: 520 },
} as const;

/**
 * 한 막이 **최소한 서 있는 시간**. 그 전에 들어온 손은 받지 않는다.
 *
 * 카드를 넘기려고 다다닥 두드리던 손이 그대로 들어오면 목소리와 등장이 한꺼번에 넘어가 장면을
 * 한 번도 보지 못한다. 한 번의 누름은 한 막만 넘기고, 막이 바뀐 직후의 누름은 버린다. 시간은
 * 씬 시계가 아니라 실제 시간이다 — 바쁜 기기에서 씬 시계가 늦으면 잠금이 끝없이 늘어난다.
 */
export const SHOWCASE_TAP_LOCK_MS = { voice: 700, stage: 1200 } as const;

/** 등장 막에서 모든 등급이 같이 쓰는 정보 자리. */
export const SHOWCASE_INFO = {
  /** 화면 밑동을 눌러 글이 원화 위에서 읽히게 하는 어둠. */
  fade: { top: 1100, bottom: SHOWCASE_SIZE.height },
  left: 72,
  code: { y: 118, size: 24 },
  rarity: { y: 1392, size: 76 },
  name: { y: 1486, size: 104 },
  origin: { y: 1568, size: 28 },
  badges: { y: 1664, element: 88, role: 66, gap: 22 },
  squad: { size: 74 },
  radar: { x: 850, y: 1610, radius: 100, plate: { width: 380, height: 340 } },
  sd: { x: 188, groundY: 1236, height: 290 },
  hintY: SHOWCASE_SIZE.height - 70,
  /** 정보 조각이 하나씩 밀려 들어오는 간격. */
  staggerMs: 70,
} as const;

export interface ShowcaseComposition {
  /** 전신의 코어 관절이 설 자리와 그림 높이. */
  portrait: { x: number; y: number; height: number };
  /** 전신이 들어오기 시작하는 자리(최종 자리에서 뺀 거리). */
  enterFrom: { x: number; y: number };
  /** 뒤에 깔리는 띠. `angle`은 도(°), 0이면 가로다. */
  band: { y: number; height: number; angle: number; alpha: number };
  /** 띠 안의 점 무늬(출격 버튼의 점 패턴과 같은 문법). */
  dots: { step: number; alpha: number };
  /** 오른쪽 위에서 뻗는 빛줄기 수. */
  rays: number;
  /** 왼쪽 가장자리에 세로로 눕는 프로젝트 이름. */
  watermark: boolean;
  /** 위로 떠오르는 마름모 조각 수. */
  sparkles: number;
  /** 섬광이 치는 횟수. */
  flashes: number;
  /** 등장 순간의 흔들림. 없으면 흔들지 않는다. */
  shake?: { ms: number; intensity: number };
  /** 대사 글자 크기. */
  voiceSize: number;
}

export const SHOWCASE_COMPOSITION: Record<RelicRarity, ShowcaseComposition> = {
  SSR: {
    portrait: { x: 660, y: 880, height: 2200 },
    enterFrom: { x: 220, y: 0 },
    band: { y: 820, height: 300, angle: -24, alpha: 0.34 },
    dots: { step: 18, alpha: 0.55 },
    rays: 5,
    watermark: true,
    sparkles: 9,
    flashes: 2,
    shake: { ms: 420, intensity: 0.008 },
    voiceSize: 66,
  },
  SR: {
    portrait: { x: 610, y: 930, height: 1880 },
    enterFrom: { x: 0, y: 60 },
    band: { y: 860, height: 380, angle: 0, alpha: 0.26 },
    dots: { step: 20, alpha: 0.42 },
    rays: 0,
    watermark: false,
    sparkles: 4,
    flashes: 1,
    voiceSize: 60,
  },
  R: {
    portrait: { x: 600, y: 950, height: 1780 },
    enterFrom: { x: 0, y: 60 },
    band: { y: 880, height: 320, angle: 0, alpha: 0.2 },
    dots: { step: 22, alpha: 0.34 },
    rays: 0,
    watermark: false,
    sparkles: 0,
    flashes: 1,
    voiceSize: 58,
  },
};

/**
 * 띠 안에 찍을 점.
 *
 * 줄마다 반 칸씩 어긋나 흩뿌린 것처럼 읽히고, 띠의 위아래 가장자리에서 안쪽으로 갈수록 작고
 * 옅어진다 — 출격 버튼의 점 패턴(`Button.decorDots`)과 같은 문법이다. 난수를 쓰지 않아 같은
 * 개체는 늘 같은 무늬를 그린다. 좌표는 띠의 국소 좌표(가운데가 0)다.
 */
export function showcaseDots(width: number, height: number, step: number): { x: number; y: number; r: number; alpha: number }[] {
  const dots: { x: number; y: number; r: number; alpha: number }[] = [];
  const half = height / 2;
  const reach = half * 0.9;
  for (let y = -half + step / 2; y < half; y += step) {
    const row = Math.round((y + half) / step);
    const offset = row % 2 === 0 ? 0 : step / 2;
    // 위아래 가장자리에서 가장 크고 진하며 가운데로 갈수록 잦아든다.
    const depth = half - Math.abs(y);
    if (depth > reach) continue;
    const fade = 1 - depth / reach;
    for (let x = -width / 2 + offset; x < width / 2; x += step) {
      dots.push({ x, y, r: 1.2 + 2.2 * fade, alpha: fade * fade });
    }
  }
  return dots;
}

/**
 * 떠오르는 마름모 조각의 출발 자리.
 *
 * 난수 대신 황금각으로 흩어 놓아 몇 개를 세우든 한쪽에 몰리지 않고, 같은 개체는 늘 같은 그림을
 * 그린다. 조각은 동그라미가 아니라 마름모이고 위로 뜬다(화면 전체의 이펙트 규칙).
 */
export function showcaseSparkles(count: number): { x: number; y: number; size: number; delay: number }[] {
  const golden = 0.618033988749895;
  return Array.from({ length: count }, (_, index) => {
    const u = (index * golden) % 1;
    const v = ((index + 1) * golden * golden) % 1;
    return {
      x: 120 + u * (SHOWCASE_SIZE.width - 240),
      y: 520 + v * 700,
      size: 10 + (index % 3) * 5,
      delay: index * 110,
    };
  });
}
