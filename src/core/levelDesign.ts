import { BREAKTHROUGH_STEPS, GROWTH_STAT_KEYS, RELIC_LEVEL_CAP } from "./relicProgression";
import type { Stats } from "./types";

/**
 * **레벨 디자인 키트** — 적의 세기를 수치가 아니라 **시간**에서 역산하기 위한 한 표.
 *
 * 지침 문서는 `docs/level-design.md`가 갖고, 이 파일은 그 문서가 말하는 값을 코드가 읽을 수
 * 있게 옮긴 것이다. Phaser를 읽지 않으므로 데이터·검수·화면이 같은 표를 지난다.
 *
 * **축은 둘뿐이다.**
 * 1. **레벨** — 그 관문이 얼마나 무거운가. 콘텐츠 사다리 하나가 갖고 **적 레벨이 곧 그 수다**.
 *    화면에 선 `LV.n`이 그 개체가 실제로 싸우는 레벨이고, 유형은 이 수를 건드리지 않는다 —
 *    유형마다 레벨을 얹으면 정예 자리에서 솟았다가 다음 관문에서 도로 내려앉는다.
 * 2. **유형** — 그 하나가 **몇 몫을 하는가**. 정예는 혼자 서므로 셋 몫을 해야 하고, 무리는
 *    다섯이 서므로 하나가 반 몫이다. 이 배수는 난이도 손잡이가 아니라 **머릿수를 대신하는
 *    정규화**라 관문마다 움직이지 않는다 — 조이는 것은 언제나 레벨 하나다.
 *
 * 예전에는 이 둘이 **야성 단계**라는 한 수에 뒤섞여 있었다. 잡졸은 ×3, 정예는 ×5로 얹혀
 * 같은 `+4`가 12레벨과 20레벨 두 가지를 뜻했고, 곱한 값을 감추느라 화면의 `LV.7 +20`으로는
 * 실제 세기(107레벨)를 유추할 방법이 없었다. 혼자 선 정예가 셋 몫을 내려면 능력치가 3배
 * 필요한데 그것을 레벨로만 표현하려 했기 때문에 생긴 배율이다 — **그 몫은 이제 유형이 갖는다.**
 */

/** 조우가 **무엇을 묻는가**. 몸집·머릿수·몫·목표 시간을 이 한 값이 함께 고른다. */
export type EncounterRole =
  /** 잡졸. 아무것도 묻지 않고 흐른다 — 자원(스태미나)을 쓰는 자리다. */
  | "normal"
  /** 무리. **광역 딜이 있는가**를 묻는다. 하나는 약하고 수가 많다. */
  | "swarm"
  /** 정예. **단일 딜과 유지력이 있는가**를 묻는다. 혼자 서서 셋을 상대하는 관문이다. */
  | "elite"
  /** 보스. 편성과 기믹 대응을 묻는다. 콘텐츠를 닫는 자리다. */
  | "boss"
  /** 불사 보스(원정 20층·레이드). 눕히는 것이 아니라 **제한 시간 안에 얼마나 밀었나**를 잰다. */
  | "endless";

export interface EncounterRoleSpec {
  /** 전장에 서는 수. 파티는 셋이다. */
  count: number;
  /** 그리는 크기. 전투 계산에 들어가지 않는다. */
  bodyScale: number;
  /** 그 하나가 버티는 몫. 머릿수를 대신하는 정규화라 관문마다 움직이지 않는다. */
  hpMultiplier: number;
  /** 그 하나가 때리는 몫. 한 번에 하나만 때리므로 체력 몫보다 훨씬 작다. */
  attackMultiplier: number;
  /** 목표 전투 시간(초). `endless`는 제한 시간이 곧 길이라 두지 않는다. */
  ttkSeconds: readonly [number, number] | null;
  /** 싸움이 끝난 뒤 파티에 남아야 하는 체력 비율. */
  remainingHp: readonly [number, number];
}

