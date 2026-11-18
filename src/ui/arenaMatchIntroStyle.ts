/**
 * 매칭이 잡힌 순간의 「나 VS 상대」 연출 값 — 시간·자리·세기를 이 표 하나가 갖는다(Phaser 없는 순수 값).
 *
 * 흐름은 세 박자다. ① 두 이름 띠가 양옆에서 스르륵 밀려 들어오고 ② 가운데 VS가 크게 떨어져 쾅 박히며(작은 흔들림)
 * ③ 한 박자 쉰 뒤 두 띠가 들어온 반대쪽으로 슈륭 빠지며 밴픽 화면이 드러난다. 움직이는 것은 위치·배율·불투명도뿐이다 —
 * 밴 시계가 이미 도는 판이라 전부 합쳐 2초를 넘기지 않고, 누르면 곧바로 ③으로 건너뛴다.
 */
export const ARENA_MATCH_INTRO = {
  depth: 3000,
  /** 화면을 누르는 어둠. */
  dimAlpha: 0.84,
  dimInMs: 140,
  /** ① 띠가 미끄러져 들어오는 시간 — 둘이 함께 출발한다. */
  slideInMs: 380,
  /** ② VS가 떨어지는 시간(띠가 다 선 뒤). */
  slamDelayMs: 300,
  slamMs: 170,
  slamFromScale: 3.2,
  shake: { ms: 200, intensity: 0.011 },
  /** ③ 앞의 뜸. */
  holdMs: 720,
  /** ③ 빠지는 시간. */
  slideOutMs: 280,
  /** 움직임 줄이기 — 미끄럼·배율·흔들림 없이 이만큼 서 있다 옅어진다. */
  reducedHoldMs: 900,
  band: { width: 1240, height: 210, slant: 64 },
  /** 상대는 위·오른쪽에서, 나는 아래·왼쪽에서 들어온다(밴픽 화면에서 상대가 위, 내가 아래인 것과 같다). */
  foe: { y: 760 },
  me: { y: 1160 },
  vs: { y: 960, size: 150 },
  name: { size: 64, maxWidth: 820, labelSize: 28, labelGap: 58 },
  /** 띠가 들어오는 출발점 — 화면 밖 한 띠 폭만큼. */
  offscreen: 1300,
  /** 실제 시간 상한의 여유 — 끝까지 기다린 길이에 이만큼 더 지나면 어떤 프레임 상태든 걷는다. */
  realTimeSlackMs: 600,
} as const;

/** 끝까지 기다렸을 때의 전체 길이(ms). 움직임 줄이기면 짧은 정지 화면이다. */
export function arenaMatchIntroDuration(reduceMotion: boolean): number {
  const S = ARENA_MATCH_INTRO;
  if (reduceMotion) return S.dimInMs + S.reducedHoldMs + S.slideOutMs;
  return S.dimInMs + Math.max(S.slideInMs, S.slamDelayMs + S.slamMs) + S.holdMs + S.slideOutMs;
}
