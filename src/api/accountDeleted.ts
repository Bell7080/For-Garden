/**
 * 운영팀이 계정을 삭제하면 서버가 모든 호출을 `account_deleted`로 거절한다. 호출한 곳마다 그 오류를 읽지 않고
 * 한 군데(겹 화면)가 알림·로그아웃·타이틀 복귀를 맡도록 신호만 모은다.
 */
type Listener = () => void;
const listeners = new Set<Listener>();
let reported = false;

export function onAccountDeleted(listener: Listener): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

/** 같은 삭제를 호출이 여러 번 알려도 한 번만 전달한다. */
export function reportAccountDeleted(): void {
  if (reported) return;
  reported = true;
  listeners.forEach((listener) => listener());
}

/** 새 계정으로 다시 서면 다음 삭제를 또 알릴 수 있게 한다. */
export function resetAccountDeleted(): void { reported = false; }
