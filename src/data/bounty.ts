import type { RelicDef } from "../core/types";
import { registerDataText } from "../i18n";
import { getRelic } from "./relics";
import { applyEncounterScaling, encounterRoleFor } from "../core/levelDesign";

/**
 * 현상수배 한 라운드에 서는 정예 하나.
 *
 * 스테이지의 `StageEnemyDef`와 같은 축을 쓴다 — **자란 레벨**과 **야성으로 난폭해진 단계**뿐이고
 * 전용 능력치 배율은 없다(`CLAUDE.md`의 "스테이지 난이도는 개체 정의가 아니라 그 관문의 레벨로
 * 조인다"). 자리는 하나뿐이라 `formationSlot`을 적지 않는다.
 */
export interface BountyRoundDef {
  relicId: string;
  level: number;
}

/** 한 번의 현상수배 의뢰. 세 라운드를 모두 이겨야 보상이 나온다. */
export interface BountyTierDef {
  id: string;
  /** 1부터 오르는 등급. 바로 앞 등급을 깨야 열린다. */
  order: number;
  name: string;
  /**
   * 세 라운드를 모두 이겼을 때 받는 골드. **스테미나 하나당 골드**가 등급마다 오른다 — 하루 세 번
   * 제한을 걷어 내며 스테미나가 사다리를 따르게 되자, 예전 값(스테미나 15 고정)의 1당 효율
   * (200 · 333 · 533 · 800 · 1,200)을 그대로 지키도록 새 스테미나에 맞춰 다시 셌다.
   */
  rewardGold: number;
  rounds: readonly [BountyRoundDef, BountyRoundDef, BountyRoundDef];
}

/**
 * 콘텐츠 전체가 공유하는 운영 상수.
 *
 * **한 판이 곧 세 라운드다.** 스테미나는 입장 한 번에 한 번만 나가고, 그 값은 **모든 등급이
 * 같다**(`DUNGEON_RUN_STAMINA` — 치즈케이크 대작전과 같은 값). 하루 입장 제한은
 * 두지 않는다 — 스테미나를 녹이는 던전이라 횟수까지 잠그면 같은 판을 두 번 막는다.
 *
 * **제한 시간은 두지 않는다.** 1대1은 서로 못 죽이는 조합이 실제로 있어(아모처럼 버티는 정예
 * 상대로 화력이 모자란 개체) 예전에는 60초에 그 라운드를 패배로 끊었는데, 모든 전투가 이미
 * 데스 카운트(`BATTLE_DEATH_CLOCK`)로 스스로 닫히므로 두 장치가 같은 일을 했다. 이제 못 끝내는
 * 라운드는 데스 카운트에 무너져 진다 — 거의 이긴 판은 그 사이에 끝낼 틈을 얻는다.
 */
export const BOUNTY = {
  roundCount: 3,
} as const;

/**
 * 등급 사다리 — **열 등급**.
 *
 * **한 등급 안의 셋은 같은 레벨로 자라 있고, 등급마다 서는 정예가 바뀐다.** 다섯 등급이 모두 토비 → 아모
 * → 코마였을 때는 등급이 레벨만 다른 같은 판이라 한 번 맞춘 세 명을 끝까지 그대로 썼다. 지금은 아래
 * 등급에 가벼운 정예(네우리·펄시·미르·리파)가 서고, 위로 갈수록 무거운 정예(아모·아트라·코마·이카닉시아)가
 * 자리를 넓혀 **등급마다 누구를 어느 라운드에 낼지**를 다시 고르게 한다. 마지막 라운드는 늘 그 등급에서
 * 가장 무거운 정예다 — 누구를 마지막까지 남길지가 이 던전의 판단이다.
 *
 * 값은 눈대중이 아니라 `tests/unit/bountyBalance.test.ts`가 `duelBalance`로 다시 잰다 — 등급마다 상정한
 * 성장 수준에서 세 라운드 모두 낼 개체가 셋 이상 남는지, 그리고 **레벨 20 파티를 세워 두고 등급만
 * 올렸을 때 낼 수 있는 개체가 줄곧 줄어드는지**(70 → 68 → 59 → 44 → 41 → 28 → 25 → 16 → 13 → 4)다.
 *
 * **ID는 저장 키라 순서와 따로 논다.** 다섯 등급이던 때의 `bounty-1`~`bounty-5`는 같은 레벨대의 새 자리
 * (1 · 3 · 5 · 7 · 10급)로 옮겨 앉고, 그 사이에 새로 선 다섯이 `bounty-6`~`bounty-10`이다 — 이미 깬 등급이
 * 저장 이관 없이 비슷한 무게의 자리를 그대로 깬 것으로 남는다. 위 등급을 깼으면 아래 등급은 모두 깬
 * 것으로 본다(`isBountyTierCleared`).
 *
 * 골드는 예전 다섯 자리(1,200 · 3,300 · 6,400 · 14,400 · 26,400)의 레벨-골드 곡선 위에 새 레벨을 얹어
 * 다시 읽었다. 스테미나는 모든 등급이 10이라 위 등급일수록 1당 골드가 크게 좋아진다(120 → 2,800).
 * 맨 위는 예전 5급과 같은 LV.60에 더 무거운 셋이 서는 자리라 한 판 몫을 6%만 얹었다(26,400 → 28,000 —
 * 반복 보상 승인선 20% 안).
 */
