import type { Puppet, PuppetSkinFrame } from "puppetforge";

/**
 * Secondary motion is a spring simulation, so one large frame is not equivalent to several editor frames.
 * Keep its integration interval close to PuppetForge's 60 fps preview while retaining ordinary slow-frame time.
 */
export const PUPPET_STEP_SECONDS = 1 / 60;
// A multi-second return from a background tab is suspended wall time, not useful animation or stable spring time.
export const PUPPET_BACKGROUND_GAP_SECONDS = 1;

/**
 * 서브스텝 하나가 편집기 간격보다 이만큼까지 길어지는 것은 허용한다.
 *
 * `ceil(elapsed / step)`을 그대로 쓰면 60fps의 실제 프레임(16.7ms)이 편집기 간격(16.667ms)을
 * 0.2% 넘는 것만으로 **매 프레임 두 번 적분한다** — 전투에서 가장 비싼 CPU 작업(정점 스키닝)이
 * 상시 두 배로 돌았다. 경계 바로 위의 값은 한 번으로 삼키고, 정말 긴 프레임만 나눈다.
 *
 * 이 여유가 걸리는 것은 배수 바로 위 구간뿐이라 서브스텝은 최대 1.25배(20.8ms)까지만 길어지고,
 * 그보다 긴 프레임은 여전히 정확히 편집기 간격으로 잘린다.
 */
export const PUPPET_STEP_TOLERANCE = 0.25;

/**
 * 한 프레임에 Puppet 하나를 적분하는 횟수의 상한.
 *
 * `Puppet.update`는 재생 시각만이 아니라 **정점 스키닝까지 매번** 하므로 가장 비싼 CPU 작업이다.
 * 느린 프레임을 편집기 간격으로 끝까지 나누면 느릴수록 일이 늘어 다음 프레임이 더 느려지는
 * 악순환이 생긴다 — 치즈케이크 대작전(SD 20마리)에서 프레임이 0.5초로 늘자 Puppet 갱신이
 * 프레임당 915번, CPU의 94%를 먹었다(v0.465.0 측정).
 *
 * 셋이면 20fps(약 54ms)까지는 예전과 똑같이 나뉘고, 그보다 느린 프레임만 서브스텝이 길어진다.
 * 길어져도 안전한 이유는 PuppetForge의 secondary 적분(`SecondaryMotion.apply`)이 스스로
 * dt를 1/30초로 자르기 때문이다 — 스프링은 폭주하지 않고, 재생 시각(`player.update`)과
 * 블렌드는 넘긴 시간을 그대로 받아 **흐른 시간은 이번 프레임에 전부 소비한다**(남은 몫을 다음
 * 프레임에 빚으로 넘기지 않는다 — 그러면 느린 프레임이 이어질 때 애니메이션이 영영 뒤처진다).
 */
export const PUPPET_MAX_STEPS_PER_FRAME = 3;

/**
 * Puppet에 넘길 **실제로 흐른 시간**(ms)을 고른다.
 *
 * 값이 셋인 이유는 Phaser의 어느 값도 혼자서는 실제 경과 시간이 아니기 때문이다.
 *
 * - `smoothedDeltaMs`(Scene UPDATE의 delta)는 `fps.smoothStep`이 평탄화한 값이고, `fps.min`보다
 *   느린 프레임의 delta를 **통째로 버린 뒤 1000/min으로 잘라** 보고한다. 우리 설정은 `min: 30`
 *   이라 6fps(166ms)로 도는 저사양 화면에서는 1초가 0.2초로 전달되어 정확히 5배 슬로모션이 된다.
 * - `rawDeltaMs`는 평탄화 이전 값이지만 **프레임 제한이 켜지면 콜백 간격이 아니라 rAF 간격**이다.
 *   `stepLimitFPS`가 `rawDelta`를 매 rAF마다 덮어쓰고 콜백은 몇 rAF에 한 번만 부르므로, 60 제한
 *   에서 이 값만 읽으면 Puppet만 절반 속도로 흘러 트윈과 어긋난다.
 * - `loopElapsedMs`는 호출부가 `TimeStep.time`(rawDelta를 계속 더한 벽시계)에서 직접 잰 두 갱신
 *   사이의 간격이라 두 경우 모두에서 맞다. 그래서 있으면 이것을 먼저 쓴다.
 *
 * 백그라운드 복귀처럼 비정상적으로 큰 값은 `advancePuppet`이 이미 버린다.
 */
