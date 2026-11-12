import { GROWTH_STAT_KEYS, breakthroughGrowthPercent } from "./relicProgression";
import { combatPower, POWER_COMPARISON_SLOTS } from "./combatPower";
import type { RelicRarity, Stats } from "./types";

/**
 * **레벨 디자인 키트** — 적의 세기를 수치가 아니라 **시간**에서 역산하기 위한 한 표.
 *
 * 지침 문서는 `docs/level-design.md`가 갖고, 이 파일은 그 문서가 말하는 값을 코드가 읽을 수
 * 있게 옮긴 것이다. Phaser를 읽지 않으므로 데이터·검수·화면이 같은 표를 지난다.
 *
 * **축은 둘뿐이다.**
 * 공용 성장/조우의 기본 규칙이다. 고대 지층의 별도 콘텐츠 배율은
 * data/ancientStrataDifficulty.ts에 공개하며 이 유형 표와 다른 콘텐츠에는 적용하지 않는다.
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
  /**
   * 보스(레이드). 여럿이 함께 미는 표적이다 — 판 안에서는 눕지 않지만 시즌 체력 한 줄은 끝내
   * 깎여 **죽는다.** 그래서 잠기지 않을 **강인함**만 갖고 경감은 갖지 않는다.
   */
  | "boss"
  /**
   * 불사(원정 20층). 눕히는 것이 아니라 **제한 시간 안에 얼마나 밀었나**를 잰다. 죽지 않는
   * 벽이라 **강인함**에 더해 깎일수록 커지는 **경감**을 갖는다.
   */
  | "endless";

/**
 * **강인함** — 군중제어를 받아 낼수록 덜 받는 성질.
 *
 * 한때 보스마다 패시브에 태생 저항·쌓이는 몫·상한을 따로 적었다(폰토스 +8 · 수쿠스이노 +6).
 * 보스가 늘 때마다 같은 문장과 조금씩 다른 수가 복사되므로 **자리(유형)가 갖는다.**
 */
export interface EncounterTenacity {
  /** 강인함 적용 후 이 시간 이하로 남은 행동 제약은 행동을 막지 않는다(초). */
  controlIgnoreAtOrBelowSeconds?: number;
  /** 판을 시작할 때부터 갖는 몫(%). */
  basePercent: number;
  /** 제어를 한 번 받아 낼 때마다 더해지는 몫(%). 시간이 아니라 **횟수**로 센다. */
  perControlPercent: number;
  /** 태생 몫과 쌓인 몫을 합친 상한(%). 100이면 걸리자마자 풀린다. */
  maxPercent: number;
}

/**
 * **치유 감소** — 이 자리의 적이 살아 있는 동안 **상대 편이 받는 모든 회복**이 깎이고, 싸움이 길어질수록 더 깎인다.
 *
 * 정예는 혼자 서므로 한 명을 붙잡고 길게 치유로 버티는 편성이 가장 안전한 풀이가 된다 — 시간이 흐를수록
 * 그 풀이가 막히도록 **경과 시간**으로 오른다. 맞은 횟수가 아니라 시간이라 제어기가 있어도 줄지 않는다.
 * 보호막은 건드리지 않는다(막은 눈에 보이는 자원이고 데스 카운트가 따로 깎는다).
 */
export interface EncounterHealingReduction {
  /** 싸움이 시작되는 순간의 감소(%). */
  basePercent: number;
  /** 상한(%). */
  maxPercent: number;
  /** 상한에 닿기까지 걸리는 시간(초). */
  rampSeconds: number;
}

/**
 * **경감** — 체력이 깎일수록 받는 모든 피해가 줄어드는 성질. 죽지 않는 자리만 갖는다.
 *
 * 최종 피해에 곱하는 감쇠는 뚫을 방법이 없어 개체에 새로 만들지 않는다(`CLAUDE.md` 7번).
 * 이것은 그 규칙의 **유일한 예외**이며, 개체가 아니라 불사라는 자리가 갖고 적 정보창의
 * 역할 칸이 그대로 말한다.
 */
