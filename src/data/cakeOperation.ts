import { registerDataText } from "../i18n";
import type { DungeonRunCost } from "../core/dungeonShortcut";
import type { RelicDef } from "../core/types";
import { getRelic } from "./relics";
import { applyEncounterScaling, encounterRoleFor, type EncounterRole } from "../core/levelDesign";

/**
 * **치즈케이크 대작전** — 레이티아 다섯 자매가 떼로 몰려오는 물량형 던전.
 *
 * 성장 재화(치즈케이크)를 캐는 자리라 "더 강하게 키운 아군으로 더 높은 단계에 들어간다"가
 * 그대로 순환이 된다. 단계가 오를수록 적이 무거워지고 한 판이 주는 치즈케이크도 늘어난다.
 *
 * **난이도 손잡이는 하나뿐이다** — 그 단계의 레벨(`enemyLevel`)이다.
 * 스테이지 전용 배율이나 숨은 보정을 만들지 않는다는 규칙 그대로라, 화면에 선 `LV.n`이 곧
 * 그 개체가 싸우는 레벨이다. 몇 마리가 몰려오는지(`enemyCount`)는 난이도가 아니라 **이 던전의
 * 성격**이라 단계가 올라도 크게 흔들지 않는다.
 */

/** 한 단계의 정적 정의다. 화면도 서버도 이 표 하나만 읽는다. */
export interface CakeOperationTier {
  /** 저장에 남는 안정적인 키다. 화면에 세우는 번호와 섞지 않는다. */
  id: string;
  /** 목록에 서는 단계 이름이다. */
  name: string;
  /** 몰려오는 개체의 자란 레벨이다. */
  enemyLevel: number;
  /**
   * 한 판에 몰려오는 적의 수. **전부 한꺼번에** 맵 끝에서 쏟아져 들어온다.
   *
   * 셋·넷씩 끊어 웨이브로 세우던 때는 "몰려온다"가 아니라 "세 번 나눠 온다"로 읽혔고, 한
   * 무리를 치우면 잠깐 전장이 비어 물량전의 압박이 끊겼다. 상한은 난전의 `MAX_ENEMY_COUNT`다.
   */
  enemyCount: number;
  /** 한 판(배율 x1)에 드는 스테미나다. */
  staminaCost: number;
  /** 한 판(배율 x1)을 이겼을 때 받는 치즈케이크다. */
  rewardCheesecake: number;
}

/**
 * 여덟 단계의 사다리.
 *
 * **적 전부가 한꺼번에 몰려온다.** 무리 유형(`swarm`)의 몫(체력 ×0.7)을 받으므로 권장 레벨은
 * 웨이브 시절 그대로 두어도, 참조 파티(엘라·마키·스테라)가 제 권장 레벨에서 여덟 단계를 모두
 * 넘고 체력이 0.6~0.9 남는다. 머릿수는 10에서 15까지만 오른다 — 20을 넘기면 레벨을 아무리
 * 내려도 수로 밀려 끝나지 않는 판이 된다.
 *
 * 레벨이 한 번도 내려가지 않게 짠다 — 다음 단계가 앞 단계보다
 * 가벼우면 사다리가 아니라 옆길이 된다. 보상은 실효 레벨과 같은 결로 올라가되 **스테미나당
 * 효율이 위로 갈수록 좋아진다**: 그래야 아군을 키울 이유가 생긴다(1단계 3.3 → 8단계 7.5
 * 케이크/스테미나). 일일 무과금 치즈케이크 목표(`FREE_MONTHLY_TARGETS.daily` 200)를
 * 기준으로 잡아, 중간 단계 서너 판이 하루치를 채운다.
 */
export const CAKE_OPERATION_TIERS: readonly CakeOperationTier[] = [
  { id: "cake-1", name: "1단계", enemyLevel: 5, enemyCount: 10, staminaCost: 6, rewardCheesecake: 20 },
  { id: "cake-2", name: "2단계", enemyLevel: 10, enemyCount: 10, staminaCost: 8, rewardCheesecake: 32 },
  { id: "cake-3", name: "3단계", enemyLevel: 15, enemyCount: 11, staminaCost: 10, rewardCheesecake: 46 },
  { id: "cake-4", name: "4단계", enemyLevel: 20, enemyCount: 12, staminaCost: 12, rewardCheesecake: 62 },
  { id: "cake-5", name: "5단계", enemyLevel: 26, enemyCount: 13, staminaCost: 14, rewardCheesecake: 82 },
  { id: "cake-6", name: "6단계", enemyLevel: 32, enemyCount: 14, staminaCost: 16, rewardCheesecake: 104 },
  { id: "cake-7", name: "7단계", enemyLevel: 38, enemyCount: 15, staminaCost: 18, rewardCheesecake: 128 },
  { id: "cake-8", name: "8단계", enemyLevel: 45, enemyCount: 15, staminaCost: 20, rewardCheesecake: 150 },
];