export function puppetElapsedMs(rawDeltaMs: number, smoothedDeltaMs: number, loopElapsedMs?: number): number {
  // 첫 프레임이나 시계를 못 읽는 실행 환경(테스트 더블 등)에서는 아래 순서로 되돌아간다.
  if (Number.isFinite(loopElapsedMs) && (loopElapsedMs as number) > 0) return loopElapsedMs as number;
  if (!Number.isFinite(rawDeltaMs) || rawDeltaMs <= 0) return smoothedDeltaMs;
  return rawDeltaMs;
}

/** Advance one Puppet through stable, editor-sized steps (at most PUPPET_MAX_STEPS_PER_FRAME) and return the last vertex buffer. */
export function advancePuppet(puppet: Puppet, elapsedSeconds: number): Float32Array | null {
  return stepPuppet(elapsedSeconds, (step, output) => puppet.update(step, { output }), () => puppet.flush());
}

/**
 * `advancePuppet`과 같은 간격으로 굴리되 정점 대신 관절 행렬을 받는다(GPU 스키닝).
 *
 * 서브스텝마다 흔들림(secondary)은 그대로 적분하고, 정점 계산은 마지막 한 번도 하지 않는다 —
 * 정점은 정점 셰이더가 옮긴다. 그래서 느린 프레임에 서브스텝이 셋으로 늘어도 정점 일은 늘지 않는다.
 */
export function advancePuppetSkin(puppet: Puppet, elapsedSeconds: number): PuppetSkinFrame | null {
  return stepPuppet(elapsedSeconds, (step, output) => puppet.updateSkin(step, { output }), () => puppet.flushSkin());
}

/**
 * 서브스텝은 흔들림 적분을 위해 나누는 것이라 **결과는 마지막 걸음 것만 쓴다.** 그래서 앞 걸음은
 * `output: false`로 최종 행렬·palette·정점 계산을 건너뛴다(PuppetForge v0.46.0). 시간·흔들림·이벤트·
 * 블렌드는 그대로 흐르고, 마지막 걸음이 결과를 못 냈을 때(그 사이 동작이 멈췄다)만 `flush`가 건너뛴
 * 걸음의 결과를 같은 값으로 만든다 — 예전의 `advance(step) ?? result`와 같은 프레임이 나온다.
 */
function stepPuppet<T>(
  elapsedSeconds: number,
  advance: (step: number, output: boolean) => T | null,
  flush: () => T | null,
): T | null {
  // Negative/non-finite deltas are not real elapsed time, so they must neither rewind nor poison the remainder.
  if (!Number.isFinite(elapsedSeconds) || elapsedSeconds <= 0) return null;

  if (elapsedSeconds >= PUPPET_BACKGROUND_GAP_SECONDS) {
    // Background-return wall time is intentionally discarded instead of feeding seconds into an unstable spring.
    return null;
  }

  let result: T | null = null;
  // 경계 바로 위의 값을 한 번으로 삼킨다. 이유는 PUPPET_STEP_TOLERANCE 주석에 있다.
  const stepCount = Math.min(
    PUPPET_MAX_STEPS_PER_FRAME,
    Math.max(1, Math.ceil(elapsedSeconds / PUPPET_STEP_SECONDS - PUPPET_STEP_TOLERANCE)),
  );
  const step = elapsedSeconds / stepCount;

  // Substep size protects secondary integration; consuming every substep now keeps the coupled timeline truthful.
  for (let index = 0; index < stepCount; index += 1) {
    const last = index === stepCount - 1;
    const next = advance(step, last);
    if (next) result = next;
    else if (last) result = flush() ?? result;
  }
  return result;
}
