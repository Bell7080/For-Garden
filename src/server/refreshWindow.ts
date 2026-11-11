/** 완료된 갱신만 잠깐 재사용한다. 진행 중인 갱신은 합치고, 실패는 다음 호출에서 재시도한다. */
export function refreshWindow(intervalMs: number, capacity = 1024) {
  const entries = new Map<string, { until: number; pending?: Promise<void> }>();
  return async (key: string, refresh: () => Promise<void>): Promise<void> => {
    const previous = entries.get(key);
    if (previous?.pending) return previous.pending;
    if (previous && Date.now() < previous.until) return;
    if (entries.size >= capacity) {
      for (const [id, entry] of entries) {
        if (!entry.pending) { entries.delete(id); break; }
      }
    }
    const entry: { until: number; pending?: Promise<void> } = { until: 0 };
    entry.pending = Promise.resolve().then(refresh).then(() => {
      entry.until = Date.now() + intervalMs;
      entry.pending = undefined;
    }, error => { if (entries.get(key) === entry) entries.delete(key); throw error; });
    // 모두 실행 중이면 새 키를 보관하지 않는다. 이미 진행 중인 처리를 쫓아내지 않는다.
    if (entries.size < capacity) entries.set(key, entry);
    return entry.pending;
  };
}
