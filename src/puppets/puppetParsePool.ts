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
 * 묶음 하나를 일꾼에게 맡긴다. 일꾼을 쓸 수 없거나 해석이 실패하면 `null`이다 —
 * 실패를 던지지 않는 것은 부르는 쪽이 예전 경로로 조용히 되돌아가면 되기 때문이다.
 */
export function parsePuppetOffThread(url: string): Promise<ParsedPuppet | null> {
  if (!supported()) return Promise.resolve(null);
  pool ??= createPool();
  return new Promise<ParsedPuppet | null>((settle) => {
    waiting.push({ url, settle });
    pump();
  });
}
