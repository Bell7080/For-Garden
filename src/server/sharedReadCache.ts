/** 계정과 무관한 운영 정의를 잠깐 재사용하고, 동시 갱신은 DB 호출 하나로 합친다. */
export function sharedReadCache<T>(ttlMs: number, capacity = 8) {
  const entries = new Map<string, { value?: T; until: number; pending?: Promise<T> }>();
  return {
    peek(key: string): T | undefined { return entries.get(key)?.value; },
    read(key: string, load: () => Promise<T>): Promise<T> {
      const previous = entries.get(key);
      if (previous?.pending) return previous.pending;
      if (previous && Date.now() < previous.until) return Promise.resolve(previous.value as T);
      if (!previous && entries.size >= capacity) {
        for (const [id, entry] of entries) {
          if (!entry.pending) { entries.delete(id); break; }
        }
      }
      const entry = previous ?? { until: 0 };
      entry.pending = Promise.resolve().then(load).then(value => {
        entry.value = value;
        entry.until = Date.now() + ttlMs;
        return value;
      }).finally(() => { entry.pending = undefined; });
      // 모든 자리가 갱신 중이면 기존 요청을 쫓아내지 않는다.
      if (previous || entries.size < capacity) entries.set(key, entry);
      return entry.pending;
    },
  };
}
