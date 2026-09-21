/**
 * Puppet 원화를 언제까지 GPU에 남겨 둘지 정하는 순수 규칙.
 *
 * 배경 원화에는 이미 같은 규칙이 있는데(`src/ui/backgroundResidency.ts`) **Puppet에는 없었다** —
 * 한 번 올린 묶음은 `textures.remove`를 부르는 곳이 저장소에 한 군데도 없어 게임이 끝날 때까지
 * 남았다. 실측으로 SD 26장이 164MB, 전신 32장이 212MB이고(둘 다 한 장 6.5MB 안팎), 도감은
 * 카드 한 장마다 전신을 하나씩 올리므로 **도감을 한 번 열면 그것만으로 165MB가 영영 붙잡힌다.**
 * 배경 열여덟 장을 부트에서 올리다 590MB가 되어 걷어 냈던 자리와 같은 종류의 문제다.
 *
 * 규칙도 같다 — 어느 화면이 무엇을 쓰는지 표로 적지 않고, **원화를 세운 표시 객체가 사는
 * 동안만 붙잡고 죽으면 놓는다.** 표는 화면이 늘 때마다 빠뜨릴 자리가 된다.
 *
 * **배경과 다른 것은 둘이다.**
 * 1. **붙잡아 두는 키를 두지 않는다.** 배경에는 카드 한 장마다 깔리는 뒷배경이 있어 그것만
 *    `BACKGROUND_PINNED`으로 잡아 두지만, 모든 화면이 함께 쓰는 Puppet은 없다. 부트가 미리
 *    읽는 묶음도 **파싱만** 해 두는 것이라 GPU 텍스처와는 다른 비용이다 — 여기서 붙잡을
 *    이유가 되지 않는다.
 * 2. **내릴 때는 파싱 결과까지 함께 놓는다.** 일꾼이 디코드한 원화는 GPU에 올리는 순간
 *    버려지고(`ensureTexture`), 일꾼 경로의 `Puppet`은 압축 원본을 들고 있지 않다. 텍스처만
 *    지우면 다시 올릴 그림이 없어 그 묶음이 통째로 못 서게 되므로, 내린다는 것은 **다음에
 *    ZIP부터 다시 읽는다**는 뜻이다. 그 비용이 곧 아래 `PUPPET_IDLE_KEEP`이 존재하는 이유다.
 *
 * Phaser 없는 순수 모듈에 두는 이유는 이 규칙이 눈으로 확인할 수 없는 종류(메모리)라
 * 테스트로만 지킬 수 있기 때문이다.
 */

/**
 * 쓰는 곳이 사라진 뒤에도 남겨 둘 최대 묶음 수.
 *
 * 한 장이 6.5MB 남짓이라 여덟이면 52MB다. 0으로 두면 전투에서 나왔다 다시 들어가는 길에
 * 여섯을 매번 다시 읽어, 고쳐 둔 진입 대기가 그대로 돌아온다 — 내리는 것은 텍스처만이
 * 아니라 파싱 결과까지라 되읽는 값이 배경보다 비싸다(한 장 디코드가 400ms 남짓).
 *
 * 한 판의 전투가 아군 여섯 + 적 다섯이라 열하나를 다 남기려면 71MB가 필요한데, 그만큼
 * 잡아 두면 전투를 한 번 지난 계정이 도감을 열 때의 봉우리가 그만큼 높아진다. 여덟은
 * 되돌아가는 한 걸음(같은 스테이지 재도전 · 결과 화면에서 다시 출격)을 덮는 크기다.
 */
export const PUPPET_IDLE_KEEP = 8;

/** 지금 무엇이 올라가 있고 무엇을 쓰는 중인지. */
export interface PuppetResidency {
  /** 묶음별로 그 원화를 세운 채 살아 있는 표시 객체 수. 0이 되면 idle로 내려간다. */
  readonly users: Readonly<Record<string, number>>;
  /** 쓰는 곳이 없지만 아직 GPU에 남겨 둔 묶음. 오래 놓인 것이 앞이다. */
  readonly idle: readonly string[];
}

export function emptyPuppetResidency(): PuppetResidency {
  return { users: {}, idle: [] };
}

/** 지금 GPU에 남아 있어야 하는 묶음인지. */
export function isPuppetResident(state: PuppetResidency, url: string): boolean {
  return (state.users[url] ?? 0) > 0 || state.idle.includes(url);
}

/**
 * 표시 객체 하나가 그 묶음을 쓰기 시작했다.
 * idle에 놓여 있었다면 도로 붙잡아 내려가지 않게 한다.
 */
export function retainPuppet(state: PuppetResidency, url: string): PuppetResidency {
  return {
    users: { ...state.users, [url]: (state.users[url] ?? 0) + 1 },
    idle: state.idle.filter((idleUrl) => idleUrl !== url),
  };
}

/**
 * 그 묶음을 쓰던 표시 객체가 죽었다.
 *
 * 마지막 하나가 죽어도 곧바로 내리지 않고 idle 뒤에 세운다. 넘치는 만큼만 앞에서부터
 * 내보내며, `evict`가 실제로 지워야 하는 묶음이다 — 호출부는 그 목록만 지우면 되고 어떤
 * 순서로 지울지 판단하지 않는다.
 *
 * 붙잡은 곳이 남아 있으면 `evict`는 언제나 비어 있다. 살아 있는 표시 객체가 쓰는 그림을
 * 지우면 그 자리에서 렌더가 터진다.
 */
export function releasePuppet(
  state: PuppetResidency,
  url: string,
  idleKeep: number = PUPPET_IDLE_KEEP,
): { state: PuppetResidency; evict: readonly string[] } {
  const remaining = (state.users[url] ?? 0) - 1;
  const users = { ...state.users };
  if (remaining > 0) {
    users[url] = remaining;
    return { state: { users, idle: state.idle }, evict: [] };
  }
  delete users[url];

  const keep = Math.max(0, idleKeep);
  const idle = [...state.idle.filter((idleUrl) => idleUrl !== url), url];
  const evict = idle.slice(0, Math.max(0, idle.length - keep));
  return { state: { users, idle: idle.slice(evict.length) }, evict };
}
