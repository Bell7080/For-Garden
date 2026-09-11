import type { EffectManager } from "./EffectManager";
import type { EffectKind } from "../ui/effectPresets";

/**
 * 늘 맨 위에 떠 있는 이펙트 겹의 **공개 진입점**이다.
 *
 * 메뉴의 판(룬 세공처럼 결과가 박히는 팝업)도 이펙트를 쓰지만, 팝업은 제 씬에 파티클을 만들 수
 * 없다 — 팝업 층은 깊이 2000대라 씬에서 터뜨린 것이 판 아래에 묻히고, 화면마다
 * `EffectManager`를 하나 더 만들면 emitter가 화면 수만큼 늘어난다. 그래서
 * `EffectOverlayScene`이 만든 매니저 하나를 여기 걸어 두고, 부르는 쪽은 **어디서 무엇이
 * 터졌는지만** 넘긴다. 파문 풀과 프레임 예산(`EFFECT_BUDGET`)도 화면 조작과 함께 쓴다.
 *
 * 씬이 아니라 이 경계가 손잡이를 갖는 이유는, `src/ui`가 `src/scenes`를 거꾸로 import하지
 * 않게 하려는 것이다.
 */
let overlay: EffectManager | undefined;

/** 이펙트 겹이 만들어지고 사라질 때 제 매니저를 걸고 내린다. */
export function setOverlayEffects(effects: EffectManager | undefined): void {
  overlay = effects;
}

/**
 * 판 위에서 한 방 터뜨린다. 좌표는 게임 화면 좌표다.
 *
 * 겹이 아직 없는 문맥(부트 이전·테스트)에서는 **조용히 아무것도 하지 않는다** — 부르는 쪽이
 * 성공을 묻지 않으므로 연출 사정이 조작 흐름을 막지 않는다.
 */
export function burstOverlayEffect(kind: EffectKind, x: number, y: number, color: number): void {
  overlay?.burst(kind, x, y, { color });
}