export interface EncounterDamageReduction {
  /** 온전한 몸에서의 경감(%). */
  basePercent: number;
  /** 상한(%). */
  maxPercent: number;
  /** 상한에 닿는 체력 비율(%). 0이면 마지막 한 점까지 계속 자란다. */
  maxAtHpPercent: number;
  /** 오르는 모양. 1보다 작으면 깎이자마자 붙고 뒤에서 완만해진다. */
  curve: number;
  /** 경감과 반올림을 모두 지난 최종 피해가 이 값 이하이면 무효가 된다. */
  ignoreAtOrBelow: number;
}

/**
 * **시간 상승 배율** — 판이 시작될 때는 공격력·주문력이 `startPercent`에서 출발해 `seconds`초에 걸쳐
 * 매초 한 칸씩 100%까지 오른다. 보스·불사는 판이 길어질수록 위협이 되는 자리인데, 처음부터 전부 내면
 * 첫 몇 초에 편성이 서기도 전에 쓰러진다(월드 폭주에서 보스를 제대로 치지도 못하고 아군이 사망했다).
 *
 * 개체가 아니라 **자리**가 갖는다 — 폰토스의 패시브에 있던 시간 누적을 이리로 옮겼다. 공격력·주문력만 곱하고
 * 체력(공유 게이지)·방어·저항·공속은 건드리지 않는다.
 */
export interface EncounterRamp {
  /** 판 시작 때의 공격력·주문력 몫(%). */
  startPercent: number;
  /** 100%에 닿기까지 걸리는 시간(초). */
  seconds: number;
  /** 100%에 닿은 뒤 매초 기본값의 몇 %씩 더 오르는가(선형). 오래 끄는 판일수록 위협이 된다. */
  lateGrowthPercentPerSecond: number;
}

/** 경과 시간(초)에서 램프 몫(0~1)을 구한다. 완전히 지난 초마다 한 칸씩 오른다. */
export function encounterRampFactor(ramp: EncounterRamp, elapsedSeconds: number): number {
  const start = ramp.startPercent / 100;
  const whole = Math.max(0, Math.floor(elapsedSeconds));
  const rise = start + (1 - start) * Math.min(1, whole / ramp.seconds);
  const late = Math.max(0, whole - ramp.seconds);
  return rise + (late * ramp.lateGrowthPercentPerSecond) / 100;
}