/**
 * 이 던전에 서는 다섯 자매.
 *
 * **순서가 곧 규칙이다** — 몰려오는 무리는 이 차례를 되풀이해 채우므로 다섯 마리마다 자매가
 * 한 명씩 선다. 난수를 쓰지 않아 같은 단계는 늘 같은 얼굴 순서로 몰려온다.
 *
 * 다섯이 속성만 다른 같은 몸이라, 이 던전에서 고를 것은 "무엇을 데려갈까"가 아니라 **어느
 * 색에 강한 편성인가**가 된다. 한 종만 세우던 때는 상성이 한 방향으로 고정되어 편성이 한 번
 * 정해지면 다시 볼 이유가 없었다.
 */
export const CAKE_OPERATION_ENEMY_IDS = [
  "raitia-grass", "raitia-water", "raitia-fire", "raitia-earth", "raitia-wind",
] as const;

const BY_ID = new Map(CAKE_OPERATION_TIERS.map((tier) => [tier.id, tier]));

/** 존재하지 않는 단계를 조회하면 조용히 넘어가지 않고 그 자리에서 실패한다. */
export function getCakeOperationTier(id: string): CakeOperationTier {
  const found = BY_ID.get(id);
  if (!found) throw new Error(`알 수 없는 치즈케이크 대작전 단계: ${id}`);
  return found;
}

/** 목록에서 그 단계가 몇 번째인가(0부터). 해금 판정과 화면 번호가 같은 값을 읽는다. */
export function cakeOperationTierIndex(id: string): number {
  return CAKE_OPERATION_TIERS.findIndex((tier) => tier.id === id);
}

/**
 * 그 단계에 들어갈 수 있는가.
 *
 * 첫 단계는 늘 열려 있고, 그 뒤로는 **직전 단계를 한 번이라도 이겨야** 열린다.
 * `clearedIndex`는 지금까지 이긴 가장 높은 단계의 순번이며 아직 하나도 못 이겼으면 -1이다.
 */
export function isCakeTierUnlocked(id: string, clearedIndex: number): boolean {
  const index = cakeOperationTierIndex(id);
  return index >= 0 && index <= clearedIndex + 1;
}

/** 단축 규칙이 읽는 한 판의 값. 배율을 곱하는 일은 `dungeonShortcut`이 한다. */
export function cakeOperationRunCost(tier: CakeOperationTier): DungeonRunCost {
  return { staminaCost: tier.staminaCost, rewards: { cheesecake: tier.rewardCheesecake } };
}

/** 단계 이름을 언어별로 덮어쓸 수 있게 등록한다. */
for (const tier of CAKE_OPERATION_TIERS) registerDataText(tier, "name", `cakeOperation.${tier.id}.name`);

/** 대작전이 서는 무리 유형. 한 판의 적 전부가 한 화면에 함께 서므로 그 수가 곧 유형이다. */
export function cakeOperationRole(tier: CakeOperationTier): EncounterRole {
  return encounterRoleFor(tier.enemyCount);
}

/**
 * 그 단계에 몰려오는 적 전부. 난전은 이 목록을 **한꺼번에** 맵 끝에 세운다.
 *
 * 자란 몫은 레벨과 유형 몫뿐이다 — 스테이지 전용 배율이나 숨은 보정을 만들지 않는다는 규칙
 * 그대로다.
 */
export function cakeOperationEnemies(tier: CakeOperationTier): RelicDef[] {
  const role = cakeOperationRole(tier);
  const level = tier.enemyLevel;
  // 자매마다 태생 능력치가 같지 않다(공속·이속이 갈린다). 그래서 한 번 키워 돌려쓰지 않고
  // 다섯을 각자 키워 둔 뒤 차례로 세운다.
  const grown = CAKE_OPERATION_ENEMY_IDS.map((id) => {
    const base = getRelic(id);
    return { ...base, encounterRole: role, stats: applyEncounterScaling(base.stats, level, role) } satisfies RelicDef;
  });
  // 같은 정의를 여러 몸이 나눠 쓰지 않도록 개체마다 능력치 사본을 세운다.
  return Array.from({ length: tier.enemyCount }, (_, index) => {
    const sister = grown[index % grown.length];
    return { ...sister, stats: { ...sister.stats } };
  });
}

/** 화면에 서는 `LV.n` — 그 단계의 레벨이 곧 실제로 싸우는 레벨이다. */
export function cakeOperationEnemyDisplayLevel(tier: CakeOperationTier): { level: number } {
  return { level: tier.enemyLevel };
}
