import type { SkirmishState } from "../core/skirmish";

/**
 * Playwright가 전투 씬 연결만 빠르게 확인할 때 쓰는 테스트 전용 입력이다.
 * 이 타입은 번들에 남아도 설정 창구는 아래 MODE 조건 없이는 절대 열리지 않는다.
 */
interface BattleTestConfig {
  seed: number;
  /** `result`는 다음 타격으로 끝나는 판, `ultimate`는 아군 궁극기가 찬 채로 여는 판(컷인 캡처용)이다. */
  preset?: "result" | "ultimate";
}

declare global {
  interface Window {
    /** `vite build --mode test`에서만 읽는 결정론적 전투 설정이다. */
    __PF_BATTLE_TEST__?: BattleTestConfig;
  }
}

/** 테스트 모드가 아니면 전역 객체를 읽지 않아 프로덕션에서 주입 경로 자체를 닫는다. */
function testConfig(): BattleTestConfig | undefined {
  if (import.meta.env.MODE !== "test" || typeof window === "undefined") return undefined;
  return window.__PF_BATTLE_TEST__;
}

/** 같은 seed가 브라우저와 실행 속도에 관계없이 같은 난수열을 내도록 작은 LCG를 만든다. */
export function battleRandom(): () => number {
  const config = testConfig();
  if (!config) return Math.random;
  let state = config.seed >>> 0;
  return () => {
    state = (Math.imul(state, 1_664_525) + 1_013_904_223) >>> 0;
    return state / 0x1_0000_0000;
  };
}

/** 결과 팝업 E2E만 다음 유효 타격으로 끝나게 하며 전투 공식은 전혀 바꾸지 않는다. */
export function applyBattleTestPreset(state: SkirmishState): void {
  const preset = testConfig()?.preset;
  if (preset === "ultimate") {
    // 궁극기 컷인을 실제로 여는 E2E만 아군 게이지를 채워 둔다. 전투 공식은 건드리지 않는다.
    for (const fighter of state.fighters) if (fighter.side === "player") fighter.energy = fighter.def.ultimate.cost;
    return;
  }
  if (preset !== "result") return;
  for (const fighter of state.fighters) {
    // 양쪽을 전장 중앙에 붙이고 아군의 다음 공격만 열어 결과 방향과 도달 시점을 함께 고정한다.
    fighter.x = (state.arena.left + state.arena.right) / 2;
    fighter.y = (state.arena.top + state.arena.bottom) / 2;
    fighter.attackCooldown = fighter.side === "player" ? 0 : 999;
    if (fighter.side === "enemy") fighter.hp = 1;
  }
}