export interface EncounterRoleSpec {
  /** 전장에 서는 수. 파티는 셋이다. */
  count: number;
  /** 그리는 크기. 전투 계산에 들어가지 않는다. */
  bodyScale: number;
  /** 그 하나가 버티는 몫. 머릿수를 대신하는 정규화라 관문마다 움직이지 않는다. */
  hpMultiplier: number;
  /** 그 하나가 때리는 몫. 한 번에 하나만 때리므로 체력 몫보다 훨씬 작다. */
  attackMultiplier: number;
  /** 목표 전투 시간(초). 판 안에서 눕지 않는 `boss`·`endless`는 제한 시간이 곧 길이라 두지 않는다. */
  ttkSeconds: readonly [number, number] | null;
  /** 싸움이 끝난 뒤 파티에 남아야 하는 체력 비율. */
  remainingHp: readonly [number, number];
  /** 그 자리가 갖는 강인함. 없으면 제어가 그대로 다 들어간다. */
  tenacity?: EncounterTenacity;
  /** 그 자리가 갖는 경감. 죽지 않는 자리만 갖는다. */
  damageReduction?: EncounterDamageReduction;
  /** 그 자리가 갖는 치유 감소. 혼자 서는 정예가 갖는다. */
  healingReduction?: EncounterHealingReduction;
  /** 그 자리가 갖는 시간 상승 배율. 판 안에서 오래 서는 보스·불사가 갖는다. */
  ramp?: EncounterRamp;
  /**
   * **최대 체력 비례 피해(출혈·뇌진탕·빙결 해제)를 덜 받는 비율(%).**
   *
   * 비율 피해는 맞는 쪽이 두꺼울수록 커지므로, 압도적인 체력으로 서는 자리(보스·불사)에서는 같은 출혈이
   * 다른 모든 타격을 합친 것보다 커진다. 기준 체력(`percentHpBasis`)을 성장 체력으로 낮춘 뒤에도 여전히
   * 한 개체의 퍼뎀이 판을 끌고 가서, 그 자리에만 한 겹을 더 둔다. 받는 피해 전체를 깎는 경감이 아니라
   * **비율 피해만** 줄이므로 무엇으로 때리면 되는지는 그대로 읽힌다.
   */
  percentHpResistance?: number;
  /**
   * **전투력 표시에 얹는 자리 몫** — 능력치가 말하지 못하는 그 자리의 무게(강인함·치유 감소)를 전투력 숫자에 싣는다.
   * 표시 전용이며 전투에는 들지 않는다(`encounterUnitPower`). 없으면 1이다.
   */
  powerWeight?: number;
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
    /*
     * 셋이 함께 서는 일반 무리는 **아군과 같은 척도**다(가중 없음 — 응태 요청, 2026-11-12: 1-6·1-7이 1만으로 읽혀 높다).
     * ×1.3이던 때는 1-1부터 아군 레벨 1(약 7,000)이 이기는 무리가 9,000~10,500으로 읽혔다. 대표 두 조합이 반을 넘게 이기는
     * 아군 전투력은 일반 셋 표시의 최대 1.03배(3-3·5-7 렉시아 조합)이고, 6-6(라자·노아·네우리)에서 엘라·마키·스테라만
     * 1.24배가 드는 것은 그 조합의 상성 벽이다(같은 관문을 렉시아 조합은 0.82배로 넘는다). ×0.9(1-6 약 7,300)로 내리면
     * 3장 일반 관문 여럿에서 렉시아 조합이 1.1배 넘게 들어 「내 전투력이 더 센데 졌다」가 상성 없이도 나온다.
     */
    powerWeight: 1,
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
     *
     * 검수를 실제 전장 크기(`battleArena("stage")`)로 옮기며 공격 몫을 ×1.5 → ×1.1로 다시 쟀다
     * (v0.172.6). 넓은 틀에서는 혼자 선 정예가 후열까지 걸어가는 동안 원거리가 공짜로 쏘았는데,
     * 실제 전장은 그 거리가 짧아 ×1.5로는 대표 조합이 1-10을 한 판도 열지 못했다.
     * v0.174.2에서 ×1.2로 한 뼘 올렸다 — 1-10이 장을 닫는 **벽**이 되어 권장 레벨 파티가 한 번
     * 막히고 뽑기·강화로 돌아가게 한다. ×1.3부터는 원정 10층 정예까지 8판 중 1판만 열려 멈췄다. 체력 몫은
     * 결과를 거의 바꾸지 않아(×2.4~×3.3 사이에서 같은 판이 났다) 그대로 두었다.
     *
     * **v0.275.14에서 ×8로 올렸다**(응태 결정). 1-5의 R 토비가 12초에 끝나 정예답지 않았고, 1-10은 직접 깨 보며 조율하기로 했다.
     * 1-5는 21초(띠 안), 1-10은 편성에 따라 승률 0 ~ 1.00이다. **원정 정예 10층은 29.5 → 67초로 띠를 벗어나 사실상 열리지 않는다** —
     * 같은 표를 읽기 때문이며, 원정 레벨을 다시 풀 때 함께 본다(`levelDesign.test`의 검수 기록).
     *
     * **v0.282.9에서 ×4로 내렸다**(응태 결정). 직접 R 토비로 1-5를 떠 봤는데 이기지 못해, ×8이 R 단독 편성에는 과했다.
     *
     * **v0.308.6에서 ×3으로 내렸다**(응태 결정). 1-10 코마가 SSR 없이는 깨지지 않았다.
     */
    count: 1, bodyScale: 1.18,
    hpMultiplier: 3, attackMultiplier: 1.2,
    ttkSeconds: [18, 32], remainingHp: [0.20, 0.60],
    /*
     * **혼자 서는 정예도 보스처럼 막아서되 훨씬 얕게.** 태생 20%에 제어 한 번마다 10% — 여섯 번이면 상한(80)이라
     * 기절 하나로 정예를 끝까지 잠그지 못하되 첫 몇 번의 잠금은 확실히 든다. 치유 감소는 5%에서 시작해
     * 60초에 걸쳐 40%까지 오른다 — 길게 버티며 고치는 풀이를 시간이 닫되, 평범하게 끝나는 판은 거의 건드리지 않는다
     * (10%에서 50%까지 40초에 올렸더니 원정 정예 10층의 권장 파티 승률이 75%에서 25%로 떨어졌다).
     */
    tenacity: { basePercent: 20, perControlPercent: 10, maxPercent: 80, controlIgnoreAtOrBelowSeconds: 0.05 },
    healingReduction: { basePercent: 5, maxPercent: 40, rampSeconds: 60 },
    /*
     * **혼자 선 정예는 전투력이 더 무겁게 읽힌다**(응태 요청, 2026-11-12 — "왜 내 전투력이 더 센데 져"가 없어야 한다).
     * 강인함과 치유 감소는 능력치에 없어 실제 능력치만 세면 정예가 가볍게 선다. 1-5 토비가 이기는 아군 선(약 6,200~6,700)을
     * 표시가 그대로 말하도록 실제 능력치 전투력에 1.6을 곱한다(`encounterUnitPower`).
     */
    powerWeight: 1.6,
  },
  boss: {
    /*
     * **레이드의 자리다.** 시즌 하나가 공유 체력 한 줄을 갖고 참가자 전원의 피해가 그 줄을
     * 깎는다 — 판 안의 체력은 시즌 게이지에서 나오므로(`raidBossDef`) 이 표가 곱하지 않는다.
     * 비율 피해(출혈)의 기준 체력(`raidBossPercentHpBasis`)도 이 배수를 지나므로 1에서 움직이면
     * 레이드 점수가 통째로 흔들린다.
     *
     * 판 안에서 눕지 않으니 목표 시간은 두지 않고 제한 시간이 곧 길이다.
     */
    count: 1, bodyScale: 1.9,
    hpMultiplier: 1, attackMultiplier: 2.6,
    ttkSeconds: null, remainingHp: [0.05, 0.45],
    /*
     * 태생 50%에 제어 한 번마다 6%. 하루 두 판을 제어 하나로 잠가 끝내지 못하게 하되, 첫 몇
     * 번의 잠금은 확실히 가져가게 하는 선이다.
     */
    tenacity: { basePercent: 50, perControlPercent: 6, maxPercent: 100, controlIgnoreAtOrBelowSeconds: 0.05 },
    percentHpResistance: 30,
    /*
     * **처음 25%에서 30초에 걸쳐 100%로.** 월드 폭주(LV60)의 첫 몇 초에 편성이 서기도 전에 쓰러지는 일을
     * 막되, 30초 뒤의 세기는 예전 그대로라 오래 버티는 판의 난이도는 바뀌지 않는다(응태 결정).
     */
    ramp: { startPercent: 25, seconds: 30, lateGrowthPercentPerSecond: 2 },
  },
  endless: {
    // 판 안에서 눕지 않는다(`SkirmishState.boss`의 불사 계약). 체력은 세기가 아니라 점수를 재는
    // 자라 이 표가 곱하지 않는다.
    count: 1, bodyScale: 1.9,
    hpMultiplier: 1, attackMultiplier: 2.6,
    ttkSeconds: null, remainingHp: [0.05, 0.45],
    /*
     * 태생 50%에 제어 한 번마다 8% — 일곱 번이면 상한이다. 제어 하나로 최종 관문을 통째로
     * 지우지 못하게 하면서도 제어 개체를 쓸모없게 만들지 않는다.
     */
    tenacity: { basePercent: 50, perControlPercent: 8, maxPercent: 100, controlIgnoreAtOrBelowSeconds: 0.05 },
    /*
     * **바닥부터 높다.** 50이던 때는 온전한 몸으로 선 폰토스가 받는 피해의 절반을 그대로
     * 맞았다 — 체력이 무한인 자리라 사실상 "절반만 아픈 벽"이었다. 곡선(0.75)은 1보다 작아
     * 체력 75%에서 80%, 50%에서 87%, 25%에서 93%로 붙고 끝에서 상한에 **부딪히지 않고 닿는다.**
     */
    damageReduction: { basePercent: 70, maxPercent: 99, maxAtHpPercent: 0, curve: 0.75, ignoreAtOrBelow: 10 },
    percentHpResistance: 30,
    /*
     * 보스와 같은 램프에 **주문력 복리 +2%/초**가 얹힌다. 폰토스의 패시브(「심해의 압력」)에 있던 시간 누적을
     * 자리로 옮긴 것이다 — 복리는 0초부터 세므로 30초 뒤의 주문력은 예전과 완전히 같고 앞 30초만 약하다.
     */
    ramp: { startPercent: 25, seconds: 30, lateGrowthPercentPerSecond: 2 },
  },
};

