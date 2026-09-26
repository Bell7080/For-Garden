import type { PlayerExpReceipt } from "../core/playerLevel";

/**
 * 방금 치른 입장이 올린 연구원 경험치 — 결과판이 한 번 꺼내 쓰고 비운다.
 *
 * 경험치는 **입장**에서 오르지만(스테미나를 거기서 쓴다) 그 몫을 보여 줄 자리는 판이 끝난 뒤의
 * 결과판이다. 두 자리 사이에는 전투 한 판과 씬 전환이 끼므로, 입장 영수증을 여기 맡겨 두고
 * 결과판이 연 순간 꺼낸다. 세션 상태가 아니라 화면에 한 번 보여 줄 영수증이라 저장하지 않는다.
 *
 * 한 판에 입장이 두 번 오지 않으므로 겹칠 일은 없지만, 결과판을 보지 못하고 다음 입장이 오면
 * **두 영수증을 이어 붙인다** — 앞 판에서 오른 레벨과 받은 병이 조용히 사라지지 않게 한다.
 */
let pending: PlayerExpReceipt | undefined;

export function rememberPlayerExp(receipt: PlayerExpReceipt | undefined): void {
  if (!receipt) return;
  pending = pending ? mergePlayerExpReceipts(pending, receipt) : receipt;
}

export function takePlayerExp(): PlayerExpReceipt | undefined {
  const receipt = pending;
  pending = undefined;
  return receipt;
}

/** 앞 영수증의 시작과 뒤 영수증의 끝을 잇는다. 받은 병은 종류별로 더한다. */
export function mergePlayerExpReceipts(first: PlayerExpReceipt, second: PlayerExpReceipt): PlayerExpReceipt {
  const items = new Map<string, number>();
  for (const { itemId, quantity } of [...first.levelUpItems, ...second.levelUpItems]) items.set(itemId, (items.get(itemId) ?? 0) + quantity);
  return {
    before: first.before, after: second.after,
    granted: first.granted + second.granted,
    levelsGained: first.levelsGained + second.levelsGained,
    levelUpItems: [...items].map(([itemId, quantity]) => ({ itemId, quantity })),
  };
}
