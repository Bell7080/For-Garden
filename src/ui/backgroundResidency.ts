/**
 * 배경 원화를 언제까지 GPU에 남겨 둘지 정하는 순수 규칙.
 *
 * **파일 용량은 원화가 차지하는 메모리를 말해 주지 않는다.** `background_001.webp`는 1.3MB지만
 * 1882×3344라 디코드되면 RGBA로 25.2MB를 차지한다. 열여덟 장을 부트에서 한꺼번에 올리던
 * v0.84.1까지는 로비에 닿기도 전에 텍스처만 590MB였고, 그 상태로 모바일에 패키징하면 iOS는
 * 프로세스를 종료시키고 안드로이드 중저가 단말은 GPU에서 먼저 막힌다.
 *
 * 그래서 **지금 화면이 쓰는 것만 올려 두고 쓰는 곳이 사라지면 내린다.** 어느 화면이 무엇을
 * 쓰는지 표로 적지 않는 이유는, 표는 화면이 늘 때마다 빠뜨릴 자리가 되기 때문이다. 대신
 * 원화를 세운 표시 객체가 살아 있는 동안만 붙잡고 그 객체가 죽으면 놓는다 — 화면이 늘어도
 * 적을 것이 없다.
 *
 * Phaser 없는 순수 모듈에 두는 이유는 이 규칙이 눈으로 확인할 수 없는 종류(메모리)라
 * 테스트로만 지킬 수 있기 때문이다.
 */

/**
 * 쓰는 곳이 사라진 뒤에도 남겨 둘 최대 장수.
 *
 * 0으로 두면 로비 → 도감 → 로비처럼 오가는 길에서 같은 원화를 매번 다시 읽어 그때마다
 * 한 번씩 비어 보인다. 2면 되돌아오는 한 걸음은 항상 즉시 뜨고, 최악이라도 붙잡힌 것
 * 위에 두 장(50MB 남짓)만 더 남는다.
 */
export const BACKGROUND_IDLE_KEEP = 2;

/**
 * 아무도 쓰지 않아도 내리지 않는 키.
 *
 * 카드 뒷배경은 도감·편성·전투 프로필·연구 결과의 **카드 한 장마다** 깔리므로, 화면을 옮길
 * 때마다 내렸다 올리면 그리드가 뜰 때마다 카드 뒤가 한 번씩 빈다. 6.3MB짜리 한 장이라
 * 붙잡아 두는 비용이 다시 읽는 값보다 싸다.
 */
export const BACKGROUND_PINNED: readonly string[] = ["background-card-backdrop"];

/** 지금 무엇이 올라가 있고 무엇이 붙잡혀 있는지. */
export interface BackgroundResidency {
  /** 키별로 그 원화를 세운 채 살아 있는 표시 객체 수. 0이 되면 idle로 내려간다. */
  readonly users: Readonly<Record<string, number>>;
  /** 쓰는 곳이 없지만 아직 GPU에 남겨 둔 키. 오래 놓인 것이 앞이다. */
  readonly idle: readonly string[];
}

export interface ResidencyLimits {
  readonly idleKeep?: number;
  readonly pinned?: readonly string[];
}

export function emptyBackgroundResidency(): BackgroundResidency {
  return { users: {}, idle: [] };
}

/** 지금 GPU에 남아 있어야 하는 키인지. 붙잡혀 있거나 idle 목록에 있으면 그렇다. */
export function isBackgroundResident(state: BackgroundResidency, key: string): boolean {
  return (state.users[key] ?? 0) > 0 || state.idle.includes(key);
}

/**
 * 표시 객체 하나가 그 원화를 쓰기 시작했다.
 * idle에 놓여 있었다면 도로 붙잡아 내려가지 않게 한다.
 */
export function retainBackground(state: BackgroundResidency, key: string): BackgroundResidency {
  return {
    users: { ...state.users, [key]: (state.users[key] ?? 0) + 1 },
    idle: state.idle.filter((idleKey) => idleKey !== key),
  };
}

/**
 * 그 원화를 쓰던 표시 객체가 죽었다.
 *
 * 마지막 하나가 죽어도 곧바로 내리지 않고 idle 뒤에 세운다 — 되돌아오는 한 걸음까지 다시
 * 읽으면 화면을 오갈 때마다 배경이 한 번씩 빈다. 넘치는 만큼만 앞에서부터 내보낸다.
 *
 * `evict`는 실제로 GPU에서 지워야 하는 키다. 호출부가 이 목록만 지우면 되고, 어떤 순서로
 * 지울지 판단하지 않는다.
 */
export function releaseBackground(
  state: BackgroundResidency,
  key: string,
  limits: ResidencyLimits = {},
): { state: BackgroundResidency; evict: readonly string[] } {
  const remaining = (state.users[key] ?? 0) - 1;
  const users = { ...state.users };
  if (remaining > 0) {
    users[key] = remaining;
    return { state: { users, idle: state.idle }, evict: [] };
  }
  delete users[key];

  const pinned = limits.pinned ?? BACKGROUND_PINNED;
  const idleKeep = Math.max(0, limits.idleKeep ?? BACKGROUND_IDLE_KEEP);
  // 붙잡아 두기로 한 것도 idle 목록에는 남긴다 — 목록이 곧 "지금 올라가 있는 것"이라
  // 빼 버리면 실제로는 GPU에 있는 원화를 없다고 답한다. 다만 **자리를 세지 않는다**:
  // 세면 그 한 장이 남은 자리를 차지해 정작 오가는 길의 배경이 먼저 밀려난다.
  const idle = [...state.idle.filter((idleKey) => idleKey !== key), key];
  const evictable = idle.filter((idleKey) => !pinned.includes(idleKey));
  const evict = evictable.slice(0, Math.max(0, evictable.length - idleKeep));
  return { state: { users, idle: idle.filter((idleKey) => !evict.includes(idleKey)) }, evict };
}
