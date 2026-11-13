/**
 * **계정에 묶인 메모리 상태**를 계정이 바뀌는 순간 한꺼번에 비우는 경계 — Phaser를 모르는 순수 모듈.
 *
 * 로비의 「지난번에 알린 연구원 레벨」처럼 앱을 켜 둔 동안만 메모리에 두는 기준값이 여럿 있다. 그 값들은
 * 늘 **같은 계정**의 지난 값과 비교한다는 전제로 짜였는데, 계정 변경은 앱을 끄지 않고 부트로 돌아가므로
 * 모듈 변수가 그대로 남는다 — 2레벨 계정에서 20레벨 계정으로 들어오면 `LV.2 › LV.20` 레벨업 판이 떴다.
 *
 * 그래서 그런 상태를 가진 모듈은 저마다 `onAccountSwitch`로 「비우는 법」을 맡기고, 세션에 계정이 얹히는
 * 두 자리(`replaceSession`·`applyServerState`)가 `observeAccountOwner`로 주인 UID를 알린다. 주인이 바뀐
 * 순간에만 맡긴 것을 모두 부른다. **빈 UID는 주인이 아니다** — 계정 변경 직후 부트는 UID가 빈 기본 세션을
 * 세우고 로그인 뒤에야 새 UID가 오므로, 빈 값을 주인으로 받으면 같은 계정으로 다시 들어와도 비워 버린다.
 *
 * 기기 설정에 남는 기록(`contentSeen`)은 제 안에 주인 UID를 함께 들고 있어 이 경계를 쓰지 않는다.
 */
const resets = new Set<() => void>();
let owner: string | undefined;

/** 계정이 바뀌면 부를 「비우는 법」을 맡긴다. 돌려준 함수로 뗀다. */
export function onAccountSwitch(reset: () => void): () => void {
  resets.add(reset);
  return () => { resets.delete(reset); };
}

/** 지금 세션의 주인 UID를 알린다. 앞서 알린 주인과 다른 계정이면 맡긴 상태를 모두 비우고 true를 돌려준다. */
export function observeAccountOwner(uid: string): boolean {
  if (!uid) return false;
  if (owner === undefined || owner === uid) { owner = uid; return false; }
  owner = uid;
  for (const reset of [...resets]) {
    try { reset(); } catch { /* 하나가 실패해도 나머지 계정 상태는 비운다 */ }
  }
  return true;
}

/** 테스트 전용 — 기억한 주인을 지운다(맡긴 「비우는 법」은 모듈이 들고 있으므로 남긴다). */
export function resetAccountOwnerForTest(): void { owner = undefined; }
