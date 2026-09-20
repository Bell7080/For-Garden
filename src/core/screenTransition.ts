/**
 * 화면이 갈릴 때의 **시간과 거리**를 정하는 순수 규칙.
 *
 * 씬 전환과 팝업 여닫기는 화면마다 제각각 구현되어 있었다 — 도감은 카드가 촤르륵 깔리고,
 * 상점은 전시대가 올라오는데, 나머지 열대여섯 화면은 아무 일도 없이 **툭 갈렸다.** 같은
 * 손짓으로 다른 화면에 들어가는데 어디서는 연출이 있고 어디서는 없으면, 있는 쪽이 특별한
 * 것이 아니라 **없는 쪽이 덜 만든 것으로** 읽힌다.
 *
 * Phaser를 읽지 않는 이유는 배치표와 같다 — 화면과 회귀 테스트가 같은 값을 읽어야 한다.
 *
 * ## 값을 이렇게 잡은 이유
 *
 * **세로 모바일은 한 손으로 빠르게 훑는다.** 화면을 넘나드는 일이 잦으므로 전환이 길면 그
 * 길이가 그대로 기다림이 된다. 나가는 쪽을 들어오는 쪽보다 **짧게** 두는 것도 같은 이유다 —
 * 이미 볼 일이 끝난 화면을 천천히 배웅할 까닭이 없고, 들어오는 화면은 무엇이 새로 섰는지
 * 읽을 짬이 필요하다.
 *
 * **거리는 화면 폭이 아니라 한 뼘이다.** 화면을 통째로 밀어내면 전환이 "장면 전환"이 되어
 * 탭을 누른 것보다 크게 느껴지고, 그만큼 시간도 길어야 한다. 판이 살짝 떠오르는 정도면
 * "갈렸다"는 이미 말한다.
 */

/** 움직임을 얼마나 줄일지. `motionPolicy`의 배율을 그대로 받는다. */
export interface TransitionMotion {
  /** 1이면 그대로, 0이면 움직이지 않는다. `reduceMotion`이 켜지면 작아진다. */
  readonly factor: number;
}

/** 한 번의 전환이 쓰는 시간·거리·자리. 화면은 이 값을 읽기만 한다. */
export interface TransitionTiming {
  /** 밀리초. 0이면 트윈을 걸지 않고 곧바로 끝난 상태로 둔다. */
  readonly duration: number;
  /** 화면 좌표에서 움직이는 거리(px). */
  readonly distance: number;
  /** 시작 불투명도. 끝은 언제나 1(들어올 때)이거나 0(나갈 때)이다. */
  readonly alpha: number;
  /** 시작 배율. 판이 살짝 커지며 들어오는 몫이다. */
  readonly scale: number;
}

/**
 * 전환 시간의 단일 출처.
 *
 * ## 나가는 연출은 두지 않는다
 *
 * 한때 씬이 나갈 때도 130ms 동안 어두워지며 가라앉았다. 그러려면 **`scene.start`를 그만큼
 * 미뤄야 한다** — 곧바로 부르면 나가는 씬이 그 자리에서 죽어 연출이 한 프레임도 그려지지
 * 않기 때문이다. 그런데 미루는 일을 씬의 시계(`delayedCall`)가 맡으므로, 그 타이머는
 * **프레임이 돌아야 깨어난다.** 편성에서 전투로 넘어가는 것처럼 그 순간 메인 스레드가 바쁜
 * 자리에서는 98ms짜리 타이머가 **1.5초 넘게** 늦었다(E2E가 그 자리에서 5초를 기다리다
 * 실패했고, 실측 로그가 `startScene` → `begin` 사이의 그 간격을 그대로 보여 주었다).
 *
 * 즉 나가는 연출은 **화면이 갈리는 일 자체에 상한 없는 기다림을 얹는다.** 손이 이미 다음
 * 화면을 향한 뒤라 그 시간은 통째로 지연으로만 남는다. 그래서 걷어 냈다 — 들어오는 쪽만으로도
 * "화면이 갈렸다"는 충분히 말하고, 대가가 없다. 벽시계 타이머로 바꾸는 길도 있었지만, 그러면
 * 프레임이 긴 자리에서 연출이 끊겨 보일 뿐 기다림은 그대로 남는다.
 *
 * **다시 만들지 않는다.** 나가는 연출이 필요해 보이면 먼저 이 지연을 어떻게 없앨지부터 푼다.
 */
