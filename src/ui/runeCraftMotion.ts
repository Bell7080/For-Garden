import type { EffectKind } from "./effectPresets";
import type { StarTones } from "./stars";

/**
 * 룬 세공·각인 결과가 **박히는 순간**의 순수 규칙이다.
 *
 * Phaser를 모르는 값만 둔다 — 표식의 색, 박히는 배율과 시간, 확률 줄이 흘러가는 시간,
 * 연타를 받아 두는 깊이. 세공은 한 줄에 세 번씩 반복하는 일이라 **결과가 손끝에서 곧바로
 * 터져야** 몇 번 눌렀는지가 화면에 남는다. 그 무게를 화면이 눈대중으로 고치면 성공과 실패가
 * 같은 크기로 앉아 무엇이 성공이었는지 되짚어야 한다.
 */

/** 세공 한 번이 남기는 결과. 각인은 룬 하나에 한 번뿐이라 따로 선다. */
export type RuneCraftImpactKind = "success" | "fail" | "engrave";

/**
 * 세공 결과 표식의 색.
 *
 * 성공은 푸른 다이아로 박히고, 실패는 다크체리로 가라앉는다 — 실패도 "아무 일 없음"이 아니라
 * 한 번 새겨진 자국이라 자리를 지킨다. 각인은 맨 뒤에 금빛으로 박힌다.
 * 모양과 겹은 성급 별과 같은 `stars.ts` 규칙을 그대로 쓰고 색만 갈아 끼운다.
 *
 * 실패도 **판 위에서 읽혀야 한다.** 예전 몸통(0x6e1526)은 줄 판(0x121a23)과 명도가 가까워
 * 세 칸이 다 찬 줄에서도 무엇이 실패였는지 눈에 들어오지 않았다. 몸통과 빛무리를 함께 올리되
 * 빛은 성공보다 좁게 둬 **여전히 뒤로 물러난다**.
 */
export const RUNE_MARK: Readonly<Record<RuneCraftImpactKind, StarTones>> = {
  success: { shadow: 0x04121e, halo: 0x8fdfff, glow: 0xcdefff, body: 0x4fb8ff },
  fail: { shadow: 0x14040a, halo: 0xb03352, glow: 0xd85470, body: 0x8e1b31, bloom: 0.6 },
  // 각인은 완성을 뜻하는 금빛이라 빛무리만 넓게 잡는다 — 크기가 아니라 빛으로 구분한다.
  engrave: { shadow: 0x1a1200, halo: 0xffd166, glow: 0xffe9a8, body: 0xffc233, bloom: 1.25 },
};

/** 결과 하나가 박히는 동작. 크기와 시간만 갈리고 모양은 같은 다이아 하나다. */
export interface RuneCraftImpactSpec {
  /** 박히기 시작하는 배율. 크게 나타나 제 크기로 꽂힌다. */
  fromScale: number;
  /** 시작 자리가 제자리에서 위아래로 떨어진 거리(px). 음수는 위에서 내려앉는다는 뜻이다. */
  fromY: number;
  /** 제자리에 앉기까지(ms). */
  settleMs: number;
  /** 앉는 곡선. 성공·각인만 제 크기를 살짝 지나쳐 되돌아온다. */
  ease: string;
  /** 함께 터지는 이펙트 종류. 파편·파문·섬광 값은 `EFFECT_PRESETS` 한 표가 갖는다. */
  effect: EffectKind;
  /** 판이 한 번 얻어맞고 되돌아오는 거리(px). 0이면 흔들지 않는다. */
  kickPx: number;
}

/**
 * 결과별 박힘.
 *
 * - **성공**은 크게 나타나 제 크기를 지나쳐 꽂힌다("깡").
 * - **실패**는 위에서 떨어져 내려앉는다. 지나치지 않고 그대로 가라앉으므로 같은 자리에
 *   박히면서도 손맛이 다르다.
 * - **각인**은 룬 하나에 한 번뿐이라 가장 크게 나타나고, 그 순간만 판을 한 번 때린다.
 *   세공까지 흔들면 연타 내내 판이 떨려 어느 것이 마지막 한 번인지 읽히지 않는다.
 */
export const RUNE_CRAFT_IMPACT: Readonly<Record<RuneCraftImpactKind, RuneCraftImpactSpec>> = {
  success: { fromScale: 2.5, fromY: 0, settleMs: 210, ease: "Back.Out", effect: "craftSuccess", kickPx: 0 },
  fail: { fromScale: 1.45, fromY: -22, settleMs: 250, ease: "Cubic.In", effect: "craftFail", kickPx: 0 },
  engrave: { fromScale: 3.2, fromY: 0, settleMs: 280, ease: "Back.Out", effect: "craftEngrave", kickPx: 7 },
};

/**
 * 누른 순간 목표 칸에서 한 번 번지는 예고.
 *
 * 서버가 답하기까지 한 박자가 비어, 그동안 화면에 아무 일도 없으면 연타가 먹지 않은 것처럼
 * 보인다. 결과 색을 미리 말할 수는 없으므로 **아직 비어 있는 그 칸**만 흰빛으로 한 번 크게
 * 벌어졌다 꺼진다 — "때렸다"까지만 알리고 "무엇이 나왔나"는 결과가 말한다.
 */
export const RUNE_CRAFT_STRIKE = { scale: 1.8, ms: 150, color: 0xffffff, alpha: 0.9 } as const;

/**
 * 확률 줄과 그 위 두 수치가 목표로 흘러가는 시간.
 *
 * 곧바로 갈아 끼우면 성공·실패로 확률이 10%씩 움직인 것이 화면에 남지 않는다. 게이지와 수치가
 * **같은 값을 같은 속도로** 따라가야 "이번에 내려갔다"가 읽힌다(전투 게이지의 `stepMeters`와
 * 같은 이유다).
 */
export const RUNE_CHANCE_ROLL = { ms: 380, ease: "Cubic.Out" } as const;

/** 서버 응답을 기다리는 동안 눌러 둘 수 있는 세공 수. */
export const RUNE_CRAFT_QUEUE_LIMIT = 2;

/** 연타 한 번을 어떻게 받을지. */
export type RuneCraftTapPlan = "run" | "queue" | "drop";

/**
 * 지금 누른 한 번을 곧바로 보낼지, 쌓아 둘지, 버릴지 정한다.
 *
 * 세공은 같은 줄을 세 번씩 두드리는 일이라 **응답을 기다리는 동안 누른 손도 세어 준다** —
 * 기다리는 동안의 입력을 버리면 연타가 한 번으로 줄고, 무한히 쌓으면 손을 뗀 뒤에도 골드가
 * 계속 빠져나간다. 각인은 되돌릴 수 없는 한 번의 선택이라 **절대 쌓지 않는다.**
 */
export function planRuneCraftTap(state: { pending: boolean; queued: number; repeatable: boolean }): RuneCraftTapPlan {
  if (!state.pending) return "run";
  if (!state.repeatable) return "drop";
  return state.queued < RUNE_CRAFT_QUEUE_LIMIT ? "queue" : "drop";
}
