/** Playwright 전용 Puppet 수명 계측값이며 `?puppetPerf=1`일 때만 브라우저에 공개한다. */
export interface PuppetPerformanceCounts {
  created: number;
  destroyed: number;
  alive: number;
  updateSubscriptions: number;
}

/** 테스트가 정보창을 조작하는 최소 명령이며 게임 진행 데이터는 읽거나 쓰지 않는다. */
export interface PuppetPerformanceHarness {
  counts: PuppetPerformanceCounts;
  openInfo(): void;
  closeInfo(): void;
  nextCharacter(): void;
}

declare global {
  interface Window { __PUPPET_PERF__?: PuppetPerformanceHarness }
}

const counts: PuppetPerformanceCounts = { created: 0, destroyed: 0, alive: 0, updateSubscriptions: 0 };

/** 일반 실행에는 전역이나 계측 분기를 만들지 않고 명시적인 성능 시나리오에서만 켠다. */
export function puppetPerformanceEnabled(): boolean {
  return typeof window !== "undefined" && new URLSearchParams(window.location.search).get("puppetPerf") === "1";
}

/** Indexed Puppet 생성과 Scene UPDATE 구독이 항상 한 쌍인지 기록한다. */
export function recordPuppetCreated(): void {
  if (!puppetPerformanceEnabled()) return;
  counts.created += 1; counts.alive += 1; counts.updateSubscriptions += 1;
}

/** 파괴 시 생존 개체와 UPDATE 구독을 함께 차감해 숨은 계산 회귀를 드러낸다. */
export function recordPuppetDestroyed(): void {
  if (!puppetPerformanceEnabled()) return;
  counts.destroyed += 1; counts.alive -= 1; counts.updateSubscriptions -= 1;
}

/** 로비가 소유한 조작만 붙이고 계측값 객체는 유지해 비동기 생성도 즉시 반영한다. */
export function installPuppetPerformanceHarness(controls: Omit<PuppetPerformanceHarness, "counts">): void {
  if (!puppetPerformanceEnabled()) return;
  window.__PUPPET_PERF__ = { counts, ...controls };
}

/** 씬 종료 뒤 테스트 전역에 오래된 Phaser 객체를 붙잡지 않는다. */
export function removePuppetPerformanceHarness(): void {
  if (puppetPerformanceEnabled()) window.__PUPPET_PERF__ = undefined;
}