export const TRANSITION = {
  /**
   * 씬이 들어올 때 — 한 뼘 아래에서 떠오르며 밝아진다.
   *
   * **검은 화면에서 밝아지지 않는다.** 시작 불투명도가 0이던 때는 화면을 옮길 때마다 한 번씩
   * 암전을 지나, 자주 오가는 손에는 전환이 아니라 **번쩍임**으로 읽혔다. 완전히 지우지 않고
   * 살짝 엷어진 자리에서 올라오면 "갈렸다"는 그대로 말하면서 깜빡이지 않는다.
   */
  sceneIn: { duration: 190, distance: 26, alpha: 0.45, scale: 1 },
  /**
   * 핵심 화면 다섯 사이를 오갈 때.
   *
   * **이 다섯은 성격이 다르다.** 들어갔다 나오는 화면이 아니라 **나란히 놓인 자리**라, 손이
   * 하루에도 수십 번 오간다. 그 자리에 일반 씬 전환을 쓰면 같은 연출을 그만큼 되풀이해 보게
   * 되고, 짧은 암전이 겹쳐 화면이 깜빡이는 것으로 느껴진다.
   *
   * 그래서 **위아래가 아니라 좌우로** 지나가고, 엷어지는 몫도 거의 남기지 않는다 — 어느 쪽에서
   * 들어왔는지가 곧 그 화면이 줄의 어느 쪽에 있는지라, 방향 자체가 자리를 말한다.
   */
  navSwitch: { duration: 160, distance: 72, alpha: 0.72, scale: 1 },
  /** 팝업이 열릴 때 — 누른 자리에서 부풀어 오른다. */
  popupIn: { duration: 210, distance: 0, alpha: 0, scale: 0.94 },
  /**
   * 팝업이 닫힐 때.
   *
   * **여는 것보다 확실히 짧다.** 닫는 손은 이미 다음 조작을 하려는 손이라, 사라지는 판을
   * 기다리게 하면 그 판이 아직 입력을 먹고 있는 것처럼 느껴진다.
   */
  popupOut: { duration: 120, distance: 0, alpha: 0, scale: 0.96 },
} as const satisfies Record<string, TransitionTiming>;

/** 위 표의 어느 전환인가. */
export type TransitionKind = keyof typeof TRANSITION;

/**
 * 움직임 설정을 먹인 실제 값.
 *
 * **`factor`가 0이면 시간과 거리를 함께 0으로 만든다.** 시간만 0으로 두면 판이 옮겨진 자리에
 * 그대로 굳고, 거리만 0으로 두면 아무것도 움직이지 않는 트윈을 그 시간만큼 기다린다.
 * 불투명도와 배율도 제자리로 되돌려, 움직임을 끈 사람에게는 **곧바로 완성된 화면**이 선다.
 */
export function transitionTiming(kind: TransitionKind, motion: TransitionMotion): TransitionTiming {
  const factor = clamp01(motion.factor);
  const base = TRANSITION[kind];
  if (factor === 0) return { duration: 0, distance: 0, alpha: 1, scale: 1 };
  return {
    duration: Math.round(base.duration * factor),
    distance: Math.round(base.distance * factor),
    // 불투명도와 배율은 **덜 움직이게** 줄인다 — 0.94배로 부풀던 판이 절반이면 0.97배다.
    alpha: 1 - (1 - base.alpha) * factor,
    scale: 1 - (1 - base.scale) * factor,
  };
}
function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 1;
  return Math.min(1, Math.max(0, value));
}
