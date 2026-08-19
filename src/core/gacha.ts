/**
 * 뽑기 규칙. 화면도 난수원도 모른다.
 *
 * 난수는 밖에서 넣어 준다. 그래야 같은 난수열로 같은 결과가 나와서 규칙을 테스트로 고정할 수 있고,
 * 나중에 서버가 결과를 정하게 될 때도 이 계산식을 그대로 쓸 수 있다.
 */

/** 재화. 화석은 흔하고, 호박석은 귀하다. */
export interface Wallet {
  /** 일반 뽑기에 쓰는 재화. */
  fossil: number;
  /** 고급 뽑기에 쓰는 재화. 과금과 이어진다. */
  amber: number;
}

export type Currency = keyof Wallet;

export interface Banner {
  id: string;
  name: string;
  desc: string;
  /** 배너 화면에 대표로 노출할 실제 픽업 렐릭 id. */
  featuredRelicId: string;
  currency: Currency;
  /** 1회 뽑기 비용. */
  costOne: number;
  /** 10회 뽑기 비용. 낱개로 열 번 하는 것보다 싸다. */
  costTen: number;
  /** 나올 수 있는 렐릭 id. */
  pool: string[];
}

export function pullCost(banner: Banner, count: number): number {
  return count === 10 ? banner.costTen : banner.costOne * count;
}

export function canPull(wallet: Wallet, banner: Banner, count: number): boolean {
  return wallet[banner.currency] >= pullCost(banner, count);
}

/** 뽑기 결과. 재화는 건드리지 않는다. */
export function pull(banner: Banner, count: number, rng: () => number): string[] {
  const results: string[] = [];
  for (let i = 0; i < count; i += 1) {
    const index = Math.min(banner.pool.length - 1, Math.floor(rng() * banner.pool.length));
    results.push(banner.pool[index]);
  }
  return results;
}

/** 비용을 치른 새 지갑. 모자라면 그대로 돌려준다. */
export function spend(wallet: Wallet, banner: Banner, count: number): Wallet {
  if (!canPull(wallet, banner, count)) return wallet;
  return { ...wallet, [banner.currency]: wallet[banner.currency] - pullCost(banner, count) };
}

/**
 * 뽑은 결과를 보유 목록에 넣는다. 이미 가진 렐릭은 중복으로 표시한다.
 * (중복 보상은 육성 체계를 정한 뒤에 붙인다.)
 */
export interface PullOutcome {
  /** 처음 얻은 렐릭. */
  fresh: string[];
  /** 이미 가지고 있던 렐릭. */
  duplicates: string[];
}

export function applyPull(owned: Set<string>, results: string[]): PullOutcome {
  const fresh: string[] = [];
  const duplicates: string[] = [];
  for (const id of results) {
    if (owned.has(id)) duplicates.push(id);
    else {
      owned.add(id);
      fresh.push(id);
    }
  }
  return { fresh, duplicates };
}
