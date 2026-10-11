import type { PuppetAfterimage } from "../puppets/IndexedPuppetCreature";

/**
 * 폭주의 잉크 결 — Phaser 없이 값과 모양만 정한다(그리는 것은 `BattleScene`·`EffectManager`).
 *
 * 폭주는 빛이 아니라 **화난 테두리**다. 몸을 검게·붉게 열두 방향으로 비껴 그려 바깥에 먹선과
 * 붉은 띠를 세우고, 그 두께가 위험 경보처럼 숨 쉰다(`sirenMs`마다 한 번). 발밑에서는 붉은
 * 마름모가 같은 박자로 퍼지고, 머리 옆에는 빠직 표식(💢)이 박자에 맞춰 부풀었다 줄며 좌우를
 * 오간다. 몸 자체에는 붉은 기운을 아주 옅게만 덮는다 — 원화를 물들이면 누구인지가 흐려진다.
 *
 * 예전의 속성색 tint 맥동을 대신한다. 테두리 24겹은 폭주 중인 개체에만 든다.
 */
export const FEVER_INK = {
  /** 경보 한 박자(ms). 두께·발밑 마름모·표식이 모두 이 박자를 탄다. */
  sirenMs: 640,
  /** 몸 둘레로 비껴 그리는 방향 수. */
  directions: 12,
  /** 붉은 띠의 두께(px) — 가장 얇을 때와 박자의 정점에서 더하는 몫. */
  thickness: [5, 9],
  /** 먹선은 붉은 띠보다 이만큼 더 바깥에 선다. */
  inkGap: 6.4,
  ink: 0x2e2836,
  /** 박자의 앞뒤 절반이 쓰는 붉은 두 톤 — 띠가 깜빡이듯 켜졌다 꺼진다. */
  red: [0xe0302a, 0xff3b30],
  /** 몸 위에 덮는 붉은 기운(0~1). 박자의 정점에서도 1할 남짓이다. */
  bodyFill: { color: 0xff2a1f, amount: [0.03, 0.11] },
  /** 들고 날 때 녹아드는 시간(ms). */
  fadeInMs: 200,
  fadeOutMs: 300,
  /** 발밑 사이렌 — 두 겹이 반 박자씩 어긋나 퍼진다. */
  siren: { rings: 2, from: 72, grow: 164, fillAlpha: 0.16, inkWidth: [3, 8], lineWidth: [2.4, 3.2] },
  /** 머리 옆 빠직 표식. 두 박자마다 반대편으로 옮겨 간다. */
  anger: { color: 0xff3b30, side: 92, lift: 12, scale: [1, 0.45], tilt: 0.2 },
} as const;

/** 경보 박자 0(가장 얇음)~1(정점). */
export function feverPulse(ageMs: number): number {
  return 0.5 + 0.5 * Math.sin((ageMs / FEVER_INK.sirenMs) * Math.PI * 2);
}

/**
 * 들고 나는 진하기. 폭주가 이어지는 동안은 `endedMs`를 비운다 — 끝난 뒤의 경과를 넘기면
 * 그만큼 녹아 없어진다.
 */
export function feverFade(ageMs: number, endedMs?: number): number {
  const rise = Math.min(1, Math.max(0, ageMs / FEVER_INK.fadeInMs));
  if (endedMs === undefined) return rise;
  return Math.min(rise, Math.max(0, 1 - endedMs / FEVER_INK.fadeOutMs));
}

/**
 * 몸 둘레로 비껴 그릴 겹들. **먹선이 먼저**(더 바깥, 더 뒤), 붉은 띠가 그 안쪽이다 — 순서가
 * 바뀌면 붉은 띠를 먹이 덮어 테두리가 검게만 보인다.
 */
export function feverOutlineSteps(pulse: number, fade: number, scale = 1): PuppetAfterimage[] {
  if (fade <= 0) return [];
  const [base, swing] = FEVER_INK.thickness;
  const red = (base + swing * pulse) * fade * scale;
  const ink = red + FEVER_INK.inkGap * scale;
  const redColor = FEVER_INK.red[pulse > 0.5 ? 1 : 0];
  const ring = (distance: number, color: number): PuppetAfterimage[] => Array.from({ length: FEVER_INK.directions }, (_, index) => {
    const angle = (index / FEVER_INK.directions) * Math.PI * 2;
    return { dx: Math.cos(angle) * distance, dy: Math.sin(angle) * distance, alpha: fade, color };
  });
  return [...ring(ink, FEVER_INK.ink), ...ring(red, redColor)];
}

/** 몸 위에 덮을 붉은 기운의 양. */
export function feverBodyFill(pulse: number, fade: number): number {
  const [low, high] = FEVER_INK.bodyFill.amount;
  return (low + (high - low) * pulse) * fade;
}

/** 발밑 사이렌 마름모들 — 반지름과 진하기(0~1). */
export function feverSirenRings(ageMs: number): { radius: number; strength: number }[] {
  const { rings, from, grow } = FEVER_INK.siren;
  return Array.from({ length: rings }, (_, index) => {
    const phase = ((ageMs / FEVER_INK.sirenMs) + index / rings) % 1;
    const eased = 1 - (1 - phase) ** 3;
    return { radius: from + grow * eased, strength: 1 - phase };
  });
}

/** 빠직 표식의 자리 — 어느 쪽(-1 왼쪽 · 1 오른쪽)에, 얼마나 부풀어 서는지. */
export function feverAngerPlacement(ageMs: number): { side: -1 | 1; scale: number } {
  const side = Math.floor(ageMs / (FEVER_INK.sirenMs * 2)) % 2 ? 1 : -1;
  const [base, swell] = FEVER_INK.anger.scale;
  return { side, scale: base + swell * feverPulse(ageMs) };
}
