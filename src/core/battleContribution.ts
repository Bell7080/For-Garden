/** 화면과 서버 검증기가 공유하는 전투 기여도 대분류다. */
export type ContributionCategory = "attack" | "defense" | "healing";

/** 한 그래프 안에서 테마 색으로 나눠 그릴 수 있는 기여도 세부 원천이다. */
export interface FighterContribution {
  attack: { attackPower: number; abilityPower: number };
  defense: { armor: number; resistance: number; shield: number };
  healing: number;
  /**
   * 아군(자신 포함)에게 두른 보호막의 양. 회복 분류에 함께 들고, 판에는 회복 막대 오른쪽에 푸른 칸으로 선다.
   *
   * 막은 **두른 순간** 센다(`grantShield` 한 곳). 막혀서 줄어든 몫을 방어에 다시 세지 않는다 —
   * 같은 막이 두 분류에 들면 막을 두르는 개체만 MVP 점수가 두 번 오른다.
   */
  shieldGranted: number;
}

/** 안정적인 전투원 런타임 ID만 키로 쓰는 변경 가능한 전투 누적표다. */
export type BattleContributions = Record<string, FighterContribution>;

/**
 * 귀속 전투 유닛의 실제 공격자 ID와 결과 행 소유자를 분리한다.
 *
 * 사건은 `actualSourceId`를 그대로 보존하고, 누적표만 명시된 owner로 접는다. owner가 없으면
 * 일반 전투원 공격이므로 실제 출처가 곧 결과 행이다. 이 경계 덕분에 소환수 행을 만들지 않는다.
 */
export function contributionOwnerId(actualSourceId: string, ownerFighterId?: string): string {
  return ownerFighterId ?? actualSourceId;
}

