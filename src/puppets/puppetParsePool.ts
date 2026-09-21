/**
 * Puppet 해석 일꾼 무리.
 *
 * 일꾼을 묶음마다 만들지 않고 몇 개만 두고 돌려 쓴다 — 도감은 스물한 장을 한꺼번에 요청하는데
 * 그만큼 일꾼을 세우면 기기가 코어 수보다 많은 스레드를 번갈아 깨우느라 오히려 느려진다.
 *
 * **일꾼을 쓸 수 없는 환경에서는 `null`을 돌려준다.** Worker나 `createImageBitmap`이 없는
 * 빌드(단위 테스트의 node 환경이 그렇다)에서 성공을 흉내 내지 않고, 부르는 쪽이 예전의
 * 메인 스레드 경로로 되돌아가게 한다.
 */
import type { PuppetProject } from "puppetforge";
import type { PuppetParseRequest, PuppetParseResponse } from "./puppetParseWorker";

/** 해석이 끝난 묶음. 원화는 이미 디코드되어 GPU에 바로 올릴 수 있다. */
export interface ParsedPuppet {
  readonly project: PuppetProject;
  readonly bitmap: ImageBitmap;
}

/**
 * 기다리는 일감 하나.
 *
 * 실패를 던지지 않고 `null`로 알린다 — 부르는 쪽이 할 수 있는 일은 예전의 메인 스레드
 * 경로로 되돌아가는 것뿐이라, 오류를 만들어 봐야 읽는 곳 없이 버려진다.
 */
interface Job {
  readonly url: string;
  readonly settle: (parsed: ParsedPuppet | null) => void;
}

/**
 * 코어 하나는 메인 스레드에 남긴다. 전부 일꾼에게 주면 해석이 도는 동안 화면이 오히려 끊긴다.
 * 넷을 넘기지 않는 이유는 실측에서 그 위로는 내려받기 대기만 늘고 총 시간이 줄지 않기 때문이다.
 */
const MAX_WORKERS = 4;

let pool: Worker[] | null = null;
let nextId = 0;
const waiting: Job[] = [];
const free: Worker[] = [];
const running = new Map<Worker, Job>();

function supported(): boolean {
  return typeof Worker !== "undefined" && typeof createImageBitmap === "function";
}

function finish(worker: Worker, parsed: ParsedPuppet | null): void {
  const job = running.get(worker);
  running.delete(worker);
  free.push(worker);
  job?.settle(parsed);
  pump();
}

function createPool(): Worker[] {
  const cores = typeof navigator !== "undefined" ? navigator.hardwareConcurrency : undefined;
  const count = Math.max(1, Math.min(MAX_WORKERS, (cores ?? MAX_WORKERS) - 1));
  return Array.from({ length: count }, () => {
    const worker = new Worker(new URL("./puppetParseWorker.ts", import.meta.url), { type: "module" });
    worker.onmessage = (event: MessageEvent<PuppetParseResponse>) => {
      const { project, bitmap } = event.data;
      finish(worker, project && bitmap ? { project, bitmap } : null);
    };
    // 일꾼 자체가 죽으면 그 일감은 영영 돌아오지 않는다. 기다리던 쪽을 풀어 메인 스레드 경로로 보낸다.
    worker.onerror = () => finish(worker, null);
    free.push(worker);
    return worker;
  });
}

function pump(): void {
  while (waiting.length > 0 && free.length > 0) {
    const worker = free.pop()!;
    const job = waiting.shift()!;
    running.set(worker, job);
    const request: PuppetParseRequest = { id: (nextId += 1), url: job.url };
    worker.postMessage(request);
  }
}

/**
 * 일감의 주소를 **문서 기준 절대 주소로** 바꾼다.
 *
 * 묶음 주소는 `import.meta.env.BASE_URL`에서 나오는데 이 저장소의 `vite.config.ts`는
 * `base: "./"`라, 실제 값이 `./puppets/char_001.zip` 같은 **상대 경로**다. 메인 스레드에서는
 * 문서(`/`)를 기준으로 풀려 맞게 가지만, 일꾼 스크립트는 `/assets/`에 놓이므로 같은 문자열이
 * 일꾼 안에서는 `/assets/puppets/char_001.zip`으로 풀린다 — 그 주소는 SPA 폴백에 걸려
 * **200과 함께 `index.html`을 돌려주고**, 일꾼은 그것을 puppet.json으로 읽다 실패한다.
 *
 * 실패가 눈에 띄지 않았던 이유는 폴백이 조용하기 때문이다. `loadPuppet`은 `null`을 받으면
 * 예전 메인 스레드 경로로 되돌아가므로 화면은 멀쩡했고, 대신 **이 일꾼 무리가 하는 일이
 * 통째로 없었다** — ZIP 해제·puppet.json 파싱·원화 디코드(한 장 400ms 남짓)가 전부 메인
 * 스레드로 돌아와, 묶음을 읽는 동안 화면이 그만큼 멎었다.
 *
 * 그래서 **주소를 넘기기 전에 문서 기준으로 푼다.** 일꾼이 제 위치를 기준으로 다시 풀 여지를
 * 남기지 않는 것이 이 함수의 전부다.
 */
export function resolveWorkerAssetUrl(url: string, documentBase: string): string {
  return new URL(url, documentBase).href;
}

/**
 * 묶음 하나를 일꾼에게 맡긴다. 일꾼을 쓸 수 없거나 해석이 실패하면 `null`이다 —
 * 실패를 던지지 않는 것은 부르는 쪽이 예전 경로로 조용히 되돌아가면 되기 때문이다.
 */
export function parsePuppetOffThread(url: string): Promise<ParsedPuppet | null> {
  if (!supported()) return Promise.resolve(null);
  pool ??= createPool();
  const base = typeof document !== "undefined" ? document.baseURI : self.location.href;
  const resolved = resolveWorkerAssetUrl(url, base);
  return new Promise<ParsedPuppet | null>((settle) => {
    waiting.push({ url: resolved, settle });
    pump();
  });
}