/**
 * **적 전용 레벨당 성장률(%) — 등급마다 다르다.**
 *
 * **적은 적이다**(응태 결정, 2026-11-12). 적의 세기는 레벨 하나가 말하고 레벨에 상한이 없다. 그 위에서 **적도 아군처럼**
 * 등급이 레벨당 성장을 가르고(아군 R 2.2 · SR 2.4 · SSR 2.6과 같은 비례), 돌파 단계마다 오각형 다섯에 아군과 같은 +10%p를
 * 받는다(`breakthroughGrowthPercent` — 적의 돌파는 레벨이 정한다, `ENEMY_BREAKTHROUGH_LEVELS`). 값은 아군보다 가팔라
 * SSR 카르가 LV.60 언저리에서 예전 단일 성장 3.6%의 LV.60과 같은 세기(×3.1)를 낸다. 다른 콘텐츠의 레벨은 3.6% 시절의
 * 세기를 그 개체 등급의 새 곡선 위로 옮겨 적었다.
 */
export const ENEMY_RARITY_LEVEL_GROWTH: Readonly<Record<RelicRarity, number>> = {
  R: 2.5,
  SR: 2.75,
  SSR: 3,
};

/** 레벨 1을 기본치로 두고 등급 성장 + 그 레벨의 돌파 몫으로 자란 배수다. 플레이어와 같은 선형 누적이다. */
export function enemyLevelMultiplier(level: number, rarity: RelicRarity): number {
  if (!Number.isInteger(level) || level < 1) throw new RangeError("적 레벨은 1 이상의 정수여야 합니다.");
  return 1 + ((level - 1) * ENEMY_RARITY_LEVEL_GROWTH[rarity] + breakthroughGrowthPercent(requiredBreakthroughForLevel(level))) / 100;
}

