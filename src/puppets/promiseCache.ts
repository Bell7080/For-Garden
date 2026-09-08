/**
 * 같은 키의 진행 중/완료 로드를 공유하되 실패한 작업만 다시 시도할 수 있게 비우는 순수 캐시 경계다.
 * Phaser나 PuppetForge를 알지 않으므로 네트워크·ZIP 파싱 회귀를 빠른 단위 테스트로 재현할 수 있다.
 */
export function loadSharedPromise<K, V>(cache: Map<K, Promise<V>>, key: K, loader: () => Promise<V>): Promise<V> {
  const cached = cache.get(key);
  if (cached) return cached;

  const pending = loader();
  cache.set(key, pending);
  void pending.catch(() => {
    // 실패 뒤 새 요청이 이미 다른 Promise를 넣었다면 그 성공 가능성을 과거 실패가 지우면 안 된다.
    if (cache.get(key) === pending) cache.delete(key);
  });
  return pending;
}
