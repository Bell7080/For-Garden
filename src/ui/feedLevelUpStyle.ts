import type { Stats } from "../core/types";
import { GROWTH_STAT_KEYS } from "../core/relicProgression";

/**
 * 급여로 레벨이 오른 순간의 연출 — 값만 두는 순수 표다(`feedLevelUpEffect.ts`가 그린다).
 *
 * 경험치 줄이 끝까지 찼다가 비워지는 것만으로는 "올랐다"가 읽히지 않았다. 급여는 게임에서 가장 자주
 * 두드리는 버튼이라, 그 끝에 오는 레벨업이 **한 박자 크게** 터져야 연타의 보상이 된다. 여섯 겹이다:
 *
 * 1. **빛기둥** — SD 위로 빛이 내리꽂혀 하얗게 번쩍인 뒤 가늘어지며 사라진다(SD 뒤에 선다).
 * 2. **LEVEL UP! 띠** — SD 머리 위에서 글자가 하나씩 튀어 오르며 넘쳤다 돌아오고, 떠오르며 사라진다.
 * 3. **나선 불꽃** — 마름모 두 줄기가 SD를 감고 올라간다. 뒤로 돌 때는 SD 뒤, 앞으로 올 때는 앞에 선다.
 * 4. **경험치 줄 번쩍임** — 줄이 하얗게 번쩍이며 오른쪽으로 한 뼘 넘치고, 빛살이 줄을 훑는다.
 * 5. **능력치 상승 팝업** — 오른 몫이 오각형의 제 수치 위에서 `+N`으로 차례로 튀어 오른다(능력치 색).
 * 6. **충격파 점프** — SD가 통 튀어 오르고 발밑에서 납작한 마름모 파문이 퍼진다.
 *
 * 화면 전체의 규칙을 지킨다 — **동그라미를 쓰지 않고**(파문·불꽃 모두 마름모), 파편은 **위로** 뜨며,
 * 섬광은 상한(0.6)보다 옅고, **난수를 쓰지 않아** 같은 레벨업이 늘 같은 그림을 그린다.
 */
export const FEED_LEVEL_UP = {
  /** SD 위로 내리꽂히는 빛기둥. 폭과 높이(`heightRatio`)는 SD 키에 대한 비율이다. 위쪽 `fadeRatio`만큼은 `fadeBands`개의 띠로 나눠 투명하게 녹인다. */
  pillar: { widthRatio: 0.62, topY: 160, heightRatio: 2.6, fadeRatio: 0.6, fadeBands: 18, alpha: 0.5, flashAlpha: 0.58, dropMs: 120, holdMs: 140, narrowMs: 380, color: 0xfff1c2 },
  /** LEVEL UP! 글자. 한 글자씩 넘쳐 서고, 다 선 뒤 함께 떠오르며 사라진다. */
  banner: { size: 52, gap: 1, letterMs: 46, popMs: 260, overshoot: 1.45, holdMs: 520, rise: 34, fadeMs: 360, aboveHead: 30, color: "#ffe08a", stroke: "#3a2203" },
  /** SD를 감고 오르는 마름모 두 줄기. 한 줄기에 여섯 조각으로 끊는다. */
  spiral: { strands: 2, perStrand: 6, radiusRatio: 0.42, turns: 1.6, rise: 1.25, ms: 820, stagger: 55, size: 34, colors: [0xffe08a, 0x9ff3ff] },
  /** 경험치 줄. 넘치는 폭과 훑는 빛살. */
  bar: { overfill: 24, flashAlpha: 0.9, flashMs: 420, sweepMs: 460, sweepWidth: 46 },
  /** 능력치 팝업. 줄 사이 간격과 떠오르는 높이. */
  stat: { size: 30, lineGap: 38, stagger: 90, rise: 64, holdMs: 620, fadeMs: 360, axisSize: 30, axisLift: 22, axisRise: 40 },
  /** 점프 높이와 발밑 파문. 파문은 납작한 마름모다. */
  hop: { motion: true, height: 52, upMs: 170, downMs: 230, ring: { from: 40, to: 248, squash: 0.36, thickness: 6, ms: 520, alpha: 0.9, color: 0xffd45a }, glow: { alpha: 0.5, ms: 520, color: 0xffd45a } },
  /**
   * 전신 원화에도 SD와 같은 결을 입힌다 — 감아 오르는 마름모와 통 튀기·금빛. 원화는 화면을 크게
   * 차지하므로 튀는 높이를 줄이고, 파문은 판에 가리지 않게 발밑이 아니라 허리께에 둔다.
   * 빛기둥·LEVEL UP!은 SD 한 곳에만 선다(두 곳이면 어디를 봐야 할지 흐려진다).
   */
  portrait: {
    sparkSize: 52,
    hop: { motion: false, height: 26, upMs: 170, downMs: 260, ring: { from: 80, to: 420, squash: 0.3, thickness: 7, ms: 560, alpha: 0.55, color: 0xffd45a }, glow: { alpha: 0.42, ms: 620, color: 0xffd45a } },
  },
  /** 레벨 숫자가 한 번 부풀었다 돌아오는 몫. */
  levelPop: { scale: 1.32, ms: 360 },
  /**
   * 연출이 아직 도는 동안 또 오르면(꾹 눌러 연달아 먹일 때) 큰 연출을 다시 틀지 않는다 —
   * 줄 번쩍임·능력치·숫자만 다시 말한다. 겹치면 화면이 빛과 조각으로 덮인다.
   */
  cooldownMs: 1100,
} as const;

