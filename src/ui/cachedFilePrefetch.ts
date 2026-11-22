/**
 * 파일을 **브라우저 캐시에만** 받아 둔다 — 디코드·GPU 업로드는 하지 않는다.
 *
 * 타이틀 로딩이 「미리 받기」를 하던 자리 중 바로 그리지 않는 원화(출격 칸·스킬 일러스트)는 여기로 옮겼다.
 * Phaser 로더로 받으면 그 자리에서 디코드되어 화면에 서기 전부터 GPU 텍스처로 붙잡힌다. 여기서는 바이트만
 * 받고, 실제로 세울 때 각자의 로더가 같은 주소를 읽어 캐시에서 꺼낸다.
 *
 * 한 번에 여섯 개씩 받고, 실패는 삼킨다(그 그림은 설 때 다시 받는다). 한 실행에 같은 파일은 한 번만 건다.
 */
const requested = new Set<string>();
const PARALLEL = 6;

export function prefetchCachedFiles(urls: readonly string[]): Promise<void> {
  if (typeof fetch !== "function") return Promise.resolve();
  const queue = urls.filter((url) => !requested.has(url));
  queue.forEach((url) => requested.add(url));
  if (queue.length === 0) return Promise.resolve();
  const worker = async (): Promise<void> => {
    for (let url = queue.shift(); url !== undefined; url = queue.shift()) {
      try {
        const response = await fetch(url);
        await response.arrayBuffer();
      } catch {
        requested.delete(url);
      }
    }
  };
  return Promise.all(Array.from({ length: Math.min(PARALLEL, queue.length) }, worker)).then(() => undefined);
}