/**
 * 적 하나의 전투 능력치 — **등급·레벨로 자라고 유형으로 몫을 받는다.**
 *
 * 돌파 등급은 그 레벨이 정하고(스킬 칸과 +10%p씩의 능력치 몫을 함께 연다), 등급은 **필수 인자**다 — 기본값을 두면 새
 * 호출부가 등급을 빠뜨린 채 모두 같은 속도로 자란다(아군 `applyLevelGrowth`와 같은 이유).
 *
 * 성장이 올리는 것은 플레이어와 같은 오각형 다섯뿐이고(`GROWTH_STAT_KEYS`), 공속·이속·치명타
 * 같은 나머지는 그 개체의 정의가 그대로 갖는다. 유형 배수도 **체력과 공격 두 축에만** 걸어
 * 어디서 무엇이 얹혔는지 읽히게 둔다.
 */
export function applyEncounterScaling(
  base: Stats,
  rarity: RelicRarity,
  level: number,
  role: EncounterRole,
  countOnField: number = ENCOUNTER_ROLE[role].count,
): Stats {
  const spec = ENCOUNTER_ROLE[role];
  const growth = enemyLevelMultiplier(level, rarity);
  const result = { ...base };
  for (const key of GROWTH_STAT_KEYS) result[key] = Math.round(base[key] * growth);
  result.hp = Math.round(result.hp * encounterHpShare(role, countOnField));
  result.atk = Math.round(result.atk * spec.attackMultiplier);
  result.ap = Math.round(result.ap * spec.attackMultiplier);
  return result;
}

/**
 * **정예가 둘 이상 서는 관문의 체력 몫.** 정예의 체력 배수는 "셋이 나눠 내던 몫을 혼자 대신한다"는
 * 뜻이라, 둘이 서면 그 몫을 **나눠 가진다**(둘이면 각각 절반). 새 유형을 만들지 않고 같은 정예 자리에
 * 머릿수만 달리 얹는 계산이며, 하나일 때는 표 그대로다. 정예 아닌 유형은 머릿수와 무관하다.
 */
