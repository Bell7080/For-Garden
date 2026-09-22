/**
 * **레벨 디자인 키트** — 적의 세기를 수치가 아니라 **시간**에서 역산하기 위한 한 표.
 *
 * 지침 문서는 `docs/level-design.md`가 갖고, 이 파일은 그 문서가 말하는 값을 코드가 읽을 수
 * 있게 옮긴 것이다. Phaser를 읽지 않으므로 데이터·검수·화면이 같은 표를 지난다.
 *
 * **왜 시간인가.** 수치를 먼저 적고 돌려 보면 "이 관문이 어려운가"를 사람이 눈대중으로
 * 판정하게 된다. 목표를 **몇 초짜리 싸움인가**로 두면 그 판정이 측정이 되고, 새 콘텐츠가
 * 늘어도 같은 자로 잰다. 실측 도구는 이미 있다(`summarizeStageDifficulty`의 `durationSeconds`).
 *
 * **왜 레벨 하나인가.** 플레이어가 화면에서 읽을 수 있는 수는 레벨뿐이다. 세기를 조이는 축이
 * 둘이면(레벨 + 배율) 화면에 선 `LV.n`이 실제 세기를 말하지 못한다 — 1장 정예가 `LV.7 +20`으로
 * 서 있으면서 실제로는 107레벨로 싸우던 것이 그 예다.
 */

/**
 * 조우가 **무엇을 묻는가**. 몸집·표식 같은 생김새는 `ENEMY_PRESENCE`가 갖고, 여기서는 그
 * 조우가 검사하는 항목과 목표 시간을 갖는다.
 */
export type EncounterRole =
  /** 잡졸. 아무것도 묻지 않고 흐른다 — 자원(스태미나)을 쓰는 자리다. */
  | "normal"
  /** 무리. **광역 딜이 있는가**를 묻는다. 하나는 약하고 수가 많다. */
  | "swarm"
  /** 정예. **단일 딜과 유지력이 있는가**를 묻는다. 관문이 되는 자리다. */
  | "elite"
  /** 보스. 편성과 기믹 대응을 묻는다. 콘텐츠를 닫는 자리다. */
  | "boss"
  /** 불사 보스(원정 20층·레이드). 눕히는 것이 아니라 **제한 시간 안에 얼마나 밀었나**를 잰다. */
  | "endless";

/**
 * **권장 레벨 대비 적이 몇 레벨 위인가.**
 *
 * 이 한 줄이 이 키트의 핵심이다 — 유형별 체감 차이를 **배율이 아니라 레벨 차**로 말한다.
 * 플레이어는 곱셈을 해독하지 않고 "내 레벨과 비슷하네 / 여덟 위네"만 읽으면 된다.
 * 야성 단계(`ferocityLevel` × 3 또는 × 5)가 하던 일을 이 표가 대신한다.
 */
export const ENCOUNTER_LEVEL_OFFSET: Record<EncounterRole, number> = {
  normal: 0,
  swarm: 2,
  elite: 8,
  boss: 15,
  endless: 20,
};

/**
 * **전장에 서는 수.** 유형을 레벨 차로 말할 수 있게 하는 짝 규칙이다.
 *
 * 정예를 **혼자** 세우면 셋 몫을 하나가 내야 해서 능력치가 3배 필요하고, 3배는 레벨 차로
 * 적을 수 있는 크기가 아니다(레벨당 5%면 40레벨 위다). 야성 ×5가 태어난 자리가 정확히
 * 여기다 — 그래서 **정예도 호위 둘을 데리고 선다.** 머릿수를 파티와 같은 셋으로 맞추면
 * 유형 차이가 작은 레벨 차로 표현되고, 숫자가 그대로 읽힌다.
 *
 * 보스만 혼자 서는 예외다. 그 자리는 시간이 승패를 정하는 계약(`endless`)이거나 기믹이
 * 머릿수를 대신한다.
 */
