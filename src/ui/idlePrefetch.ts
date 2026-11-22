import type Phaser from "phaser";
import { navigatorConnection, idlePrefetchAllowed } from "../core/idleFilePrefetch";

const requested = new Set<string>();

/**
 * 로비에서 **손이 노는 동안** 다음 화면이 쓸 파일을 한 개씩 받아 **브라우저 캐시에만** 둔다.
 *
 * - 데이터: 셀룰러로 알려진 연결·데이터 절약에서는 받지 않는다(`idlePrefetchAllowed`). 받는 양은 자주 넘어가는 화면의 배경 원화까지 합쳐 6MB 안팎이다.
 * - 메모리·GPU: 디코드·파싱하지 않는다. 세우는 것은 그 화면에 들어갈 때 제 경로가 한다(거주 규칙).
 * - 첫 진입: 한 개씩, 낮은 우선순위로 받고, 로비를 떠나면 남은 것은 받지 않는다 — 다음 화면 몫 앞에
 *   끼어들지 않는다. 한 실행에 같은 파일은 한 번만 건다.
 */
export function prefetchIdleFiles(scene: Phaser.Scene, urls: readonly string[]): void {
  if (!idlePrefetchAllowed(navigatorConnection())) return;
  const queue = urls.filter((url) => !requested.has(url));
  if (queue.length === 0) return;
  let left = false;
  scene.events.once("shutdown", () => { left = true; });
  const next = (): void => {
    const url = queue.shift();
    if (!url || left) return;
    requested.add(url);
    void fetch(url, { priority: "low" } as RequestInit).then((response) => response.arrayBuffer()).catch(() => undefined).finally(next);
  };
  next();
}