/** 능력치 한 줄 — 무엇이 얼마나 올랐나. 오른 것만, 오각형 순서대로 담는다. */
export interface StatGain {
  readonly key: "hp" | "def" | "res" | "atk" | "ap";
  readonly gain: number;
}

/**
 * 레벨이 오르기 전과 뒤의 능력치에서 오른 몫을 고른다. 성장은 오각형 다섯만 올리므로 그 다섯만 본다.
 * 반올림으로 생긴 0은 빼 "+0"이 서지 않게 한다.
 */
export function feedLevelUpStatGains(before: Stats, after: Stats): StatGain[] {
  const gains: StatGain[] = [];
  for (const key of GROWTH_STAT_KEYS) {
    const gain = Math.round(after[key] - before[key]);
    // 성장 축은 오각형 다섯뿐이라 이 단언은 `GROWTH_STAT_KEYS` 표를 그대로 따른다.
    if (gain > 0) gains.push({ key: key as StatGain["key"], gain });
  }
  return gains;
}

/**
 * 나선 불꽃 한 조각의 자리 — SD 발밑(0, 0) 기준, `height`는 SD 키.
 *
 * 줄기마다 반 바퀴씩 어긋나 서로 마주 보며 오르고, `depth`가 양수면 SD 앞(화면 쪽)이다. 위로 갈수록
 * 반지름이 조금 좁아져 끝이 모인다. 난수를 쓰지 않는다.
 */
export function feedSpiralPoint(strand: number, index: number, t: number, height: number): { x: number; y: number; depth: number; alpha: number; scale: number } {
  const { radiusRatio, turns, rise, perStrand, strands } = FEED_LEVEL_UP.spiral;
  const progress = Math.max(0, Math.min(1, t));
  const phase = (strand / strands) * Math.PI * 2 + (index / perStrand) * 0.9;
  const angle = phase + progress * turns * Math.PI * 2;
  const radius = height * radiusRatio * (1 - progress * 0.35);
  return {
    x: Math.cos(angle) * radius,
    // 바닥은 납작하게 눌러 위에서 내려다본 원통처럼 보이게 한다(세로 0.28).
    y: -progress * height * rise + Math.sin(angle) * radius * 0.28,
    depth: Math.sin(angle),
    alpha: progress < 0.15 ? progress / 0.15 : progress > 0.75 ? (1 - progress) / 0.25 : 1,
    scale: 1 - progress * 0.45,
  };
}

/** `LEVEL UP!` 글자 하나가 튀어 오르기 시작하는 시각(ms). 빈칸은 시간을 쓰지 않는다. */
export function feedBannerLetterDelay(text: string, index: number): number {
  let visible = 0;
  for (let i = 0; i < index; i += 1) if (text[i] !== " ") visible += 1;
  return visible * FEED_LEVEL_UP.banner.letterMs;
}

/** 몸이 통 튀는 한 번의 값. SD와 전신 원화가 같은 모양을 쓰고 크기만 다르다. */
export interface FeedHopSpec {
  /** 몸 동작(포효)을 함께 트는가. 원화는 동작이 없어 끈다. */
  readonly motion: boolean;
  readonly height: number;
  readonly upMs: number;
  readonly downMs: number;
  readonly ring: { readonly from: number; readonly to: number; readonly squash: number; readonly thickness: number; readonly ms: number; readonly alpha: number; readonly color: number };
  readonly glow: { readonly alpha: number; readonly ms: number; readonly color: number };
}