export const ENCOUNTER_COMPOSITION: Record<EncounterRole, { lead: number; escort: number }> = {
  normal: { lead: 0, escort: 3 },
  swarm: { lead: 0, escort: 5 },
  elite: { lead: 1, escort: 2 },
  boss: { lead: 1, escort: 2 },
  endless: { lead: 1, escort: 0 },
};

/**
 * 목표 **전투 시간**(초)과 싸움이 끝난 뒤 파티에 남아야 하는 체력 비율.
 *
 * 두 수를 함께 두는 이유는 하나만으로는 조우의 성격이 잡히지 않기 때문이다 — 20초가 걸려도
 * 체력이 그대로면 그냥 긴 잡졸이고, 8초 만에 끝나도 절반이 날아갔으면 그 자리는 관문이다.
 *
 * `endless`는 눕히는 자리가 아니라 제한 시간이 곧 길이라 시간 목표를 두지 않는다.
 */
export const ENCOUNTER_TARGET: Record<EncounterRole, { ttkSeconds: readonly [number, number] | null; remainingHp: readonly [number, number] }> = {
  normal: { ttkSeconds: [10, 16], remainingHp: [0.78, 0.95] },
  swarm: { ttkSeconds: [14, 22], remainingHp: [0.65, 0.88] },
  elite: { ttkSeconds: [20, 30], remainingHp: [0.25, 0.55] },
  boss: { ttkSeconds: [45, 75], remainingHp: [0.10, 0.40] },
  endless: { ttkSeconds: null, remainingHp: [0.10, 0.45] },
};

/**
 * **적 전용 레벨당 성장률(%).**
 *
 * 플레이어 곡선(R 1.8 · SR 2.0 · SSR 2.2)을 그대로 쓰면 의미 있는 세기 차를 만드는 데 수십
 * 레벨이 들어, 1장 정예가 107레벨이 된다. 적에게 희귀도는 가챠 개념이라 성장률을 가를 이유도
 * 없다. 5%로 두면 **오늘의 조정 단위와 같거나 더 섬세하다** — 지금 야성 한 단계가 잡졸 3레벨
 * (≈5.4%) · 정예 5레벨(≈9%)이다.
 */
export const ENEMY_LEVEL_GROWTH_PERCENT = 5;

/** 레벨 1을 기본치로 두고 레벨당 정해진 비율로 자란 배수다. 플레이어와 같은 선형 누적이다. */
export function enemyLevelMultiplier(level: number): number {
  if (!Number.isInteger(level) || level < 1) throw new RangeError("적 레벨은 1 이상의 정수여야 합니다.");
  return 1 + (level - 1) * ENEMY_LEVEL_GROWTH_PERCENT / 100;
}

/**
 * 그 조우에 세울 적 레벨.
 *
 * **권장 레벨은 콘텐츠 사다리가 갖는다**(스토리 관문 순서·원정 층·대작전 단계…). 이 함수는
 * 거기에 유형 차 하나만 더한다 — 콘텐츠마다 다른 방언을 만들지 않기 위해서다.
 */
export function encounterEnemyLevel(recommendedLevel: number, role: EncounterRole): number {
  if (!Number.isInteger(recommendedLevel) || recommendedLevel < 1) throw new RangeError("권장 레벨은 1 이상의 정수여야 합니다.");
  return recommendedLevel + ENCOUNTER_LEVEL_OFFSET[role];
}

/** 실측값이 그 유형의 목표 띠 안에 드는지. 검수가 같은 판정을 쓰도록 순수 함수로 둔다. */
export function isEncounterOnTarget(role: EncounterRole, measured: { ttkSeconds: number; remainingHp: number }): boolean {
  const target = ENCOUNTER_TARGET[role];
  const [lowHp, highHp] = target.remainingHp;
  if (measured.remainingHp < lowHp || measured.remainingHp > highHp) return false;
  if (target.ttkSeconds === null) return true;
  const [low, high] = target.ttkSeconds;
  return measured.ttkSeconds >= low && measured.ttkSeconds <= high;
}