export function encounterHpShare(role: EncounterRole, countOnField: number): number {
  const spec = ENCOUNTER_ROLE[role];
  if (role !== "elite") return spec.hpMultiplier;
  return spec.hpMultiplier / Math.max(1, countOnField);
}

/**
 * **자리를 아는 전투력** — 적 한 무리의 개체별 표시 전투력(응태 요청, 2026-11-12: 정예가 전투력보다 훨씬 세다).
 *
 * 정예의 체력 몫(×3)은 「셋이 나눠 내던 몫을 혼자 대신한다」는 뜻인데, 전투력 식은 체력을 선형으로 낮게 세어 혼자 선
 * 정예가 실제 세기의 절반쯤으로 읽혔다. 한때 몫을 덜어 낸 한 몸 × 머릿수로 셌더니 방어·저항·주문력까지 4.8배로 불어 1-5 토비가
 * 아군 두 배(12,900)로 읽혔다(응태: 「수치 표기가 높다」). 지금은 **실제 능력치(몫이 든 값)의 전투력 × 자리 몫**(정예 1.6 · 일반 1 — 아군과 같은 척도)이다 —
 * 토비가 실제로 이기는 아군 선(약 6,200~6,700)과 맞는다. 이카닉시아·코마가 선 벽(1-10·3-10·4-10·7-5)은 편성 상성 때문에 이 표시보다 세다.
 * 표시 전용이며 전투에는 쓰지 않는다.
 */
export function encounterUnitPowers(units: readonly { stats: Stats; encounterRole?: EncounterRole }[]): number[] {
  const elites = encounterEliteCount(units);
  return units.map(({ stats, encounterRole }) => encounterUnitPower(stats, encounterRole, elites));
}

/** 한 무리에 선 정예의 수 — 개체 하나만 그릴 때도 몫을 같은 값으로 나누도록 따로 둔다. */
export function encounterEliteCount(units: readonly { encounterRole?: EncounterRole }[]): number {
  return units.filter((unit) => unit.encounterRole === "elite").length;
}

/** 개체 하나의 자리를 아는 전투력(`encounterUnitPowers`의 한 칸). `elites`는 그 무리에 선 정예 수다. */
export function encounterUnitPower(stats: Stats, encounterRole: EncounterRole | undefined, elites: number): number {
  void elites;
  return Math.round(combatPower(stats) * ((encounterRole && ENCOUNTER_ROLE[encounterRole].powerWeight) ?? 1));
}

/** `encounterUnitPowers`의 합 — 셋보다 많이 서면 `groupCombatPower`처럼 평균 × 셋이다. */
export function encounterGroupPower(units: readonly { stats: Stats; encounterRole?: EncounterRole }[], slots: number = POWER_COMPARISON_SLOTS): number {
  const powers = encounterUnitPowers(units);
  if (powers.length === 0) return 0;
  const total = powers.reduce((sum, power) => sum + power, 0);
  return powers.length <= slots ? total : Math.round(total * slots / powers.length);
}

/**
 * 적의 돌파 단계가 열리는 레벨 — 1 · 2 · 3 · 4단계가 이 레벨부터 선다(응태 결정 2026-11-12, 아군의 한계 돌파 문턱 20 · 30 · 40 · 50
 * 바로 다음 레벨). 단계마다 스킬 칸과 오각형 +10%p를 함께 연다. 적에게는 레벨 상한이 없고 마지막 단계 뒤로는 4단계로 선다.
 */
export const ENEMY_BREAKTHROUGH_LEVELS: readonly number[] = [21, 31, 41, 51];

/** 그 레벨의 적이 지니는 돌파 단계(`ENEMY_BREAKTHROUGH_LEVELS`). */
export function requiredBreakthroughForLevel(level: number): number {
  return ENEMY_BREAKTHROUGH_LEVELS.filter((threshold) => level >= threshold).length;
}

/** 화면에 세울 적의 돌파 등급 — `requiredBreakthroughForLevel`과 같은 값이다(어느 레벨에서도 던지지 않는다). */
export function shownBreakthroughForLevel(level: number): number {
  return requiredBreakthroughForLevel(level);
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