/** 편성원 전부를 0으로 시작시켜 사건이 없던 전투원도 결과 화면에 항상 남긴다. */
export function createBattleContributions(fighterIds: readonly string[]): BattleContributions {
  return Object.fromEntries(fighterIds.map((id) => [id, {
    attack: { attackPower: 0, abilityPower: 0 },
    defense: { armor: 0, resistance: 0, shield: 0 },
    healing: 0,
    shieldGranted: 0,
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
  if (category === "healing") {
    if (detail === "shield") fighter.shieldGranted += amount;
    else fighter.healing += amount;
  }
  else if (category === "attack" && (detail === "attackPower" || detail === "abilityPower")) fighter.attack[detail] += amount;
  else if (category === "defense" && (detail === "armor" || detail === "resistance" || detail === "shield")) fighter.defense[detail] += amount;
}

/** UI가 변경 가능한 원본을 잡지 않도록 값과 중첩 객체를 모두 새 객체로 복사한다. */
export function contributionValue(contributions: BattleContributions, fighterId: string): FighterContribution | undefined {
  const value = contributions[fighterId];
  return value ? { attack: { ...value.attack }, defense: { ...value.defense }, healing: value.healing, shieldGranted: value.shieldGranted ?? 0 } : undefined;
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
  // 보호막이 막은 몫은 여기서 세지 않는다 — 막은 두른 순간 회복 분류(`shieldGranted`)가 이미 셌다.
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
  /** 마주 선 편의 세 분류. 기여도 판의 「적」 보기가 읽는다 — MVP·정산은 `rows`(제 편)만 본다. */
  opponentRows?: Record<ContributionCategory, BattleContributionRow[]>;
  /** 재검증 점수가 행동 재생 합계와 다를 때만 결과 머리글에 병기한다. */
  confirmedAttackTotal?: number;
}

/** 변경 가능한 누적표에서 한 진영의 세 분류를 한 번에 깊은 복사해 종료 스냅샷을 확정한다. */
export function createBattleContributionResult(
  contributions: BattleContributions,
  fighters: readonly ContributionFighterView[],
  side: BattleContributionResult["side"],
  opponents?: readonly ContributionFighterView[],
): BattleContributionResult {
  const snapshot = (list: readonly ContributionFighterView[]): Record<ContributionCategory, BattleContributionRow[]> => ({
    attack: contributionSnapshot(contributions, list, "attack"),
    defense: contributionSnapshot(contributions, list, "defense"),
    healing: contributionSnapshot(contributions, list, "healing"),
  });
  return { side, rows: snapshot(fighters), ...(opponents && opponents.length > 0 ? { opponentRows: snapshot(opponents) } : {}) };
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
      attack: { attackPower: 0, abilityPower: 0 }, defense: { armor: 0, resistance: 0, shield: 0 }, healing: 0, shieldGranted: 0,
    };
    const total = category === "attack" ? value.attack.attackPower + value.attack.abilityPower
      : category === "defense" ? value.defense.armor + value.defense.resistance + value.defense.shield : value.healing + value.shieldGranted;
    const { id: fighterId, ...presentation } = fighter;
    return { fighterId, ...presentation, ...value, total, ratio: 0 };
  });
  const grandTotal = totals.reduce((sum, row) => sum + row.total, 0);
  return totals.map((row) => ({ ...row, ratio: grandTotal > 0 ? row.total / grandTotal : 0 }))
    .sort((a, b) => b.total - a.total || a.formationOrder - b.formationOrder);
}

/**
 * 방어·회복 분류가 MVP 점수에서 온전한 무게를 받으려면 그 분류 전체가 공격 전체의 몇 배여야 하는가.
 *
 * 분류별 몫만 더하던 때는 **양이 아무리 작아도 혼자 도맡으면 몫이 1**이었다 — 흡혈 50을 낸 개체가
 * 피해 10,000을 낸 딜러와 동률이었다. 그래서 방어·회복의 몫에는 「그 분류가 이 판에서 얼마나 컸나」를
 * 곱한다. 팀 전체 회복이 팀 전체 피해의 15%(방어는 30%)에 닿으면 회복은 공격과 같은 무게이고, 그보다 작으면
 * 그만큼 가볍다. 공격은 늘 온전한 무게다 — 판을 끝내는 것이 피해다. 기준은 무작위 3대3 300판 모의의
 * 실측이다(팀 회복 ÷ 팀 피해 중앙값 0.11, 방어 ÷ 피해 중앙값 0.94).
 */
export const MVP_FULL_WEIGHT_SHARE = { defense: 0.3, healing: 0.15 } as const;

/** 세 분류가 MVP 점수에 얹히는 무게. 공격 합이 0인 판은 남은 분류가 온전한 무게를 받는다. */
export function battleContributionMvpWeights(result: BattleContributionResult): Record<ContributionCategory, number> {
  const total = (category: ContributionCategory): number => result.rows[category].reduce((sum, row) => sum + row.total, 0);
  const attack = total("attack");
  const weight = (category: "defense" | "healing"): number => {
    const value = total(category);
    if (value <= 0) return 0;
    if (attack <= 0) return 1;
    return Math.min(1, value / (attack * MVP_FULL_WEIGHT_SHARE[category]));
  };
  return { attack: 1, defense: weight("defense"), healing: weight("healing") };
}

/** 편성원마다의 MVP 점수(분류별 몫 × 그 분류의 무게의 합). 결과판·테스트가 같은 값을 읽는다. */
export function battleContributionMvpScores(result: BattleContributionResult): Map<string, { score: number; formationOrder: number }> {
  const weights = battleContributionMvpWeights(result);
  const scores = new Map<string, { score: number; formationOrder: number }>();
  (["attack", "defense", "healing"] as const).forEach((category) => {
    result.rows[category].forEach((row) => {
      const entry = scores.get(row.fighterId) ?? { score: 0, formationOrder: row.formationOrder };
      entry.score += row.ratio * weights[category];
      scores.set(row.fighterId, entry);
    });
  });
  return scores;
}

/**
 * 결과 화면의 MVP 한 명을 고른다.
 *
 * 원시 수치를 그대로 더하면 규모가 큰 공격이 늘 이겨 방어·회복만 맡은 전투원은 뽑힐 수 없다.
 * 그래서 분류별 몫(ratio, 그 분류 전체 대비 비중)을 세 분류에 걸쳐 더하되, 방어·회복의 몫에는
 * 그 분류가 이 판에서 얼마나 컸는지의 무게(`battleContributionMvpWeights`)를 곱한다.
 */
export function battleContributionMvp(result: BattleContributionResult): string | undefined {
  let best: { fighterId: string; score: number; formationOrder: number } | undefined;
  for (const [fighterId, value] of battleContributionMvpScores(result)) {
    if (!best || value.score > best.score + 1e-9 || (Math.abs(value.score - best.score) <= 1e-9 && value.formationOrder < best.formationOrder)) best = { fighterId, ...value };
  }
  return best?.fighterId;
}