export const BOUNTY_TIERS: readonly BountyTierDef[] = [
  // 1급은 스토리 1장을 막 민 파티(레벨 15 언저리)가 들어서는 자리다.
  { id: "bounty-1", order: 1, name: "현상수배 1급", rewardGold: 1_200, rounds: [
    { relicId: "neuri", level: 5 }, { relicId: "pulsi", level: 5 }, { relicId: "amo", level: 5 },
  ] },
  { id: "bounty-6", order: 2, name: "현상수배 2급", rewardGold: 2_200, rounds: [
    { relicId: "ripa", level: 11 }, { relicId: "toby", level: 11 }, { relicId: "amo", level: 11 },
  ] },
  { id: "bounty-2", order: 3, name: "현상수배 3급", rewardGold: 3_200, rounds: [
    { relicId: "mir", level: 17 }, { relicId: "pulsi", level: 17 }, { relicId: "koma", level: 17 },
  ] },
  // 4급부터 돌파 없는 상한(20)을 넘는다.
  { id: "bounty-7", order: 4, name: "현상수배 4급", rewardGold: 4_400, rounds: [
    { relicId: "toby", level: 23 }, { relicId: "amo", level: 23 }, { relicId: "koma", level: 23 },
  ] },
  { id: "bounty-3", order: 5, name: "현상수배 5급", rewardGold: 5_700, rounds: [
    { relicId: "neuri", level: 29 }, { relicId: "atra", level: 29 }, { relicId: "koma", level: 29 },
  ] },
  // 6급부터 이카닉시아가 마지막 라운드의 벽으로 선다.
  { id: "bounty-8", order: 6, name: "현상수배 6급", rewardGold: 7_800, rounds: [
    { relicId: "pulsi", level: 35 }, { relicId: "amo", level: 35 }, { relicId: "ikanixia", level: 35 },
  ] },
  { id: "bounty-4", order: 7, name: "현상수배 7급", rewardGold: 11_500, rounds: [
    { relicId: "mir", level: 41 }, { relicId: "atra", level: 41 }, { relicId: "ikanixia", level: 41 },
  ] },
  { id: "bounty-9", order: 8, name: "현상수배 8급", rewardGold: 15_000, rounds: [
    { relicId: "ripa", level: 47 }, { relicId: "atra", level: 47 }, { relicId: "ikanixia", level: 47 },
  ] },
  { id: "bounty-10", order: 9, name: "현상수배 9급", rewardGold: 20_000, rounds: [
    { relicId: "ripa", level: 53 }, { relicId: "koma", level: 53 }, { relicId: "ikanixia", level: 53 },
  ] },
  // 10급은 돌파로 상한을 연 만렙 셋, 그것도 가장 무거운 셋의 자리다.
  { id: "bounty-5", order: 10, name: "현상수배 10급", rewardGold: 28_000, rounds: [
    { relicId: "amo", level: 60 }, { relicId: "koma", level: 60 }, { relicId: "ikanixia", level: 60 },
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
 * 스테이지와 같은 경로를 쓴다 — 레벨 성장과 유형 배수를 `applyEncounterScaling`이 한 줄에서만
 * 돌린다. 정적 정의는 바꾸지 않는다.
 */
export function bountyRoundEnemy(round: BountyRoundDef): RelicDef {
  const base = getRelic(round.relicId);
  return { ...base, encounterRole: BOUNTY_ROLE, stats: applyEncounterScaling(base.stats, bountyRoundLevel(round), BOUNTY_ROLE) };
}

/**
 * 현상수배의 조우 유형은 **잡졸과 같은 한 몫**이다.
 *
 * 이름은 "정예를 사냥한다"이지만 판의 모양은 **1대1 세 판**이라, 편성 하나가 적 하나를 맡는다 —
 * 유형 배수는 "그 하나가 몇 몫을 하는가"이고 여기서는 한 몫이다. 정예 배수(체력 3.6배)를
 * 얹었더니 1급 3라운드를 **확실히 이기는 개체가 한 종도 남지 않았다**(`bountyBalance`).
 * 셋이 하나를 미는 자리에만 그 몫이 붙는다.
 */
export const BOUNTY_ROLE = encounterRoleFor(1);

/** 그 라운드에 실제로 서는 레벨 — 권장 레벨에 정예 차 하나만 얹는다. */
export function bountyRoundLevel(round: BountyRoundDef): number {
  return round.level;
}

/** 등급 이름을 언어별로 덮어쓸 수 있게 등록한다. */
for (const tier of BOUNTY_TIERS) registerDataText(tier, "name", `bounty.tier.${tier.id}.name`);