/**
 * **유형 한 표.**
 *
 * `hpMultiplier`가 `count`와 거의 역수인 것이 이 표의 뼈대다 — 셋이 설 자리에 하나가 서면
 * 그 하나가 셋 몫을 버텨야 조우의 길이가 유지된다. 반대로 **때리는 몫은 훨씬 작다**: 혼자
 * 서는 개체는 한 번에 하나만 때리므로 체력과 같은 배수를 주면 맞는 쪽이 즉사한다(실측에서
 * 정예에 3배를 주자 파티가 8초에 전멸했다).
 *
 * **유형은 레벨을 건드리지 않는다.** 한때 잡졸 +0 · 무리 +1 · 정예 +3처럼 유형마다 레벨을
 * 얹었는데, 그러면 같은 사다리 위에서 정예 자리만 솟았다가 다음 관문에서 도로 내려앉는다 —
 * 1-5가 LV.19인데 1-6이 LV.15였다. 사다리를 오르는 사람에게 그 내리막은 "여기부터 약해진다"로
 * 읽히므로, **레벨은 콘텐츠 사다리 하나만 정하고** 유형은 아래 두 배수로만 말한다.
 */
export const ENCOUNTER_ROLE: Record<EncounterRole, EncounterRoleSpec> = {
  normal: {
    count: 3, bodyScale: 1,
    hpMultiplier: 1, attackMultiplier: 1,
    ttkSeconds: [10, 16], remainingHp: [0.72, 0.95],
  },
  swarm: {
    /*
     * 하나하나가 가벼워 보여야 떼로 오는 것이 위협이 된다. 다섯이 서므로 몫도 그만큼 작다.
     *
     * **띠는 한 파 기준이다.** 무리는 파를 이어 붙이는 콘텐츠(대작전)가 쓰므로, 한 파에서
     * 남는 체력이 0.9여도 다섯 파를 지나면 절반 아래로 내려간다 — 한 판 전체로 재면 같은
     * 표가 한 파짜리 조우에는 너무 가혹해진다.
     */
    count: 5, bodyScale: 0.8,
    hpMultiplier: 0.7, attackMultiplier: 1,
    ttkSeconds: [14, 28], remainingHp: [0.55, 0.95],
  },
  elite: {
    /*
     * **혼자 서는 자리다.** 셋이 나눠 내던 체력을 하나가 대신하므로 그만큼 두껍다.
     *
     * 유형 차(+3)를 걷어 내고 정예가 잡졸과 같은 사다리 위에 서면서 두 배수를 다시 쟀다 —
     * 정예 관문은 그 장의 끝에 서므로 사다리가 이미 높고, 거기에 ×3.6·×1.55를 그대로 얹자
     * 대표 조합이 여덟 판 모두 전멸했다. 레벨이 아니라 이 두 수가 세기의 손잡이라는 말은
     * **레벨이 움직이면 여기도 다시 잰다**는 뜻이다.
     */
    count: 1, bodyScale: 1.18,
    hpMultiplier: 3.3, attackMultiplier: 1.5,
    ttkSeconds: [18, 32], remainingHp: [0.20, 0.60],
  },
  boss: {
    count: 1, bodyScale: 1.45,
    hpMultiplier: 6.5, attackMultiplier: 2.6,
    ttkSeconds: [40, 80], remainingHp: [0.10, 0.45],
  },
  endless: {
    // 판 안에서 눕지 않는다. 체력은 시즌 게이지가 정하므로 이 표가 곱하지 않는다.
    count: 1, bodyScale: 1.9,
    hpMultiplier: 1, attackMultiplier: 2.6,
    ttkSeconds: null, remainingHp: [0.05, 0.45],
  },
};

/**
 * **적 전용 레벨당 성장률(%).**
 *
 * 플레이어는 등급이 성장률을 가르지만(R 1.8 · SR 2.0 · SSR 2.2) **적에게 희귀도는 가챠
 * 개념이라 성장률을 가를 이유가 없다.** 한 값으로 두면 같은 `LV.n`이 어느 콘텐츠에서나 같은
 * 세기이고, 플레이어 곡선과 같은 자리(2.0)에 두었으므로 **적 레벨과 내 레벨을 나란히 읽을 수
 * 있다** — "내가 18인데 저건 21이네"가 그대로 뜻이 된다.
 */
export const ENEMY_LEVEL_GROWTH_PERCENT = 2;

