import type { ProductGrant } from "./products";

/** 후원 지층 표(규칙은 `core/patronStrata.ts`). 매일 보급·기념품·치장을 바꾸면 `patronStrata.test`·`rewardVolumes.test`를 함께 고친다(응태 승인). */
export type PatronTierId = "topsoil" | "sediment" | "fossil" | "amber" | "bedrock" | "deep" | "core";

export interface PatronTierDefinition {
  readonly id: PatronTierId;
  /** 이 기금 누적에 닿으면 그 지층이다. */
  readonly threshold: number;
  /** 하루 한 번 받는 후원 보급. */
  readonly daily: readonly ProductGrant[];
  /** 처음 닿았을 때 한 번 받는 기념품(표토는 없다). */
  readonly reward: readonly ProductGrant[];
  /** 기념품과 함께 열리는 테두리·수식어. */
  readonly frameId?: string;
  readonly modifierId?: string;
  /** 지층 색 — 단면도의 띠와 칩의 표식이 같은 값을 읽는다. */
  readonly color: number;
}

const gold = (amount: number): ProductGrant => ({ kind: "currency", currency: "gold", amount });
const cake = (amount: number): ProductGrant => ({ kind: "currency", currency: "cheesecake", amount });
const gems = (amount: number): ProductGrant => ({ kind: "currency", currency: "gems", amount });
const tonic: ProductGrant = { kind: "item", itemId: "stamina-tonic", name: "에너지 드링크", amount: 1, expiresInDays: 7 };

export const PATRON_TIERS: readonly PatronTierDefinition[] = [
  { id: "topsoil", threshold: 0, daily: [gold(5_000), gems(5)], reward: [], color: 0x9c8466 },
  { id: "sediment", threshold: 30, daily: [gold(5_000), cake(20), gems(5)], reward: [gems(100)], color: 0xc9a46a },
  { id: "fossil", threshold: 300, daily: [gold(10_000), cake(30), gems(10)], reward: [{ kind: "currency", currency: "fossil", amount: 3 }], frameId: "patron-fossil", color: 0xd9d2c0 },
  { id: "amber", threshold: 1_000, daily: [gold(10_000), cake(50), gems(15)], reward: [{ kind: "currency", currency: "amber", amount: 5 }], modifierId: "amber-bound", color: 0xf2b441 },
  { id: "bedrock", threshold: 3_000, daily: [gold(20_000), cake(50), gems(20), tonic], reward: [{ kind: "currency", currency: "fossil", amount: 10 }, { kind: "currency", currency: "amber", amount: 10 }], frameId: "patron-bedrock", color: 0x8a95a8 },
  { id: "deep", threshold: 10_000, daily: [gold(30_000), cake(80), gems(25), tonic], reward: [{ kind: "item", itemId: "universal-fragment-sr", name: "만능 SR 파편", amount: 2 }], modifierId: "deep-patron", color: 0x6f6cff },
  { id: "core", threshold: 30_000, daily: [gold(50_000), cake(100), gems(30), tonic], reward: [{ kind: "item", itemId: "universal-fragment-ssr", name: "만능 SSR 파편", amount: 1 }], frameId: "patron-core", color: 0xff7a45 },
];

