import { applyLevelGrowth } from "../core/relicProgression";
import { effectiveEnemyLevel, type RelicDef } from "../core/types";
import { registerDataText } from "../i18n";
import { CONTENT_STAMINA_COSTS } from "./contentCosts";
import { getRelic } from "./relics";

/**
 * 현상수배 한 라운드에 서는 정예 하나.
 *
 * 스테이지의 `StageEnemyDef`와 같은 축을 쓴다 — **자란 레벨**과 **야성으로 난폭해진 단계**뿐이고
 * 전용 능력치 배율은 없다(`CLAUDE.md`의 "스테이지 난이도는 개체 정의가 아니라 `ferocityLevel`로
 * 조인다"). 자리는 하나뿐이라 `formationSlot`을 적지 않는다.
 */
export interface BountyRoundDef {
  relicId: string;
  level: number;
  /** 화면의 붉은 `+n`과 같은 **단계**다. 능력치에 얹히는 몫은 정예 배율이 곱한 값이다. */
  ferocityLevel: number;
}

/** 한 번의 현상수배 의뢰. 세 라운드를 모두 이겨야 보상이 나온다. */
export interface BountyTierDef {
  id: string;
  /** 1부터 오르는 등급. 바로 앞 등급을 깨야 열린다. */
  order: number;
  name: string;
  /** 세 라운드를 모두 이겼을 때 받는 골드. */
  rewardGold: number;
  rounds: readonly [BountyRoundDef, BountyRoundDef, BountyRoundDef];
}

/**
 * 콘텐츠 전체가 공유하는 운영 상수.
 *
 * **한 판이 곧 세 라운드다.** 스테미나는 등급과 무관하게 입장 한 번에 한 번만 나가고, 더 높은
 * 등급일수록 같은 값에 더 많은 골드가 돌아온다 — 그래야 "더 강하게 키워 더 높은 등급으로"가
 * 비용이 아니라 이득으로 읽힌다.
 *
 * `limitSeconds`는 **무승부를 패배로 확정하는 선**이다. 1대1은 서로 못 죽이는 조합이 실제로
 * 있어(아모처럼 버티는 정예 상대로 화력이 모자란 개체), 제한이 없으면 그 판이 영영 끝나지
 * 않는다. 한 번이라도 지면 패배인 던전이므로 시간을 다 쓴 라운드도 진 것으로 센다.
 */
export const BOUNTY = {
  roundCount: 3,
  staminaCost: CONTENT_STAMINA_COSTS.bountyRun,
  maxEntriesPerUtcDay: 3,
  limitSeconds: 60,
} as const;

/**
 * 등급 사다리.
 *
 * **한 등급 안의 셋은 같은 레벨로 자라 있고, 다른 것은 얼마나 사나운가뿐이다.** 관문을 조이는
 * 손잡이를 `ferocityLevel` 하나로 두기 위해서다.
 *
 * 라운드 순서는 **토비 → 아모 → 코마**다. 1대1 실측에서 코마가 같은 레벨의 다른 둘보다 훨씬
 * 무거워(레벨 20 파티 기준 확실히 이기는 개체가 실효 15에서 토비 15종 · 아모 13종 · 코마
 * 6종), 그 하나가 마지막 라운드의 벽이 된다. **코마에는 야성을 얹지 않는다** — 자란 레벨만으로
 * 이미 나머지 둘의 몫을 한다.
 *
 * 값은 눈대중이 아니라 `tests/unit/bountyBalance.test.ts`가 `duelBalance`로 다시 잰다. 보유
 * 렐릭 21종을 세 seed로 붙여 **확실히 이기는 개체 수**를 세고, 두 가지를 확인한다 — 등급마다
 * 상정한 성장 수준에서 세 라운드 모두 세 명 이상이 남는지(편성 칸이 셋이므로 라운드마다 다른
 * 개체가 필요하다), 그리고 **같은 파티를 세워 두고 등급만 올렸을 때 낼 수 있는 개체가 실제로
 * 줄어드는지**다.
 *
 * 뒤엣것이 처음 표를 되돌렸다. 레벨을 다섯씩 올리던 첫 표는 레벨 20 파티 기준으로 2급과 3급이
 * **똑같은 무게**(32종)였다 — 등급이 보상만 다른 같은 관문이 되는 자리다. 지금은 실효 레벨이
 * 등급마다 크게 벌어져(토비 10 → 20 → 35 → 50 → 70) 그 수가 37 → 32 → 26 → 19 → 12로 내려간다.
 */
