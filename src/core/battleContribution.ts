/** 화면과 서버 검증기가 공유하는 전투 기여도 대분류다. */
export type ContributionCategory = "attack" | "defense" | "healing";

/** 한 그래프 안에서 테마 색으로 나눠 그릴 수 있는 기여도 세부 원천이다. */
export interface FighterContribution {
  attack: { attackPower: number; abilityPower: number };
  defense: { armor: number; resistance: number; shield: number };
  healing: number;
}

/** 안정적인 전투원 런타임 ID만 키로 쓰는 변경 가능한 전투 누적표다. */
export type BattleContributions = Record<string, FighterContribution>;

/** 편성원 전부를 0으로 시작시켜 사건이 없던 전투원도 결과 화면에 항상 남긴다. */
export function createBattleContributions(fighterIds: readonly string[]): BattleContributions {
  return Object.fromEntries(fighterIds.map((id) => [id, {
    attack: { attackPower: 0, abilityPower: 0 },
    defense: { armor: 0, resistance: 0, shield: 0 },
    healing: 0,
  }]));
}

/** NaN·음수·외부 ID를 거부해 클라이언트와 서버 재계산이 같은 안전 경계를 사용하게 한다. */
export function addContribution(
  contributions: BattleContributions,
  fighterId: string,
  category: ContributionCategory,
  amount: number,
  detail?: "attackPower" | "abilityPower" | "armor" | "resistance" | "shield",
): void {
  const fighter = contributions[fighterId];
  if (!fighter || !Number.isFinite(amount) || amount <= 0) return;
  if (category === "healing") fighter.healing += amount;
  else if (category === "attack" && (detail === "attackPower" || detail === "abilityPower")) fighter.attack[detail] += amount;
  else if (category === "defense" && (detail === "armor" || detail === "resistance" || detail === "shield")) fighter.defense[detail] += amount;
}

/** UI가 변경 가능한 원본을 잡지 않도록 값과 중첩 객체를 모두 새 객체로 복사한다. */
export function contributionValue(contributions: BattleContributions, fighterId: string): FighterContribution | undefined {
  const value = contributions[fighterId];
  return value ? { attack: { ...value.attack }, defense: { ...value.defense }, healing: value.healing } : undefined;
}

/** 클라이언트 진행기와 서버 검증기가 동일하게 재생할 수 있는 한 피해 사건의 확정 입력이다. */
export interface DamageContributionInput {
  attackerId: string | "environment";
  targetId: string;
  attackDetail: "attackPower" | "abilityPower";
  defenseDetail: "armor" | "resistance";
  preMitigation: number;
  postMitigation: number;
  hpBefore: number;
  shieldBefore: number;
  hpDamage: number;
  shieldAbsorbed: number;
  shieldProviderId?: string | null;
}

/** 과잉 피해 제한, 무효화 단일 집계, 보호막 제공자 귀속을 한 순수 정책 경계에서 확정한다. */
export function accumulateDamageContribution(contributions: BattleContributions, input: DamageContributionInput): void {
  const capacity = Math.max(0, input.hpBefore) + Math.max(0, input.shieldBefore);
  const hpDamage = Math.min(Math.max(0, input.hpDamage), Math.max(0, input.hpBefore));
  // 환경 피해는 방어 결과에는 남지만 공격자 점수는 만들지 않는다.
  if (input.attackerId !== "environment") addContribution(contributions, input.attackerId, "attack", hpDamage, input.attackDetail);
  const boundedIncoming = Math.min(Math.max(0, input.preMitigation), capacity);
  const afterMitigation = Math.min(Math.max(0, input.postMitigation), capacity);
  addContribution(contributions, input.targetId, "defense", Math.max(0, boundedIncoming - afterMitigation), input.defenseDetail);
  addContribution(contributions, input.shieldProviderId ?? input.targetId, "defense", Math.max(0, input.shieldAbsorbed), "shield");
}

/** 결과 행에 필요한 복사본이며 ratio는 해당 대분류의 전체 합계가 0이면 안전하게 0이다. */
export interface BattleContributionRow extends FighterContribution {
  fighterId: string;
  formationOrder: number;
  name: string;
  portraitId: string;
  total: number;
  ratio: number;
}

