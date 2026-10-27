/** 다운로드/파싱은 병렬로 두고, 메인 스레드의 모델 생성만 프레임 예산으로 나눈다. */
export class PuppetCreationQueue {
  private tail: Promise<void> = Promise.resolve();
  private spent = 0;
  private completed = 0;
  private yields = 0;
  private maxTaskMs = 0;

  constructor(private readonly options: {
    isCurrent?: () => boolean;
    now?: () => number;
    yieldFrame?: () => Promise<void>;
    budgetMs?: number;
  } = {}) {}

  get stats() { return { completed: this.completed, yields: this.yields, maxTaskMs: this.maxTaskMs }; }

  run<T>(create: () => Promise<T>): Promise<T> {
    const now = this.options.now ?? (() => performance.now());
    const current = () => this.options.isCurrent?.() !== false;
    const result = this.tail.then(async () => {
      if (!current()) throw new Error("puppet_creation_cancelled");
      if (this.spent >= (this.options.budgetMs ?? 8)) {
        // 작업 큐로 양보한다. 느린 GPU의 rAF 완료까지 기다리면 생성 대기 자체가 길어진다.
        await (this.options.yieldFrame?.() ?? new Promise<void>(resolve => setTimeout(resolve, 0)));
        this.spent = 0; this.yields++;
      }
      if (!current()) throw new Error("puppet_creation_cancelled");
      const started = now();
      try { return await create(); }
      finally {
        const elapsed = Math.max(0, now() - started);
        this.spent += elapsed; this.maxTaskMs = Math.max(this.maxTaskMs, elapsed); this.completed++;
      }
    });
    this.tail = result.then(() => undefined, () => undefined);
    return result;
  }
}