/** 레벨 1을 기본치로 두고 레벨당 정해진 비율로 자란 배수다. 플레이어와 같은 선형 누적이다. */
export function enemyLevelMultiplier(level: number): number {
  if (!Number.isInteger(level) || level < 1) throw new RangeError("적 레벨은 1 이상의 정수여야 합니다.");
  return 1 + (level - 1) * ENEMY_LEVEL_GROWTH_PERCENT / 100;
}

/**
 * 적 하나의 전투 능력치 — **레벨로 자라고 유형으로 몫을 받는다.**
 *
 * 성장이 올리는 것은 플레이어와 같은 오각형 다섯뿐이고(`GROWTH_STAT_KEYS`), 공속·이속·치명타
 * 같은 나머지는 그 개체의 정의가 그대로 갖는다. 유형 배수도 **체력과 공격 두 축에만** 걸어
 * 어디서 무엇이 얹혔는지 읽히게 둔다.
 */
export function applyEncounterScaling(base: Stats, level: number, role: EncounterRole): Stats {
  const spec = ENCOUNTER_ROLE[role];
  const growth = enemyLevelMultiplier(level);
  const result = { ...base };
  for (const key of GROWTH_STAT_KEYS) result[key] = Math.round(base[key] * growth);
  result.hp = Math.round(result.hp * spec.hpMultiplier);
  result.atk = Math.round(result.atk * spec.attackMultiplier);
  result.ap = Math.round(result.ap * spec.attackMultiplier);
  return result;
}

/**
 * 그 레벨에 닿으려면 한계 돌파를 몇 단계 뚫어야 하는가.
 *
 * **레벨 사다리는 돌파 사다리 위에 놓인다** — 상한이 20인 사람에게 권장 레벨 28짜리 관문을
 * 세우면 그 관문은 "더 키우면 된다"가 아니라 **막힌 문**이다(`BREAKTHROUGH_STEPS`의 상한은
 * 30·40·50·60이고 돌파 0의 상한이 20이다). 콘텐츠 사다리를 그릴 때 이 함수가 돌려주는 단계가
 * 그 시점에 실제로 뚫려 있을 만한 값인지 반드시 함께 본다.
 */
export function requiredBreakthroughForLevel(level: number): number {
  if (level <= RELIC_LEVEL_CAP) return 0;
  const step = BREAKTHROUGH_STEPS.findIndex(({ levelCap }) => level <= levelCap);
  if (step < 0) throw new RangeError("한계 돌파를 다 뚫어도 닿지 못하는 레벨입니다.");
  return step + 1;
}

/** 실측값이 그 유형의 목표 띠 안에 드는지. 검수가 같은 판정을 쓰도록 순수 함수로 둔다. */
export function isEncounterOnTarget(role: EncounterRole, measured: { ttkSeconds: number; remainingHp: number }): boolean {
  const spec = ENCOUNTER_ROLE[role];
  const [lowHp, highHp] = spec.remainingHp;
  if (measured.remainingHp < lowHp || measured.remainingHp > highHp) return false;
  if (spec.ttkSeconds === null) return true;
  const [low, high] = spec.ttkSeconds;
  return measured.ttkSeconds >= low && measured.ttkSeconds <= high;
}

/**
 * **무리로 세는 최소 인원.**
 *
 * 세우는 수(`ENCOUNTER_ROLE.swarm.count`)와 가르는 수는 다른 값이다 — 무리 노드는 다섯을
 * 세우지만, 파티 셋보다 많아지는 **넷부터** 이미 "둘러싸였다"가 시작된다. 대작전 1단계가
 * 3·3·4로 몰려오는 자리가 그 경계다.
 */
export const SWARM_MINIMUM_COUNT = 4;

/** 전장에 함께 선 수와 자리의 성질로 유형을 고른다. 콘텐츠마다 다른 규칙을 만들지 않는다. */
export function encounterRoleFor(countOnField: number, options: { elite?: boolean; boss?: boolean; endless?: boolean } = {}): EncounterRole {
  if (options.endless === true) return "endless";
  if (options.boss === true) return "boss";
  if (options.elite === true) return "elite";
  return countOnField >= SWARM_MINIMUM_COUNT ? "swarm" : "normal";
}