export interface ContributionFighterView { id: string; formationOrder: number; name: string; portraitId: string }

/** 전투 종료 뒤에도 보관하거나 네트워크 요청과 함께 전달할 수 있는 순수 JSON 결과다. */
export interface BattleContributionResult {
  side: "player" | "enemy";
  rows: Record<ContributionCategory, BattleContributionRow[]>;
  /** 재검증 점수가 행동 재생 합계와 다를 때만 결과 머리글에 병기한다. */
  confirmedAttackTotal?: number;
}

/** 변경 가능한 누적표에서 한 진영의 세 분류를 한 번에 깊은 복사해 종료 스냅샷을 확정한다. */
export function createBattleContributionResult(
  contributions: BattleContributions,
  fighters: readonly ContributionFighterView[],
  side: BattleContributionResult["side"],
): BattleContributionResult {
  return {
    side,
    rows: {
      attack: contributionSnapshot(contributions, fighters, "attack"),
      defense: contributionSnapshot(contributions, fighters, "defense"),
      healing: contributionSnapshot(contributions, fighters, "healing"),
    },
  };
}

/** 서버 확정 총점만 새 객체에 얹어 이미 확정한 개별 행동 재생 결과는 손대지 않는다. */
export function withConfirmedAttackTotal(result: BattleContributionResult, total: number): BattleContributionResult {
  return Number.isFinite(total) && total >= 0 ? { ...result, confirmedAttackTotal: total } : result;
}

/** 값 내림차순 뒤 편성 순서로 고정해 동률 그래프가 프레임·브라우저 정렬 구현에 흔들리지 않게 한다. */
export function contributionSnapshot(
  contributions: BattleContributions,
  fighters: readonly ContributionFighterView[],
  category: ContributionCategory,
): BattleContributionRow[] {
  const totals = fighters.map((fighter) => {
    const value = contributionValue(contributions, fighter.id) ?? {
      attack: { attackPower: 0, abilityPower: 0 }, defense: { armor: 0, resistance: 0, shield: 0 }, healing: 0,
    };
    const total = category === "attack" ? value.attack.attackPower + value.attack.abilityPower
      : category === "defense" ? value.defense.armor + value.defense.resistance + value.defense.shield : value.healing;
    const { id: fighterId, ...presentation } = fighter;
    return { fighterId, ...presentation, ...value, total, ratio: 0 };
  });
  const grandTotal = totals.reduce((sum, row) => sum + row.total, 0);
  return totals.map((row) => ({ ...row, ratio: grandTotal > 0 ? row.total / grandTotal : 0 }))
    .sort((a, b) => b.total - a.total || a.formationOrder - b.formationOrder);
}

/**
 * 결과 화면의 MVP 한 명을 고른다.
 *
 * 원시 수치를 그대로 더하면 규모가 큰 공격이 늘 이겨 방어·회복만 맡은 전투원은 뽑힐 수 없다.
 * 그래서 분류별 몫(ratio, 그 분류 전체 대비 비중)을 세 분류에 걸쳐 더한 값으로 비교한다 —
 * 공격을 절반 몰아준 딜러와 회복을 절반 몰아준 힐러가 같은 무게로 경쟁하게 된다.
 */
export function battleContributionMvp(result: BattleContributionResult): string | undefined {
  const scores = new Map<string, { score: number; formationOrder: number }>();
  (["attack", "defense", "healing"] as const).forEach((category) => {
    result.rows[category].forEach((row) => {
      const entry = scores.get(row.fighterId) ?? { score: 0, formationOrder: row.formationOrder };
      entry.score += row.ratio;
      scores.set(row.fighterId, entry);
    });
  });
  let best: { fighterId: string; score: number; formationOrder: number } | undefined;
  for (const [fighterId, value] of scores) {
    if (!best || value.score > best.score || (value.score === best.score && value.formationOrder < best.formationOrder)) best = { fighterId, ...value };
  }
  return best?.fighterId;
}