export const BOUNTY_TIERS: readonly BountyTierDef[] = [
  // 1급은 스토리 1장을 막 민 파티(레벨 15 언저리)가 들어서는 자리다.
  { id: "bounty-1", order: 1, name: "현상수배 1급", rewardGold: 3_000, rounds: [
    { relicId: "toby", level: 5, ferocityLevel: 1 }, { relicId: "amo", level: 5, ferocityLevel: 0 }, { relicId: "koma", level: 5, ferocityLevel: 0 },
  ] },
  // 2급부터 레벨 상한(20)을 채운 셋을 요구한다.
  { id: "bounty-2", order: 2, name: "현상수배 2급", rewardGold: 5_000, rounds: [
    { relicId: "toby", level: 15, ferocityLevel: 1 }, { relicId: "amo", level: 15, ferocityLevel: 0 }, { relicId: "koma", level: 15, ferocityLevel: 0 },
  ] },
  { id: "bounty-3", order: 3, name: "현상수배 3급", rewardGold: 8_000, rounds: [
    { relicId: "toby", level: 25, ferocityLevel: 2 }, { relicId: "amo", level: 25, ferocityLevel: 2 }, { relicId: "koma", level: 25, ferocityLevel: 0 },
  ] },
  { id: "bounty-4", order: 4, name: "현상수배 4급", rewardGold: 12_000, rounds: [
    { relicId: "toby", level: 40, ferocityLevel: 2 }, { relicId: "amo", level: 40, ferocityLevel: 2 }, { relicId: "koma", level: 40, ferocityLevel: 0 },
  ] },
  // 5급은 돌파로 상한을 연 만렙 셋의 자리다.
  { id: "bounty-5", order: 5, name: "현상수배 5급", rewardGold: 18_000, rounds: [
    { relicId: "toby", level: 50, ferocityLevel: 4 }, { relicId: "amo", level: 50, ferocityLevel: 4 }, { relicId: "koma", level: 50, ferocityLevel: 0 },
  ] },
];

const BOUNTY_TIER_BY_ID = new Map(BOUNTY_TIERS.map((tier) => [tier.id, tier]));

/** 잘못된 ID는 조용히 첫 등급으로 수렴시키지 않고 경계에서 드러낸다. */
export function getBountyTier(id: string): BountyTierDef {
  const tier = BOUNTY_TIER_BY_ID.get(id);
  if (!tier) throw new Error(`알 수 없는 현상수배 등급 id: ${id}`);
  return tier;
}

/**
 * 그 라운드의 정예를 **전투에 서는 성장 사본**으로 만든다.
 *
 * 스테이지와 같은 경로를 쓴다 — 야성으로 얹힌 몫도 레벨과 같은 성장 공식을 지나고, 정예 배율은
 * `effectiveEnemyLevel`이 한 줄에서만 돈다. 정적 정의는 바꾸지 않는다.
 */
export function bountyRoundEnemy(round: BountyRoundDef): RelicDef {
  const base = getRelic(round.relicId);
  return { ...base, stats: applyLevelGrowth(base.stats, effectiveEnemyLevel(round, true), base.rarity) };
}

/** 등급 이름을 언어별로 덮어쓸 수 있게 등록한다. */
for (const tier of BOUNTY_TIERS) registerDataText(tier, "name", `bounty.tier.${tier.id}.name`);
