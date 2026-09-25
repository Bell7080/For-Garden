import { POISON } from "../core/skirmish";
import { registerDataText } from "../i18n";
import type { BasicAttack, RelicDef } from "../core/types";

/**
 * 렐릭 정의. 최종 30종을 목표로 하되, 지금은 파티 편성과 전투 규칙을 검증할 만큼만 둔다.
 * 밸런스 수치는 데이터일 뿐이므로 코드 수정 없이 여기서 조정한다.
 */
/**
 * 디안이 불러내는 두 늑대.
 *
 * 배열 밖 상수로 두는 이유는 **같은 객체**가 두 곳에서 쓰이기 때문이다 — 디안의 `summons`가
 * 전투에 세울 정의로 품고, `RELICS`에도 함께 실려 정보창이 다른 개체와 같은 경로로 찾는다.
 */
const KURO_DEF: RelicDef = {
  /**
   * 검은 늑대 쿠로. 디안의 **공격력** 한 축에서만 자라는 물리 근거리 몸이다.
   *
   * 가챠에 서지 않으므로 등급 띠 밖이지만, 두 마리가 함께 나오는 만큼 R 개체 한 명보다
   * 약하게 짠다 — 오각형의 주문 축이 통째로 비어 있어 같은 모양의 R보다 총량이 낮다.
   */
  id: "kuro",
  summonOnly: true,
  squad: "rogue",
  name: "쿠로",
  specimenNumber: "222",
  projectName: "PACK ECHO",
  excavationSite: "북아메리카 란초 라브레아 타르층",
  fossilRecord: "우두머리 표본 곁에서 함께 발굴된 두 다이어울프 중 검은 털 개체다. 앞다리 근부착부가 두껍게 남아 몸을 던지는 돌격 습성이 확인됐다.",
  catalogSummary: "디안에게 귀속된 검은 다이어울프. 디안의 공격력이 그대로 이 개체의 모든 수치가 된다.",
  unlockRecord: { status: "recorded", text: "쿠로는 디안보다 먼저 문을 나선다. 낯선 소리가 나면 뒤도 돌아보지 않고 그쪽으로 달려가 서 있고, 디안이 부를 때까지 물러서지 않는다." },
  squadNote: "쁘띠 로그의 앞. 디안이 가리키기 전에 먼저 달려가 길목에 선다.",
  researcherTitle: "대장님",
  rarity: "R",
  portraitAssetId: "kuro",
  origin: "다이어울프",
  element: "fire",
  role: "warrior",
  reachTier: "melee",
  excavationTrait: { primaryCurrency: "gold", baseProductionPerHour: 0, efficiencyMultiplier: 1.00 },
  // 디안의 태생 공격력 160에서 파생한 값이며, 전투에서는 성장한 공격력으로 다시 계산된다.
  stats: { hp: 704, def: 56, res: 56, atk: 158, ap: 0, attackSpeed: 104, moveSpeed: 109, critChance: 10, critDamage: 150, energyGain: 26, lifeSteal: 0, ferocityGain: 0 },
  ferocityTrait: {
    name: "무리의 몸", effectId: "packBody",
    defenseResistancePercent: 50, attackSpeedPercent: 50, criticalChancePoints: 25, lifeStealPoints: 25,
  },
  passive: { id: "kuro-passive", name: "검은 이빨", kind: "summonDerived", iconAssetId: "skill-icon-buff", effectType: "buff", value: 0, desc: "디안이 전투 시작 시 불러내는 귀속 소환수다. 디안의 공격력이 쿠로의 체력·공격력·방어력·저항력·공격 속도·이동 속도를 모두 정한다." },
  basic: { id: "kuro-basic", name: "물어뜯기", power: 45, iconAssetId: "skill-icon-physical", effectType: "physical", damageType: "physical", targeting: "single" },
  ultimate: {
    id: "kuro-ult", name: "검은 돌진", power: 150, iconAssetId: "skill-icon-physical", effectType: "physical",
    damageType: "physical", cost: 100, targeting: "chargeLine", radius: 42,
    statusEffects: [{ kind: "bleed", seconds: 3, maxHpPercentPerSecond: 2 }],
  },
};

const SHIRO_DEF: RelicDef = {
  /** 흰 늑대 시로. 디안의 **주문력** 한 축에서만 자라는 마법 근거리 몸이다. */
  id: "shiro",
  summonOnly: true,
  squad: "rogue",
  name: "시로",
  specimenNumber: "223",
  projectName: "PACK ECHO",
  excavationSite: "북아메리카 란초 라브레아 타르층",
  fossilRecord: "우두머리 표본 곁에서 함께 발굴된 두 다이어울프 중 흰 털 개체다. 두개골의 청각 기관이 유난히 발달해 먼 거리의 움직임을 읽었을 것으로 추정된다.",
  catalogSummary: "디안에게 귀속된 흰 다이어울프. 디안의 주문력이 그대로 이 개체의 모든 수치가 된다.",
  unlockRecord: { status: "recorded", text: "시로는 달려가지 않고 먼저 귀를 세운다. 쿠로가 뛰어든 뒤에 옆으로 돌아 들어가 빠져나갈 길을 막고, 디안이 물러설 때 마지막까지 그 자리에 남는다." },
  squadNote: "쁘띠 로그의 옆. 쿠로가 앞을 막는 동안 빠져나갈 길목을 끊는다.",
  researcherTitle: "대장님",
  rarity: "R",
  portraitAssetId: "shiro",
  origin: "다이어울프",
  element: "fire",
  role: "assassin",
  reachTier: "melee",
  excavationTrait: { primaryCurrency: "gold", baseProductionPerHour: 0, efficiencyMultiplier: 1.00 },
  // 디안의 태생 주문력 158에서 파생한 값이며, 전투에서는 성장한 주문력으로 다시 계산된다.
  stats: { hp: 703, def: 58, res: 62, atk: 0, ap: 155, attackSpeed: 96, moveSpeed: 100, critChance: 10, critDamage: 150, energyGain: 26, lifeSteal: 0, ferocityGain: 0 },
  ferocityTrait: {
    name: "무리의 몸", effectId: "packBody",
    defenseResistancePercent: 50, attackSpeedPercent: 50, criticalChancePoints: 25, lifeStealPoints: 25,
  },
  passive: { id: "shiro-passive", name: "흰 이빨", kind: "summonDerived", iconAssetId: "skill-icon-buff", effectType: "buff", value: 0, desc: "디안이 전투 시작 시 불러내는 귀속 소환수다. 디안의 주문력이 시로의 체력·주문력·방어력·저항력·공격 속도·이동 속도를 모두 정한다." },
  basic: { id: "shiro-basic", name: "백색 포효", power: 45, iconAssetId: "skill-icon-magical", effectType: "magical", damageType: "magical", scalingStat: "ap", targeting: "single" },
  ultimate: {
    id: "shiro-ult", name: "서리 추적", power: 150, iconAssetId: "skill-icon-magical", effectType: "magical",
    damageType: "magical", scalingStat: "ap", cost: 100, targeting: "chargeLine", radius: 42,
    statusEffects: [{ kind: "chill", speedPercentPerStack: 15, maxStacks: 2 }],
  },
};

export const RELICS: RelicDef[] = [
  {
    id: "rex",
    squad: "fang",
    name: "렉시아",
    specimenNumber: "072",
    projectName: "APEX CROWN",
    excavationSite: "몽골 네메그트층 제7구역",
    // 발굴 기록은 장소·보존 상태·복원 연구 특징만 담고, 복원 이후 생활 관찰과 분리한다.
    fossilRecord: "제7구역의 붉은 사암 경계에서 두개골과 하악이 맞물린 채 발견됐다. 마모된 치아의 미세 흔적까지 복원 연구에 남았다.",
    observationProfile: {
      originYear: "약 6,800만 년 전",
      // E.C.는 렉시아의 인간형 신체 나잇대만 나타내며, 아래 성체 초기 화석 단계와 독립된 값이다.
      restorationYear: "E.C. 18년",
      lifeStage: "성체 초기",
      height: "1.63 m",
      // 163cm의 인간형 체격을 기준으로 관찰일지에 단일 측정값을 기록하며, 원종의 성체 여부를 체격에 대입하지 않는다.
      weight: "54 kg",
    },
    catalogSummary: "신장 1.63m, 체중 54kg의 균형 잡힌 인간형 체격과 발달한 턱 구조가 확인된, 성체 초기 티라노사우루스 화석 기반 표본.",
    unlockRecord: { status: "recorded", text: "렉시아는 먼저 앞장서고 승부를 선언하는 일이 잦다. 스스로를 여왕이라 부르는 당당한 말투와 달리, 동료의 신호가 들리면 곧바로 보폭을 맞춘다. 전투가 길어질수록 [[ferocity|야성]]을 즐기면서도 뒤처진 동료를 몇 번이고 돌아보는 모습이 관찰됐다." },
    rarity: "SSR",
    portraitAssetId: "lexia",
    origin: "티라노사우루스",
    element: "fire",
    role: "warrior",
    // 송곳니로 물어뜯는 근접 물리 딜러.
    reachTier: "melee",
    // 발굴 특화는 전투 능력치와 무관한 운영 데이터다.
    excavationTrait: { primaryCurrency: "rawStone", baseProductionPerHour: 1.2, efficiencyMultiplier: 1.10 },
    stats: {
      hp: 980,
      def: 50,
      res: 44,
      atk: 158,
      ap: 92,
      attackSpeed: 112,
      moveSpeed: 108,
      critChance: 10,
      critDamage: 150,
      energyGain: 26,
      lifeSteal: 0,
      ferocityGain: 0,
    },
    // 치명타 확률 가산은 패시브가 이미 미는 축이라 폭주가 같은 말을 반복했다. 지금은 자기가
    // 남긴 출혈을 조건으로 삼아, 물어뜯은 자리를 다시 무는 것이 곧 확정 치명타다.
    ferocityTrait: { name: "전투의 여왕은 나야.", effectId: "rexBattleQueen", bleedingGuaranteedCritical: true, allDamageLifeStealPoints: 25 },
    breakthroughEffects: {
      basic: { kind: "deepBleed", bleedMultiplier: 2, healingReceivedReductionPercent: 40 },
      ultimate: { kind: "execution", energyRefundOnKill: 150 },
      ferocity: { kind: "cleavingBasics", radius: 260 },
      passive: { kind: "battleMaidAscension", durabilityPercent: 25, rechargeOnKill: true },
    },
    passive: {
      id: "rex-passive",
      name: "전투는 메이드의 소양이기에.",
      kind: "battleMaidMastery",
      iconAssetId: "skill-icon-buff",
      effectType: "buff",
      value: 25,
      attackSpeedPercent: 25,
      attackPowerPercent: 25,
      criticalChancePercent: 25,
      criticalDamagePercent: 25,
      // 흡혈은 전 개체 공통 0이라 곱이 아니라 퍼센트포인트로 끌어다 쓴다. 물어뜯을수록 회복하는
      // 개체라야 앞장서서 먼저 붙는 폭주와 맞물린다.
      lifeStealPoints: 25,
      // 뒤에서 쏘는 상대에게는 붙는 것 자체가 일이다. **중거리쯤까지 다가서면** 남은 사이를
      // 한 번에 파고들어 멈춰 세운다 — 원거리 상대에게는 한두 대 맞으며 달려간 끝에 뛰어들고,
      // 상대도 중거리면 서로 닿는 그 순간 함께 뛰어드는 그림이 된다.
      openingCharge: { withinReachTier: "mid", stunSeconds: 1 },
      // kind가 battleMaidMastery인 패시브는 passiveDescription()이 실제 능력치로 다시 문장을 만들므로
      // 이 원문은 데이터 문서화용일 뿐 화면에는 쓰이지 않는다.
      desc: "전투 시작 시 공격 속도·공격력·치명타 확률·치명타 피해·흡혈이 모두 25% 오르고, 표적에게 중거리까지 다가서면 돌진해 1초 동안 기절시킨다.",
    },
    basic: {
      id: "rex-basic",
      name: "출혈 송곳니",
      power: 120,
      iconAssetId: "skill-icon-physical",
      effectType: "physical",
      damageType: "physical",
      // 일반 공격도 요약에서 대상을 명시할 수 있도록 단일 대상 계약을 데이터에 둔다.
      targeting: "single",
      statusEffects: [{ kind: "bleed", seconds: 3, maxHpPercentPerSecond: 2 }],
    },
    ultimate: {
      id: "rex-ult",
      name: "절멸의 포효",
      power: 300,
      iconAssetId: "skill-icon-physical",
      effectType: "physical",
      damageType: "physical",
      cost: 210,
      damageHealingPercent: 50,
      // 궁극기 대상 방식은 설명문이나 렐릭 ID가 아니라 코어가 읽는 계약이다.
      targeting: "single",
      // damageHealingPercent가 있는 스킬은 skillDescription()이 대상·피해·회복을 한 문장으로
    },
  },
  {
    id: "anky",
    squad: "rogue",
    name: "토리카",
    specimenNumber: "014",
    projectName: "BASTION HORN",
    excavationSite: "고비 사막 백악기 퇴적층",
    // 발굴 기록은 장소·보존 상태·복원 연구 특징만 담고, 복원 이후 생활 관찰과 분리한다.
    fossilRecord: "모래폭풍 뒤 드러난 난각 군집 곁에서 어린 개체의 골격을 수습했다. 눌렸어도 볏과 짧은 뿔의 배열은 또렷했다.",
    observationProfile: {
      originYear: "약 6,800만 년 전",
      // 초등학생 또래의 인간형 신체 나잇대만 나타내며, 해츨링 후기 화석이 암시하는 순수한 성향과 함께 사용한다.
      restorationYear: "E.C. 11년",
      lifeStage: "해츨링 후기",
      height: "1.26 m",
      weight: "186 kg",
    },
    catalogSummary: "초등학생 또래의 키를 지닌 트리케라톱스 해츨링 표본.",
    unlockRecord: { status: "recorded", text: "토리카는 작은 뿔로도 누군가의 앞을 막아 서려 한다. 겁이 나면 한 걸음 물러서지만, 지켜야 할 일이 생기면 자기 생각을 또박또박 말한다. 식사 시간에는 누구보다 씩씩하고 먹성도 좋아 마지막 접시까지 챙긴다. 칭찬을 받으면 볏 끝까지 붉어진 채 친구 몫부터 슬쩍 내미는 습관이 있다." },
    // 소속은 role이 아니라 나이와 성격이 정했다 — E.C. 6년 · 1.08 m의 해츨링이라 "유년형·소형
    // 렐릭은 쁘띠 로그"라는 배정 가이드에 그대로 걸린다. 스쿼드 안의 자리는 기존 둘과 겹치지
    // 않게 잡는다: 도디가 기록하고 티아가 주워 오면, 이쪽은 그 짐을 지고 앞을 막는다.
    squadNote: "쁘띠 로그의 보급 담당 겸 선두 방패. 탐험대가 주워 온 간식과 부품을 제 등에 지고 다니다, 앞이 막히면 누구보다 먼저 나서서 짧은 뿔로 길을 가로막는다.",
    // 스쿼드가 주인공을 부르는 대표 호칭.
    researcherTitle: "대장님",
    rarity: "SR",
    portraitAssetId: "torika",
    origin: "트리케라톱스",
    element: "earth",
    role: "tank",
    // 들이받아 막아서는 전방 탱커.
    reachTier: "melee",
    // 발굴 특화는 전투 능력치와 무관한 운영 데이터다.
    excavationTrait: { primaryCurrency: "gold", baseProductionPerHour: 125, efficiencyMultiplier: 1.05 },
    stats: {
      hp: 1420,
      def: 128,
      res: 92,
      atk: 74,
      ap: 52,
      attackSpeed: 78,
      moveSpeed: 72,
      critChance: 10,
      critDamage: 150,
      energyGain: 26,
      lifeSteal: 0,
      ferocityGain: 0,
    },
    // **폭주가 체력을 되돌리지 않는다.** 매초 회복이 함께 있던 때는 폭주 한 번이 곧 완치라,
    // 앞에 선 몸이 언제 무너지는지가 화면에서 사라졌다(5% → 1.5%로 내려도 성격은 같았다).
    // 되찾는 것은 패시브 「온화한 방패」가 전투당 한 번만 맡고, 폭주는 **버티는 값**만 든다.
    // 방어력 +40·저항력 +30은 CLAUDE.md의 탱커 규칙대로 퍼센트가 아닌 능력치 판의 실제 증가값이다.
    // 320px 도발은 기존 폭주 반경 220보다 넓어 전열 주변의 복수 적을 확실히 붙잡되 전장 전체는 덮지 않는다.
    // 도발은 진입 때 한 번만 3초간 걸어 폭주 내내 표적을 강제하지 않고, 그 뒤에는 적의 공용 재지정을 허용한다.
    ferocityTrait: { name: "이제 못참아!", effectId: "torikaBulwark", defenseBonus: 40, resistanceBonus: 30, tauntRadius: 320, tauntDurationSeconds: 3 },
    // 별 넷이 이 개체를 **여엿한 탱커**로 완성한다. 넷 다 "막아 선다"는 한 방향을 향하고,
    // 열리는 순서가 곧 그 방향의 단계다 — 기본 공격에 자급 회복과 도발이 붙고(II), 궁극기가
    // 제어를 두 번 더 뿌리고(III), 폭주 뒤의 가장 약한 자리를 보호막이 메우며(IV), 마지막에
    // 자기 회복을 팀 회복으로 나눈다(V). 도발 반경은 폭주와 같은 320px을 쓴다 — 같은 개체가
    // 거는 "넓은 범위"가 기술마다 다르면 어디까지 끌어당기는지 플레이어가 셀 수 없다.
    breakthroughEffects: {
      // 기본 공격의 셋째 뿔에 얹는다. 방어력의 60%는 방어형 성장이 곧 유지력이 되게 하고,
      // 1초 도발은 궁극기의 3초보다 짧아 평타가 제어를 대신하지 않는다.
      basic: { kind: "periodicGuard", healScalingStat: "def", healPercent: 60, tauntRadius: 320, tauntSeconds: 1 },
      // 지각 붕괴가 1.5초 간격으로 두 번 더 떨어진다. 위력 25%라 총량은 본 타격의 1.5배지만,
      // 궁극기가 거는 기절이 세 번 나눠 들어와 전열 점유 시간이 길어지는 쪽이 값이다.
      ultimate: { kind: "echo", casts: 2, intervalSeconds: 1.5, powerPercent: 25 },
      // 폭주가 끝나는 순간 그동안 받은 피해의 30%가 보호막으로 남는다. 폭주 중에 주면 이미
      // 단단한 시간만 더 단단해지고, 끝난 뒤 가장 약해지는 자리를 메우지 못한다.
      ferocity: { kind: "feverBulwark", shieldPercentOfDamageTaken: 50, tauntRadius: 320, tauntSeconds: 2 },
      // 「온화한 방패」가 돌 때 그 회복의 25%를 모든 아군이 함께 받는다. 자기 패시브의 조건을
      // 그대로 타므로 새 발동 조건이 늘지 않는다.
      passive: { kind: "sharedRecovery", percent: 25 },
    },
    passive: {
      id: "anky-passive",
      name: "온화한 방패",
      kind: "emergencyRecovery",
      iconAssetId: "skill-icon-buff",
      effectType: "healing",
      // 5초 동안 최대 체력의 17.5%를 되찾는다. 7%였을 때는 같은 5초에 35%가 돌아와, 반쯤
      // 무너진 몸이 한 번에 제자리로 서서 "여기서 위험하다"는 순간 자체가 없었다.
      value: 3.5,
      durationSeconds: 5,
      // **규칙어로 감싸지 않는다.** 「지속 회복」은 "정해진 시간 동안 일정한 간격으로"까지만
      // 말해 정작 얼마나 오래 얼마씩인지는 눌러 봐도 나오지 않았다 — 이 패시브가 말해야 하는
      // 것이 바로 그 둘이라, 문장이 직접 적는다.
      desc: "전투당 한 번, 체력이 절반 이하가 되면 5초 동안 매초 최대 체력의 3.5%를 회복한다.",
    },
    basic: {
      id: "anky-basic",
      name: "들이받기",
      // 위력을 로스터 최저로 내리고 그 몫을 기절로 옮겼다. 한 방이 아프지 않은 대신 상대의
      // 시간을 빼앗는 개체라, 방어형 탱커가 "혼자 튼튼하기만 한" 자리에서 벗어난다.
      power: 70,
      iconAssetId: "skill-icon-physical",
      effectType: "physical",
      damageType: "physical",
      targeting: "single",
      // 뿔 셋이 모여야 들이받는다. 매 타격마다 1초씩 걸면 공격 간격이 1.92초라 상대의 시간을
      // 절반이나 빼앗아 과했고, 세 타에 한 번 0.5초면 실효 점유가 9%로 내려간다. 주기를
      // 숨기지 않는 이유는 자기 프로필의 칩이 그 수를 들고 있어 다음 한 방이 언제인지
      // 플레이어가 보고 셀 수 있기 때문이다(파치의 배트와 같은 자리다).
      statusEffectEvery: 3,
      statusEffectStackName: "세 개의 뿔",
      // 셋째 뿔은 기절만 남기지 않는다 — 제어 하나로만 끝나면 방어력을 키운 몫이 기본 공격에
      // 돌아오지 않아, 이 개체는 궁극기를 쓸 때만 방어형으로 읽혔다.
      periodicBonusScaling: { stat: "def", power: 50 },
      statusEffects: [{ kind: "stun", seconds: 0.5 }],
    },
    ultimate: {
      id: "anky-ult",
      name: "지각 붕괴",
      // 방어형 성장의 보상을 분명히 하기 위해 방어력 계수를 300%로 사용한다.
      power: 300,
      scalingStat: "def",
      iconAssetId: "skill-icon-physical",
      effectType: "physical",
      damageType: "physical",
      // 광역 제어가 이 개체의 값이라 한때 90까지 낮춰 두었는데, 돌파로 「지각 붕괴」가 1.5초
      // 간격으로 두 번 더 떨어지게 되자 **그 전열이 적의 시간을 거의 전부 가져갔다** — 3.5초
      // 기절이 세 번 나눠 들어오는 동안 다시 게이지가 차서 다음 붕괴가 이어졌다. 게이지를
      // 올려 도는 주기를 벌리고, 기절도 한 번에 가져가는 시간을 줄인다.
      cost: 120,
      // 궁극기 대상 방식은 설명문이나 렐릭 ID가 아니라 코어가 읽는 계약이다.
      targeting: "nearbyEnemies",
      // 반경은 전투 엔진의 대상 판정용 값이며 플레이어에게는 이해하기 쉬운 대상 범위로 바꿔 표시한다.
      radius: 220,
      statusEffects: [{ kind: "stun", seconds: 2 }],
    },
  },
  {
    id: "spino",
    squad: "gear",
    // 저장 데이터와 에셋 키는 유지하고 플레이어에게 표시하는 이름만 스피나로 통일한다.
    name: "스피나",
    specimenNumber: "105",
    projectName: "TIDAL SAIL",
    excavationSite: "북아프리카 켐켐층 수로",
    // 발굴 기록은 장소·보존 상태·복원 연구 특징만 담고, 복원 이후 생활 관찰과 분리한다.
    fossilRecord: "옛 수로의 철분 띠 안에 주둥이와 돛뼈가 흩어지지 않고 보존됐다. 골밀도 분석에서 수중 적응의 흔적을 확인했다.",
    // 관찰 프로필은 저장 데이터가 아닌 정적 도감 정보로 복원 세계관 값과 현재 신체 측정값을 공개한다.
    observationProfile: {
      originYear: "약 9,500만 년 전",
      // E.C.는 소녀기 후반의 인간형 신체 나잇대이며, 원종 화석의 성체 초기 단계와 독립된다.
      restorationYear: "E.C. 19년",
      lifeStage: "성체 초기",
      height: "1.74 m",
      weight: "61 kg",
    },
    // 미보유 도감에는 외형과 수중 적응 체형만 공개하고 신상 및 생활 기록은 노출하지 않는다.
    catalogSummary: "긴 주둥이와 돛 구조, 수중 활동에 적합한 균형 잡힌 체형이 확인된 표본.",
    // 해금 기록은 유일한 연구원인 주인공이 직접 포착한 직업·태도·취미·관계를 1인칭으로 남긴다.
    unlockRecord: { status: "recorded", text: "스피나는 연구소 수중경비대로 근무한다. 과묵한 편이지만 맡은 일은 언제나 정확하게 수행하며, 순찰 경로와 수문 점검 기록에도 빈틈이 없다. 나는 스피나가 아무도 모른다고 생각하는 듯 근무가 끝난 뒤 작은 어항을 오래 꾸미는 모습을 지켜보았다. 아는 체하지 않은 채 주변의 물자국과 모래를 조용히 청소해 두었더니, 여전히 들키지 않았다고 여긴 모양이다. 다음 날 내 책상에는 가장 반듯한 조개 하나가 놓여 있었다." },
    rarity: "SSR",
    portraitAssetId: "seira",
    origin: "스피노사우루스",
    element: "water",
    role: "assassin",
    // 악어턱으로 물어뜯는 근접 암살자.
    reachTier: "melee",
    // 치즈케이크 생산 계약은 수중 발굴 특화이며 전투 역할을 바꿔도 기존 생산성을 보존한다.
    excavationTrait: { primaryCurrency: "cheesecake", baseProductionPerHour: 2.4, efficiencyMultiplier: 1.10 },
    // 낮은 HP·방어력은 렉시아보다 낮은 생존력을, 높은 공격·공속·이속은 암살자의 선공 능력을 보장한다.
    // 저항력 46과 주문력 58은 최소 대응력만 남기고, 치명타 15/155는 빠른 공격이 과도하게 폭증하지 않게 한다.
    stats: {
      hp: 960,
      def: 48,
      res: 58,
      atk: 156,
      ap: 74,
      attackSpeed: 122,
      moveSpeed: 120,
      critChance: 10,
      critDamage: 150,
      energyGain: 26,
      lifeSteal: 0,
      ferocityGain: 0,
    },
    // 내려서는 자리에 물이 고인다. 잠행이 "숨어서 옮겨 간다"에서 **사냥터를 여는 걸음**이 되어,
    // 도착하자마자 그 자리의 평타가 전부 다단히트로 들어간다.
    ferocityTrait: { name: "잠행", effectId: "stealthLeap", durationSeconds: 3, leapTarget: "lowestHpEnemy", landingDistance: 172, landingShallows: true },
    passive: {
      id: "spino-passive",
      name: "전투의 환희",
      kind: "basicHitAttackSpeedStack",
      iconAssetId: "skill-icon-buff",
      effectType: "buff",
      value: 3,
      // 태생 치명타는 전 개체 공통이므로 암살자의 치명타형 정체성은 패시브가 만든다.
      // 연격이 한 행동에 두 번 판정하므로 렉시아·루카보다 낮은 값으로도 충분히 자주 터진다.
      criticalChancePercent: 10,
      desc: "기본 공격이 적중할 때마다 이번 전투 동안 공격 속도가 3 증가한다.",
    },
    // 스피나의 기본 공격 데이터는 중복 키 없이 BasicAttack 계약을 직접 검증한다.
    basic: {
      id: "spino-basic",
      name: "악어턱 물어뜯기",
      power: 80,
      iconAssetId: "skill-icon-physical",
      effectType: "physical",
      damageType: "physical",
      combo: { chancePercent: 40, hitCount: 2 },
      /*
       * 「여울」. 물가의 포식자는 사냥터를 고르는 것이 아니라 **만든다.**
       *
       * 예전에는 판이 한 곳뿐이고 스피나 **발밑에** 고여, 이름만 사냥터일 뿐 사실상 자기 강화
       * 버프였다 — 한 명과 붙어 싸우는 동안 물은 늘 발밑에 있었고 전장을 돌아다니는 개체도
       * 아니라 "어디에 고였나"가 아무것도 바꾸지 않았다. 지금은 **적 주위 곳곳에** 깔고 그
       * 사이를 뛰어다닌다.
       *
       * 반경 200은 붙어 싸우는 거리(`SKIRMISH.reach` 172)보다 조금 넓다 — 표적 하나만 잠그는
       * 판이면 "물가"가 아니라 그냥 표식이고, 난전 한 덩어리를 통째로 덮을 만큼 넓으면 근접
       * 개체가 전부 상시 둔화된다.
       *
       * `behindDistance` 120은 적을 사이에 두고 건너편이다. 도약이 곧 **적을 지나쳐 반대편으로
       * 파고드는** 걸음이 되고, 표적이 움직일 때마다 새 자리가 열린다.
       *
       * `minSpacing` 260은 반경(200)보다 넓다 — 두 판이 서로의 안쪽에 겹치면 잠긴 적이 한
       * 곳에만 세어져 도약 후보가 둘로 갈리기만 한다. 이 한 줄이 판의 개수를 정하므로 상한을
       * 손으로 적지 않는다: 적이 몰려 있으면 한둘, 흩어져 있으면 셋 넷이 깔린다.
       */
      shallows: {
        radius: 200,
        seconds: 6,
        moveSlowPercent: 35,
        behindDistance: 120,
        minSpacing: 260,
        /*
         * **네 번 물면 한 번 뛴다.** 공속 122(로스터 상위)에 누적 패시브까지 붙으므로 실전에서
         * 대략 2.5~3초에 한 번이고, 판이 6초 남으니 도약 한 번당 두세 곳이 깔려 있다 — 궁극기가
         * 회수할 물이 늘 남아 있으면서도 판이 전장을 덮지는 않는 자리다.
         *
         * 주기를 타수로 잡은 이유는 이 개체의 성장이 공격 속도이기 때문이다. 초로 못 박으면
         * 「전투의 환희」가 아무리 쌓여도 뛰는 횟수가 그대로라 성장과 맞물리지 않는다.
         */
        leapEveryHits: 4,
        leapPower: 110,
        // 물에 잠긴 채로 맞으면 더 아프다. 평타에는 아무 몫도 주지 않으므로, 적을 물가에
        // 가둬 두는 값이 **도약이 꽂히는 순간**에만 돌아온다.
        submergedLeapBonusPercent: 40,
      },
    } satisfies BasicAttack,
    ultimate: {
      id: "spino-ult",
      name: "범람의 포식자",
      power: 200,
      iconAssetId: "skill-icon-physical",
      effectType: "physical",
      damageType: "physical",
      cost: 100,
      // 공격력 200%에 현재 공격 속도 150%를 더해, 두 성장 축을 함께 쓰되 공속 누적의 비중은 절제한다.
      attackSpeedPower: 150,
      // 궁극기 대상 방식은 설명문이나 렐릭 ID가 아니라 코어가 읽는 계약이다.
      targeting: "single",
      statusEffects: [{ kind: "stun", seconds: 3 }],
      /*
       * **깔아 둔 물을 전부 회수한다.** 이 궁극기의 값은 한 명을 세게 치는 것이 아니라
       * **여울을 몇 곳에 벌려 놓았느냐**다 — 평타로 판을 까는 일과 궁극기가 같은 축에 서고,
       * 판이 하나도 없으면 터뜨릴 것도 없다.
       *
       * 위력 130은 도약(110)보다 한 뼘 높다. 같은 판을 터뜨리는 같은 일이되 게이지를 치른
       * 몫만큼만 세다 — 여기를 크게 올리면 판을 까는 이유가 "궁극기 한 방을 키우려고"가 되어,
       * 뛰어다니며 터뜨리는 평상시 리듬이 궁극기를 기다리는 시간이 된다.
       */
      detonateShallows: { power: 130 },
      // attackSpeedPower가 있는 궁극기는 skillDescription()이 구조화 필드로 다시 문장을 만들므로
    },
  },
  // 4번 Puppet 묶음은 전신과 SD가 모두 완성된 루카의 전용 에셋을 사용한다.
  {
    id: "luka",
    squad: "gear",
    name: "루카",
    specimenNumber: "038",
    projectName: "VELOCITY CLAW",
    excavationSite: "몽골 자도흐타층 사구 지대",
    // 발굴 기록은 장소·보존 상태·복원 연구 특징만 담고, 복원 이후 생활 관찰과 분리한다.
    fossilRecord: "사구가 무너진 자리에서 꼬리까지 이어진 관절 골격이 모습을 드러냈다. 발가락뼈의 정렬은 짧고 빠른 질주에 특화돼 있었다.",
    // 성체는 벨로키랍토르 화석의 생물학적 성장 단계만 뜻한다. 루카의 인간형 신체는 별도 E.C. 16년이며 인간 사회의 성인이 아니다.
    observationProfile: {
      originYear: "약 7,500만 년 전",
      restorationYear: "E.C. 16년",
      lifeStage: "성체",
      height: "1.62 m",
      weight: "59 kg",
    },
    // 도감도 관찰 프로필과 같은 수치를 사용하며, 체중은 단거리 선수의 발달한 하체 근육과 함께 설명한다.
    catalogSummary: "신장 1.62m, 체중 59kg이며 단거리 질주에 적합한 발달한 하체 근육과 가벼운 골격을 지닌, 성체 벨로키랍토르 화석 기반 표본.",
    // 해금 기록은 유일한 연구원인 주인공이 루카의 생활과 관계를 직접 관찰한 1인칭 시점으로 남긴다.
    unlockRecord: { status: "recorded", text: "나는 루카를 집과 휴식을 무엇보다 좋아하는 단거리 달리기 선수로 관찰하고 있다. 단거리 선수답게 하체 근육량이 탄탄한 루카는 다른 육식 계열 렐릭들과도 대체로 원만하게 지낸다. 연구소 소파에 길게 누워 쉬다가도 내가 지나가면 늘 먼저 말을 걸어 오는 것이 루카의 습관이다. 오늘은 좋아하는 치즈케이크를 먹으면서도 살이 찌면 달리기가 둔해지지 않겠냐며 가볍게 걱정했지만, 이내 한 입 더 먹고는 다음 질주로 충분히 움직이면 된다며 웃었다." },
    rarity: "SR",
    portraitAssetId: "luka",
    origin: "벨로키랍토르",
    element: "wind",
    role: "assassin",
    // 발톱으로 파고드는 근접 암살자.
    reachTier: "melee",
    // 발굴 특화는 전투 능력치와 무관한 운영 데이터다.
    excavationTrait: { primaryCurrency: "gold", baseProductionPerHour: 137.5, efficiencyMultiplier: 1.08 },
    stats: {
      hp: 850,
      def: 52,
      res: 48,
      atk: 136,
      ap: 76,
      attackSpeed: 122,
      moveSpeed: 124,
      critChance: 10,
      critDamage: 150,
      energyGain: 26,
      lifeSteal: 0,
      ferocityGain: 0,
    },
    // 폭주는 스피나와 같은 은신 태그를 쓰되 도약 없이 무리 사냥을 재실행하며, 루카 자신도 공속 오라 대상이다.
    ferocityTrait: { name: "폭주", effectId: "packHunt", stealthDurationSeconds: 3, retriggerPackHunt: true, sharedTargetAttackSpeedPercent: 40 },
    passive: {
      id: "luka-passive",
      name: "무리 사냥",
      kind: "followHighestAttackAllyTarget",
      iconAssetId: "skill-icon-buff",
      effectType: "buff",
      value: 0,
      // 태생 치명타는 전 개체 공통이므로 암살자의 치명타형 정체성은 패시브가 만든다.
      criticalChancePercent: 15,
      desc: "전투 시작 시 공격력이 가장 높은 아군이 표적으로 삼은 적을 함께 표적으로 삼는다.",
    },
    basic: {
      id: "luka-basic",
      name: "치명적인 발톱",
      power: 100,
      periodicCritical: { every: 4 },
      iconAssetId: "skill-icon-physical",
      effectType: "physical",
      damageType: "physical",
    },
    ultimate: {
      id: "luka-ult",
      name: "약점 관통",
      power: 200,
      iconAssetId: "skill-icon-physical",
      effectType: "physical",
      damageType: "physical",
      cost: 90,
      // 궁극기 대상 방식은 설명문이나 렐릭 ID가 아니라 코어가 읽는 계약이다.
      targeting: "single",
      // 약점을 뚫는 기술이라 표적을 고르는 일까지 이 궁극기가 맡는다 — 가장 무른 곳으로 뛰어
      // 그 자리에서 쓴다. 정적 정의가 아니라 지금의 실제 방어력을 읽어, 깎여 무너진 적이 있으면
      // 그쪽이 먼저다.
      blinkToLowestDefense: true,
      // 주 대상의 최종 HP 손실을 기준으로, 주 대상에게서 가장 가까운 다른 적에게 전이한다.
      damageTransfer: { percent: 75, distanceOrigin: "primaryTarget" },
    },
  },
  {
    id: "dodo",
    squad: "rogue",
    // 스쿼드 메모는 쁘띠 로그의 역할과 주인공을 향한 팬심만 남겨, 복원 후 관찰 기록과 서사를 중복하지 않는다.
    squadNote: "쁘띠 로그의 막내 기록병. 대장님의 1호 팬을 자처해 일지 첫 장에도 그 이름을 적어 두었다.",
    researcherTitle: "대장님",
    // 저장·에셋 호환 ID는 dodo로 두고 플레이어에게 보이는 이름만 확정 명칭으로 바꾼다.
    name: "도디",
    specimenNumber: "001",
    projectName: "ECHO NEST",
    excavationSite: "모리셔스 석회동굴 보관층",
    // 발굴 기록은 장소·보존 상태·복원 연구 특징만 담고, 복원 이후 생활 관찰과 분리한다.
    fossilRecord: "석회동굴의 마른 보관층에서 골격과 난각 조각이 함께 발견됐다. 염분 손상이 적어 최초의 안정 복원 기준이 되었다.",
    observationProfile: {
      originYear: "약 400년 전",
      // E.C.는 어린 탐험대원의 인간형 신체 나잇대이며, 원종 화석의 성체 초기 단계와 독립된다.
      restorationYear: "E.C. 13년",
      lifeStage: "성체 초기",
      // 토리카와 같은 전신 원화 비율을 기준으로 키를 맞추고, 인간형 체격보다 가벼운 조류 골격을 반영했다.
      height: "1.08 m",
      weight: "20 kg",
    },
    catalogSummary: "신장 1.08m, 체중 20kg의 가벼운 체형과 짧은 날개, 단단한 부리가 확인된 비행 불능 조류 표본.",
    // 다른 스쿼드를 향한 동경도 독립 라벨이 아닌, 연구원이 직접 본 행동으로 관찰 기록 문장 안에 남긴다.
    unlockRecord: { status: "recorded", text: "복원 후 도디는 새로운 물건만 보면 “대장님, 이것 좀 보세요!”라고 외치며 달려오고, 반짝이는 잡동사니도 발견 기록이라며 일지에 적는 모습이 관찰됐다. 동료의 사소한 행동과 낯선 상대의 반응까지 깃펜으로 부지런히 받아 적는다. 관제탑의 시그널 아이가 여러 신호를 한꺼번에 살피고 판단하는 모습을 오래 올려다본 날에는, 높은 곳에 올라 동료들의 움직임을 일일이 확인하고 먼저 갈 길을 정하려 했다." },
    rarity: "R",
    portraitAssetId: "dodi",
    origin: "도도새",
    element: "wind",
    role: "support",
    // 깃펜을 든 조수라 겁이 많아 한 걸음 뒤에서 거든다.
    reachTier: "mid",
    // 다이아는 희소 재화라 1시간 생산량을 1 미만으로 두고 수확 시에만 내림한다.
    // 보석은 희소성을 유지하되 기본 보관 시간에 슬롯 하나가 최소 정수 넷을 만든다.
    excavationTrait: { primaryCurrency: "gems", baseProductionPerHour: 0.5, efficiencyMultiplier: 1.12 },
    // **손이 빠른 지원가가 아니라 단단한 지원가다.** 공속 96은 깃펜이 옮기는 회복을 그대로
    // 횟수로 바꿔, 이 개체가 서 있는 것만으로 편성이 죽지 않았다. 그 몫(12)을 체력·방어·저항
    // 셋으로 나눠 옮긴다 — 같은 등급 띠 안에서 총량은 그대로이고, 오르는 것은 제가 버티는
    // 힘이라 회복 총량으로 되돌아오지 않는다.
    stats: {
      hp: 794,
      def: 52,
      res: 90,
      atk: 96,
      ap: 118,
      attackSpeed: 84,
      moveSpeed: 94,
      critChance: 10,
      critDamage: 150,
      energyGain: 26,
      lifeSteal: 0,
      ferocityGain: 0,
    },
    // 손이 빨라지는 몫은 절반으로 줄이고, 그만큼을 고친 자리에 한 겹 덮는 쪽으로 옮겼다 —
    // 속도만 두 배가 되면 폭주가 "더 많이 고쳤다"까지만 말하고, 이미 가득 찬 아군에게는
    // 아무 일도 하지 않는다.
    ferocityTrait: { name: "인비저블 썸띵?", effectId: "selfAttackSpeedMultiplier", bonusPercent: 50, healingShieldPercent: 40 },
    passive: {
      id: "dodo-passive",
      name: "연구원님, 이것 좀 보세요!",
      kind: "guardianNestAura",
      iconAssetId: "skill-icon-buff",
      effectType: "buff",
      value: 15,
      teamDefenseResistancePercent: 15,
      enemyHealingReceivedReductionPercent: 30,
      desc: "생존 중 아군 전체의 방어력·저항력을 15% 높이고 적 전체가 받는 회복량을 30% 낮춘다.",
    },
    basic: {
      id: "dodo-basic",
      name: "깃펜 톡톡",
      power: 50,
      iconAssetId: "skill-icon-magical",
      effectType: "magical",
      damageType: "magical",
      // 깎은 만큼의 30%가 가장 다친 아군에게 간다. 50%였을 때는 평타 한 대가 곧 회복 한 번이라
      // 도디가 선 편성은 받은 피해가 그대로 지워졌다.
      lowestHpAllyHealingFromDamagePercent: 30,
      // lowestHpAllyHealingFromDamagePercent가 있는 스킬은 skillDescription()이 대상·피해·회복을
    },
    ultimate: {
      id: "dodo-ult",
      name: "세기의 대발견... 맞죠?!",
      power: 150,
      iconAssetId: "skill-icon-magical",
      effectType: "magical",
      damageType: "magical",
      cost: 100,
      // 200이었을 때는 한 번에 아군 셋이 거의 만피로 돌아와, 그 한 방이 앞선 전투를 통째로
      // 되감았다. 지금은 크게 한 번 메우되 깎인 자리가 남는다.
      allyHealingPower: 100,
      // 지정점 중심의 넓은 원 경계 안에서 적 피해와 아군 회복을 한 번에 판정한다.
      targeting: "targetedCircle",
      radius: 360,
      // allyHealingPower가 있는 궁극기는 skillDescription()이 실제 주문력으로 회복량을 다시
    },
  },
  {
    id: "tia",
    squad: "rogue",
    name: "티아",
    specimenNumber: "118",
    projectName: "TIDE CROWN",
    excavationSite: "홀츠마덴 흑색 점판암층 제3수로",
    // 발굴 기록은 장소·보존 상태·복원 연구 특징만 담고, 복원 이후 생활 관찰과 분리한다.
    fossilRecord: "흑색 점판암의 얕은 수로 단면에서 유체 한 마리가 통째로 눌린 채 드러났다. 피부 윤곽선까지 남아 등지느러미와 꼬리날의 형태를 그대로 복원했다.",
    observationProfile: {
      originYear: "약 1억 8천만 년 전",
      // E.C.는 티아의 인간형 신체 나잇대이며, 원종 화석의 유체 단계와 독립된 값이다.
      restorationYear: "E.C. 10년",
      lifeStage: "유체",
      height: "1.31 m",
      weight: "27 kg",
    },
    catalogSummary: "신장 1.31m, 체중 27kg의 작은 인간형 체격에 등지느러미 관과 꼬리날, 반투명한 지느러미 베일이 확인된 유체 어룡 표본.",
    unlockRecord: { status: "recorded", text: "복원 후 티아는 물가만 보이면 먼저 뛰어들어 물살을 튀기고 도망치는 장난을 반복한다. 그러다 연구원이 다가오면 베일 자락으로 얼굴 절반을 가린 채 뒷걸음질 치면서도, 이름을 부르면 곧바로 곁으로 달려와 옷자락을 붙잡고 따라다닌다. 강가에서 “쁘띠 로그의 일”이라며 반짝이는 돌과 유리 조각을 한 움큼씩 주워 오는데, 쓸모가 없다는 말을 들은 날에는 꼬리날을 축 늘어뜨리고 한참 말이 없었다." },
    squadNote: "쁘띠 로그의 물가 담당. 반짝이는 것만 보면 주워 와 대장님의 보급품이라 우기고, 정작 칭찬은 베일 뒤에 숨어서 듣는다.",
    researcherTitle: "연구원님",
    rarity: "R",
    portraitAssetId: "tia",
    origin: "이크티오사우루스",
    element: "water",
    role: "warrior",
    // 물장구는 붙어야 튄다.
    reachTier: "melee",
    // 물가에서 주워 오는 것이 곧 그 아이의 일이라, 발굴 특화도 화석 회수 쪽에 붙인다.
    excavationTrait: { primaryCurrency: "rawStone", baseProductionPerHour: 1.12, efficiencyMultiplier: 1.06 },
    // 앞으로 뛰어드는 전사지만 피해는 주문력에서 나온다 — 물살 자체가 무기라 공격력이 낮고
    // 주문력이 높으며, 어린 유체라 체력과 방어는 같은 등급의 탱커보다 낮게 잡는다.
    stats: {
      hp: 820,
      def: 62,
      res: 74,
      atk: 74,
      ap: 126,
      attackSpeed: 104,
      moveSpeed: 112,
      critChance: 10,
      critDamage: 150,
      energyGain: 26,
      lifeSteal: 0,
      ferocityGain: 0,
    },
    // 물살을 타고 계속 뛰어드는 몸이라 폭주는 **버틸 숨과 손**으로 발현한다. 토리카의 폭주와
    // 같은 1초 시계를 쓰되(`torikaBulwark`) 손이 함께 빨라진다 — 그쪽은 앞에 서서 버티는
    // 값이고, 이쪽은 계속 때리면서 버티는 값이다.
    ferocityTrait: { name: "이크티오 다이브!", effectId: "tidalVigor", attackSpeedPercent: 20, missingHpRegenPercentPerSecond: 2 },
    passive: {
      // kind가 shimmerMark인 패시브는 passiveDescription()이 구조화 필드로 다시 문장을 만들므로
      // 이 desc는 표시되지 않는 데이터 문서용 사본이다. 수치를 고치면 함수 쪽 분기도 함께 본다.
      //
      // **표식을 남기는 것이 패시브의 몫이다.** 규칙어(`shimmer`)는 반짝이 무엇이고 다시
      // 맞으면 사라진다는 것까지만 말하고, 지워지는 순간에 무엇이 터지는지는 그 타격을 낸
      // 스킬이 든다(`Skill.shimmerBurst`).
      id: "tia-passive",
      name: "반짝반짝 첨벙첨벙!",
      kind: "shimmerMark",
      iconAssetId: "skill-icon-magical",
      effectType: "magical",
      // 표식을 새로 남길 때 터지는 추가 피해의 주문력 계수(%)다. 100 → 50으로 내렸다가
      // **되돌렸다** — 도달선이 한 칸도 움직이지 않아, 줄인 것은 체감뿐이었다.
      value: 100,
      desc: "적을 타격하면 반짝! 표식을 부여하고 주문력의 100%만큼 마법 피해를 추가로 입힌다.",
    },
    basic: {
      id: "tia-basic",
      name: "물장구",
      power: 62,
      // 물살은 주먹이 아니라 마력이다. 마법 피해지만 계수는 주문력에서 나온다.
      scalingStat: "ap",
      iconAssetId: "skill-icon-magical",
      effectType: "magical",
      damageType: "magical",
      // 표식을 다루는 손이라 한 명을 겨눈다 — 범위로 여럿을 함께 때리면 한 번 휘두를 때마다
      // 표식이 여러 장 붙었다 지워져 무엇이 표식인지 읽히지 않는다.
      targeting: "single",
      // 반짝이 묻은 적을 때리면 그 자리에서 터뜨려 주위까지 함께 적시고, 그 피해의 일부를
      // 제 몸에 두른다.
      shimmerBurst: { power: 50, radius: 260, shieldPercent: 40 },
    },
    ultimate: {
      id: "tia-ult",
      name: "반짝이는 건 다 내 거야!",
      // 한 번만 내리찍는다. 두 번 찍던 때의 값을 그대로 두어(240%를 둘로 나눈 120) 궁극기가
      // 내는 총량이 절반이 된다 — 줄이려는 것이 그 총량이라 한 번의 값은 건드리지 않는다.
      power: 120,
      scalingStat: "ap",
      iconAssetId: "skill-icon-magical",
      effectType: "magical",
      damageType: "magical",
      cost: 90,
      // 궁극기 대상 방식은 설명문이나 렐릭 ID가 아니라 코어가 읽는 계약이다.
      targeting: "nearbyEnemies",
      radius: 420,
      // 쿵. 한 번이다. 두 번 찍던 때는 첫 번째가 남긴 표식을 두 번째가 지워 궁극기 혼자
      // 표식을 열고 닫았고, 그 두 대가 초반 화력을 통째로 밀어 올렸다. 터뜨리는 것은 여전히
      // 일반 공격의 몫이라 여기서는 터지지 않는다(`shimmerBurst`가 없다).
      statusEffects: [{ kind: "stagger", seconds: 0.1 }],
    },
  },

  {
    id: "stella",
    squad: "eye",
    name: "스테라",
    specimenNumber: "141",
    projectName: "UPDRAFT",
    excavationSite: "니오브라라 백악층 상부 해성 퇴적대",
    // 발굴 기록은 장소·보존 상태·복원 연구 특징만 담고, 복원 이후 생활 관찰과 분리한다.
    fossilRecord: "백악층 상부의 고운 이암에서 아직 다 자라지 않은 익수(翼手)가 접힌 채 발견됐다. 볏이 완성되기 전 단계라 성체 표본과 대조해서야 종을 확정할 수 있었다.",
    observationProfile: {
      originYear: "약 8천 4백만 년 전",
      // E.C.는 스테라의 인간형 신체 나잇대이며, 원종 화석의 유체 단계와 독립된 값이다.
      restorationYear: "E.C. 14년",
      lifeStage: "유체",
      height: "1.42 m",
      weight: "31 kg",
    },
    catalogSummary: "신장 1.42m, 체중 31kg의 인간형 체격에 아직 자라는 중인 볏과 넓게 접히는 익수가 확인된 유체 익룡 표본.",
    // 소속을 옮긴 사정은 라벨이 아니라 연구원이 직접 본 행동으로 남긴다.
    unlockRecord: { status: "recorded", text: "복원 후 스테라는 관제탑에 올라가 바람의 방향과 세기를 하루에도 몇 번씩 다시 적는다. 계산이 맞아떨어진 날에는 아무렇지 않은 척 보고서만 내밀지만 볏 끝이 서 있다. 배치 첫 주부터 상급 관측 절차를 통째로 외워 와 시그널 아이 선임들을 당황시켰고, 그 이야기를 들은 쁘띠 로그의 어린 개체들이 통로에서 기다렸다가 따라붙으면 귀찮다고 말하면서도 걸음을 늦춰 준다." },
    squadNote: "시그널 아이의 최연소 관측 담당. 바람길을 미리 읽어 아군이 뜰 자리를 잡아 주며, 아직 새내기라 연구원도 선임처럼 부른다.",
    // 시그널 아이의 새내기라 연구원을 "선배"라 부른다 — 그 호칭 자체가 이적한 지 얼마 안 됐음을 말한다.
    researcherTitle: "선배",
    rarity: "SR",
    portraitAssetId: "stella",
    origin: "게오스테른베르기아",
    element: "wind",
    role: "support",
    // 바람을 밀어 보내는 지원가.
    reachTier: "mid",
    // 관측 기록을 자산으로 바꾸는 담당이라 발굴 특화도 골드 회수 쪽에 붙인다.
    excavationTrait: { primaryCurrency: "gold", baseProductionPerHour: 157.5, efficiencyMultiplier: 1.10 },
    // 회복이 아니라 아군의 스킬 회전을 앞당기는 지원가라, 자기 화력보다 생존과 충전에 무게를 둔다.
    stats: {
      hp: 980,
      def: 60,
      res: 106,
      atk: 120,
      ap: 62,
      attackSpeed: 102,
      moveSpeed: 104,
      critChance: 10,
      critDamage: 150,
      energyGain: 26,
      lifeSteal: 0,
      ferocityGain: 0,
    },
    ferocityTrait: { name: "자, 역풍의 시간이다!", effectId: "tailwindRally", teamFerocityGain: 5, teamEnergyGain: 5 },
    passive: {
      // kind가 lowHpVanish인 패시브는 passiveDescription()이 구조화 필드로 다시 문장을 만들므로
      // 이 desc는 표시되지 않는 데이터 문서용 사본이다. 수치를 고치면 함수 쪽 분기도 함께 본다.
      id: "stella-passive",
      name: "선망 받는 루키의 일상",
      kind: "lowHpVanish",
      iconAssetId: "skill-icon-buff",
      effectType: "buff",
      // 발동 경계는 긴급 회복과 같은 최대 체력의 50%다. 표시에도 이 값을 그대로 쓴다.
      value: 50,
      durationSeconds: 3,
      lowHpStealth: { hpPercent: 50, seconds: 3 },
      desc: "전투당 한 번, 체력이 절반 이하가 되면 3초 동안 은신해 표적에서 벗어난다.",
    },
    basic: {
      id: "stella-basic",
      name: "산뜻한 바람",
      power: 50,
      iconAssetId: "skill-icon-physical",
      effectType: "physical",
      damageType: "physical",
      targeting: "single",
      // 지원가의 값어치는 제 피해가 아니라 아군의 궁극기가 얼마나 빨리 돌아오느냐다.
      allyEnergyGain: 5,
    },
    ultimate: {
      id: "stella-ult",
      name: "상승 기류",
      iconAssetId: "skill-icon-buff",
      effectType: "buff",
      cost: 180,
      // 피해도 회복도 없는 순수 지원 궁극기다. 코어는 teamBuff 계약만 읽는다.
      targeting: "battlefieldAllies",
      // 지속 회복은 순풍 태그가 아니라 이 궁극기가 얹는 값이다 — 다른 개체가 건 순풍은 회복을 데려오지 않는다.
      teamBuff: { kind: "tailwind", attackSpeedPercent: 20, moveSpeedPercent: 20, seconds: 10, maxHpRegenPercentPerSecond: 2 },
    },
  },

  {
    id: "meron",
    squad: "rune",
    name: "메론",
    specimenNumber: "047",
    projectName: "QUIET SKETCH",
    excavationSite: "피스코 분지 해성 실트암 하부",
    // 발굴 기록은 장소·보존 상태·복원 연구 특징만 담고, 복원 이후 생활 관찰과 분리한다.
    fossilRecord: "해성 실트암 하부에서 아직 다 자라지 않은 이빨 열이 턱뼈째 발견됐다. 성체 표본의 절반에도 못 미치는 크기라 처음에는 다른 종으로 분류했다.",
    observationProfile: {
      originYear: "약 1천 5백만 년 전",
      // E.C.는 메론의 인간형 신체 나잇대이며, 원종 화석의 유체 단계와 독립된 값이다.
      restorationYear: "E.C. 18년",
      lifeStage: "유체",
      height: "1.58 m",
      weight: "44 kg",
    },
    catalogSummary: "신장 1.58m, 체중 44kg의 인간형 체격에 등지느러미형 후드와 긴 꼬리가 확인된 유체 상어 표본.",
    // 유체 화석에서 복원한 이유를 세계관 안의 판단으로 남긴다 — 성체 표본은 복원 자체가 통제 밖이다.
    unlockRecord: { status: "recorded", text: "성체 표본의 파장은 리바이어던급이라 복원 승인이 나지 않았고, 연구소는 힘이 덜 여문 유체 쪽을 골랐다. 복원 후 메론은 케어실 구석 가장 서늘한 자리에 앉아 하루 종일 무언가를 그린다. 말을 걸면 스케치북을 가슴에 붙이고 앞머리 뒤로 숨지만, 다음 날 아침이면 그 사람의 얼굴이 그려진 스티커가 문 앞에 한 장 붙어 있다. 전장에서도 적을 똑바로 보지 못해 시선을 내린 채 손끝으로만 윤곽을 뜨는데, 그렇게 그려진 자국이 남은 적은 동료들의 타격에 유난히 크게 무너진다." },
    squadNote: "사일런트 룬의 기록 담당. 케어실을 드나든 렐릭의 얼굴을 한 장씩 그려 벽에 붙여 두고, 정작 자기 그림 이야기가 나오면 후드를 뒤집어쓴다.",
    researcherTitle: "연구원 씨",
    rarity: "SSR",
    portraitAssetId: "meron",
    origin: "메갈로돈",
    element: "water",
    role: "support",
    // 붓이 닿는 만큼만 다가간다.
    reachTier: "mid",
    // 그림으로 표본을 기록하는 담당이라 발굴 특화도 화석 회수 쪽에 붙인다.
    excavationTrait: { primaryCurrency: "rawStone", baseProductionPerHour: 1.12, efficiencyMultiplier: 1.14 },
    // 앞에 나서지 못하는 지원가라 화력과 발이 느리고, 대신 오래 서 있도록 체력과 저항이 두껍다.
    stats: {
      hp: 1000,
      def: 74,
      res: 112,
      atk: 66,
      ap: 144,
      attackSpeed: 92,
      moveSpeed: 86,
      critChance: 10,
      critDamage: 150,
      energyGain: 26,
      lifeSteal: 0,
      ferocityGain: 0,
    },
    // 소심해서 자기가 나서지 못하는 아이라, 폭주는 제 화력이 아니라 아군의 손을 빌리는 쪽으로 발현한다.
    ferocityTrait: {
      name: "네? 마음에 안 드신다고요...?",
      effectId: "sharedOverpaint",
      overpaint: { kind: "overpaint", seconds: 10, damageTakenPercent: 6, maxStacks: 4 },
    },
    passive: {
      // kind가 overpaintSiphon인 패시브는 passiveDescription()이 구조화 필드로 다시 문장을 만들므로
      // 이 desc는 표시되지 않는 데이터 문서용 사본이다. 수치를 고치면 함수 쪽 분기도 함께 본다.
      id: "meron-passive",
      name: "스케치 시작",
      kind: "overpaintSiphon",
      iconAssetId: "skill-icon-healing",
      effectType: "healing",
      // 덧칠된 적에게 입힌 실제 HP 피해 중 때린 본인이 회복하는 비율(%)이다.
      value: 10,
      desc: "아군이 덧칠된 적을 맞히면 그 피해의 10%만큼 자신의 체력을 회복한다. 표적의 덧칠이 최대로 쌓이면 다른 적으로 표적을 옮긴다.",
    },
    basic: {
      id: "meron-basic",
      name: "러프 크로키",
      power: 70,
      // 물살이 아니라 그림이라 계수는 주문력에서 나온다.
      scalingStat: "ap",
      iconAssetId: "skill-icon-magical",
      effectType: "magical",
      damageType: "magical",
      targeting: "single",
      statusEffects: [{ kind: "overpaint", seconds: 10, damageTakenPercent: 6, maxStacks: 4 }],
    },
    ultimate: {
      id: "meron-ult",
      name: "완성_진짜 마지막(4).png",
      // 폭발형 궁극기라 이 위력은 총량이 아니라 **덧칠 한 겹당** 값이다. 네 겹을 다 칠해도
      // 렉시아의 단일 대상 궁극기(300%)에 못 미치고, 한 겹도 없는 적은 대상에서 빠진다 —
      // 전장 전체를 때리는 지원가가 최상위 딜러의 한 방을 넘지 않게 하는 상한이다.
      power: 60,
      overpaintDetonation: true,
      scalingStat: "ap",
      iconAssetId: "skill-icon-magical",
      effectType: "magical",
      damageType: "magical",
      cost: 110,
      // 궁극기 대상 방식은 설명문이나 렐릭 ID가 아니라 코어가 읽는 계약이다.
      targeting: "battlefieldEnemies",
    },
  },

  {
    id: "pachi",
    squad: "fang",
    name: "파치",
    specimenNumber: "093",
    projectName: "HARD HAT",
    excavationSite: "헬크리크 상부 사암 붕괴면",
    // 발굴 기록은 장소·보존 상태·복원 연구 특징만 담고, 복원 이후 생활 관찰과 분리한다.
    fossilRecord: "붕괴면 아래에서 두개골 윗면만 온전한 성체 표본이 나왔다. 뼈가 스무 겹 넘게 겹쳐 굳어 있었고, 같은 자리에서 부러진 뿔 조각 여럿이 함께 수습됐다.",
    observationProfile: {
      originYear: "약 6천 6백만 년 전",
      // E.C.는 파치의 인간형 신체 나잇대이며, 원종 화석의 성장 단계와 독립된 값이다.
      restorationYear: "E.C. 16년",
      lifeStage: "성체",
      height: "1.55 m",
      weight: "47 kg",
    },
    catalogSummary: "신장 1.55m, 체중 47kg의 인간형 체격에 각질이 두꺼운 꼬리와 단단한 두개골이 확인된 성체 표본.",
    // 복원 후 관찰은 성격과 실제로 목격된 행동만 남기고 발굴 기록과 겹치지 않게 쓴다.
    unlockRecord: { status: "recorded", text: "복원 첫날 파치는 케어실 문틀을 머리로 받아 경첩을 부쉈고, 그 뒤로 안전모를 씌워 두자 벗지 않는다. 하루 종일 체리맛 사탕을 물고 다니며 껍질을 아무 데나 버리고, 지적하면 눈을 굴리며 \"알았다고\"라고 대꾸한 뒤 결국 주워 온다. 출격 지시에도 매번 툴툴거리지만 연구원이 말한 자리에서는 한 발도 물러서지 않고, 뒤따라오는 인원이 다 지나갈 때까지 그 앞을 막고 서 있는다." },
    squadNote: "앱솔루트 팽의 돌파 담당. 전선이 열려야 할 자리를 머리로 뚫어 놓고, 연구원을 굳이 \"보스\"라 부르며 지시에는 툴툴거리면서도 꼭 따른다.",
    researcherTitle: "보스",
    rarity: "SR",
    portraitAssetId: "pachi",
    origin: "파키케팔로사우루스",
    element: "earth",
    role: "warrior",
    // 철거 스윙은 휘두르는 팔 길이가 곧 사거리다.
    reachTier: "melee",
    // 부수고 다니는 개체라 발굴 특화도 화석 회수 쪽에 붙인다.
    excavationTrait: { primaryCurrency: "rawStone", baseProductionPerHour: 1.04, efficiencyMultiplier: 1.04 },
    // 머리로 받는 개체라 방어가 두껍고 발이 빠르다. 주문력을 쓰는 스킬이 하나도 없어 낮게 둔다.
    stats: {
      hp: 1100,
      def: 92,
      res: 55,
      atk: 142,
      ap: 45,
      attackSpeed: 92,
      moveSpeed: 118,
      critChance: 10,
      critDamage: 150,
      energyGain: 26,
      lifeSteal: 0,
      ferocityGain: 0,
    },
    ferocityTrait: {
      name: "야, 비켜!",
      effectId: "knockbackSlam",
      // 폭주가 열리는 순간 배트가 이미 장전되어 있다 — 다음 한 방이 곧 헬멧을 울린다.
      loadsStatusCycleOnEntry: true,
      seconds: 1.6,
      // 곡선을 그리며 굴러가는 것이 아니라 **따악 맞고 튀어 나가는** 속도다.
      speed: 2400,
      bounces: 3,
    },
    passive: {
      // kind가 impactCap인 패시브는 passiveDescription()이 구조화 필드로 다시 문장을 만들므로
      // 이 desc는 표시되지 않는 데이터 문서용 사본이다. 수치를 고치면 함수 쪽 분기도 함께 본다.
      id: "pachi-passive",
      name: "무면허 안전제일",
      kind: "impactCap",
      iconAssetId: "skill-icon-fixed",
      effectType: "fixed",
      // Passive.value는 공용 필수 필드라, 이 패시브에서는 상한 비율을 그대로 담아 둔다.
      value: 40,
      // 한 방에 들어올 수 있는 피해의 상한(최대 체력 %)이다. 이하의 타격은 그대로 다 맞는다.
      impactCapMaxHpPercent: 40,
      // 뇌진탕이 깎은 만큼을 안전모가 되받아 두른다. 큰 한 방은 상한이 누르고, 그 사이의
      // 잔타는 이 막이 받는다.
      concussionShieldPercent: 60,
      // 평범한 적에게는 걸리지 않는 선이다. 체력이 무한한 불사 보스를 때릴 때만 막을 붙잡는다.
      concussionShieldCapMaxHpPercent: 35,
      desc: "한 방에 받는 피해가 최대 체력의 40%를 넘지 않는다. 뇌진탕이 입힌 피해의 40%만큼 보호막을 얻으며, 한 번에 두르는 보호막은 최대 체력의 25%를 넘지 않는다.",
    },
    basic: {
      id: "pachi-basic",
      name: "철거 스윙",
      power: 90,
      iconAssetId: "skill-icon-physical",
      effectType: "physical",
      damageType: "physical",
      targeting: "single",
      // 세 번째 배트가 헬멧을 울린다. 확정 치명타(periodicCritical)와 달리 부가 효과의 주기다.
      statusEffectEvery: 3,
      statusEffects: [
        { kind: "stun", seconds: 1 },
        { kind: "concussion", maxHpPercent: 5, criticalMaxHpPercent: 15 },
      ],
    },
    ultimate: {
      id: "pachi-ult",
      name: "저돌맹진!",
      power: 200,
      iconAssetId: "skill-icon-physical",
      effectType: "physical",
      damageType: "physical",
      cost: 110,
      // 궁극기 대상 방식은 설명문이나 렐릭 ID가 아니라 코어가 읽는 계약이다.
      targeting: "chargeLine",
      // 뚫고 지나가는 통로의 반폭(px)이다. 나아가는 거리는 이동 속도가 정한다.
      radius: 110,
      statusEffects: [
        { kind: "stun", seconds: 2 },
        { kind: "concussion", maxHpPercent: 5, criticalMaxHpPercent: 15 },
      ],
    },
  },

  {
    id: "maki",
    squad: "gear",
    name: "마키",
    specimenNumber: "126",
    projectName: "OMAKASE",
    excavationSite: "세로 데 라스 아니마스 하부 역암층",
    // 발굴 기록은 장소·보존 상태·복원 연구 특징만 담고, 복원 이후 생활 관찰과 분리한다.
    fossilRecord: "역암층 틈에서 아직 다 자라지 않은 검치 한 쌍이 턱뼈째 나왔다. 이가 갈려 나간 흔적 없이 날이 그대로 남아 있어 복원 대상으로 골랐다.",
    observationProfile: {
      originYear: "약 1천 2백만 년 전",
      // E.C.는 마키의 인간형 신체 나잇대이며, 원종 화석의 성장 단계와 독립된 값이다.
      restorationYear: "E.C. 19년",
      lifeStage: "해츨링",
      height: "1.62 m",
      weight: "49 kg",
    },
    catalogSummary: "신장 1.62m, 체중 49kg의 인간형 체격에 반점 무늬 꼬리와 드러난 검치가 확인된 해츨링 표본.",
    // 복원 후 관찰은 성격과 실제로 목격된 행동만 남기고 발굴 기록과 겹치지 않게 쓴다.
    unlockRecord: { status: "recorded", text: "이터널 시티에서 뼈를 가장 잘 맞추는 손이다. 부러진 자리를 한 번 짚고 곧바로 붙여 놓고는, 같은 손으로 회복식 재료를 손질해 내온다. 연구원의 전속 담당의를 자처하며 매일 진료 신청서를 들이밀지만 매번 퇴짜를 맞고, 그때마다 \"보는 눈이 없다\"며 꼬리를 세운다. 케어실 벽에 붙여 둔 식재료 순위표 1등 칸에는 연구원의 이름이 적혀 있는데, 본인은 그게 최고의 찬사라고 우긴다." },
    squadNote: "나이트 기어의 야전 담당의. 인양조가 다치면 그 자리에서 붙여 놓고, 연구원만은 \"연구원님\"이라 부르며 진료 예약을 조른다.",
    researcherTitle: "연구원님",
    rarity: "SSR",
    portraitAssetId: "maki",
    origin: "마카이로두스",
    element: "earth",
    role: "assassin",
    // 손질은 붙어서 한다.
    reachTier: "melee",
    // 재료를 다루는 손이라 발굴 특화도 치즈케이크 쪽에 붙인다.
    excavationTrait: { primaryCurrency: "cheesecake", baseProductionPerHour: 2.28, efficiencyMultiplier: 1.12 },
    // 가장 약해진 적을 골라 뛰어드는 개체라 발이 가장 빠르고, 칼을 쓰는 손이라 공격력이 높다.
    stats: {
      hp: 930,
      def: 58,
      res: 54,
      atk: 190,
      ap: 40,
      attackSpeed: 122,
      moveSpeed: 128,
      critChance: 10,
      critDamage: 150,
      energyGain: 26,
      lifeSteal: 0,
      ferocityGain: 0,
    },
    ferocityTrait: {
      name: "잠깐, 나 이래 봬도 의사라고?",
      effectId: "butcherFeast",
      healPercent: 50,
      // 폭주 직후 세 번은 기존 손질 중첩과 무관하게 즉시 터져 짧은 회복·폭딜 구간을 만든다.
      instantButcherAttacks: 3,
    },
    passive: {
      // kind가 gourmetHunt인 패시브는 passiveDescription()이 구조화 필드로 다시 문장을 만들므로
      // 이 desc는 표시되지 않는 데이터 문서용 사본이다. 수치를 고치면 함수 쪽 분기도 함께 본다.
      id: "maki-passive",
      name: "고품격 식재료는 어딨냥?",
      kind: "gourmetHunt",
      iconAssetId: "skill-icon-buff",
      effectType: "buff",
      // Passive.value는 공용 필수 필드라, 이 패시브에서는 재사용 간격을 그대로 담아 둔다.
      value: 10,
      huntCooldownSeconds: 10,
      // 첫 도약만 조금 늦춰, 전투가 시작되자마자 사라지는 것처럼 보이지 않게 한다.
      huntOpeningSeconds: 1.2,
      // 종잇장 같은 생존력을 어그로 해제로 보완하되, 전투당 세 번만 허용해 상시 은신을 막는다.
      damageStealthSeconds: 2,
      damageStealthMaxTriggers: 3,
      desc: "전투를 시작할 때 현재 체력이 가장 낮은 적을 표적으로 삼고 그 자리로 도약한다. 적을 처치하면 즉시, 그 밖에는 10초마다 다시 고른다. 적에게 피해를 입으면 2초 동안 은신하며 전투당 최대 3번 발동한다.",
    },
    basic: {
      id: "maki-basic",
      name: "부위별 손질",
      power: 80,
      iconAssetId: "skill-icon-physical",
      effectType: "physical",
      damageType: "physical",
      targeting: "single",
      statusEffects: [
        { kind: "butcher", maxStacks: 3, burstPower: 120 },
        { kind: "bleed", seconds: 3, maxHpPercentPerSecond: 2 },
      ],
    },
    ultimate: {
      id: "maki-ult",
      name: "오마카세",
      power: 250,
      iconAssetId: "skill-icon-physical",
      effectType: "physical",
      damageType: "physical",
      cost: 90,
      // 처치했을 때만 돌려받는다. 살아남으면 아무것도 없다.
      energyRefundOnKill: 200,
      // 궁극기 대상 방식은 설명문이나 렐릭 ID가 아니라 코어가 읽는 계약이다.
      targeting: "single",
    },
  },

  {
    id: "keris",
    squad: "eye",
    name: "케리스",
    specimenNumber: "182",
    projectName: "MARGINALIA",
    excavationSite: "아일랜드 발리베탁 이탄 습지",
    // 발굴 기록은 장소·보존 상태·복원 연구 특징만 담고, 복원 이후 생활 관찰과 분리한다.
    fossilRecord: "이탄 습지의 산소 없는 진흙이 거대한 뿔 한 쌍을 뿌리까지 온전히 남겼다. 뿔 안쪽에는 성장선이 촘촘히 겹쳐 있어, 복원 연구는 그 줄을 세는 일부터 시작했다.",
    observationProfile: {
      originYear: "약 1만 2천 년 전",
      // 성체 직전 화석에서 비롯된 조용하고 미숙한 성향에 맞춰 E.C. 17년으로 둔다.
      restorationYear: "E.C. 17년",
      lifeStage: "성체",
      height: "1.62 m",
      weight: "48 kg",
    },
    catalogSummary: "신장 1.62m의 인간형 체격에 안쪽으로 굽은 한 쌍의 큰 뿔과, 종이를 다루기 좋게 가늘고 긴 손끝이 확인된 성체 메갈로케로스 표본.",
    unlockRecord: { status: "recorded", text: "케리스는 복원 직후부터 중앙 도서관을 떠나지 않았다. 말수가 거의 없고 눈을 잘 맞추지 못하지만, 누가 무엇을 빌려 갔는지는 묻지 않아도 정확히 기억한다. 특히 연구원이 열람한 자료는 반납일이 지나도 서가로 돌려보내지 않고 제 책상 옆에 따로 쌓아 두며, 그 목록을 별도의 공책에 옮겨 적는 모습이 여러 번 관찰됐다. 좋아하는 것을 물으면 로맨스 소설이라고만 답한다." },
    squadNote: "시그널 아이의 기록 담당. 관측 보고가 오가는 자리에 끼지 않고 그 기록을 받아 색인하며, 연구원이 무엇을 열람했는지는 아무도 묻지 않았는데도 전부 적어 둔다.",
    // 관제탑의 잡담에 끼지 못하는 성격이라 스쿼드가 쓰는 호칭 중 가장 사적인 "선배"를 쓴다.
    researcherTitle: "선배",
    rarity: "SR",
    portraitAssetId: "keris",
    origin: "메갈로케로스",
    element: "earth",
    role: "warrior",
    // 서가 사이에서 글로 싸우는 마법형이라 붙지 않는다.
    reachTier: "ranged",
    // 장서를 정리하며 나오는 기록 자산이라 발굴 특화도 골드 회수 쪽에 붙인다.
    excavationTrait: { primaryCurrency: "gold", baseProductionPerHour: 132.5, efficiencyMultiplier: 1.06 },
    /*
     * 주문력에 전부 몰아준 마법형 디버프 딜러다. 공격력은 쓰는 스킬이 하나도 없으므로 가장 낮다.
     *
     * **공격 속도는 저주를 쌓는 손이지 때리는 손이 아니다.** 74로 두었을 때는 전사 다섯 중
     * 혼자 30 가까이 뒤처져(티아 104 · 렉시아 112 · 매디 100 · 파치 92) 저주 3중첩과 집중
     * 10겹이 둘 다 전투가 끝날 무렵에야 찼다 — 쌓아서 커지는 개체가 쌓을 시간을 못 받으면
     * 패시브도 궁극기도 켜지기 전에 판이 끝난다. 92로 올린 몫은 **뒷줄의 몸**에서 빼 온다
     * (체력 900 → 850, 저항 112 → 100): 서가 사이에 선 손이라 맞으면 약한 것이 맞고,
     * 전투력은 2286으로 그대로여서 SR 띠(2210~2330) 안을 벗어나지 않는다.
     *
     * 이동 속도 62는 그대로 둔다 — 걸어 나가지 않는 것이 이 개체의 자리다.
     */
    stats: {
      hp: 850,
      def: 54,
      res: 100,
      atk: 58,
      ap: 180,
      attackSpeed: 92,
      moveSpeed: 62,
      critChance: 10,
      critDamage: 150,
      energyGain: 26,
      lifeSteal: 0,
      ferocityGain: 0,
    },
    // 광란은 폭주에서도 나오지만 **직접 적중**에만 걸린다. 전이까지 발동하면 한 번의 공격이
    // 사슬 길이만큼 적을 돌려세워, 폭주 동안 상대 편이 통째로 멈춘 것처럼 된다.
    ferocityTrait: { name: "나만 봐", effectId: "frenzyGaze", seconds: 2, attackSpeedPercent: 50 },
    passive: {
      // kind가 cursedInsight인 패시브는 passiveDescription()이 구조화 필드로 다시 문장을 만들므로
      // 이 desc는 표시되지 않는 데이터 문서용 사본이다. 수치를 고치면 함수 쪽 분기도 함께 본다.
      id: "keris-passive",
      name: "열 번 찍어 안 넘어가는 연구원도 없다죠?",
      kind: "cursedInsight",
      iconAssetId: "skill-icon-buff",
      effectType: "buff",
      value: 2,
      maxStacks: 10,
      /*
       * 전사 계약이 요구하는 자가 수급이 여기 있다. 「받는 피해 감소」도 상시 흡혈도 아니라,
       * **제가 돌려세운 적이 제 편을 치는 동안에만** 차오른다 — 궁극기 「등장인물이 너무
       * 많아요」가 광란을 걸어야 켜지므로, 유지력이 그 개체의 주 조작과 같은 축에 선다.
       *
       * 25%인 이유는 광란이 4초짜리이고 한 번에 여럿에게 걸리기 때문이다. 상시 흡혈로 두면
       * 뒷줄 마법형이 전사 중 가장 잘 버티게 되므로, 값이 아니라 **켜지는 순간**으로 조인다.
       */
      frenzyLifeStealPercent: 25,
      desc: "저주에 걸린 적에게 기본 공격을 직접 적중시킬 때마다 이번 전투 동안 주문력이 2% 증가한다. 최대 10회까지 쌓인다. 광란에 걸린 적이 입힌 피해의 25%만큼 회복한다.",
    },
    basic: {
      id: "keris-basic",
      name: "첫 사랑은 무슨 맛일까요?",
      power: 80,
      scalingStat: "ap",
      iconAssetId: "skill-icon-magical",
      effectType: "magical",
      damageType: "magical",
      targeting: "single",
      statusEffects: [{ kind: "curse", seconds: 8, resistancePercent: 15, maxStacks: 3 }],
      // 저주가 이미 최대인 적에서만 이어진다. 비율이 곱해지며 줄어들어 피해는 두세 번이면
      // 미미해지므로, 이어지는 몫은 피해가 아니라 저주를 퍼뜨리는 것이다.
      curseTransfer: { percent: 25 },
    },
    ultimate: {
      id: "keris-ult",
      name: "등장인물이 너무 많아요",
      power: 120,
      scalingStat: "ap",
      iconAssetId: "skill-icon-magical",
      effectType: "magical",
      damageType: "magical",
      cost: 120,
      // 궁극기 대상 방식은 설명문이나 렐릭 ID가 아니라 코어가 읽는 계약이다.
      targeting: "battlefieldEnemies",
      // 저주받은 적이 하나도 없으면 가장 가까운 적에게 먼저 씌운다 — 그러지 않으면 게이지가
      // 가득 찬 자동 궁극기가 대상 없이 헛돌고, 플레이어는 왜 안 나가는지 알 수 없다.
      cursedTargetsOnly: { seedCurse: { kind: "curse", seconds: 8, resistancePercent: 15, maxStacks: 3 } },
      statusEffects: [{ kind: "frenzy", seconds: 4, attackSpeedPercent: 50 }],
    },
  },

  {
    id: "delopi",
    squad: "gear",
    name: "델로피",
    specimenNumber: "013",
    projectName: "CURTAIN CALL",
    excavationSite: "미국 애리조나 카옌타층 하부 이암대",
    // 발굴 기록은 장소·보존 상태·복원 연구 특징만 담고, 복원 이후 생활 관찰과 분리한다.
    fossilRecord: "이암이 갈라진 틈에서 한 쌍의 얇은 볏이 나란히 붙은 채 드러났다. 볏뼈가 얇아 부서질 줄 알았으나 두개골까지 이어진 골질이 그대로 남아, 복원 연구는 그 얇은 판을 세우는 일에 가장 오래 매달렸다.",
    observationProfile: {
      originYear: "약 1억 9천만 년 전",
      // 장난기와 미숙함이 함께 읽히는 중학생 또래 외형·정서에 맞춰 E.C. 14년으로 둔다.
      restorationYear: "E.C. 14년",
      lifeStage: "성체",
      height: "1.45 m",
      weight: "41 kg",
    },
    catalogSummary: "신장 1.45m, 체중 41kg의 작고 마른 인간형 체격에 목 뒤로 접히는 한 쌍의 얇은 볏과, 카드를 다루기 좋게 마디가 긴 손가락이 확인된 성체 딜로포사우루스 표본.",
    unlockRecord: { status: "recorded", text: "나는 델로피를 손이 먼저 움직이는 아이로 관찰하고 있다. 내 주머니에서 사라진 열쇠는 늘 인사와 함께 되돌아오고, 되돌려 줄 때의 표정이 가져갈 때보다 훨씬 즐거워 보인다. 목 뒤의 볏은 놀래킬 순간에만 활짝 펴지는데, 정작 본인은 그게 다 보인다는 걸 모르는 눈치다. 임무에서 돌아온 날에는 카드 한 벌을 들고 다른 렐릭들을 쫓아다니며 같은 마술을 열 번쯤 반복하다가, 아무도 속지 않으면 그제야 시무룩하게 구석으로 간다." },
    squadNote: "나이트 기어의 막내 인양조. 조용해야 할 잠입 중에도 회수한 물건을 손안에서 사라지게 했다가 되돌리는 장난을 멈추지 않아, 선배들이 매번 볏을 눌러 접어 준다.",
    // 낯을 가리는 스쿼드에서 혼자 말이 많은 막내라, 스쿼드가 쓰는 호칭 중 가장 격식 있는 쪽을 골라 장난스럽게 부른다.
    researcherTitle: "연구원님",
    rarity: "SR",
    portraitAssetId: "delopi",
    origin: "딜로포사우루스",
    element: "grass",
    role: "assassin",
    // 손을 벗어나 날아가는 카드라 붙지 않고 한 걸음 물러서서 던진다.
    reachTier: "mid",
    // 남의 주머니에서 나온 것을 되돌려 주는 손이라 발굴 특화도 골드 회수 쪽에 붙인다.
    excavationTrait: { primaryCurrency: "gold", baseProductionPerHour: 130, efficiencyMultiplier: 1.07 },
    // 유일한 혼합형이다. 카드 한 장이 손끝 힘과 발라 둔 독을 함께 쓰므로 공격력과 주문력을
    // 비슷하게 들며, 그래서 둘 중 어느 쪽도 남는 수치가 되지 않는다. 대신 몸은 가장 얇다.
    stats: {
      hp: 820,
      def: 50,
      res: 52,
      atk: 120,
      ap: 108,
      attackSpeed: 116,
      moveSpeed: 116,
      critChance: 10,
      critDamage: 150,
      energyGain: 26,
      lifeSteal: 0,
      ferocityGain: 0,
    },
    // 바르거나 터뜨리거나 한 번에 하나만 한다. 그래서 폭주 중 실제 피해량은 공속이 정하고,
    // 공속 증가가 곧 "얼마나 자주 청산하는가"가 된다.
    ferocityTrait: { name: "초절정 도파민 중독", effectId: "venomousEncore", attackSpeedBonusPercent: 30 },
    passive: {
      // kind가 openingVanish인 패시브는 passiveDescription()이 구조화 필드로 문장을 만들므로
      // 이 desc는 표시되지 않는 데이터 문서용 사본이다. 수치를 고치면 함수 쪽 분기도 함께 본다.
      id: "delopi-passive",
      name: "짜잔!",
      kind: "openingVanish",
      iconAssetId: "skill-icon-buff",
      effectType: "buff",
      // Passive.value는 공용 필수 필드라, 이 패시브에서는 은신 시간을 그대로 담아 둔다.
      value: 5,
      durationSeconds: 5,
      openingStealthSeconds: 5,
      // 태생 치명타는 전 개체 공통이므로 암살자의 치명타형 정체성은 패시브가 만든다.
      criticalChancePercent: 5,
      criticalDamagePercent: 25,
      desc: "전투 시작 시 5초 동안 은신 상태로 진입한다.",
    },
    basic: {
      id: "delopi-basic",
      name: "트릭 카드",
      power: 50,
      scalingStat: "atk",
      // 카드에 발라 둔 독이 손끝 힘과 함께 실린다 — 위력을 두 능력치가 반씩 나눠 갖는다.
      secondaryScaling: { stat: "ap", power: 50 },
      iconAssetId: "skill-icon-physical",
      effectType: "physical",
      damageType: "physical",
      targeting: "single",
      statusEffects: [{ kind: "poison", seconds: 3, attackPercentPerSecond: POISON.attackPercentPerSecond, abilityPercentPerSecond: POISON.abilityPercentPerSecond }],
    },
    ultimate: {
      id: "delopi-ult",
      name: "그랜드 피날레",
      iconAssetId: "skill-icon-fixed",
      effectType: "fixed",
      cost: 90,
      // 아무도 때리지 않는다. 자리를 잡는 것이 전부이고 피해는 이어질 트릭 카드 한 장이 낸다.
      targeting: "self",
      // 위력을 적지 않는다. 이 궁극기의 피해는 곧 이어질 트릭 카드 한 장의 몫이라, 여기에
      // 숫자를 두면 평타 위력을 조정한 뒤 이 한 방만 옛 값으로 남는다.
      selfSetup: {
        stealthSeconds: 3,
        // 숨어 들어가 한 방을 꽂는 자리라 그 한 방이 곧 노출이다. 시간만으로 끊으면 혼자 남은
        // 판에서 아무도 자신을 고르지 못한 채 계속 때리게 되어 짧은 무적과 다르지 않다.
        stealthBreaksOnBasic: true,
        leapTarget: "lowestHpEnemy",
        // 중거리 개체라 스피나보다 멀찍이 내려선다 — 붙어서 내리면 사거리 안쪽으로 파고든다.
        landingDistance: 200,
        empowerNextBasic: { guaranteedCritical: true, ignoresDefense: true },
      },
    },
  },

  {
    id: "nodonia",
    squad: "rune",
    name: "노도니아",
    // 파일 번호(char_014)와 개체번호는 다른 계열이다 — 014는 토리카가 이미 쓴다.
    // 원종이 살던 8,300만 년 전에서 따 083을 쓴다.
    specimenNumber: "083",
    projectName: "REVERIE",
    excavationSite: "미국 캔자스 스모키힐 백악층",
    // 발굴 기록은 장소·보존 상태·복원 연구 특징만 담고, 복원 이후 생활 관찰과 분리한다.
    fossilRecord: "얕은 바다가 남긴 백악층에서 볏뼈와 날개막 자국이 함께 눌린 채 나왔다. 골절이 아문 자리가 열두 곳이며 그중 아홉은 부러진 뒤에도 계속 날았던 흔적이다.",
    observationProfile: {
      originYear: "약 8,300만 년 전",
      restorationYear: "E.C. 18년",
      lifeStage: "성체",
      height: "1.66 m",
      weight: "79 kg",
    },
    catalogSummary: "검은 예복과 베일을 쓴 채 복원된 성체 프테라노돈 표본.",
    unlockRecord: { status: "recorded", text: "노도니아는 아프다는 말을 하지 않는다. 케어실에서 상처를 볼 때 표정이 오히려 풀리는 것이 여러 번 기록됐고, 처치가 끝나면 아쉬운 얼굴로 베일을 내린다. 훈련에서는 늘 어린 렐릭들 앞에 서서 먼저 맞고, 다 끝난 뒤 \"잘했어요\"라며 한 명씩 머리를 쓰다듬는다. 정작 자기 몫의 붕대는 며칠씩 갈지 않아 케어 담당이 매번 찾아다닌다. 반대로 남이 다치는 자리에는 웃음기가 완전히 사라진다." },
    squadNote: "사일런트 룬의 케어실 앞자리. 공명이 흔들린 개체가 실려 오면 제일 먼저 달려가 붙잡고 있으며, 그 자리에서 자기 상처는 뒤로 미룬다.",
    // 케어하는 스쿼드에서 스스로 돌봄을 받지 않는 쪽이라, 아이를 부르듯 하는 호칭을 골라 쓴다.
    researcherTitle: "아가",
    rarity: "SSR",
    portraitAssetId: "nodonia",
    origin: "프테라노돈",
    element: "wind",
    role: "tank",
    // 아군 앞에 서는 자리라 손이 닿는 거리에서만 싸운다. 날개는 버티는 데 쓴다.
    reachTier: "melee",
    // 하늘에서 내려다보며 넓게 훑는 손이라 발굴 특화는 화석 쪽에 붙인다.
    excavationTrait: { primaryCurrency: "rawStone", baseProductionPerHour: 1.24, efficiencyMultiplier: 1.1 },
    /**
     * **종이 방어에 산더미 체력이다.** 방어력 86·저항력 80은 탱커 중 최저이고 체력 2280은
     * 로스터 최고다(엘라 1500). 다 맞으면서 그보다 빨리 차오르는 것이 이 개체의 값이라,
     * 방어를 올리면 오히려 회복이 값을 잃는다 — 아프지 않으면 재생이 할 일이 없다.
     *
     * **공격력이 로스터 최저다**(46). 기본 공격도 폭주도 최대 체력에서 피해를 뽑으므로 공격력은
     * 어디에도 쓰이지 않는다 — 쓰지 않는 능력치를 높게 적으면 실전에 없는 힘이 전투력만
     * 부풀린다(스테라의 주문력이 그랬다).
     */
    stats: {
      hp: 2280,
      def: 86,
      res: 80,
      atk: 46,
      ap: 24,
      attackSpeed: 74,
      moveSpeed: 78,
      critChance: 10,
      critDamage: 150,
      energyGain: 26,
      lifeSteal: 0,
      ferocityGain: 0,
    },
    // 폭주 중에는 서 있는 것만으로 주위가 지져진다. 회복만 있던 자리에 적에게 남기는 값을 하나
    // 두는 것이라, 탱커가 자기 숫자만 바꾸다 화면에서 사라지는 일이 없다.
    ferocityTrait: {
      name: "절정", effectId: "climax", auraDamageMaxHpPercent: 1.5, radius: 240,
      // 화상 틱을 버틴 적만 잠깐 노도니아를 바라보므로 피해 반경과 도발 반경이 갈리지 않는다.
      taunt: { kind: "taunt", seconds: 0.5 }, missingHpPercentPerBasic: 3,
    },
    passive: {
      // kind가 painfulElation인 패시브는 passiveDescription()이 구조화 필드로 문장을 만들므로
      // 이 desc는 표시되지 않는 데이터 문서용 사본이다. 수치를 고치면 함수 쪽 분기도 함께 본다.
      id: "nodonia-passive",
      name: "고통의 희열",
      kind: "painfulElation",
      iconAssetId: "skill-icon-buff",
      effectType: "buff",
      // Passive.value는 공용 필수 필드라, 이 패시브에서는 겹 하나가 매초 돌리는 비율을 담아 둔다.
      value: 0.4,
      durationSeconds: 5,
      elation: { maxStacks: 10, maxHpRegenPercentPerStack: 0.4, seconds: 5 },
      desc: "적에게 피격당할 때마다 희열이 한 겹 쌓여 겹당 매초 최대 체력의 0.4%를 회복한다. 최대 열 겹까지 쌓이고 5초 동안 남으며, 다시 맞으면 유지 시간이 처음부터 다시 흐른다.",
    },
    basic: {
      id: "nodonia-basic",
      name: "착한 아이에게는 포상을",
      // 최대 체력에서 피해를 뽑는다. 방어가 종이라 방어 계수는 쓸 수 없고, 이 개체가 키우는
      // 유일한 축이 체력이라 몸집이 곧 손이 된다.
      power: 5,
      scalingStat: "hp",
      iconAssetId: "skill-icon-physical",
      effectType: "physical",
      damageType: "physical",
      targeting: "single",
    },
    ultimate: {
      id: "nodonia-ult",
      name: "고통의 미학",
      iconAssetId: "skill-icon-buff",
      effectType: "buff",
      cost: 150,
      // 아무도 때리지 않고 아무 데도 가지 않는다. 앞에 서서 아군의 몫을 대신 받는 것이 전부다.
      targeting: "self",
      // 방어를 올리지 않고 회복만 돌린다. 종이 방어로 다 맞으면서 그보다 빨리 차오르는 것이
      // 이 궁극기이고, 끝난 뒤가 아니라 **버티는 동안** 돌아야 그 사이에 쓰러지지 않는다.
      selfBulwark: { seconds: 5, redirectPercent: 100, maxHpRegenPercentPerSecond: 5 },
    },
  },

  {
    id: "ella",
    squad: "fang",
    name: "엘라",
    specimenNumber: "015",
    projectName: "TALISMAN",
    excavationSite: "중국 티베트 자다 분지 홍적세 자갈층",
    // 발굴 기록은 장소·보존 상태·복원 연구 특징만 담고, 복원 이후 생활 관찰과 분리한다.
    fossilRecord: "고원의 자갈층에서 코뿔 하나와 앞다리뼈가 함께 나왔다. 뼈의 성장선이 유난히 촘촘하고 겹이 많아, 같은 종 표본 중 가장 오래 산 개체로 분류됐다.",
    observationProfile: {
      originYear: "약 3만 년 전",
      // 외형은 열대여섯이지만 말투는 그보다 한참 늙었다. E.C.는 외형 쪽을 따르고, 그 어긋남은
      // 복원 후 관찰 기록이 말한다.
      restorationYear: "E.C. 15년",
      lifeStage: "성체 후기",
      height: "1.56 m",
      weight: "138 kg",
    },
    catalogSummary: "신장 1.56m, 체중 138kg의 표본. 인간형 체격에 비해 밀도가 세 배 가까워 들어 올릴 수 없으며, 이마와 소매에 부적을 붙인 채 복원된 성체 후기 코엘로돈타 표본이다.",
    unlockRecord: { status: "recorded", text: "엘라는 몸이 굳어 있다. 복원 직후 계측대가 주저앉아 한 번 갈았고 케어실 바닥재도 다시 깔았는데, 정작 본인은 소리 없이 걷는다. 하루의 대부분을 마당에서 같은 동작을 아주 느리게 반복하며 보내고, 어린 렐릭들이 흉내 내며 달려들면 손목만 살짝 돌려 하나씩 넘어뜨리고는 다시 처음 자세로 돌아간다. 앳된 얼굴로 \"요즘 것들은 성질이 급해\"라고 말하는 것이 여러 번 관찰됐다. 이마의 부적은 젖으면 안 된다며 비 오는 날에는 처마 밑에서만 움직인다." },
    squadNote: "앱솔루트 팽의 최전선 방벽. 화려한 선배들이 앞다투어 뛰어나갈 때 혼자 제자리에 서서 그 뒤를 받치고, 문짝을 부순 이들의 시말서를 대신 써 준다.",
    // 힘을 숨기지 않는 스쿼드에서 유일하게 물러서지 않는 쪽이라, 호칭도 가장 격의 없는 것을 쓴다.
    researcherTitle: "연구원",
    rarity: "SSR",
    portraitAssetId: "ella",
    origin: "코엘로돈타",
    element: "grass",
    role: "tank",
    // 붙어서 밀고 흘리는 권법이라 손이 닿는 거리에서만 싸운다.
    reachTier: "melee",
    // 굳은 몸으로 땅을 다지는 손이라 발굴 특화는 화석 쪽에 붙인다.
    excavationTrait: { primaryCurrency: "rawStone", baseProductionPerHour: 1.36, efficiencyMultiplier: 1.14 },
    // **로스터에서 가장 느리다**(공속 62 · 이속 64). 한 방 한 방이 무거운 대신 그 사이가 길고,
    // 공격력은 탱커답게 절제해 화력이 아니라 버티는 시간이 이 개체의 값이 되게 한다.
    stats: {
      hp: 1500,
      def: 146,
      res: 112,
      atk: 100,
      ap: 32,
      attackSpeed: 62,
      moveSpeed: 64,
      critChance: 10,
      critDamage: 150,
      energyGain: 26,
      lifeSteal: 0,
      ferocityGain: 0,
    },
    // 굳는 순간 몸이 한 겹 덮이고, 그 상태로 권을 딱 한 바퀴(발경 3연) 몰아친다.
    ferocityTrait: { name: "금강불괴(金剛不壞)", effectId: "adamantBody", shieldMaxHpPercent: 25, hastenedAttacks: 3, attackSpeedPercent: 150 },
    passive: {
      // kind가 undyingTalisman인 패시브는 passiveDescription()이 구조화 필드로 문장을 만들므로
      // 이 desc는 표시되지 않는 데이터 문서용 사본이다. 수치를 고치면 함수 쪽 분기도 함께 본다.
      id: "ella-passive",
      name: "불멸(不滅)",
      kind: "undyingTalisman",
      iconAssetId: "skill-icon-buff",
      effectType: "buff",
      // Passive.value는 공용 필수 필드라, 이 패시브에서는 버티는 동안 회복할 총량을 담아 둔다.
      value: 30,
      durationSeconds: 4,
      // 쓰러지려는 순간 제 주위를 비운다. 파치의 날려버림과 같은 궤적 규칙을 쓰되 주체가 다르다.
      undyingKnockback: { seconds: 0.8, speed: 900, bounces: 1, radius: 240 },
      desc: "전투당 한 번, 쓰러질 피해를 받으면 죽지 않고 4초 동안 무적이 되는 대신 아무 행동도 하지 못한다. 그동안 최대 체력의 30%를 매초 나누어 회복하고, 발동 순간 주위 적을 날려버린다.",
    },
    basic: {
      id: "ella-basic",
      name: "발경(發勁)",
      // 순환이 위력·대상·효과를 걸음마다 통째로 정하므로 이 값들은 쓰이지 않는 기본값이다.
      power: 90,
      iconAssetId: "skill-icon-physical",
      effectType: "physical",
      damageType: "physical",
      targeting: "single",
      /**
       * 세 걸음이 **모두 자기 주위 광역**이고 반경이 걸음마다 넓어진다 — 붙이고(보호막)
       * 흔들고(경직) 쓸어 낸다(날려버림). 1·2단이 단일이던 시절에는 순환이 화면에서 읽히지
       * 않았다: 같은 SD가 같은 자리에서 세 번 때리고 차이는 숫자뿐이었다.
       *
       * 마지막 걸음이 기절이 아니라 **날려버림**인 이유는 기절이 토리카의 정체성이고, 여기서
       * 필요한 것은 "여기서 끊는다"를 눈으로 보여 주는 것이기 때문이다. 회복은 두지 않는다 —
       * 이 개체는 보호막으로 버티고, 회복은 노도니아의 축이다.
       */
      cycle: [
        { name: "점(粘)", power: 80, targeting: "nearbyEnemies", radius: 150, shieldFromDamagePercent: 80 },
        { name: "화(化)", power: 105, targeting: "nearbyEnemies", radius: 190, statusEffects: [{ kind: "stagger", seconds: 0.1 }] },
        { name: "발(發)", power: 135, targeting: "nearbyEnemies", radius: 240, pull: { distance: 90 } },
      ],
    },
    ultimate: {
      id: "ella-ult",
      name: "인(引)",
      iconAssetId: "skill-icon-buff",
      effectType: "buff",
      cost: 110,
      // 아무도 때리지 않는다. 끌어당겨 붙잡아 두고 버틴 시간을 보호막으로 바꾸는 것이 전부다.
      targeting: "self",
      // 불러 놓고 그 자리에서 덮는다. 끝난 뒤에 돌려받으면 순서가 거꾸로다 — 끌어당겨 도발한
      // 5초를 버티라고 주는 막이 5초 뒤에 오면 이미 늦는다.
      selfGuard: {
        tauntSeconds: 5,
        pull: { radius: 420, distance: 150 },
        shieldMaxHpPercent: 35,
      },
    },
  },

  // --- 적 개체. 아군 5대 자치 스쿼드가 아니라 각자의 적대 세력에만 배정한다. ---
  // 영구 캐릭터 ID는 외형을 뜻하던 husk-* 대신 이름과 같은 ID를 써 저장·편성 데이터의
  // 정체성을 분명히 한다. 초상/전신 asset ID는 로더 키와 실제 zip 계약이므로 그대로 둔다.
  //
  // 코마만 `husk-koma`로 남아 있었다. 형제 셋(`husk-shell`·`husk-raptor`·`husk-wing`)이
  // 이름 ID로 옮겨 갈 때 빠진 자리라, 같은 표에서 혼자 외형 접두사를 달고 있었다. 셋과 달리
  // 코마는 한 번도 플레이어블이었던 적이 없어 저장에 실려 나간 적이 없으므로,
  // `LEGACY_SAVED_RELIC_ID_MAP`에 줄을 더하거나 저장 버전을 올릴 필요가 없다.
  {
    id: "toby",
    enemyOnly: true,
    squad: "annihilation",
    name: "토비",
    // 공멸 내부 프로젝트 번호와 도감 개체번호를 혼동하지 않도록 별도의 연속 번호를 쓴다.
    specimenNumber: "202",
    // 정체성 데이터는 복원 프로젝트 계보를 표시하며 발굴 기록이나 성격 관찰에 포함하지 않는다.
    projectName: "ANNIHILATION OVERREACH",
    // 발굴 기록의 장소 데이터로, 복원 후 행동은 아래 관찰 기록에서만 다룬다.
    excavationSite: "뉴욕주 버티층 석회암대",
    // 발굴 기록은 장소·보존 상태·복원 연구 특징만 담고, 복원 이후 생활 관찰과 분리한다.
    fossilRecord: "버티층 석회암에서 바다전갈의 등판과 집게발 화석을 한 덩어리로 회수했다. 관절 사이에는 여러 차례 접합한 복원 흔적이 남아 있다.",
    observationProfile: {
      originYear: "약 4억 3,000만 년 전",
      // E.C.는 충동적이고 수습이 서툰 소년기형 인상을 분류하며, 복원 뒤 경과 시간이나 화석 단계의 연령이 아니다.
      restorationYear: "E.C. 11년",
      lifeStage: "성체",
      height: "1.42 m",
      weight: "48 kg",
    },
    // 공개 도감 요약은 원종과 복원 외형만 설명하는 발굴 계열 데이터다.
    catalogSummary: "넓은 등판과 집게발이 복원된 바다전갈 기반 표본.",
    // 복원 후 성격 관찰은 사고를 낸 순서와 뒤늦은 수습 행동만 기록한다.
    unlockRecord: { status: "recorded", text: "복원 후 토비는 낯선 장치를 보면 허락을 기다리지 않고 먼저 집게발을 댄다. 작동시킨 뒤에야 멈출 방법을 찾느라 뛰어다니며, 넘어뜨린 장비는 아무도 보기 전에 제자리로 돌려놓으려 한다. 훈련에서는 힘을 줄이겠다고 매번 다짐하지만 손잡이나 표적을 또 부순 다음에야 힘 조절에 실패했다는 것을 알아차린다." },
    // 복원 후 성격 관찰을 소속 내 행동으로 이어 쓰되 발굴 상태는 반복하지 않는다.
    squadNote: "공멸의 정면 돌파 담당. 잠긴 방벽을 집게발로 먼저 뜯어 일을 키우지만, 흩어진 장비까지 주워 다음 돌입로를 열어 둔다.",
    researcherTitle: "연구원",
    rarity: "R",
    portraitAssetId: "toby",
    // 원종·속성·역할은 발굴 및 복원 분류 데이터이며 성격을 직접 표현하지 않는다.
    origin: "바다전갈",
    element: "fire",
    role: "warrior",
    // 갈퀴로 할퀴는 근접 허스크.
    reachTier: "melee",
    // 발굴 특화는 전투 능력치와 무관한 운영 데이터다.
    excavationTrait: { primaryCurrency: "gold", baseProductionPerHour: 112.5, efficiencyMultiplier: 1.00 },
    // 기존의 강한 물리 공격과 빠른 발은 보존한다. 다만 암살자가 아닌 전사로 확정했으므로
    // 체력·방어를 한 단계 올리고, 공속은 폭증시키지 않아 정면에서 버티며 때리는 감각을 만든다.
    // 쓰지 않는 주문력은 낮추고 공용 부가 능력치는 COMMON_SECONDARY_STATS와 같은 값으로 맞춘다.
    stats: {
      // **적은 R 띠의 위쪽에 선다.** 잡졸이라고 띠 바닥에 두면 같은 등급의 아군보다 약해 관문이
      // 레벨로만 어려워진다. 전사는 쓰는 곳(공격력)에 몰아 주고 남는 몫만 체력·방어로 돌린다.
      hp: 1020,
      def: 85,
      res: 45,
      atk: 155,
      ap: 20,
      attackSpeed: 102,
      moveSpeed: 110,
      critChance: 10,
      critDamage: 150,
      energyGain: 26,
      lifeSteal: 0,
      ferocityGain: 0,
    },
    // 공속 축의 폭주는 전부 같은 계약(`selfAttackSpeedMultiplier`)을 쓴다. 예전에는 이 둘만
    // 간격을 직접 줄이는 별도 효과라, 같은 일을 하는 폭주가 화면에서 "공격 간격이 짧아진다"는
    // 다른 말로 섰다 — 게임 어디에도 없는 단위다. 간격 -12%는 속도 x1/0.88이므로 +14%로 옮긴다.
    ferocityTrait: { name: "맹추", effectId: "selfAttackSpeedMultiplier", bonusPercent: 14 },
    /*
     * **손을 대기 시작하면 멈추지 못한다.** 관찰 기록의 성격(먼저 집게발을 대고, 부순 다음에야
     * 힘 조절에 실패했다는 것을 안다)을 그대로 전투 값으로 옮긴 셋이다 — 때릴수록 손이 빨라지고
     * (패시브), 한 번 문 자리를 비틀어 열고(기본기), 마지막에는 주위를 통째로 뜯어 넘긴다(궁극기).
     */
    passive: {
      id: "toby-passive",
      name: "손대고 나서 생각하기",
      kind: "basicHitAttackSpeedStack",
      iconAssetId: "skill-icon-buff",
      effectType: "buff",
      value: 2,
      maxStacks: 8,
      // 전용 분기(`passiveDescription`)가 이 종류의 문장을 짓는다. 이 원문은 표시되지 않는 데이터
      // 문서용 사본이라, 고칠 때는 그 분기도 함께 본다.
      desc: "기본 공격이 적중할 때마다 이번 전투 동안 공격 속도가 증가한다.",
    },
    basic: {
      id: "toby-basic",
      name: "집게발 비틀기",
      power: 100,
      iconAssetId: "skill-icon-physical",
      effectType: "physical",
      damageType: "physical",
      targeting: "single",
    },
    ultimate: {
      id: "toby-ult",
      // 잠긴 방벽을 먼저 뜯어 일을 키우는 그 손이다. 이름이 이미 그림을 말하므로 본문은 효과만 적는다.
      name: "일단 뜯고 본다",
      /*
       * **혼자 서는 자리를 전제로 짠 광역이다.** 1-5의 단일 정예가 이 개체라, 궁극기가 한 명만
       * 때리면 셋이 둘러싼 자리에서 아무 일도 일어나지 않는다(실제로 야성을 34까지 올려도 바닥
       * 파티의 잔여 체력이 0.64에서 움직이지 않았다). 잡졸로 설 때도 같은 기술이므로 위력은
       * 단일 170에서 낮추고, 넘어뜨린 시간을 기절로 준다.
       */
      power: 150,
      iconAssetId: "skill-icon-physical",
      effectType: "physical",
      damageType: "physical",
      cost: 100,
      // 궁극기 대상 방식은 설명문이나 렐릭 ID가 아니라 코어가 읽는 계약이다.
      targeting: "nearbyEnemies",
      radius: 300,
      /*
       * 전사 계약이 요구하는 자가 수급이다. 토비는 유지력이 한 줄도 없는 유일한 전사였고,
       * 적이라고 해서 다른 잣대를 쓰지 않는다 — 적과 아군은 같은 `RelicDef` 정체성 규칙을
       * 쓴다는 원칙 그대로다.
       *
       * 렉시아(50%)·코마(40%)와 같은 공용 계약을 쓰되 값은 가장 낮다. 그 둘은 단일 대상
       * 궁극기라 한 명에게서만 빨아들이지만 이쪽은 **반경 300의 광역**이라, 셋이 둘러싼
       * 자리에서는 같은 25%도 세 몫으로 들어온다. 붙어 싸우는 손(기본 공격)이 아니라
       * 게이지를 채워야 도는 값이라 지속 회복이 아니라 **버티는 한 순간**이다.
       */
      damageHealingPercent: 25,
    },
    // 한계 돌파 효과는 네 칸 모두 "없음"이다 — 정해 둔 효과라 나중에 이 자리에 다른 효과를 넣으면 그대로 바뀐다.
    breakthroughEffects: { basic: { kind: "none" }, ultimate: { kind: "none" }, ferocity: { kind: "none" }, passive: { kind: "none" } },
  },
  {
    id: "amo",
    enemyOnly: true,
    squad: "annihilation",
    name: "아모",
    // 도디의 도감 001번과 공멸 프로젝트 001을 구분하면서 공멸 표본군의 첫 번호를 표시한다.
    specimenNumber: "201",
    // 설정 문서의 공멸 001과 같은 인물임을 보존하는 복원 프로젝트 식별 데이터다.
    projectName: "ANNIHILATION 001 — 최초의 호문쿨루스",
    // 발굴 기록의 장소 데이터로, 복원 후 행동은 아래 관찰 기록에서만 다룬다.
    excavationSite: "도싯 쥐라기 해안 암모나이트층",
    // 발굴 기록은 장소·보존 상태·복원 연구 특징만 담고, 복원 이후 생활 관찰과 분리한다.
    fossilRecord: "해안 절벽에서 나선형 암모나이트 껍질과 내부 격벽이 함께 드러난 표본을 수습했다. 껍질 가장자리에는 초기 복원 과정에서 덧댄 접합 흔적이 남아 있다.",
    observationProfile: {
      originYear: "약 1억 8,000만 년 전",
      // E.C.는 겁이 많지만 동료 앞을 막아서는 소녀기형 정서를 뜻할 뿐 실제 나이 또는 복원 경과 연도가 아니다.
      restorationYear: "E.C. 13년",
      lifeStage: "성체",
      height: "1.47 m",
      weight: "52 kg",
    },
    // 공개 도감 요약은 원종과 복원 외형만 설명하는 발굴 계열 데이터다.
    catalogSummary: "나선형 껍질과 격벽 구조가 복원된 암모나이트 기반 표본.",
    // 복원 후 성격 관찰은 위험에 숨는 반응과 동료를 위해 앞을 막는 행동만 기록한다.
    unlockRecord: { status: "recorded", text: "복원 후 아모는 큰 소리나 위험 신호가 나면 곧바로 몸을 껍질 안으로 감춘다. 혼자 있을 때는 좀처럼 다시 나오지 않지만, 뒤에 동료가 남아 있으면 한참 망설이다 껍질을 끌고 앞으로 나와 길을 막는다. 상황이 끝난 뒤에는 자신이 먼저 나섰다는 말을 부정하며 다시 얼굴을 숨긴다." },
    // 복원 후 성격 관찰을 소속 내 행동으로 이어 쓰되 발굴 상태는 반복하지 않는다.
    squadNote: "공멸의 후미 방벽. 포격에는 먼저 껍질을 닫지만 작은 동료가 남으면 돌아와, 침투조가 모두 빠질 때까지 통로를 몸으로 막는다.",
    researcherTitle: "연구원",
    rarity: "R",
    portraitAssetId: "amo",
    // 원종·속성·역할은 발굴 및 복원 분류 데이터이며 성격을 직접 표현하지 않는다.
    origin: "암모나이트",
    element: "earth",
    role: "tank",
    // 몸통으로 밀어붙이는 근접 허스크.
    reachTier: "melee",
    // 발굴 특화는 전투 능력치와 무관한 운영 데이터다.
    excavationTrait: { primaryCurrency: "rawStone", baseProductionPerHour: 1, efficiencyMultiplier: 1.00 },
    // 높은 체력·방어·저항과 느린 공속·이속이라는 기존 방벽 감각을 그대로 살린다.
    // 물리 기본기만큼의 공격력만 남기고 쓰지 않는 주문력은 낮춰, 생존 능력으로 R 띠를 채운다.
    // 치명타·충전 계열은 캐릭터 차별점이 아니므로 COMMON_SECONDARY_STATS와 동일하게 통일한다.
    stats: {
      // 탱커는 오래 서 있는 것이 일이라 체력·방어·저항에만 몰아 준다. 공격력은 쓰지 않는 값이므로
      // 띠를 채우려고 올리지 않는다(쓰지 않는 능력치를 높게 적지 않는다).
      hp: 1420,
      def: 128,
      res: 104,
      atk: 65,
      ap: 20,
      attackSpeed: 74,
      moveSpeed: 64,
      critChance: 10,
      critDamage: 150,
      energyGain: 26,
      lifeSteal: 0,
      ferocityGain: 0,
    },
    ferocityTrait: {
      name: "이번엔 안 숨을 거야!",
      effectId: "shellResolve",
      // 폭주 진입 순서는 정화 → 조가비 획득 → 상한 소비이며, ID가 아닌 이 계약만 전투가 읽는다.
      cleanseAllOnEntry: true,
      shellStacksOnEntry: 3,
      shellCooldownSecondsDuringFever: 3,
    },
    passive: {
      id: "amo-passive",
      name: "무서운 건 아니거든",
      kind: "shellGuard",
      iconAssetId: "skill-icon-buff",
      effectType: "buff",
      value: 0,
      // 요청 수치의 절반인 자기 6%·아군 3%로 시작해 R 탱커의 반복 보호막 과잉을 막는다.
      shellGuard: { maxStacks: 3, durationSeconds: 6, cooldownSeconds: 6, selfShieldMaxHpPercent: 10, lowestHpAllyShieldMaxHpPercent: 5 },
      // 실제 문구는 shellGuard 수치에서 생성하며, 수동 원문은 의도적으로 비워 둔다.
      desc: "",
    },
    basic: {
      id: "amo-basic",
      name: "껍질로 쿵",
      power: 100,
      iconAssetId: "skill-icon-physical",
      effectType: "physical",
      damageType: "physical",
    },
    ultimate: {
      id: "amo-ult",
      name: "다들 내 뒤로!",
      iconAssetId: "skill-icon-buff",
      effectType: "buff",
      cost: 100,
      targeting: "self",
      // 피해 없이 기존 끌어당김·도발·자기 보호막 경로를 재사용하고 마지막에 조가비 쿨다운만 초기화한다.
      selfGuard: { tauntSeconds: 5, pull: { radius: 420, distance: 150 }, shieldMaxHpPercent: 35, resetShellGuardCooldown: true },
    },
    // 한계 돌파 효과는 네 칸 모두 "없음"이다 — 정해 둔 효과라 나중에 이 자리에 다른 효과를 넣으면 그대로 바뀐다.
    breakthroughEffects: { basic: { kind: "none" }, ultimate: { kind: "none" }, ferocity: { kind: "none" }, passive: { kind: "none" } },
  },
  {
    id: "ripa",
    enemyOnly: true,
    squad: "annihilation",
    name: "리파",
    // 공멸 프로젝트 계보와 분리된 도감 개체번호이며 세 표본의 복원 순서를 유지한다.
    specimenNumber: "203",
    // 정체성 데이터는 복원 프로젝트 계보를 표시하며 발굴 기록이나 성격 관찰에 포함하지 않는다.
    projectName: "ANNIHILATION HIDE-AND-TIDE",
    // 발굴 기록의 장소 데이터로, 복원 후 행동은 아래 관찰 기록에서만 다룬다.
    excavationSite: "모로코 안티아틀라스 셰일층",
    // 발굴 기록은 장소·보존 상태·복원 연구 특징만 담고, 복원 이후 생활 관찰과 분리한다.
    fossilRecord: "셰일층에서 삼엽충의 머리·가슴·꼬리 마디가 이어진 압착 화석을 회수했다. 닳아 없어진 가슴마디 일부에는 얇은 복원재를 덧댄 흔적이 보인다.",
    observationProfile: {
      originYear: "약 4억 8,000만 년 전",
      // E.C.는 숨바꼭질과 장난을 즐기는 아동기형 인상을 기록하며 실제 생존 햇수나 복원 연차로 읽지 않는다.
      restorationYear: "E.C. 9년",
      lifeStage: "성체",
      height: "1.31 m",
      weight: "36 kg",
    },
    // 공개 도감 요약은 원종과 복원 외형만 설명하는 발굴 계열 데이터다.
    catalogSummary: "세 구획의 등껍질과 마디 구조가 복원된 삼엽충 기반 표본.",
    // 복원 후 성격 관찰은 숨었다 나타나는 장난과 동료 물건을 옮기는 행동만 기록한다.
    unlockRecord: { status: "recorded", text: "복원 후 리파는 모래나 얕은 물속에 몸을 숨긴 채 동료가 가까이 오기를 기다린다. 갑자기 솟아올라 놀래킨 뒤에는 웃으며 달아나고, 자리를 비운 사이 동료의 장갑이나 기록 도구를 다른 선반으로 옮겨 놓는다. 물건을 찾는 모습을 충분히 지켜본 다음에야 숨겨 둔 곳을 가리킨다." },
    // 복원 후 성격 관찰을 소속 내 행동으로 이어 쓰되 발굴 상태는 반복하지 않는다.
    squadNote: "공멸의 잠복 지원가. 모래와 물속을 오가며 회복 파장을 건네고, 동료 장비를 숨겼다가 필요한 순간 버프 신호와 함께 되돌려 준다.",
    researcherTitle: "연구원",
    rarity: "R",
    portraitAssetId: "ripa",
    // 원종·속성·역할은 발굴 및 복원 분류 데이터이며 성격을 직접 표현하지 않는다.
    origin: "삼엽충",
    element: "water",
    role: "support",
    // 복원된 마디가 일으키는 수류가 조금 떨어진 곳까지 닿는다.
    reachTier: "mid",
    // 발굴 특화는 전투 능력치와 무관한 운영 데이터다.
    excavationTrait: { primaryCurrency: "cheesecake", baseProductionPerHour: 1.8, efficiencyMultiplier: 1.00 },
    // 높은 주문력·이동 속도와 낮은 체력·방어라는 기존 지원가 감각을 보존한다.
    // 마법 기본기·궁극기가 쓰는 주문력으로 R 띠를 채우고, 쓰지 않는 공격력은 낮게 둔다.
    // 공용 부가 능력치는 COMMON_SECONDARY_STATS와 맞춰 차별점을 스킬·패시브에만 남긴다.
    stats: {
      // 마법 지원가라 주문력이 먼저지만 그 값은 이미 레이더 상한(200)에 닿아 있다. 남는 몫은
      // **오래 서서 시약을 바르는 데** 쓰는 체력·저항으로 돌린다 — 공격력은 스킬이 한 번도
      // 읽지 않는 값이라 띠를 채우려고 올리지 않는다. 그래도 셋 중 가장 무른 몸이다.
      hp: 770,
      def: 40,
      res: 78,
      atk: 20,
      ap: 200,
      attackSpeed: 100,
      moveSpeed: 114,
      critChance: 10,
      critDamage: 150,
      energyGain: 26,
      lifeSteal: 0,
      ferocityGain: 0,
    },
    // 캐릭터 ID가 아니라 공용 시약 도핑 계약이 진입 살포와 자기 공속 증가를 함께 표현한다.
    ferocityTrait: {
      name: "몰래 쿡! 도핑 투여", effectId: "reagentDoping",
      // 진입 1겹은 궁극기 없이도 순환을 시작하되 즉시 반응하지 않는 R등급 행동 예산이다.
      stacksOnEntry: 1,
      // +40%는 R 지원가의 직접 버프를 자기 폭주 시간에만 묶어 반응 횟수의 상한을 세운다.
      attackSpeedPercent: 40,
    },
    passive: {
      id: "ripa-passive",
      name: "으흐흐, 실험 시작!",
      kind: "reagentReaction",
      iconAssetId: "skill-icon-buff",
      effectType: "buff",
      // 기존 Passive 계약의 대표값도 3겹 상한과 맞춰 정보창의 R등급 발동 예산이 갈리지 않게 한다.
      value: 3,
      reagentReaction: {
        // 3겹은 기본 공격 세 번 또는 기본기+궁극기로 완성되어 R등급의 준비 동작을 보존한다.
        maxStacks: 3,
        // 8초는 느린 기본 공속에도 한 순환을 허용하지만 표적 변경으로 영구 보존되지는 않는 창이다.
        seconds: 8,
        // 기본 1겹은 매 타격 반응을 막아 독·회복 예산을 세 번의 적중에 나눠 둔다.
        basicStacks: 1,
        // 궁극기 2겹은 비용 100의 광역 준비 가치를 주되 단독 즉발 반응은 만들지 않는다.
        ultimateStacks: 2,
        // 중독 4초는 공용 POISON 네 틱만 빌려 R등급 직접 피해가 주력 딜러를 넘지 않게 한다.
        reactionPoisonSeconds: 4,
        // 단일 아군 최대 HP 5%는 광역 회복보다 좁은 대신 반복 가능한 R 지원 예산이다.
        lowestHpAllyHealMaxHpPercent: 5,
        // 원본 저항 12%는 후반 기여의 첫 조정점이며 3겹 규칙을 건드리지 않고 낮출 수 있다.
        resistanceReductionPercent: 12,
        // 5초는 후속 아군 공격을 받되 다음 반응까지 상시 유지되기 어렵게 둔 가동 창이다.
        resistanceReductionSeconds: 5,
      },
      desc: "",
    },
    basic: {
      id: "ripa-basic",
      // 삼엽충 원종의 복원 외형에 맞춘 기술명이며 성격 관찰 데이터와는 분리한다.
      name: "찰싹! 시약 묻히기",
      // AP 80%는 시약 1겹과 공용 중독을 함께 가진 R등급 기본기의 직접 피해 예산이다.
      power: 80,
      iconAssetId: "skill-icon-magical",
      effectType: "magical",
      damageType: "magical",
      // 패시브 수치와 일치하며 이후 공용 적중 후 경로가 캐릭터 ID 없이 읽을 부여량이다.
      // 1겹은 패시브 계약과 같은 기본 공격 몫이며 숫자를 두 경로가 함께 검증한다.
      reagentStacks: 1,
    },
    ultimate: {
      id: "ripa-ult",
      // 삼엽충 원종의 수중 움직임에 맞춘 기술명이며 성격 관찰 데이터와는 분리한다.
      name: "뭐가 들었게? 약물 폭탄",
      // AP 100%는 광역 2겹 준비가 핵심인 R등급 궁극기라 직접 피해를 한 배율로 제한한다.
      power: 100,
      iconAssetId: "skill-icon-magical",
      effectType: "magical",
      damageType: "magical",
      // 비용 100은 공용 궁극기 한 주기 예산을 지켜 광역 2겹을 반복 살포하지 못하게 한다.
      cost: 100,
      // 궁극기 대상 방식은 설명문이나 렐릭 ID가 아니라 코어가 읽는 계약이다.
      targeting: "battlefieldEnemies",
      // 일반 공격과 동일한 공용 적중 후 경로에 넘겨 각 대상의 반응을 독립 판정한다.
      // 2겹은 이미 묻은 1겹과 합쳐 반응한다는 입력 순서를 화면의 세 칸과 일치시킨다.
      reagentStacks: 2,
    },
    // 한계 돌파 효과는 네 칸 모두 "없음"이다 — 정해 둔 효과라 나중에 이 자리에 다른 효과를 넣으면 그대로 바뀐다.
    breakthroughEffects: { basic: { kind: "none" }, ultimate: { kind: "none" }, ferocity: { kind: "none" }, passive: { kind: "none" } },
  },
  {
    // 코마는 1-10에서만 처음 등장하지만 스테이지 전용 보정이 아닌 독립 영구 캐릭터다.
    id: "koma",
    enemyOnly: true,
    squad: "annihilation",
    name: "코마",
    // 도감 개체번호는 렉시아의 072와 충돌하지 않으며, 공멸 프로젝트 번호 072는 아래 이름에 보존한다.
    specimenNumber: "204",
    projectName: "ANNIHILATION VANGUARD 072",
    excavationSite: "오디디 격리 연구동",
    // 봉인된 적 캐릭터도 출처와 복원 흔적은 영구 정의에 남겨 스테이지 데이터와 섞지 않는다.
    fossilRecord: "오디디 격리 연구동의 파손된 배양조에서 소형 골격과 폭발 잔류물을 회수했다. 빠른 이동을 위한 경량 복원 흔적이 사지 관절마다 남아 있다.",
    observationProfile: {
      originYear: "약 1억 5,000만 년 전",
      // E.C.는 앞뒤를 재지 않고 먼저 달려 나가는 소년기형 인상을 분류하며, 복원 경과 연도가 아니다.
      restorationYear: "E.C. 10년",
      lifeStage: "성체",
      height: "1.18 m",
      weight: "29 kg",
    },
    catalogSummary: "가벼운 체형과 긴 꼬리로 급습하는 콤프소그나투스 기반 공멸 선봉.",
    /*
     * **봉인을 풀었다.** 1장 마지막 관문에 홀로 서는 개체인데 관찰 기록만 봉인되어 있어, 정보창의
     * 오른쪽 절반이 비어 있었다 — 플레이어가 가장 오래 마주 보는 적이 이름과 수치밖에 갖지 못했다.
     * 다른 공멸 셋과 같은 층위(복원 후 관찰 · 소속 행동 · 호칭)로 채운다.
     */
    unlockRecord: { status: "recorded", text: "복원 후 코마는 문이 열리는 소리보다 먼저 그 앞에 가 있다. 길이 맞는지 확인하는 일은 뒤따라오는 동료에게 맡기고, 막다른 곳이면 왔던 자리로 되돌아와 다시 다른 길을 골라 달린다. 한 번 뒤를 밟기 시작한 상대는 시야에서 사라져도 놓지 않아, 훈련이 끝난 뒤에도 표적이 지나간 통로를 혼자 몇 번씩 되짚는다." },
    squadNote: "공멸의 첨병. 돌입로가 정해지기 전에 먼저 들어가 안을 보고 오며, 흩어진 적을 한 방향으로 몰아 뒤따르는 아모와 토비 앞에 세운다.",
    researcherTitle: "연구원",
    /*
     * **중간보스는 SR급이다.** 공멸 3인조(토비·아모·리파)가 R 띠를 지키는 잡졸이라면 이쪽은
     * 1장 마지막 관문에 서는 개체라 한 단계 위에 둔다. 적 전용이라 띠 검사 대상은 아니지만,
     * 등급을 R로 두면 레벨 성장률(1.8)까지 잡졸과 같아져 관문이 올라갈수록 격차가 벌어진다.
     */
    rarity: "SR",
    portraitAssetId: "koma",
    origin: "콤프소그나투스",
    /*
     * **1장의 관문 둘이 같은 속성이면 그 속성의 딜러만 상성 없이 싸운다.** 정예가 토비(불)와
     * 코마 둘뿐인데 코마까지 불이면, 불 딜러는 1-5도 1-10도 1.00배로 주고 1.00배로 맞는다 —
     * 실측에서 렉시아를 낀 아홉 조합이 탱커·지원가를 무엇으로 바꾸든 두 관문에서 모두 막혔고,
     * 물·땅 딜러는 1.25배 주고 0.8배 받아(합쳐 1.56배) 같은 재화·같은 룬으로 그냥 뚫었다.
     * 간판 SSR이 1장의 두 관문에서만 쓸 수 없는 개체가 되는 자리라 코마를 풀로 옮긴다.
     *
     * 풀은 물·땅을 이기고 불에 약하므로 정예 둘이 서로 다른 답을 요구하게 된다 — 1-5는 물·땅이
     * 유리하고 1-10은 불이 유리하다. 기본기(꼬리 베기)도 궁극기(추락하는 방주)도 불을 말하는
     * 기술이 아니라 연출과 어긋나지 않는다.
     */
    element: "grass",
    role: "assassin",
    // 전열 사이를 빠르게 파고드는 근접 중간보스다.
    reachTier: "melee",
    // 적 전용 개체지만 데이터 계약을 완성하기 위해 비전투 특성도 영구 정의에 둔다.
    excavationTrait: { primaryCurrency: "gold", baseProductionPerHour: 112.5, efficiencyMultiplier: 1.00 },
    /*
     * **잡졸보다 아래에 있던 수치를 SR 띠로 올렸다.** 태생 전투력이 1916으로 공멸 3인조
     * (2082~2098)보다도 낮아, 중간보스 자리에 섰는데 실제로는 셋 중 누구보다 약했다 —
     * 1장 마지막 관문이 직전 관문보다 쉬웠던 원인의 절반이 여기다(나머지 절반은 레벨 1이었다).
     *
     * 모양은 그대로 둔다: 방어·저항이 얇고 발이 빠른 급습형이다. 늘린 몫은 체력과 공격력이라
     * "한 번 붙으면 아프지만 붙잡히면 죽는다"가 유지된다. 2274로 SR 띠(2210~2330) 안이다.
     */
    stats: {
      // 중간보스는 SR 띠의 위쪽이다. 암살자가 쓰는 공격력과 그 정체성인 공격 속도에만 얹는다.
      hp: 1100,
      def: 55,
      res: 46,
      atk: 150,
      ap: 52,
      attackSpeed: 118,
      moveSpeed: 124,
      critChance: 10,
      critDamage: 150,
      energyGain: 26,
      lifeSteal: 0,
      ferocityGain: 0,
    },
    /*
     * **앞장서서 뚫는 몸이라 잃은 만큼을 두른다.** 공속만 올리던 때는 이 폭주가 열려도
     * 1장 마지막 관문이 달라지지 않았다 — 혼자 셋을 상대하는 자리에서는 손이 빨라져도 한 번에
     * 때리는 것이 하나뿐이라, 정작 필요한 것은 **그 사이에 버티는 값**이다. 막을 최대 체력이
     * 아니라 잃은 체력에서 재므로 몰린 뒤에 열릴수록 두꺼워진다.
     */
    ferocityTrait: { name: "공멸 선봉", effectId: "vanguardCharge", missingHpShieldPercent: 40, attackSpeedPercent: 50 },
    /*
     * **한 번 밟기 시작한 상대는 시야에서 사라져도 놓지 않는다**(관찰 기록). 같은 적을 세 번
     * 때려야 출혈이 남던 예전 패시브는 그 문장을 말하지 못했다 — 붙어 있던 적이 물러나면
     * 셈이 처음으로 돌아가 아무 일도 없었던 것이 되고, 혼자 셋을 상대하는 자리에서는 그 셈이
     * 끝까지 채워지지도 않았다. 지금은 **가장 약해진 하나를 끝내러 건너뛴다.**
     */
    passive: {
      id: "koma-passive",
      name: "집요한 추격",
      kind: "stalkerBlink",
      iconAssetId: "skill-icon-physical",
      effectType: "physical",
      // 이 패시브의 유일한 수치는 주기(초)다. 도착한 한 방의 세기는 치명타 피해가 이미 말한다.
      value: 8,
      // 전용 분기(`passiveDescription`)가 이 종류의 문장을 짓는다. 이 원문은 표시되지 않는
      // 데이터 문서용 사본이라, 고칠 때는 그 분기도 함께 본다.
      desc: "8초마다 체력이 가장 적은 적의 곁으로 순간이동하고, 그 자리에서 내는 첫 기본 공격이 확정 치명타가 된다.",
    },
    basic: {
      id: "koma-basic",
      name: "후려치기",
      // 중간보스는 잡졸보다 한 대가 아프다(토비·아모·리파 100).
      power: 120,
      iconAssetId: "skill-icon-physical",
      effectType: "physical",
      damageType: "physical",
      targeting: "single",
      /*
       * **세 번째 꼬리가 후려친다.** 매 타격마다 날리면 맞은 쪽이 영영 일어나지 못해 전투가
       * 아니라 한쪽의 처형이 되고, 코마도 날아간 상대를 쫓아 전장을 가로지르기만 한다.
       * 주기로 끊으면 플레이어가 "세 번째에 밀린다"를 읽고 자리를 다시 잡을 수 있다.
       */
      statusEffectEvery: 3,
      statusEffects: [
        { kind: "concussion", maxHpPercent: 5, criticalMaxHpPercent: 15 },
        { kind: "stun", seconds: 1 },
        // 밀어내는 것이 이 개체가 무리에서 맡은 일이다 — 흩어진 적을 한 방향으로 몰아
        // 뒤따르는 아모와 토비 앞에 세운다(`squadNote`).
        { kind: "knockback", seconds: 1.1, speed: 1800, bounces: 2 },
      ],
    },
    ultimate: {
      id: "koma-ult",
      name: "추락하는 방주",
      // 잡졸의 궁극기(토비 150 · 리파 100)와 최종 보스(폰토스 500) 사이에 둔다. 통로 전체를
      // 치는 기술이 되었으므로 단일 220에서 낮춘다.
      power: 190,
      iconAssetId: "skill-icon-physical",
      effectType: "physical",
      damageType: "physical",
      cost: 100,
      /*
       * **뚫고 지나간다.** 1-10의 단일 정예가 이 개체라, 한 명만 때리는 궁극기로는 셋이 둘러싼
       * 자리에서 아무것도 바꾸지 못한다. 나아가는 거리는 스킬이 아니라 **이동 속도**가 정하므로
       * (`SKIRMISH.chargeSeconds` × 이속) 발이 가장 빠른 이 개체가 가장 멀리 민다 — 급습형이라는
       * 정체성이 곧 이 기술의 사거리가 된다.
       */
      targeting: "chargeLine",
      radius: 90,
      /*
       * **더 멀리 뚫는다.** 나아가는 거리는 이동 속도가 정하므로(`SKIRMISH.chargeSeconds` × 이속)
       * 여기서 px를 적지 않고 그 개체 기준의 배율만 얹는다 — 이속을 올려도 두 값이 갈리지 않는다.
       * 셋이 선 자리를 한 번에 가로지르려면 제 이속으로 한 번 달린 거리로는 모자랐다.
       */
      chargeReachMultiplier: 1.8,
      // 뚫고 지나간 만큼 스스로를 되돌린다. 혼자 셋을 상대하는 자리라 궁극기가 피해만 내면
      // 주고받는 총량에서 언제나 지는 쪽이 된다.
      damageHealingPercent: 40,
    },
    // 한계 돌파 효과는 네 칸 모두 "없음"이다 — 정해 둔 효과라 나중에 이 자리에 다른 효과를 넣으면 그대로 바뀐다.
    breakthroughEffects: { basic: { kind: "none" }, ultimate: { kind: "none" }, ferocity: { kind: "none" }, passive: { kind: "none" } },
  },
  {
    // 신규 저장 키 `mette`는 표시명이나 에셋 번호와 분리한 안정적인 내부 ID다.
    id: "mette",
    squad: "rune",
    name: "메테",
    specimenNumber: "163",
    projectName: "ADAGIO COLOSSUS",
    excavationSite: "아르헨티나 팜파스 로한층",
    // 발굴 기록은 장소·보존 상태·복원 연구 특징만 담고, 복원 이후 생활 관찰과 분리한다.
    fossilRecord: "팜파스 발굴 갱도 위 임시 무대에서는 때마침 바이올린 콩쿠르가 한창이었다. 선율 아래 드러난 거대 골격은 손끝 관절까지 놀랍도록 온전했다.",
    observationProfile: {
      originYear: "약 1만 년 전",
      // 성체 화석에서 비롯된 성숙한 성향과 가장 가깝게 맞물리도록, 인간형 신체 나잇대는 허용 상한인 E.C. 19년으로 둔다.
      restorationYear: "E.C. 19년",
      lifeStage: "성체",
      // 사용자가 허용한 170cm대·70kg대 범위 안에서 도감의 단일 측정값을 확정했다.
      height: "1.76 m",
      weight: "74 kg",
    },
    catalogSummary: "신장 1.76m의 견고한 인간형 체격과 현악 연주에 적합한 섬세한 손끝을 지닌, 성체 메가테리움 화석 기반 표본.",
    unlockRecord: { status: "recorded", text: "메테는 복원 직후부터 바이올린의 울림에 유난히 오래 귀를 기울였다. 거대한 메가테리움의 힘과 섬세한 활놀림은 뜻밖에도 훌륭한 조화를 이룬다. 지금은 연구원을 위한 단 하나뿐인 무대를 준비하며, 자신의 연주가 온전히 닿을 날을 고대하고 있다." },
    rarity: "SSR",
    // 6번 전신과 SD를 함께 사용해 도감과 전투에서 같은 메테가 보이도록 한다.
    portraitAssetId: "mette",
    origin: "메가테리움",
    element: "grass",
    role: "support",
    // 활을 켜는 자리는 무대 뒤편이다.
    reachTier: "ranged",
    // 물리형 지원가의 견고함을 운영에서도 드러내도록 화석 생산 특화를 부여했다.
    excavationTrait: { primaryCurrency: "rawStone", baseProductionPerHour: 1.2, efficiencyMultiplier: 1.12 },
    stats: {
      hp: 1260, def: 110, res: 76, atk: 124, ap: 52,
      attackSpeed: 88, moveSpeed: 74, critChance: 10, critDamage: 150,
      energyGain: 26, lifeSteal: 0, ferocityGain: 0,
    },
    ferocityTrait: {
      name: "크레센도", effectId: "crescendoStaccato",
      // 추가타는 메테 atk 50%의 마법 피해이며 기존 토리카와 같은 0.1초 경직을 사용한다.
      damagePercent: 50, staggerSeconds: 0.1,
    },
    passive: {
      id: "mette-passive", name: "아다지오의 무게", kind: "adagioWeight",
      iconAssetId: "skill-icon-buff", effectType: "buff", value: 20,
      teamAttackSpeedPercent: 20, cleanseShieldAttackPercent: 320, cleanseCooldownSeconds: 7,
      // kind가 adagioWeight인 패시브는 passiveDescription()이 실제 능력치로 다시 문장을 만들므로
      // 이 원문은 데이터 문서화용일 뿐 화면에는 쓰이지 않는다.
      desc: "생존 중 아군 공격 속도를 20% 높인다. 아군이 군중제어에 걸리면 즉시 정화하고 공격력 200% 보호막을 부여한다.",
    },
    basic: {
      id: "mette-basic", name: "스타카토", power: 100, scalingStat: "atk",
      iconAssetId: "skill-icon-magical", effectType: "magical", damageType: "magical",
      statusEffects: [{ kind: "stagger", seconds: 0.1 }],
    },
    ultimate: {
      id: "mette-ult", name: "전장의 찬가", iconAssetId: "skill-icon-healing", effectType: "healing",
      cost: 90, targeting: "battlefieldAllies", healing: { kind: "teamMissingHpPercent", percent: 15 },
    },
  },
  {
    // 저장 데이터와 에셋 키(`deina`·`char_016`)는 유지하고 플레이어에게 표시하는 이름만
    // 데이로 둔다 — 스피나와 같은 규칙이다.
    id: "deina",
    squad: "gear",
    name: "데이",
    specimenNumber: "059",
    projectName: "NEON TAG",
    excavationSite: "몬태나 클로버리층 상부 이암",
    // 발굴 기록은 장소·보존 상태·복원 연구 특징만 담고, 복원 이후 생활 관찰과 분리한다.
    fossilRecord: "복원 목록에 마지막으로 올라온 표본이다. 무너진 이암 단면에서 낫발톱과 꼬리 힘줄뼈가 달리던 자세 그대로 굳어 나왔다.",
    observationProfile: {
      originYear: "약 1억 1천만 년 전",
      // E.C.는 인간형 신체 나잇대만 나타내며, 아래 아성체 화석 단계와 독립된 값이다.
      restorationYear: "E.C. 17년",
      lifeStage: "아성체",
      height: "1.66 m",
      weight: "43 kg",
    },
    catalogSummary: "신장 1.66m, 체중 43kg의 가벼운 인간형 체격과 발달한 꼬리 깃이 확인된, 아성체 데이노니쿠스 화석 기반 표본.",
    // 복원 후 관찰은 성격과 실제로 목격된 행동만 남기고 발굴 기록과 겹치지 않게 쓴다.
    unlockRecord: { status: "recorded", text: "데이는 비어 있는 면을 그냥 지나치지 못한다. 케어실 셔터와 창고 벽에 하룻밤 사이 이름 모를 표식이 늘어나는데, 정작 본인은 아침마다 시치미를 뗀다. 연구원이 책상에 엎드려 잠든 날에는 어김없이 얼굴에 무언가를 남기고, 들켜서 혼이 나면 눈이 그렁그렁해져 다시는 안 하겠다고 말한 뒤 그날 밤에 또 한다. 야단맞는 동안에도 손끝은 캔을 흔들고 있다." },
    squadNote: "나이트 기어의 야간 정찰조. 잠입 경로와 인양 지점을 벽의 표식으로 남겨 뒤따르는 조가 소리 없이 읽게 하고, 쓰다 남은 캔은 잔해에서 주워 스스로 채운다.",
    // 스쿼드가 실제로 쓰는 호칭 중 가장 격식 있는 쪽을 고른다 — 사고는 쳐도 인양조의 규율
    // 안에 있는 개체라, 혼나는 자리에서도 부르는 말은 흐트러지지 않는다.
    researcherTitle: "연구원님",
    rarity: "SSR",
    portraitAssetId: "deina",
    origin: "데이노니쿠스",
    element: "fire",
    // 붙잡아 두는 것이 값이라 태그는 tank지만, 버티는 방식은 체력도 보호막도 아닌 발이다.
    role: "tank",
    // 캔이 닿는 거리까지만 다가간다.
    reachTier: "melee",
    excavationTrait: { primaryCurrency: "gold", baseProductionPerHour: 110, efficiencyMultiplier: 1.14 },
    /*
     * **버티는 몫을 체력에 두지 않는다.** 탱커 넷 중 방어·저항이 가장 얇고 방어를 곱한 실효
     * 체력도 가장 낮다(2961 · 토리카 3238 · 엘라 3690 · 노도니아 4241) — 이 개체가 사는 방식은
     * 맞고 버티는 것이 아니라 한 대 치고 다음 벽으로 옮겨 가는 것이라, 단단하게 적으면
     * 콘셉트와 수치가 갈린다.
     *
     * **손이 아니라 발이 빠른 개체다.** 공격 속도는 112였는데 그것은 렉시아·매디와 같은
     * 구간이라 탱커에게도 딜러에게도 필요 없이 빨랐다. 84로 내리고 그 몫을 **체력**으로 옮겼다
     * (1660 → 1828) — 방어를 올리면 위의 "가장 얇은 몸"이 깨지므로, 더 단단해지는 대신
     * **한 번 더 달릴 수 있는 시간**을 준다. 이동 속도 166은 그대로다: 그것이 정체성이다.
     *
     * **1대1 승률이 낮은 것을 고치려 들지 않는다.** 1돌 20렙 검수에서 136판 중 4승(2.9%)으로
     * 로스터 최하인데, 약해서가 아니라 **혼자서는 잴 수 없는 유형**이기 때문이다: 같은 검수의
     * 3대3에서 렉시아·메론과 함께 서면 여덟 판 전승에 한 번도 쓰러지지 않고, 다른 탱커 셋
     * (엘라 11.1초 · 노도니아 10.3초 · 토리카 10.4초)보다 빠른 9.2초로 끝낸다. 어그로와 표적
     * 전환은 아군이 있어야 값이 되는 능력이라 1대1이 그것을 못 잰다 — 승률을 올리겠다고
     * **주문력을 다시 올리지 않는다.** 그 길은 아래 주석대로 이미 한 번 되돌린 적이 있다.
     *
     * 세 스킬이 전부 주문력에서 나오므로 공격력은 쓰지 않는 값이라 낮게 둔다.
     */
    stats: {
      // 공격 속도에서 덜어 낸 몫이 여기로 왔다(1660 → 1828). 방어가 아니라 체력으로 받는
      // 이유는 "탱커 중 가장 얇은 몸"이 이 개체의 계약이기 때문이다.
      hp: 1828,
      def: 62,
      res: 70,
      // 노도니아(46)에 이어 로스터에서 두 번째로 낮다. 세 스킬이 전부 주문력에서 나오므로
      // 이 값은 어디에도 쓰이지 않는다.
      atk: 48,
      /*
       * **주문력을 딜러 자리에 두지 않는다.** 처음에는 152(케리스 180에 이어 2위)로 적었는데,
       * 이 개체는 표적을 계속 돌리고 폭주는 주위를 통째로 지지며 궁극기는 전장 전체를 치므로
       * 같은 주문력이 개체 수만큼 곱해진다 — 표준 5인 파티 재현에서 적 체력의 30%를 혼자
       * 깎아 렉시아(22%)와 스피나(28%)를 넘었다. 탱커 슬롯을 쓰면서 딜러 화력을 내는 자리다.
       *
       * 위력을 낙서를 묻히는 값으로 다시 짠 뒤에는 70까지 내렸다. **남는 몫은 체력으로 간다** —
       * 도발이 평타가 아니라 들어간 피해에 붙어 폭주 중에도 계속 걸리므로 어그로 시간이 2.3초
       * → 5.4초로 늘었는데, 1350짜리 몸으로는 여섯 판 중 셋에서 쓰러졌다.
       */
      ap: 70,
      // 손이 아니라 발이 빠른 개체다. 112는 렉시아·매디와 같은 구간이라 탱커에게도 딜러에게도
      // 필요 없이 빨랐고, 그 몫을 방어·저항으로 옮겨 어그로가 도는 동안 서 있게 했다.
      attackSpeed: 84,
      moveSpeed: 166,
      // 체력은 탱커 중 둘째로 높지만(노도니아 2280 다음) **방어·저항이 로스터 탱커 최저**라,
      // 방어를 곱한 실효 체력은 여전히 넷 중 가장 얇다(2689 · 토리카 3238 · 엘라 3690 ·
      // 노도니아 4241). 맞아도 되는 몸이 아니라 "한 번 더 달릴 수 있는" 몸이다.
      critChance: 10,
      critDamage: 150,
      energyGain: 26,
      lifeSteal: 0,
      ferocityGain: 0,
    },
    ferocityTrait: {
      name: "네가 예술을 알아?",
      effectId: "graffitiRun",
      moveSpeedPercent: 100,
      // 이 폭주가 버는 것은 피해가 아니라 **묻히는 속도**다. 매초 주위 전부에게 낙서 한 겹씩
      // 이 들어가 평타 한 대씩 돌던 것이 한 번에 끝나므로, 피해는 평타보다도 얕게 둔다.
      auraDamagePercent: 25,
      radius: 240,
      vandalism: { kind: "vandalism", offenseShredPercent: 5, maxStacks: 5, burstPower: 125 },
      // 평타를 놓아도 도발은 그대로 걸린다 — 도발이 "때린다"가 아니라 "피해가 들어간다"에
      // 붙어 있어, 달리는 것 자체가 어그로인 개체의 탱킹이 폭주 중에 꺼지지 않는다.
      taunt: { kind: "taunt", seconds: 0.75 },
    },
    passive: {
      // kind가 tagAndRun인 패시브는 passiveDescription()이 구조화 필드로 문장을 만들므로
      // 이 desc는 표시되지 않는 데이터 문서용 사본이다. 수치를 고치면 함수 쪽 분기도 함께 본다.
      id: "deina-passive",
      name: "태그 앤 런",
      kind: "tagAndRun",
      iconAssetId: "skill-icon-buff",
      effectType: "buff",
      // Passive.value는 공용 필수 필드라, 이 패시브에서는 달리는 동안의 궁극기 충전량을 담는다.
      value: 6,
      // 이 개체는 때리는 순간을 빼면 늘 달리고 있어 사실상 상시 충전이다. 그래서 평타 한 번이
      // 주는 26에 견주면 작다 — 나란히 두면 게이지가 두 배 속도로 차 궁극기가 상시기가 된다.
      moveEnergyPerSecond: 6,
      moveFerocityPerSecond: 2.5,
      // 늘 달리는 개체라 남과 부딪히면 그 자리에서 낀다 — 표적을 갈아타러 가는 길이 아군과
      // 적으로 늘 막혀 있기 때문이다. 밀어내기에서 통째로 빠져 그대로 지나간다.
      phasesThroughFighters: true,
      /*
       * 탱커 계약이 요구하는 생존기가 여기 있다. 보호막도 부활도 아닌 이유는 이 개체가
       * **서서 버티는 몸이 아니기** 때문이다 — 방어·저항이 로스터 탱커 최저라 막을 둘러도
       * 그 자리에 머물 수 없고, 도발이 평타가 아니라 들어간 피해에 붙어 지나가는 자리마다
       * 걸린다. 그래서 버티는 값을 **어그로를 끈 수**에 건다: 많이 돌아볼수록 많이 돌아온다.
       *
       * 잃은 체력 비례라 가득 찬 몸에는 한 점도 들어오지 않는다. 5%는 체력 2100 기준으로
       * 절반까지 깎였을 때 한 번에 52 남짓이라, 평타 한 대(초당 0.84회)로는 맞는 속도를
       * 따라잡지 못하고 **여럿을 돌아봤을 때만** 실제로 버틴다.
       *
       * 초당 두 번으로 끊는 이유는 폭주 「네가 예술을 알아?」 때문이다. 그쪽은 매초 반경
       * 240 안의 **모든** 적에게 도발을 걸어, 상한이 없으면 적 다섯을 낀 판에서 초당 다섯
       * 번이 들어와 종이 방어의 탱커가 8초 동안 죽지 않는 몸이 된다. 평상시 평타는 초당
       * 0.84회라 이 상한에 걸리지 않으므로, 깎이는 것은 폭주 몫뿐이다.
       */
      tauntHeal: { missingHpPercent: 5, maxPerSecond: 2 },
      desc: "기본 공격을 낼 때마다 아직 때리지 않은 적으로 표적을 바꾸고, 다른 전투원을 그대로 지나간다. 적을 도발할 때마다 잃은 체력의 5%를 회복한다.",
    },
    basic: {
      id: "deina-basic",
      name: "치익, 칙!",
      /*
       * 「톡 톡 치고 다닌다」가 그대로 수치다. 표적을 매 타격마다 바꾸므로 같은 위력이 적
       * 수만큼 곱해져, 단일 대상 기준으로 읽고 적으면 실제로는 그 몇 배가 된다.
       *
       * **이 한 방의 값은 피해가 아니라 낙서와 도발이다.** 그래서 로스터 최저 수준까지 내려
       * 둔다 — 여기를 올리면 낙서를 묻히러 다니는 개체가 아니라 빠른 마법 딜러가 된다.
       */
      power: 35,
      scalingStat: "ap",
      iconAssetId: "skill-icon-magical",
      effectType: "magical",
      damageType: "magical",
      targeting: "single",
      /*
       * **낙서는 시간으로 지워지지 않는다.** 표적을 매 타격마다 갈아타는 개체라 시계를 달면
       * 한 바퀴를 돌고 돌아왔을 때 이미 말라, 몇 겹을 칠하든 영영 1~2겹에 머문다(유지 시간
       * 8초로 두고 재현했을 때 표준 전투에서 최대 4겹이었고 평타만으로는 한 번도 터지지
       * 않았다). 지우는 것은 시간이 아니라 다섯 겹째에 터지는 것뿐이다.
       *
       * 도발은 0.75초뿐이다. 붙잡아 두려는 것이 아니라 "잠깐 이쪽을 보게 해 놓고 빠지는" 것이
       * 이 개체의 탱킹이라, 길게 걸면 종이 방어로 그 시간을 다 맞는다.
       */
      statusEffects: [
        { kind: "vandalism", offenseShredPercent: 5, maxStacks: 5, burstPower: 125 },
        { kind: "taunt", seconds: 0.75 },
      ],
    },
    ultimate: {
      id: "deina-ult",
      name: "펑크 아트 180",
      /*
       * `channel`이 있으므로 이 위력은 총량이 아니라 **한 틱**의 몫이다.
       *
       * **이 궁극기가 사는 이유는 피해가 아니라 전장 전체를 한 번에 칠하는 것이다.** 5초 동안
       * 매초 한 겹씩, 즉 한 번의 시전이 살아 있는 모든 적을 상한까지 칠해 터뜨린다. 그래서
       * 위력은 케리스(120% 즉발)의 절반도 되지 않는 총 75%만 두고, 값은 낙서와 기절이 갖는다.
       */
      power: 24,
      scalingStat: "ap",
      iconAssetId: "skill-icon-magical",
      effectType: "magical",
      damageType: "magical",
      /*
       * **260으로 두면 한 판에 한 번도 나가지 않는다.** 폭주 중에는 때리지 않아 평타 충전이
       * 통째로 멈추고(한 판의 20~40%가 폭주다), 달리며 차는 몫은 매초 6뿐이라 13~15초짜리
       * 표준 전투에서 게이지가 257에서 끝났다. 220이면 10~11초에 한 번 나가 마무리로 선다 —
       * 전장 광역인 케리스(200)보다 위, 메론(260)보다 아래라는 자리도 그대로다.
       */
      cost: 90,
      targeting: "battlefieldEnemies",
      channel: {
        seconds: 5,
        // 전장이 한꺼번에 받는 틱과 달리, 이쪽은 그 5초 안에 실제로 손이 닿은 적만 받는다.
        basicStatusEffects: [{ kind: "stun", seconds: 1 }],
      },
      statusEffects: [{ kind: "vandalism", offenseShredPercent: 5, maxStacks: 5, burstPower: 125 }],
    },
  },
  {
    id: "maddy",
    squad: "rune",
    name: "매디",
    specimenNumber: "096",
    projectName: "PERMAFROST COAT",
    excavationSite: "러시아 사하 공화국 콜리마강 영구동토층",
    // 발굴 기록은 장소·보존 상태·복원 연구 특징만 담고, 복원 이후 생활 관찰과 분리한다.
    fossilRecord: "얼어붙은 강기슭이 무너지며 드러난 냉동 개체다. 두꺼운 털가죽이 얼음 속에 그대로 눌어붙어 있어, 복원 연구는 해동 속도를 늦추는 데 가장 오래 매달렸다.",
    observationProfile: {
      originYear: "약 1만 년 전",
      // 냉방을 세게 틀었다가 혼나고도 굽히지 않는 배짱과 어린 장난기를 함께 두어 E.C. 15년으로 둔다.
      restorationYear: "E.C. 15년",
      lifeStage: "성체",
      height: "1.52 m",
      weight: "39 kg",
    },
    catalogSummary: "신장 1.52m, 체중 39kg의 가늘고 마른 인간형 체격에 몸을 통째로 감싸는 두꺼운 흰 모피와 작게 말린 한 쌍의 엄니가 확인된 성체 매머드 화석 기반 표본.",
    unlockRecord: { status: "recorded", text: "매디는 더위를 못 견뎌 늘 아이스크림을 입에 물고 다니고, 연구소 냉장고를 제 것인 양 아이스크림으로 가득 채워 둔다. 냉방을 세게 틀었다가 연구원 씨에게 몇 번을 혼나도 다음 날이면 온도를 또 최저로 내려놓는다. 몸집에 안 맞게 가는 팔다리로 커다란 모피를 여미며 걷는 모습이 자꾸 눈이 간다." },
    // 저온 보존실을 제집처럼 여기고 관리하는 모습이 사일런트 룬의 임무(메인프레임 저온 보존실 관리)와
    // role(warrior)의 어긋남을 서사로 메운다 — 방어·저항을 스스로 두르는 폭주도 "버티며 지키는" 룬의 결과 맞는다.
    squadNote: "룬의 저온 보존실 냉장고를 아이스크림으로 채우는 자칭 관리인. 온도를 최저로 내려 선배들을 떨게 해 놓고는 정작 모피 코트 속에서 제일 먼저 존다.",
    researcherTitle: "연구원 씨",
    rarity: "SR",
    portraitAssetId: "maddy",
    origin: "매머드",
    element: "water",
    role: "warrior",
    // 엄니와 모피를 휘두르는 근접형이다.
    reachTier: "melee",
    excavationTrait: { primaryCurrency: "cheesecake", baseProductionPerHour: 2.16, efficiencyMultiplier: 1.09 },
    // SSR 시절의 방어형 전사 윤곽은 유지하되, SR 띠에 맞춰 주 능력치를 약 6~10% 낮춘다.
    // 공속·이속은 전투에서 보이는 개체 정체성이므로 그대로 두고 전투력 2304로 완화한다.
    stats: {
      hp: 980,
      def: 82,
      res: 82,
      atk: 136,
      ap: 64,
      attackSpeed: 100,
      moveSpeed: 90,
      critChance: 10,
      critDamage: 150,
      energyGain: 26,
      lifeSteal: 0,
      ferocityGain: 0,
    },
    ferocityTrait: { name: "모피", effectId: "furCoat", cleanseAllOnEntry: true, shieldMaxHpPercent: 25, defenseResistancePercent: 100 },
    passive: {
      // kind가 frostboundDominion인 패시브는 passiveDescription()이 구조화 필드로 문장을 만드므로
      // 이 desc는 표시되지 않는 데이터 문서용 사본이다. 수치를 고치면 함수 쪽 분기도 함께 본다.
      id: "maddy-passive",
      name: "설원의 지배자",
      kind: "frostboundDominion",
      iconAssetId: "skill-icon-buff",
      effectType: "buff",
      value: 0,
      elementOverride: "ice",
      freezeAtMaxChill: true,
      desc: "상성 계산에서 물이 아닌 얼음으로 취급된다. 얼음은 풀·물·땅에 유리하고 불에 불리하며 바람과는 무상성이다. 이미 둔화가 최대 중첩인 적을 때리면 그 겹을 모두 소모해 빙결시킨다.",
    },
    basic: {
      id: "maddy-basic",
      name: "소다맛 아이스크림",
      power: 100,
      scalingStat: "atk",
      iconAssetId: "skill-icon-physical",
      effectType: "physical",
      damageType: "physical",
      targeting: "single",
      statusEffects: [{ kind: "chill", speedPercentPerStack: 5, maxStacks: 3 }],
      // 빙결 상태의 적에게만 붙는 조건부 흡혈이다 — 평소에는 흡혈 없이 그냥 때린다.
      damageHealingPercentIfFrozen: 30,
    },
    ultimate: {
      id: "maddy-ult",
      name: "파워 냉방으로 부탁드려요.",
      /*
       * `channel`이 있으므로 이 위력은 총량이 아니라 **한 틱**의 몫이다. 5초 동안 매초 전장
       * 전체에 터져 총 175%가 되며, 틱마다 둔화도 함께 쌓여 시전 한 번으로 최대 중첩(3겹)에
       * 닿고 그 뒤로도 계속 얼려 둔다.
       */
      power: 35,
      scalingStat: "ap",
      iconAssetId: "skill-icon-magical",
      effectType: "magical",
      damageType: "magical",
      cost: 190,
      targeting: "battlefieldEnemies",
      channel: { seconds: 5 },
      statusEffects: [{ kind: "chill", speedPercentPerStack: 5, maxStacks: 3 }],
    },
  },
  {
    id: "terisa",
    squad: "rune",
    name: "테리사",
    specimenNumber: "078",
    projectName: "SILENT SUTURE",
    excavationSite: "몽골 네메그트층 알탄울라 사면",
    // 발굴 기록은 장소·보존 상태·복원 연구 특징만 담고, 복원 이후 생활 관찰과 분리한다.
    fossilRecord: "사면이 무너진 자리에서 앞발 한 쌍만 온전히 드러났다. 1m에 가까운 손톱 뼈가 세 개씩 나란히 남아 있었고, 끝이 부러지지 않은 표본은 이것이 처음이다.",
    observationProfile: {
      originYear: "약 7천만 년 전",
      // E.C.는 테리사의 인간형 신체 나잇대이며, 케어실에서 남을 돌보는 위치에 맞춰 20년대 직전에 둔다.
      restorationYear: "E.C. 19년",
      lifeStage: "성체",
      height: "1.72 m",
      weight: "50 kg",
    },
    catalogSummary: "신장 1.72m, 체중 50kg의 인간형 체격에 손가락마다 길게 뻗은 낫 모양 갈퀴가 확인된 성체 테리지노사우루스 화석 기반 표본.",
    unlockRecord: { status: "recorded", text: "테리사는 말을 아끼고 대신 손을 움직인다. 파장이 튄 개체가 케어실에 실려 오면 아무것도 묻지 않고 찢어진 자리부터 꿰매 놓는데, 실이 모자라면 제 수도복 자락을 갈퀴로 그어 뜯어 쓴다. 그 갈퀴로 남을 다치게 한 기록은 아직 없다. 다 꿰맨 뒤에는 송곳니를 드러내고 웃으며 다음 사람을 부른다." },
    squadNote: "사일런트 룬의 재봉 담당. 케어실에 실려 온 개체의 옷과 몸을 말없이 꿰매고, 실이 떨어지면 제 수도복을 그어 뜯어 쓴다.",
    researcherTitle: "아가",
    rarity: "SR",
    portraitAssetId: "terisa",
    origin: "테리지노사우루스",
    // 불은 갈퀴를 달궈 지지는 쪽에서 온다 — 자르는 손과 지혈하는 손이 같은 손이다.
    element: "fire",
    role: "support",
    // 제 손으로 직접 잘라야 아군이 꿰매지므로 적 한가운데로 파고드는 지원가다.
    reachTier: "melee",
    excavationTrait: { primaryCurrency: "cheesecake", baseProductionPerHour: 2.04, efficiencyMultiplier: 1.08 },
    /*
     * 근거리 지원가라 전사보다 두껍고 탱커보다는 얇은 자리에 선다(전투력 2303, SR 띠 안).
     *
     * 화력을 전사보다 낮게 두어도 손해가 아닌 이유는 「가봉」이 **피해의 비율**을 옮기기
     * 때문이다 — 값어치가 공격력이 아니라 **얼마나 자주 자르느냐**에서 나오므로 공속을
     * 로스터 상위에 두고, 수도복을 끌고 걷는 개체라 이속은 하위에 둔다.
     * 주문력을 쓰는 스킬이 하나도 없어 낮게 둔다.
     */
    stats: {
      hp: 1220,
      def: 92,
      res: 78,
      atk: 116,
      ap: 38,
      attackSpeed: 108,
      moveSpeed: 88,
      critChance: 10,
      critDamage: 150,
      energyGain: 26,
      lifeSteal: 0,
      ferocityGain: 0,
    },
    // 수치를 여기 적지 않는다 — 옮기는 비율과 상한은 「가봉」 하나가 갖고, 폭주는 그 몫이
    // 보호막으로 가는지 회복으로 가는지만 바꾼다.
    ferocityTrait: { name: "지짐", effectId: "cautery", attackSpeedPercent: 40 },
    passive: {
      // kind가 sutureStitch인 패시브는 passiveDescription()이 구조화 필드로 문장을 만드므로
      // 이 desc는 표시되지 않는 데이터 문서용 사본이다. 수치를 고치면 함수 쪽 분기도 함께 본다.
      id: "terisa-passive",
      name: "가봉(假縫)",
      kind: "sutureStitch",
      iconAssetId: "skill-icon-buff",
      effectType: "buff",
      value: 0,
      suture: { damagePercent: 40, maxHpCapPercent: 25 },
      desc: "기본 공격이 적중할 때마다 그 피해의 40%만큼 자신을 포함해 현재 HP 비율이 가장 낮은 생존 아군에게 보호막을 부여한다. 한 번에 부여하는 보호막은 그 아군 최대 체력의 25%를 넘지 않는다.",
    },
    basic: {
      id: "terisa-basic",
      name: "가위질",
      power: 55,
      scalingStat: "atk",
      iconAssetId: "skill-icon-physical",
      effectType: "physical",
      damageType: "physical",
      targeting: "single",
      /*
       * 세 걸음이 저마다 다른 일을 한다 — 겉감은 그냥 긋고, 안감은 **제 몫**을 덧대고,
       * 엇갈려 자르기는 둘레를 한 번에 벤다. 마지막 걸음이 광역인 이유는 「가봉」이 적중마다
       * 구르기 때문이다: 여럿을 한 번에 그으면 그만큼 여러 번 꿰매져 순환 끝에서 팀이
       * 두꺼워진다. 위력을 낮춰 둔 것이 그 몫의 값이다.
       */
      cycle: [
        /*
         * 첫 걸음만 **짧게 사라진다.** 앞에 서야 실이 도는 개체인데 그 자리에서 계속 맞고만
         * 있으면 꿰매기 전에 먼저 쓰러진다 — 순환 한 바퀴마다 어그로를 한 번 끊어 준다.
         * 0.5초인 이유는 표적을 흩기에는 충분하고 한 대를 통째로 거르기에는 짧기 때문이다.
         */
        { name: "겉감", power: 55, selfStealthSeconds: 0.5 },
        { name: "안감", power: 55, shieldFromDamagePercent: 50 },
        { name: "엇갈려 자르기", power: 40, targeting: "nearbyEnemies", radius: 150 },
      ],
    },
    ultimate: {
      id: "terisa-ult",
      name: "성의(聖衣)",
      power: 140,
      scalingStat: "atk",
      iconAssetId: "skill-icon-physical",
      effectType: "physical",
      damageType: "physical",
      cost: 110,
      targeting: "nearbyEnemies",
      radius: 200,
      // 한 번에 여럿을 벨수록 팀이 두꺼워지는 것이 이 궁극기의 전부다. 그래서 적 한가운데로
      // 파고들 이유가 생기고, 그것이 이 지원가가 근거리인 두 번째 이유다.
      allyShieldFromDamagePercent: 90,
    },
  },
  {
    id: "parua",
    squad: "rogue",
    name: "파루아",
    specimenNumber: "034",
    projectName: "QUIET CREST",
    excavationSite: "뉴멕시코 커틀랜드층 상부 사암",
    // 발굴 기록은 장소·보존 상태·복원 연구 특징만 담고, 복원 이후 생활 관찰과 분리한다.
    fossilRecord: "사암이 무너진 자리에서 뒤로 길게 뻗은 볏이 통째로 드러났다. 속이 빈 관이 두개골까지 이어져 있었고, 복원 연구진이 그 관에 바람을 통과시키자 사람 목소리에 가까운 낮은 울림이 나왔다.",
    observationProfile: {
      originYear: "약 7,500만 년 전",
      // 또래보다 반걸음 물러서 있지만 제 몫은 끝까지 해내는 중학생 또래의 외형·정서에 맞춘다.
      restorationYear: "E.C. 13년",
      lifeStage: "아성체",
      height: "1.45 m",
      weight: "38 kg",
    },
    catalogSummary: "신장 1.45m, 체중 38kg의 가늘고 긴 인간형 체격에 뒤로 뻗은 속 빈 볏과, 시위를 오래 당겨도 떨리지 않는 긴 손가락이 확인된 아성체 파라사우롤로푸스 표본.",
    unlockRecord: { status: "recorded", text: "파루아는 말을 걸면 먼저 한 걸음 물러선다. 그러면서도 시선은 늘 상대의 뒤쪽 먼 곳을 훑고 있어, 누가 다가오는지 가장 먼저 아는 것은 언제나 이 아이다. 활을 들면 그 물러섬이 사라진다 — 숨을 멈추고 한참을 겨누다가 놓는데, 놓은 뒤에는 맞았는지 보지도 않고 다음 화살을 뽑는다. 간식을 나눠 줄 때는 제 몫을 가장 작게 덜고, 남는 것이 생기면 아무 말 없이 다른 아이 접시에 올려 둔다." },
    squadNote: "쁘띠 로그의 눈. 탐험대가 몰려다니는 동안 혼자 뒤에 남아 오던 길과 그 너머를 살피고, 무언가 보이면 소리치는 대신 조용히 대장님의 소매를 잡아당긴다.",
    // 목소리를 크게 내지 못하는 아이라 스쿼드가 쓰는 호칭 중 가장 짧고 부르기 쉬운 쪽을 고른다.
    researcherTitle: "대장님",
    rarity: "R",
    portraitAssetId: "parua",
    origin: "파라사우롤로푸스",
    element: "grass",
    role: "assassin",
    // 로스터에서 세 번째 원거리 개체이며, 사거리는 집중이 자라면서 함께 늘어난다.
    reachTier: "ranged",
    excavationTrait: { primaryCurrency: "gold", baseProductionPerHour: 105, efficiencyMultiplier: 1.06 },
    /*
     * **공격력에 전부 몰아준 유리몸이다.** 체력·방어·저항이 로스터 최하급이고 공격력은 SR
     * 루카(136)보다 높다 — 600 뒤에서 쏘는 대신 붙으면 곧바로 무너지는 자리다.
     *
     * 주문력 44는 일부러 낮다. 세 스킬이 전부 물리 평타에서 나오므로 주문력을 쓰는 곳이
     * 하나도 없고, 쓰지 않는 값을 높게 적으면 실전에 없는 힘이 전투력만 부풀린다.
     *
     * 이동 속도 62는 로스터 최하다. 활은 자세를 잡아야 쏘고, 그래서 **걸어가지 않고 사거리를
     * 늘려 닿는다**는 이 개체의 성장 축이 능력치에서도 그대로 읽힌다.
     */
    stats: {
      hp: 780,
      def: 50,
      res: 56,
      atk: 158,
      ap: 44,
      attackSpeed: 118,
      moveSpeed: 62,
      critChance: 10,
      critDamage: 150,
      energyGain: 26,
      lifeSteal: 0,
      ferocityGain: 0,
    },
    // 폭주는 **거리**를 갖는다. 궁극기가 속도를 갖고 있어, 둘 다 공속을 올리면 두 슬롯이
    // 화면에서 같은 말을 한다. 순환을 기다리지 않는 갈래화살과 사거리가 함께 붙는다.
    ferocityTrait: { name: "멀리… 멀리요!", effectId: "splitVolley", reachBonus: 200 },
    passive: {
      id: "parua-passive",
      name: "나무가 아닌 숲을!",
      kind: "farthestFocus",
      iconAssetId: "skill-icon-buff",
      effectType: "buff",
      // 겹당 오르는 공격력(%). 겹당 사거리와 상한은 코어의 `FOCUS` 한 표가 갖는다.
      value: 2,
      // 태생 치명타는 전 개체 공통이므로 암살자의 치명타형 정체성은 패시브가 만든다.
      // 갈래화살이 한 행동에 셋을 판정하므로 렉시아(25)·루카(15)보다 낮게 잡는다.
      criticalChancePercent: 12,
      /*
       * **위기에 숨되 쌓은 것을 치른다.** 암살자 계약이 요구하는 은신이 여기 있다.
       *
       * 여는 은신(전투 시작 N초)으로 두었다가 걷어 냈다. 이 개체가 **바닥 로스터의 유일한
       * 딜러**라, 시작하자마자 무방비로 집중을 쌓게 두면 0.5초짜리로도 1장이 통째로 열렸다
       * (1-7·1-9 승률 0.000 → 1.000). 숨는 시점을 **시작이 아니라 위기**로 옮기면 그 은신이
       * 성장 구간이 아니라 도망 구간이 된다.
       *
       * 집중을 모두 잃는 것이 그 대가다. 쏠수록 공격력과 사거리가 함께 자라는 개체라, 숨는
       * 값이 공짜면 "위험해지면 숨고 계속 세진다"가 되어 낮은 생존력이라는 전제가 사라진다 —
       * 살아남되 처음부터 다시 쌓는다.
       */
      lowHpStealth: { hpPercent: 40, seconds: 4, spendsFocus: true },
      // 전용 분기가 있으므로 화면에는 이 문장이 아니라 `passiveDescription`이 지은 것이 뜬다.
      // 여기 사본은 데이터만 읽는 사람을 위한 것이라, 분기를 고칠 때 함께 고친다.
      desc: "사거리 안에서 가장 먼 적을 노리고, 적중할 때마다 집중을 얻어 공격력과 사거리가 오른다. 전투당 한 번, 체력이 40% 이하가 되면 집중을 모두 잃는 대신 4초 동안 은신한다.",
    },
    basic: {
      id: "parua-basic",
      name: "신중한 일격...! 이에요...",
      // 순환이 위력과 대상을 걸음마다 정하므로 이 값은 쓰이지 않는 기본값이다.
      power: 90,
      iconAssetId: "skill-icon-physical",
      effectType: "physical",
      damageType: "physical",
      targeting: "single",
      /*
       * 두 번 겨누고 세 번째에 가른다. 갈래화살은 **반경이 아니라 인원**으로 끊으므로 적이
       * 얼마나 몰려 있든 화살은 늘 셋으로 갈라지고, 중심이 시전자가 아니라 표적이라 600 뒤에
       * 선 개체도 실제로 맞힌다.
       */
      cycle: [
        { name: "신중한 일격...! 이에요...", power: 90 },
        { name: "신중한 일격...! 이에요...", power: 90 },
        { name: "갈래화살", keywordId: "split-arrow", power: 45, targeting: "splitShot", maxTargets: 3 },
      ],
    } satisfies BasicAttack,
    ultimate: {
      id: "parua-ult",
      name: "이제, 숲이 보여요",
      iconAssetId: "skill-icon-buff",
      effectType: "buff",
      cost: 150,
      // 아무도 때리지 않는다. 5초 동안 손이 달라지는 것이 전부이고 피해는 그 손들의 몫이다.
      targeting: "self",
      /*
       * 갈래화살을 상시로 켜지 않는다 — 그것은 폭주의 몫이다. 연격의 두 타격이 같은 걸음을
       * 쓰므로 갈래화살 차례가 오면 **두 발이 함께 갈라지고**, 그 한 순간이 이 궁극기의 절정이다.
       */
      selfVolley: { seconds: 5, hitCount: 2, attackSpeedPercent: 40 },
    },
  },
  {
    id: "shute",
    squad: "eye",
    name: "슈테",
    specimenNumber: "205",
    projectName: "DUO RANK",
    excavationSite: "미국 콜로라도 모리슨층 제3채석장",
    // 발굴 기록은 장소·보존 상태·복원 연구 특징만 담고, 복원 이후 생활 관찰과 분리한다.
    fossilRecord: "채석장 바닥의 이암에 등판 열일곱 장이 무너지지 않고 두 줄로 늘어선 채 남아 있었다. 판마다 혈관이 지나간 홈이 촘촘해, 복원 연구는 그 홈이 열을 버리는 길인지 신호를 보내는 길인지부터 갈라야 했다.",
    observationProfile: {
      originYear: "약 1억 5천만 년 전",
      // 말수가 적고 화면 앞에서만 길게 말하는 또래의 외형·정서에 맞춰 E.C. 15년으로 둔다.
      restorationYear: "E.C. 15년",
      lifeStage: "아성체",
      height: "1.46 m",
      weight: "39 kg",
    },
    catalogSummary: "신장 1.46m, 체중 39kg의 인간형 체격에 신호를 실어 보내는 등판 두 줄과 네 갈래 꼬리 가시가 확인된 아성체 스테고사우루스 표본.",
    unlockRecord: { status: "recorded", text: "슈테는 관제탑에 올라오지 않는다. 제 방에 화면을 여덟 장 띄워 놓고 거기서 전장을 본다. 말을 걸면 대답이 한 박자 늦고 대체로 짧지만, 한 명을 정해 놓고는 그 한 명에게만 끝없이 말한다 — 어디로 돌아라, 지금 들어가라, 그거 아니라니까. 등판은 그때 색이 돈다. 판이 밝아진 방향에 정확히 그 아이가 보고 있는 곳이 있어, 시그널 아이 선임들은 슈테의 등을 보고 전황을 읽는 법을 따로 익혔다. 잘했다고 하면 화면 쪽으로 고개를 돌리고 그럭저럭이라고만 한다." },
    squadNote: "시그널 아이의 전담 오더. 광역 관측을 나눠 맡는 다른 담당들과 달리 한 판에 한 명만 붙잡고 끝까지 따라다니며, 그 한 명이 쓰러지면 남은 시간 동안 아무 신호도 내지 않는다.",
    // 관제 절차를 통째로 외워 오는 개체라 스쿼드가 지시자에게 쓰는 호칭을 그대로 연구원에게 돌린다.
    researcherTitle: "오더",
    rarity: "SSR",
    portraitAssetId: "shute",
    origin: "스테고사우루스",
    element: "earth",
    role: "support",
    // 듀오 곁에 붙어 다니되 듀오보다 앞에 서지 않는 자리다.
    reachTier: "mid",
    // 관측 기록을 그대로 자산으로 바꾸는 담당이라 발굴 특화도 다이아 쪽에 붙인다.
    excavationTrait: { primaryCurrency: "gems", baseProductionPerHour: 0.52, efficiencyMultiplier: 1.13 },
    /*
     * **모든 스킬이 주문력에서 나온다.** 평타도 약점 포착의 추가 피해도 주문력 하나를 읽으므로
     * 공격력은 로스터 최하로 둔다 — 쓰지 않는 값을 높게 적으면 실전에 없는 힘이 전투력만 부풀린다.
     *
     * 이동 속도 96은 느린 편이다. 스테고사우루스는 원래 빠른 개체가 아니고, 혼자서는 전장을
     * 따라다니지 못한다는 것이 이 개체가 **붙어 다니는 이유**다. 다만 듀오를 놓칠 만큼 느리면
     * 평타가 통째로 비므로 따라붙을 만큼은 준다.
     */
    stats: {
      hp: 1000,
      def: 62,
      res: 108,
      atk: 48,
      ap: 172,
      attackSpeed: 108,
      moveSpeed: 96,
      critChance: 10,
      critDamage: 150,
      energyGain: 26,
      lifeSteal: 0,
      ferocityGain: 0,
    },
    // 폭주는 슈테 자신이 세지는 것이 아니라 **듀오를 밀어 넣는다.** 지원가의 폭주가 제 화력을
    // 올리면 그 순간만 지원가가 아니게 된다.
    ferocityTrait: {
      name: "그거 아니라니까?",
      effectId: "duoBreakthrough",
      chargeRadius: 120,
      // 파치가 때려서 날리는 것과 같은 궤적이되 한 뼘 짧다 — 밀어붙이는 길을 여는 것이지
      // 전장 밖으로 치우는 것이 아니다.
      knockback: { seconds: 1.1, speed: 1600, bounces: 2 },
      allyRegenFromDuoDamagePercent: 5,
    },
    passive: {
      // kind가 duoLink인 패시브는 passiveDescription()이 구조화 필드로 다시 문장을 만들므로
      // 이 desc는 표시되지 않는 데이터 문서용 사본이다. 수치를 고치면 함수 쪽 분기도 함께 본다.
      id: "shute-passive",
      name: "듀오 랭크",
      kind: "duoLink",
      iconAssetId: "skill-icon-buff",
      effectType: "buff",
      // 은신 경계는 듀오의 현재 체력 비율이다. 표시에도 이 값을 그대로 쓴다.
      value: 50,
      duoLink: { followDistance: 180, syncSeconds: 2 },
      desc: "전투 시작 시 한 번, 바로 왼쪽에 선 아군과 듀오를 맺어 그 곁에 붙어 다니고 듀오의 표적을 함께 노린다. 듀오의 체력이 50% 이상인 동안 은신한다.",
    },
    basic: {
      id: "shute-basic",
      name: "공격 핑",
      power: 50,
      iconAssetId: "skill-icon-magical",
      effectType: "magical",
      damageType: "magical",
      targeting: "single",
      // 지원가의 값어치는 제 피해가 아니라 듀오의 궁극기와 폭주가 얼마나 빨리 돌아오느냐다.
      duoCharge: { energy: 5, ferocity: 5 },
      // 세 걸음마다 한 번만 찍는다. 매 타격마다 찍으면 표식이 상시 강화가 되어 주기가 뜻을 잃는다.
      statusEffectEvery: 3,
      statusEffects: [{ kind: "weakpoint", burstPower: 120, duoHealPercent: 50 }],
    },
    ultimate: {
      id: "shute-ult",
      name: "오더 좀 들어라!",
      iconAssetId: "skill-icon-buff",
      effectType: "buff",
      cost: 210,
      // 피해도 회복도 없는 순수 지원 궁극기이며, 전장 전체가 아니라 듀오 한 명에게만 걸린다.
      targeting: "duo",
      teamBuff: { kind: "order", attackSpeedPercent: 50, criticalChancePoints: 25, lifeStealPoints: 25, seconds: 6 },
    },
  },

  {
    id: "morphe",
    squad: "eye",
    name: "모르페",
    specimenNumber: "206",
    projectName: "CRADLE SIGNAL",
    excavationSite: "영국 도싯 라임리지스 해안 이암층",
    // 발굴 기록은 장소·보존 상태·복원 연구 특징만 담고, 복원 이후 생활 관찰과 분리한다.
    fossilRecord: "해안 이암이 앞다리 비막의 실루엣까지 눌러 남겼다. 뼈 속이 비어 있어 복원 연구는 그 공동이 무게를 줄이는 길인지 소리를 키우는 길인지부터 갈라야 했다.",
    observationProfile: {
      originYear: "약 1억 9천만 년 전",
      // 또래보다 말수가 적고 반응이 한 박자 느린 정서, 그러나 판단은 가장 빠른 축에 맞춰 E.C. 17년으로 둔다.
      restorationYear: "E.C. 17년",
      lifeStage: "성체",
      height: "1.57 m",
      weight: "41 kg",
    },
    catalogSummary: "신장 1.57m, 체중 41kg의 인간형 체격에 앞다리에서 이어지는 얇은 비막과 짧은 뿔부리가 확인된 성체 디몰포돈 표본.",
    unlockRecord: { status: "recorded", text: "모르페는 제 요람에서 내려오지 않는다. 관제실이 내준 의자를 통째로 제 자리로 바꿔 놓고, 등받이를 끝까지 젖힌 채 천장에 띄운 드론들을 본다. 부르면 대답은 하는데 늘 한 박자 늦고 대체로 짧다. 그런데 드론이 움직이는 속도는 그 말투와 정반대라, 세 기가 각자 다른 통로를 동시에 맡는 것을 보고 관제탑 선임들이 손을 놓은 적이 여러 번이다. 직접 걷는 일은 거의 없다 — 어디를 봐야 하느냐고 물으면 천장을 가리키고, 그러면 이미 그곳에 드론이 가 있다." },
    squadNote: "시그널 아이의 드론 관제. 고공 정찰을 사람이 나가지 않고 끝내는 유일한 담당이라, 다른 척후들이 오르던 환기구 순찰이 이 개체가 온 뒤로 절반으로 줄었다.",
    // 직접 오르내리지 않고 화면으로만 상대하는 개체라 스쿼드에서 가장 사무적인 호칭을 쓴다.
    researcherTitle: "담당관",
    rarity: "SSR",
    portraitAssetId: "morphe",
    origin: "디몰포돈",
    element: "wind",
    /*
     * **SSR 전사는 렉시아 하나뿐이었다.** SSR 열 종 중 암살자·지원가·탱커가 셋씩인데 전사만
     * 하나라, 등급을 올려도 "지속 교전"을 맡을 개체가 사실상 고정이었다. 바람 SSR도 노도니아
     * (탱커) 하나뿐이었으므로 두 구멍이 한 개체로 메워진다.
     */
    role: "warrior",
    // 본인이 나가는 것이 아니라 드론이 나간다. 사거리는 그 비막이 닿는 거리다.
    reachTier: "ranged",
    /*
     * 고공에서 노출 지점을 찍어 주는 담당이라 발굴 특화는 화석 쪽이다.
     *
     * 다이아로 두었다가 옮겼다 — 유료 재화는 무과금 공급을 하루 20개대로 묶어 두는데
     * (`idleExcavation` 검수 띠), 슈테·도디에 이어 셋째 다이아 특화가 서면 그 띠를 넘는다.
     * 값도 화석 상위 셋(엘라·노도니아·메테)에는 못 미치게 잡아 기존 공급 총량을 건드리지 않는다.
     */
    excavationTrait: { primaryCurrency: "rawStone", baseProductionPerHour: 1.18, efficiencyMultiplier: 1.10 },
    /*
     * 전투력 2397로 SSR 띠(2340~2460) 한가운데다.
     *
     * **이동 속도 52는 로스터 최저다.** 요람 의자에서 내려오지 않는 개체라 그 자리가 곧 정체성
     * 이고, 화면에서도 혼자 거의 제자리에 선다 — 대신 사거리가 원거리 등급이라 움직이지 않아도
     * 닿는다. 파루아(62)보다 낮은 값을 준 이유는 그쪽은 "느리게나마 걷는" 개체이고 이쪽은
     * **걷지 않는** 개체이기 때문이다.
     *
     * **주문력 24는 쓰는 스킬이 하나도 없어 로스터 최저다.** 모든 피해가 공격력에서 나오므로
     * 쓰지 않는 값을 높게 적어 전투력만 부풀리지 않는다(스테라에서 한 번 겪은 함정이다).
     */
    stats: {
      hp: 1120,
      def: 80,
      res: 96,
      atk: 172,
      ap: 24,
      attackSpeed: 118,
      moveSpeed: 52,
      critChance: 10,
      critDamage: 150,
      energyGain: 26,
      lifeSteal: 0,
      ferocityGain: 0,
    },
    /*
     * **네 슬롯은 아직 임시다.** 드론 관제라는 정체성을 전투로 옮기려면 전용 메커니즘이 필요한데,
     * 그 메커니즘은 뒤에 올 드론 개체들과 함께 한 번에 짜는 편이 낫다 — 이 개체 하나를 위해
     * 계약을 세우면 둘째 개체에서 다시 갈아엎게 된다. 그래서 지금은 **공용 계약만으로** 세운다.
     *
     * 프로필·능력치·소속·원화는 확정이고, 여기 넷만 나중에 갈아 끼운다. 다만 임시라도
     * **직군 계약은 지킨다** — 전사의 자가 수급이 패시브에 있고, 은신은 없다.
     */
    ferocityTrait: { name: "다 띄워.", effectId: "selfAttackSpeedMultiplier", bonusPercent: 40 },
    passive: {
      id: "morphe-passive",
      name: "요람에서 내려올 생각 없음",
      /*
       * 전사 계약이 요구하는 자가 수급이다. 토리카와 같은 공용 계약을 쓰되, 원거리에서 드론만
       * 내보내는 개체라 값은 그쪽(초당 3.5%·5초)보다 얕게 둔다.
       */
      kind: "emergencyRecovery",
      iconAssetId: "skill-icon-healing",
      effectType: "healing",
      value: 2.5,
      durationSeconds: 5,
      // 전용 분기가 없는 종류라 이 문장이 그대로 화면에 선다.
      desc: "전투당 한 번, 체력이 절반 이하가 되면 요람이 5초 동안 매초 최대 체력의 2.5%를 되돌린다.",
      /*
       * 태생 치명타는 전 개체 공통이므로 "왜 이 개체가 치명타형인가"의 답은 늘 패시브에 있다.
       * 12는 스피나(10)·파루아(12)와 같은 구간이고 렉시아(25)·디안(20)보다 낮다.
       */
      criticalChancePercent: 12,
    },
    basic: {
      id: "morphe-basic",
      name: "산개 사격",
      // 임시 수치다. 원거리 단일 물리 평타이며, 드론이 대신 나간다는 것은 아직 이름과 원화가 맡는다.
      power: 95,
      iconAssetId: "skill-icon-physical",
      effectType: "physical",
      damageType: "physical",
      targeting: "single",
    },
    ultimate: {
      id: "morphe-ult",
      name: "전부, 한 점으로",
      // 임시 수치다. 흩어져 있던 드론이 한 명에게 모이는 그림이라 단일 대상 한 방으로 둔다.
      power: 300,
      iconAssetId: "skill-icon-physical",
      effectType: "physical",
      damageType: "physical",
      cost: 120,
      targeting: "single",
      statusEffects: [{ kind: "stagger", seconds: 0.1 }],
    },
  },

  {
    /**
     * 디안 한 명만 성장 주체다. 쿠로·시로는 제 `RelicDef`를 온전히 갖되 `summonOnly`로 표시해
     * 가챠·도감·편성에 서지 않고, 전투에 설 때 태생 능력치만 디안의 성장에서 파생한다.
     */
    id: "dian",
    squad: "rogue",
    name: "디안",
    specimenNumber: "221",
    projectName: "PACK ECHO",
    excavationSite: "북아메리카 란초 라브레아 타르층",
    fossilRecord: "한 개체 전체가 아니라 무리의 중심에 묻힌 우두머리 화석에서 유전 정보를 추출했다. 인접한 두 다이어울프 표본은 다른 도시의 후속 복원 연구로 분리 이송됐다.",
    observationProfile: {
      originYear: "약 1만 2천 년 전",
      // E.C. 11년은 실제 생존 기간이 아니라 작은 체격과 아직 서툰 사회생활이 드러내는 고정 관찰 분류다.
      restorationYear: "E.C. 11년",
      lifeStage: "성체",
      height: "1.34 m",
      weight: "29 kg",
    },
    catalogSummary: "신장 1.34m, 체중 29kg의 또래보다 작고 가벼운 인간형 체격에 다이어울프의 귀와 예민한 감각이 확인된 우두머리 표본 기반 렐릭.",
    unlockRecord: { status: "recorded", text: "디안은 애견 카페에 들어온 우당탕탕 신입 아르바이트생이다. 주문을 옮기다 쿠로와 시로까지 얽혀 테이블을 어지럽히곤 하지만, 손님과 강아지가 놀라면 누구보다 먼저 사이를 막아 선다. 나를 자신이 지켜야 할 무리의 ‘두목’으로 여기면서도 쁘띠 로그의 아이들처럼 ‘대장님’이라 부른다. 임무에서는 두 늑대를 먼저 보내 위험 지역을 확인하고, 어린 탐험대원이 모두 돌아올 때까지 가장 뒤에 남는다." },
    squadNote: "쁘띠 로그의 경계 담당. 쿠로·시로와 위험 지역을 먼저 확인하고, 어린 탐험대원이 안전하게 빠져나갈 때까지 길목을 지킨다.",
    // “두목”은 관계 인식이고 실제 발화 호칭은 쁘띠 로그의 허용 목록과 일치시킨다.
    researcherTitle: "대장님",
    rarity: "SSR",
    // 디안 전용 전신은 늑대 SD와 분리해 도감·컷인에서만 사용한다.
    portraitAssetId: "dian",
    origin: "다이어울프",
    element: "fire",
    role: "assassin",
    reachTier: "ranged",
    excavationTrait: { primaryCurrency: "gold", baseProductionPerHour: 145, efficiencyMultiplier: 1.10 },
    /**
     * 생존 셋과 이동 속도를 로스터 최저로 내주고 공격 속도와 두 공격 축을 최고로 가져간다.
     *
     * 늑대가 살아 있는 동안 단일 대상에게 보이지 않으므로 체력·방어·저항이 낮아도 버틴다 —
     * 대신 늑대를 잃는 순간이 실제로 위험해야 암살자의 낮은 생존력이 뜻을 갖는다. 이동 속도가
     * 최저인 것도 정체성이다: 먼저 달려 나가는 것은 늑대고 두목은 가장 뒤에 남는다.
     * 공격력과 주문력이 거의 같은 이유는 합공이 두 축을 한 번에 쓰기 때문이고, 늑대 둘도 각각
     * 그 한 축에서만 자란다. 전투력 2453으로 SSR 띠(2340~2460) 안이다.
     */
    stats: { hp: 750, def: 40, res: 40, atk: 160, ap: 158, attackSpeed: 132, moveSpeed: 64, critChance: 10, critDamage: 150, energyGain: 26, lifeSteal: 0, ferocityGain: 0 },
    // 쿠로는 최종 공격력만, 시로는 최종 주문력만 읽는다. 서로 반대 능력치는 파생 결과에 섞이지 않는다.
    summons: [
      {
        def: KURO_DEF, growthStat: "atk",
        // 정의의 태생 능력치가 그대로 나오도록 디안의 태생 공격력 160을 기준으로 잰 계수다.
        scaling: { hp: 4.40, atk: 0.99, def: 0.35, res: 0.35, attackSpeed: 0.65, moveSpeed: 0.68, attackSpeedCap: 150, moveSpeedCap: 150 },
        // 편성원과 같은 키로 세우면 사람만 한 늑대가 되어 폭만 남는다. 둘은 지휘자보다 낮게 선다.
        bodyScale: 0.78,
        // 쓰러진 뒤 긴 공백을 남기고 불완전한 체력으로 돌아와 늑대를 소모품처럼 던질 수 없게 한다.
        resummon: { enabled: true, cooldownSeconds: 20, hpPercent: 40 },
      },
      {
        def: SHIRO_DEF, growthStat: "ap",
        scaling: { hp: 4.45, atk: 0.98, def: 0.37, res: 0.39, attackSpeed: 0.61, moveSpeed: 0.63, attackSpeedCap: 140, moveSpeedCap: 145 },
        // 같은 몸집으로 읽혀야 하는 한 쌍이라 털색만 다른 쿠로와 같은 배율을 쓴다.
        bodyScale: 0.78,
        resummon: { enabled: true, cooldownSeconds: 20, hpPercent: 40 },
      },
    ],
    /**
     * 자신은 그대로 두고 두 늑대를 함께 폭주시킨다.
     *
     * 무엇이 얼마나 오르는지는 여기 적지 않는다 — 그 값은 폭주하는 몸이 갖는다(`packBody`).
     * 디안 자신은 폭주해도 때리는 손이 달라지지 않는다. 앞에 선 것은 늑대이기 때문이다.
     */
    ferocityTrait: { name: "무리", effectId: "summonPackFrenzy" },
    passive: {
      id: "dian-passive", name: "우두머리의 경계", kind: "summonCommander",
      iconAssetId: "skill-icon-buff", effectType: "buff", value: 0,
      // 치명타 가산은 개체 이름이 아니라 이 필드 하나로 읽히며, 무리 전체가 같은 값을 나눠 갖는다.
      criticalChancePercent: 20,
      bloodscent: { maxStacks: 3, damagePercentPerStack: 20 },
      // 전용 분기가 문장을 짓는다. 이 사본은 화면에 뜨지 않는 데이터 문서용이다.
      desc: "전투 시작 시 쿠로와 시로를 소환하고, 두 늑대가 확인한 적 중 전투력이 가장 높은 하나를 무리의 첫 표적으로 삼는다. 둘이 모두 살아 있는 동안 은신해 단일 표적 공격의 표적에서 빠지고 무리 전체의 치명타 확률이 오른다. 한 마리라도 쓰러지면 은신이 풀려 다시 표적이 된다.",
    },
    /**
     * 합공 한 번에 물리와 마법이 함께 들어간다. `power`는 목록·정렬이 읽는 대표값이고 실제
     * 피해는 `dualStrike` 두 축이 각각 낸다.
     */
    basic: {
      id: "dian-basic", name: "얘들아, 물어!", power: 45,
      iconAssetId: "skill-icon-physical", effectType: "physical", damageType: "physical", targeting: "single",
      dualStrike: { attackPercent: 45, abilityPercent: 45, aloneAlternatePercent: 25 },
      finisher: { thresholdPercent: 25, thresholdPerStack: 5, remainingHpPercent: 30 },
    },
    /** 마무리는 같은 `finisher` 계약을 쓰되 문턱을 100으로 열어 체력과 무관하게 물게 한다. */
    ultimate: {
      id: "dian-ult", name: "약점을 공격해!", power: 150,
      iconAssetId: "skill-icon-physical", effectType: "physical", damageType: "physical", cost: 130, targeting: "single",
      packAssault: { resummonHasteSeconds: 10, summonPowerPercent: 150 },
      finisher: { thresholdPercent: 100, thresholdPerStack: 0, remainingHpPercent: 30 },
    },
  },
  KURO_DEF,
  SHIRO_DEF,
  {
    // 원정 최종층의 단독 보스. 리바이어던 멜빌레이의 거대한 턱과 심해 포식자 모티브를 담는다.
    id: "pontos",
    enemyOnly: true,
    squad: "sealed-abyss",
    name: "폰토스",
    specimenNumber: "220",
    projectName: "ABYSSAL CROWN",
    excavationSite: "페루 피스코 분지 심해 퇴적층",
    // 발굴 기록은 장소·보존 상태·복원 연구 특징만 담고, 복원 이후 생활 관찰과 분리한다.
    fossilRecord: "심해 퇴적층의 저산소 점토가 거대한 턱뼈와 척추 마디를 보존했다. 압력 복원 연구에서 고래형 골격의 비정상적인 내구성이 확인됐다.",
    catalogSummary: "리바이어던 멜빌레이를 모티브로 복원된 거대 고래형 심해 개체.",
    unlockRecord: { status: "sealed", reason: "restricted" },
    // 봉인된 적은 소속만 공개하며 squadNote와 researcherTitle은 관계 기록 해제 전까지 넣지 않는다.
    rarity: "SSR",
    portraitAssetId: "pontos",
    origin: "리바이어던 멜빌레이",
    element: "water",
    role: "tank",
    // 거대한 턱은 리치가 길지만 일부러 근거리로 둔다 — 보스가 한 걸음 물러서면 붙는 데
    // 그만큼이 더 걸려 첫 해일이 5초쯤 늦고, 그만큼 원정 최종층이 통째로 쉬워진다.
    reachTier: "melee",
    /*
     * **강인함과 경감은 여기 적지 않는다.** 둘 다 이 개체가 아니라 원정 20층이라는 **불사 자리**의
     * 성질이라 유형 표(`ENCOUNTER_ROLE.endless`)가 갖고, 적 정보창의 역할 칸이 그대로 말한다.
     * 태생 기절 저항 50%(토리카의 매 타격 기절이 첫 해일을 24.7초에서 72.7초로 밀었던 자리)도
     * 거기로 옮겼다 — 같은 개체가 다른 자리에 서면 그 자리의 규칙을 따른다.
     */
    // 적 전용 정의도 RelicDef의 완전한 정적 계약을 지켜 공용 정보창이 예외 없이 표시한다.
    excavationTrait: { primaryCurrency: "rawStone", baseProductionPerHour: 0, efficiencyMultiplier: 1.00 },
    stats: {
      // 일반 SSR의 기본치를 기준으로 HP 약 2.4배, 방어·저항 약 1.7배인 유한한 보스 예산이다.
      // 20층 boss 레벨 25의 48% 성장 적용 뒤에는 HP 4,144 / 방어 266 / 저항 192 / 주문력 148이 된다.
      hp: 2800,
      def: 180,
      res: 130,
      atk: 132,
      ap: 100,
      // 레벨 성장 후 약 1.85초마다 공격하며, 90% HP 이후 7회 적중해야 첫 해일을 쓸 수 있다.
      attackSpeed: 55,
      moveSpeed: 58,
      critChance: 8,
      critDamage: 150,
      energyGain: 30,
      lifeSteal: 0,
      ferocityGain: 0,
    },
    // 폭주 파동은 매초 각 적 최대 HP의 2%를 고정 피해로 주고, 살아 있는 동안 모든 적 회복을 취소한다.
    ferocityTrait: { name: "해구", effectId: "pontusRage", maxHpDamagePercentPerSecond: 2, cancelEnemyHealing: true },
    passive: {
      id: "pontos-passive",
      name: "심해의 압력",
      kind: "abyssalPressure",
      iconAssetId: "skill-icon-buff",
      effectType: "buff",
      value: 5,
      // 500% 전장 궁극기와 곱해져도 표준 파티를 한 번에 삭제하지 않도록 실전 시뮬레이션에서 2%로 제한했다.
      apPercentPerSecond: 2,
      // kind가 abyssalPressure인 패시브는 passiveDescription()이 구조화 필드로 다시 문장을
      // 만들므로 이 원문은 데이터 문서화용일 뿐 화면에는 쓰이지 않는다. 경감·강인함은 불사
      // 자리가 갖는다(`ENCOUNTER_ROLE.endless`).
      desc: "매초 주문력이 2%씩 복리로 오른다.",
    },
    basic: {
      id: "pontos-basic",
      name: "심해 충격파",
      // 마법 피해의 암묵 기본값에 기대지 않고 주문력 100% 계수를 운영 데이터에 고정한다.
      power: 100,
      scalingStat: "ap",
      iconAssetId: "skill-icon-magical",
      effectType: "magical",
      damageType: "magical",
      targeting: "nearbyEnemies",
      radius: 520,
    },
    ultimate: {
      id: "pontos-ult",
      name: "리바이어던 해일",
      // 전장 전체의 각 생존 대상에게 주문력 500% 피해와 공용 기절 계약을 독립 적용한다.
      power: 500,
      scalingStat: "ap",
      iconAssetId: "skill-icon-magical",
      effectType: "magical",
      damageType: "magical",
      // 90% HP 단계가 열린 뒤에만 약 300의 게이지를 모아 5초 전장 기절의 최소 간격을 제한한다.
      cost: 300,
      chargeStartsAtHpPercent: 90,
      // 해일은 좌표와 무관하게 공격 시작 시점의 모든 생존 적을 확정한다.
      targeting: "battlefieldEnemies",
      statusEffects: [{ kind: "stun", seconds: 5 }],
    },
    /*
     * **한계 돌파 효과는 네 칸 모두 "없음"이다.** 보스는 돌파 없이도 충분히 세고, 돌파 단계는 레벨
     * 상한을 맞추려고 들고 있을 뿐이다. 칸을 비워 두지 않고 "없음"으로 적어 두는 이유는 그것이
     * 정해 둔 효과이기 때문이다 — 나중에 이 자리에 다른 효과를 넣으면 그대로 바뀐다.
     */
    breakthroughEffects: { basic: { kind: "none" }, ultimate: { kind: "none" }, ferocity: { kind: "none" }, passive: { kind: "none" } },
  },
  {
    /**
     * **수쿠스이노.** 공멸이 풀어 놓은 폭주 병기이자 첫 시즌의 레이드 보스다.
     *
     * 폰토스가 원정 최종층에서 **죽지 않는 벽**으로 서 있다면, 이쪽은 반대로 **여럿이 함께
     * 미는 표적**이다 — 시즌 하나가 공유 체력 한 줄을 갖고 참가자 전원의 피해가 그 줄을
     * 깎는다. 그래서 숨은 경감으로 버티지 않는다(그런 벽은 미는 맛이 없다): 체력과 방어로
     * 두껍게 서고, 시간이 지날수록 **아프게** 만든다.
     *
     * 이름은 종명(데이노수쿠스)의 뒤 두 음절을 뒤집어 붙였다. 공멸이 붙인 병기 번호가 아니라
     * 연구동에서 부르던 호칭이 그대로 굳은 것이라, 다른 공멸 개체(토비·아모·리파·코마)처럼
     * 사람 이름의 결을 갖는다.
     */
    id: "sukusuino",
    enemyOnly: true,
    squad: "annihilation",
    name: "수쿠스이노",
    specimenNumber: "231",
    projectName: "ANNIHILATION SIEGE 004",
    excavationSite: "미국 텍사스 백악기 하천 범람원",
    fossilRecord: "범람원 사암에서 두개골 하나와 등판 골편 수백 점이 함께 나왔다. 아문 자국이 겹겹이 남은 골편이 많아, 같은 개체가 오랜 기간 반복해서 물어뜯긴 뒤 살아남았다고 기록했다.",
    observationProfile: {
      originYear: "약 7,500만 년 전",
      // E.C.는 오래 눌러 온 힘을 한 번에 풀어 버린 장년기형 인상을 분류하며, 실제 나이가 아니다.
      restorationYear: "E.C. 16년",
      lifeStage: "성체",
      height: "2.41 m",
      weight: "318 kg",
    },
    catalogSummary: "턱과 등판이 과하게 복원된 데이노수쿠스 기반 대형 표본.",
    unlockRecord: { status: "sealed", reason: "restricted" },
    // 봉인된 적은 소속만 공개한다. squadNote·researcherTitle은 관계 기록 해제 전까지 넣지 않는다.
    rarity: "SSR",
    portraitAssetId: "sukusuino",
    origin: "데이노수쿠스",
    element: "grass",
    role: "warrior",
    // 물어서 끌고 들어가는 몸이라 근거리다. 사거리가 길면 물지 않고도 이기게 된다.
    reachTier: "melee",
    /*
     * **강인함은 여기 적지 않는다.** 제어를 없애지 않고 잠그지 못하게 하는 그 값은 레이드라는
     * **보스 자리**의 성질이라 유형 표(`ENCOUNTER_ROLE.boss`)가 갖고, 적 정보창의 역할 칸이
     * 그대로 말한다. 하루 두 판이 "기절을 가졌나"로 갈리지 않게 하는 값이다.
     */
    // 적 전용 정의도 RelicDef의 완전한 정적 계약을 지켜 공용 정보창이 예외 없이 표시한다.
    excavationTrait: { primaryCurrency: "rawStone", baseProductionPerHour: 0, efficiencyMultiplier: 1.00 },
    stats: {
      /*
       * **적 전용이라 등급 띠 밖이고, 폰토스와 같은 보스 예산 안에서 모양만 다르다.**
       *
       * 폰토스가 주문력으로 전장을 쓸어 담는 벽이라면 이쪽은 **턱 하나로 앞을 부수는 몸**이다.
       * 그래서 같은 체력대에 서되 주문력을 쓰지 않고(쓰지 않는 능력치를 높게 적지 않는다),
       * 그 몫을 공격력과 방어에 얹는다. 저항이 얇은 것은 그 반대급부라 마법 딜러가 낼 답이
       * 남는다 — 레이드는 하루 세 판을 다른 편성으로 돌려 보는 자리다.
       *
       * **이 체력은 판에 서지 않는다.** 시즌 보스로 설 때의 최대 체력은 난이도의 몸
       * (`raidBossDef` → `RaidDifficultySpec.bodyHp`)에서 나오므로 여기 적힌 값은 도감·정보창이
       * 읽는 태생치이고, 전장에 서는 몸은 공유 게이지의 한 칸(`1 / kills`)이다.
       */
      hp: 2950,
      def: 200,
      res: 96,
      atk: 196,
      ap: 0,
      /*
       * **로스터 어느 개체보다 느리다.** 한 방이 무거운 대신 그 사이가 길어 "다음 턱"을 읽고
       * 자리를 옮길 틈이 남는다 — 셋이 하나를 미는 판이라 그 틈이 없으면 1대3이 아니라 그냥
       * 한 판 더 붙은 적이 된다.
       *
       * **이 값을 무리 유형 표에 두지 않는다.** 유형이 능력치를 만지기 시작하면 같은 태그를
       * 단 다음 개체가 저도 모르게 그 몫을 함께 받는다. 공속·이속은 `CLAUDE.md` 그대로 **그
       * 개체의 정체성**이라 제 정의가 갖고, 유형은 몸집만 키운다.
       */
      attackSpeed: 34,
      moveSpeed: 30,
      critChance: 8,
      critDamage: 150,
      energyGain: 30,
      lifeSteal: 0,
      ferocityGain: 0,
    },
    /*
     * **범람.** 턱이 닫힐 때마다 그 옆까지 함께 찢긴다.
     *
     * 공용 범위 전이(`splashDamage`) 하나로 짠다 — 보스 전용 배율이나 숨은 보정을 만들지
     * 않는다. 셋이 나란히 선 자리에서 단일 타격만 내던 몸이 폭주에 들어가는 순간 줄 전체를
     * 물어뜯게 되므로, 게이지가 차는 것이 화면에서 그대로 읽힌다.
     */
    ferocityTrait: {
      name: "범람", effectId: "splashDamage",
      damagePercent: 45, radius: 320, attackSpeedBonusPercent: 30,
    },
    /*
     * **아문 등판.** 발굴 기록의 "아문 자국이 겹겹이 남은 골편"이 그대로 규칙이 된 패시브다.
     *
     * **회복을 주지 않는다.** 시즌 게이지는 참가자 전원이 함께 깎은 줄이라, 보스가 제 체력을
     * 되돌리면 어제 민 몫이 오늘 사라진다 — 버티기는 규칙 그대로 **눈에 보이는 보호막**으로만
     * 짜고(「받는 피해 감소」를 새로 만들지 않는다), 아모의 겹 계약(`shellGuard`)을 그대로
     * 쓴다. 보호막은 깎인 게이지를 되돌리지 않고 **다음 한 겹을 미리 덧대는** 것이라, 한 판에서
     * 얼마나 밀었나가 그대로 남는다.
     *
     * **겹의 이름은 조가비가 아니라 「흉터」다**(`stackId: "scar"`). 계약은 같아도 그 겹이
     * 무엇인지는 개체의 것이다 — 조개껍데기를 두르는 아모와 물어뜯기고 아문 자국이 쌓이는
     * 이 몸이 같은 낱말을 쓰면 두 개체가 같은 것을 두르는 것처럼 읽힌다.
     *
     * 혼자 서는 보스라 아군 몫은 0이다 — 받을 상대가 없는 값을 적어 두면 설명문이 화면에
     * 없는 일을 말한다.
     *
     * 자기 보호막이 **2%로 얇은 것은 이 몸이 곧 공유 게이지의 한 칸**이기 때문이다
     * (`RaidDifficultySpec.bodyHp`). 아모와 같은 6%를 적으면 한 겹이 몸의 6%라 한 판에서 민 몫을
     * 크게 되돌린다. 쉬움의 몸(2만 5천)에서 한 겹 500이다.
     *
     * 강인함은 패시브가 아니라 보스 자리(`ENCOUNTER_ROLE.boss`)가 갖는다.
     */
    passive: {
      id: "sukusuino-passive",
      name: "아문 등판",
      kind: "shellGuard",
      iconAssetId: "skill-icon-buff",
      effectType: "buff",
      value: 0,
      shellGuard: { maxStacks: 3, durationSeconds: 8, cooldownSeconds: 14, selfShieldMaxHpPercent: 2, lowestHpAllyShieldMaxHpPercent: 0, stackId: "scar" },
      // 실제 문구는 shellGuard 수치에서 생성하며, 수동 원문은 의도적으로 비워 둔다.
      desc: "",
    },
    basic: {
      id: "sukusuino-basic",
      name: "죽음의 물레",
      // 보스의 한 방이다. 폰토스(100)보다 높고 공속이 낮아 초당 피해로는 비슷한 자리에 선다.
      power: 140,
      iconAssetId: "skill-icon-physical",
      effectType: "physical",
      damageType: "physical",
      targeting: "single",
      /*
       * **네 번째 턱이 몸을 비튼다.** 매 타격마다 물고 흔들면 맞은 쪽이 영영 일어나지 못해
       * 전투가 아니라 한쪽의 처형이 되고, 주기로 끊으면 플레이어가 "네 번째에 밀린다"를 읽고
       * 자리를 다시 잡을 수 있다(코마의 세 번째 꼬리와 같은 이유·같은 공용 계약이다).
       *
       * 물린 자리가 아물지 않는 것이 이 개체가 다른 공멸과 갈리는 지점이라, 날리는 것과 함께
       * 회복을 깎는 출혈을 남긴다 — 회복형 편성 하나로 하루 세 판을 같은 방식으로 돌리지
       * 못하게 하는 손잡이다.
       */
      statusEffectEvery: 4,
      statusEffects: [
        { kind: "bleed", seconds: 4, maxHpPercentPerSecond: 2, healingReceivedReductionPercent: 30 },
        { kind: "knockback", seconds: 1, speed: 1500, bounces: 2 },
      ],
    },
    ultimate: {
      id: "sukusuino-ult",
      name: "수장의 아가리",
      // 코마의 통로(190)와 폰토스의 전장 해일(500) 사이다. 원 하나를 지정해 무는 기술이라
      // 전장 전체를 치지 않고, 그만큼 서 있는 자리가 답이 된다.
      power: 300,
      iconAssetId: "skill-icon-physical",
      effectType: "physical",
      damageType: "physical",
      cost: 100,
      /*
       * **원을 지정해 문다.** 전장 전체를 치는 기술로 두면 편성이 무엇이든 똑같이 맞아 자리를
       * 옮길 이유가 사라진다 — 바닥에 그려지는 원이 곧 "여기 서 있으면 맞는다"가 되고,
       * 그 판정 모양을 화면이 그대로 받아 그린다(`areaImpact`).
       */
      targeting: "targetedCircle",
      radius: 300,
      statusEffects: [{ kind: "stun", seconds: 2 }],
    },
    /*
     * **한계 돌파 효과는 네 칸 모두 "없음"이다.** 보스는 돌파 없이도 충분히 세고, 돌파 단계는 레벨
     * 상한을 맞추려고 들고 있을 뿐이다. 칸을 비워 두지 않고 "없음"으로 적어 두는 이유는 그것이
     * 정해 둔 효과이기 때문이다 — 나중에 이 자리에 다른 효과를 넣으면 그대로 바뀐다.
     */
    breakthroughEffects: { basic: { kind: "none" }, ultimate: { kind: "none" }, ferocity: { kind: "none" }, passive: { kind: "none" } },
  },
  {
    /**
     * **타보아.** 공멸이 풀어 놓은 둘째 폭주 병기이자 레이드 보스다.
     *
     * 수쿠스이노가 **한 방이 무거운 턱**이라면 이쪽은 **감아 들어가 놓지 않는 몸**이다. 한 번
     * 문 상대를 풀어 주지 않고 조일수록 손이 빨라지며(패시브), 감긴 쪽은 점점 굼떠진다(기본기).
     * 그래서 같은 보스 자리에 서도 "다음 턱을 읽고 비킨다"가 아니라 "감기기 전에 끊는다"가 답이
     * 되어, 하루 두 판을 같은 편성으로 돌리지 못하게 한다.
     *
     * 이름은 종명(티타노보아)의 뒤 두 음절에 첫 음절을 붙여 줄였다 — 수쿠스이노처럼 연구동에서
     * 부르던 호칭이 그대로 굳은 것이다.
     */
    id: "taboa",
    enemyOnly: true,
    squad: "annihilation",
    name: "타보아",
    specimenNumber: "232",
    projectName: "ANNIHILATION SIEGE 005",
    excavationSite: "콜롬비아 세레혼 탄광 팔레오세 지층",
    fossilRecord: "노천 탄광의 석탄층 사이에서 척추뼈 수십 점이 한 줄로 이어진 채 나왔다. 뼈의 굵기로 잰 몸길이가 지금의 어느 뱀보다 길어, 그 몸을 데울 만큼 뜨거웠던 열대의 기온까지 함께 추정되었다.",
    observationProfile: {
      originYear: "약 6,000만 년 전",
      // E.C.는 느긋하게 웃으면서도 감은 것을 놓지 않는 성체형 인상을 분류하며, 실제 나이가 아니다.
      restorationYear: "E.C. 17년",
      lifeStage: "성체",
      height: "1.72 m",
      weight: "146 kg",
    },
    catalogSummary: "꼬리와 비늘 외투가 과하게 복원된 티타노보아 기반 대형 표본.",
    unlockRecord: { status: "sealed", reason: "restricted" },
    // 봉인된 적은 소속만 공개한다. squadNote·researcherTitle은 관계 기록 해제 전까지 넣지 않는다.
    rarity: "SSR",
    portraitAssetId: "taboa",
    origin: "티타노보아",
    element: "fire",
    role: "warrior",
    // 감아서 조이는 몸이라 근거리다.
    reachTier: "melee",
    // 강인함은 수쿠스이노와 같이 보스 자리(`ENCOUNTER_ROLE.boss`)가 갖는다.
    excavationTrait: { primaryCurrency: "rawStone", baseProductionPerHour: 0, efficiencyMultiplier: 1.00 },
    stats: {
      /*
       * **수쿠스이노와 같은 보스 예산 안에서 모양만 다르다.** 방어를 덜어 저항에 얹었다 —
       * 물리로 미는 편성이 수쿠스이노보다 쉽게 뚫고, 마법 딜러는 반대로 조금 더 오래 친다. 두
       * 보스가 서로 다른 편성을 부르게 하는 손잡이다. 주문력은 쓰는 스킬이 없어 0이다.
       *
       * 체력은 판에 서지 않는다 — 시즌 보스로 설 때의 몸은 난이도의 몸에서 나온다
       * (`raidBossDef` → `RaidDifficultySpec.bodyHp`).
       */
      hp: 2800,
      def: 164,
      res: 140,
      atk: 198,
      ap: 0,
      /*
       * 수쿠스이노보다 빠르지만 여전히 로스터 아래쪽이다. 한 대는 가볍고 그 사이가 짧아, 조일수록
       * 빨라지는 패시브가 "시간이 지날수록 아프다"를 대신 말한다.
       */
      attackSpeed: 44,
      moveSpeed: 40,
      critChance: 8,
      critDamage: 150,
      energyGain: 30,
      lifeSteal: 0,
      ferocityGain: 0,
    },
    /*
     * **열대의 체온.** 그 몸을 데우던 뜨거운 기온이 돌아오면 조이는 손이 한층 빨라진다.
     *
     * 공속 축 폭주의 공용 계약(`selfAttackSpeedMultiplier`) 하나로 짠다 — 패시브의 겹과 곱해져
     * 폭주가 곧 "가장 빨리 감기는 순간"으로 읽힌다.
     */
    ferocityTrait: { name: "열대의 체온", effectId: "selfAttackSpeedMultiplier", bonusPercent: 40 },
    /*
     * **조여 드는 똬리.** 감은 채로 때릴수록 공격 속도가 쌓인다(토비·스피나와 같은 공용 계약).
     *
     * **회복을 주지 않는다** — 시즌 게이지는 참가자 전원이 함께 깎은 줄이라 되돌리면 어제 민 몫이
     * 사라진다(수쿠스이노와 같은 이유). 버티는 대신 **점점 아파진다**.
     */
    passive: {
      id: "taboa-passive",
      name: "조여 드는 똬리",
      kind: "basicHitAttackSpeedStack",
      iconAssetId: "skill-icon-buff",
      effectType: "buff",
      value: 3,
      maxStacks: 10,
      // 전용 분기(`passiveDescription`)가 이 종류의 문장을 짓는다. 이 원문은 표시되지 않는 데이터
      // 문서용 사본이라, 고칠 때는 그 분기도 함께 본다.
      desc: "기본 공격이 적중할 때마다 이번 전투 동안 공격 속도가 증가한다.",
    },
    basic: {
      id: "taboa-basic",
      name: "옥죄기",
      power: 120,
      iconAssetId: "skill-icon-physical",
      effectType: "physical",
      damageType: "physical",
      targeting: "single",
      /*
       * **감긴 쪽이 굼떠진다.** 둔화(공용 규칙어)를 쌓아 공격·이동 속도를 함께 깎는다 — 한 명이
       * 오래 붙잡히면 그 개체의 몫이 눈에 띄게 줄어, 누구를 앞에 세울지가 답이 된다.
       */
      statusEffects: [{ kind: "chill", speedPercentPerStack: 8, maxStacks: 3 }],
    },
    ultimate: {
      id: "taboa-ult",
      name: "열대의 똬리",
      // 수쿠스이노의 지정 원(300)보다 약간 낮다. 제 주위를 통째로 감는 기술이라 붙어 선 근거리
      // 편성이 가장 크게 맞는다.
      power: 260,
      iconAssetId: "skill-icon-physical",
      effectType: "physical",
      damageType: "physical",
      cost: 100,
      /*
       * **제 주위를 감는다.** 원을 멀리 지정하는 수쿠스이노와 달리 몸 둘레가 곧 범위라, 붙어
       * 선 근거리가 맞고 멀리 선 후열은 빠진다 — 두 보스가 위협하는 자리가 갈린다.
       */
      targeting: "nearbyEnemies",
      radius: 340,
      statusEffects: [{ kind: "stun", seconds: 1.5 }],
      /*
       * **감고 나면 비늘을 한 겹 여민다.** 회복은 참가자 전원이 함께 민 시즌 게이지를 되돌리므로
       * 주지 않고, 그 판 안에서만 남는 보호막을 **궁극기 때만, 조금** 두른다 — 몸이 시즌 줄의
       * 400분의 1이라 3%는 한 겹 750으로, 한두 대 더 치게 만드는 정도다.
       */
      selfShieldMaxHpPercent: 3,
    },
    // 수쿠스이노와 같은 이유로 네 칸 모두 "없음"이다.
    breakthroughEffects: { basic: { kind: "none" }, ultimate: { kind: "none" }, ferocity: { kind: "none" }, passive: { kind: "none" } },
  },
  {
    /**
     * **비리아.** 치즈케이크 대작전에 떼로 몰려오는 레이티아 거대겨울잠쥐 다섯 자매 중 하나다.
     *
     * 이름은 종명(레이티아 = 로마 속주 라이티아)과 같은 라틴 뿌리에서 따 viridis(초록)로 짓고,
     * 다섯이 모두 `-아`로 끝나 한배라는 것이 이름만으로 읽히게 했다. 속성을 이름에 그대로
     * 적지 않는 이유는 그러면 개체가 아니라 색표가 되기 때문이다.
     *
     * 다섯은 한배에서 난 같은 몸이라 능력치도 스킬도 같고, **갈리는 것은 속성과 걸음걸이
     * 뿐이다** — 공속·이속만 개체마다 다르게 섞는다는 규칙 그대로다. 그래서 이 던전에서
     * 고를 것은 "무엇을 데려갈까"가 아니라 "어느 색에 강한 편성인가"가 된다.
     *
     * 물량형이라고 능력치를 깎지 않는다 — 규칙대로 R 띠(2080~2200) 안에 서고, 던전이
     * 무거워지는 몫은 개체 정의가 아니라 그 관문의 레벨과 유형 배수가 갖는다.
     */
    id: "raitia-grass",
    enemyOnly: true,
    // 다섯 자매를 도감과 서사에서 한 갈래로 묶는다. 전투 능력치를 물려받는 값이 아니다.
    identityFamilyId: "raitia",
    // 이터널 시티로 밀려드는 복원체 무리라 공멸의 침투 임무와 같은 계보에 둔다.
    squad: "annihilation",
    name: "비리아",
    specimenNumber: "207",
    projectName: "ANNIHILATION SWARM — 과식 개체군",
    excavationSite: "슬로베니아 카르스트 동굴 퇴적층",
    fossilRecord: "동굴 퇴적층에서 같은 종의 두개골 수십 점이 한 층에 겹쳐 나왔다. 그중 다섯 점은 크기와 치열이 거의 같아 한배에서 난 개체로 분류했다.",
    observationProfile: {
      originYear: "약 200만 년 전",
      // E.C.는 무엇이든 갉아 보는 유생기형 인상을 기록하며 실제 생존 햇수로 읽지 않는다.
      restorationYear: "E.C. 2년",
      lifeStage: "유체",
      height: "0.94 m",
      weight: "21 kg",
    },
    catalogSummary: "앞니와 볼주머니가 과하게 복원된 겨울잠쥐 기반 표본.",
    unlockRecord: { status: "recorded", text: "복원 후 레이티아는 잠들지 않는다. 겨울잠에 들어야 할 시기가 와도 먹기를 멈추지 않고, 볼주머니가 가득 찬 뒤에도 앞니로 계속 갉는다. 한 마리가 먹이를 찾으면 울음이 아니라 앞니 소리로 알리고, 그 소리를 들은 자매들이 같은 자리로 한꺼번에 몰려든다. 첫째는 갉은 자리에 늘 새순을 흘린다. 볼주머니에서 떨어진 씨가 발자국마다 돋아, 무리가 지나간 길이 초록으로 남는다." },
    squadNote: "공멸의 소모 물량. 지시받은 방향으로 한꺼번에 흘러가 통로를 메우고, 앞의 개체가 쓰러진 자리를 뒤의 개체가 그대로 밟고 넘어간다.",
    researcherTitle: "연구원",
    rarity: "R",
    portraitAssetId: "raitia-grass",
    origin: "겨울잠쥐",
    element: "grass",
    // 앞니로 갉으며 앞줄을 메우는 몸이라 방어형이다. 다섯이 모두 같은 역할을 맡는다.
    role: "tank",
    // 앞니로 갉는 개체라 붙어야 때린다.
    reachTier: "melee",
    excavationTrait: { primaryCurrency: "cheesecake", baseProductionPerHour: 1.4, efficiencyMultiplier: 1.00 },
    stats: {
      // 다섯이 같은 몸이라 오각형은 한 벌이고, 공속·이속만 자매마다 다르다. 전투력은 전부
      // R 띠(2080~2200) 안에 든다. 주문력은 어느 스킬도 읽지 않는 값이라 낮게 둔다
      // (쓰지 않는 능력치를 높게 적지 않는다).
      hp: 1400,
      def: 100,
      res: 92,
      atk: 90,
      ap: 18,
      attackSpeed: 56,
      moveSpeed: 92,
      // 부가 능력치는 전 개체 공통값이다(`COMMON_SECONDARY_STATS`).
      critChance: 10,
      critDamage: 150,
      energyGain: 26,
      lifeSteal: 0,
      ferocityGain: 0,
    },
    ferocityTrait: {
      name: "과식",
      // 공용 자기 공속 배율을 그대로 쓴다. 떼가 한꺼번에 폭주하면 앞줄이 버티는 시간이
      // 그만큼 짧아지는 것이 이 던전의 압박이다.
      effectId: "selfAttackSpeedMultiplier",
      bonusPercent: 60,
    },
    passive: {
      id: "raitia-grass-passive",
      name: "겨울잠",
      /*
       * 겨울잠쥐가 버티는 방법은 숨은 배율이 아니라 **눈에 보이는 회복**이다 — 위험해지면
       * 한 번 웅크렸다가 다시 일어난다. 공용 계약(`emergencyRecovery`)을 그대로 쓰므로
       * 새 전투 분기가 늘지 않는다.
       */
      kind: "emergencyRecovery",
      iconAssetId: "skill-icon-healing",
      effectType: "healing",
      value: 3,
      durationSeconds: 5,
      // 전용 분기가 없는 종류라 이 문장이 그대로 화면에 선다.
      desc: "전투당 한 번, 체력이 절반 이하가 되면 5초 동안 매초 최대 체력의 3%를 회복한다.",
    },
    basic: {
      id: "raitia-grass-basic",
      name: "앞니 갉기",
      // 앞에 서서 오래 갉는 몸이라 한 대는 얕다. 무서운 것은 한 마리의 세기가 아니라 수다.
      power: 70,
      iconAssetId: "skill-icon-physical",
      effectType: "physical",
      damageType: "physical",
      targeting: "single",
    },
    ultimate: {
      id: "raitia-grass-ult",
      name: "볼주머니 쏟기",
      power: 150,
      iconAssetId: "skill-icon-physical",
      effectType: "physical",
      damageType: "physical",
      cost: 100,
      // 제 주위만 때린다. 전장 전체를 때리면 떼로 나오는 개체가 서로의 궁극기를 겹쳐
      // 아군이 한 프레임에 통째로 녹는다.
      targeting: "nearbyEnemies",
      radius: 260,
    },
    // 한계 돌파 효과는 네 칸 모두 "없음"이다 — 정해 둔 효과라 나중에 이 자리에 다른 효과를 넣으면 그대로 바뀐다.
    breakthroughEffects: { basic: { kind: "none" }, ultimate: { kind: "none" }, ferocity: { kind: "none" }, passive: { kind: "none" } },
  },
  {
    /**
     * **구티아.** 치즈케이크 대작전에 떼로 몰려오는 레이티아 거대겨울잠쥐 다섯 자매 중 하나다.
     *
     * 이름은 종명(레이티아 = 로마 속주 라이티아)과 같은 라틴 뿌리에서 따 gutta(물방울)로 짓고,
     * 다섯이 모두 `-아`로 끝나 한배라는 것이 이름만으로 읽히게 했다. 속성을 이름에 그대로
     * 적지 않는 이유는 그러면 개체가 아니라 색표가 되기 때문이다.
     *
     * 다섯은 한배에서 난 같은 몸이라 능력치도 스킬도 같고, **갈리는 것은 속성과 걸음걸이
     * 뿐이다** — 공속·이속만 개체마다 다르게 섞는다는 규칙 그대로다. 그래서 이 던전에서
     * 고를 것은 "무엇을 데려갈까"가 아니라 "어느 색에 강한 편성인가"가 된다.
     *
     * 물량형이라고 능력치를 깎지 않는다 — 규칙대로 R 띠(2080~2200) 안에 서고, 던전이
     * 무거워지는 몫은 개체 정의가 아니라 그 관문의 레벨과 유형 배수가 갖는다.
     */
    id: "raitia-water",
    enemyOnly: true,
    // 다섯 자매를 도감과 서사에서 한 갈래로 묶는다. 전투 능력치를 물려받는 값이 아니다.
    identityFamilyId: "raitia",
    // 이터널 시티로 밀려드는 복원체 무리라 공멸의 침투 임무와 같은 계보에 둔다.
    squad: "annihilation",
    name: "구티아",
    specimenNumber: "208",
    projectName: "ANNIHILATION SWARM — 과식 개체군",
    excavationSite: "슬로베니아 카르스트 동굴 퇴적층",
    fossilRecord: "동굴 퇴적층에서 같은 종의 두개골 수십 점이 한 층에 겹쳐 나왔다. 그중 다섯 점은 크기와 치열이 거의 같아 한배에서 난 개체로 분류했다.",
    observationProfile: {
      originYear: "약 200만 년 전",
      // E.C.는 무엇이든 갉아 보는 유생기형 인상을 기록하며 실제 생존 햇수로 읽지 않는다.
      restorationYear: "E.C. 2년",
      lifeStage: "유체",
      height: "0.94 m",
      weight: "21 kg",
    },
    catalogSummary: "앞니와 볼주머니가 과하게 복원된 겨울잠쥐 기반 표본.",
    unlockRecord: { status: "recorded", text: "복원 후 레이티아는 잠들지 않는다. 겨울잠에 들어야 할 시기가 와도 먹기를 멈추지 않고, 볼주머니가 가득 찬 뒤에도 앞니로 계속 갉는다. 한 마리가 먹이를 찾으면 울음이 아니라 앞니 소리로 알리고, 그 소리를 들은 자매들이 같은 자리로 한꺼번에 몰려든다. 둘째는 볼주머니가 마르지 않는다. 물을 머금은 채로 갉아 앞니 소리가 둔하게 울리고, 쓰러질 때 품고 있던 물을 한꺼번에 쏟는다." },
    squadNote: "공멸의 소모 물량. 지시받은 방향으로 한꺼번에 흘러가 통로를 메우고, 앞의 개체가 쓰러진 자리를 뒤의 개체가 그대로 밟고 넘어간다.",
    researcherTitle: "연구원",
    rarity: "R",
    portraitAssetId: "raitia-water",
    origin: "겨울잠쥐",
    element: "water",
    // 앞니로 갉으며 앞줄을 메우는 몸이라 방어형이다. 다섯이 모두 같은 역할을 맡는다.
    role: "tank",
    // 앞니로 갉는 개체라 붙어야 때린다.
    reachTier: "melee",
    excavationTrait: { primaryCurrency: "cheesecake", baseProductionPerHour: 1.4, efficiencyMultiplier: 1.00 },
    stats: {
      // 다섯이 같은 몸이라 오각형은 한 벌이고, 공속·이속만 자매마다 다르다. 전투력은 전부
      // R 띠(2080~2200) 안에 든다. 주문력은 어느 스킬도 읽지 않는 값이라 낮게 둔다
      // (쓰지 않는 능력치를 높게 적지 않는다).
      hp: 1400,
      def: 100,
      res: 92,
      atk: 90,
      ap: 18,
      attackSpeed: 60,
      moveSpeed: 88,
      // 부가 능력치는 전 개체 공통값이다(`COMMON_SECONDARY_STATS`).
      critChance: 10,
      critDamage: 150,
      energyGain: 26,
      lifeSteal: 0,
      ferocityGain: 0,
    },
    ferocityTrait: {
      name: "과식",
      // 공용 자기 공속 배율을 그대로 쓴다. 떼가 한꺼번에 폭주하면 앞줄이 버티는 시간이
      // 그만큼 짧아지는 것이 이 던전의 압박이다.
      effectId: "selfAttackSpeedMultiplier",
      bonusPercent: 60,
    },
    passive: {
      id: "raitia-water-passive",
      name: "겨울잠",
      /*
       * 겨울잠쥐가 버티는 방법은 숨은 배율이 아니라 **눈에 보이는 회복**이다 — 위험해지면
       * 한 번 웅크렸다가 다시 일어난다. 공용 계약(`emergencyRecovery`)을 그대로 쓰므로
       * 새 전투 분기가 늘지 않는다.
       */
      kind: "emergencyRecovery",
      iconAssetId: "skill-icon-healing",
      effectType: "healing",
      value: 3,
      durationSeconds: 5,
      // 전용 분기가 없는 종류라 이 문장이 그대로 화면에 선다.
      desc: "전투당 한 번, 체력이 절반 이하가 되면 5초 동안 매초 최대 체력의 3%를 회복한다.",
    },
    basic: {
      id: "raitia-water-basic",
      name: "앞니 갉기",
      // 앞에 서서 오래 갉는 몸이라 한 대는 얕다. 무서운 것은 한 마리의 세기가 아니라 수다.
      power: 70,
      iconAssetId: "skill-icon-physical",
      effectType: "physical",
      damageType: "physical",
      targeting: "single",
    },
    ultimate: {
      id: "raitia-water-ult",
      name: "볼주머니 쏟기",
      power: 150,
      iconAssetId: "skill-icon-physical",
      effectType: "physical",
      damageType: "physical",
      cost: 100,
      // 제 주위만 때린다. 전장 전체를 때리면 떼로 나오는 개체가 서로의 궁극기를 겹쳐
      // 아군이 한 프레임에 통째로 녹는다.
      targeting: "nearbyEnemies",
      radius: 260,
    },
    // 한계 돌파 효과는 네 칸 모두 "없음"이다 — 정해 둔 효과라 나중에 이 자리에 다른 효과를 넣으면 그대로 바뀐다.
    breakthroughEffects: { basic: { kind: "none" }, ultimate: { kind: "none" }, ferocity: { kind: "none" }, passive: { kind: "none" } },
  },
  {
    /**
     * **파비아.** 치즈케이크 대작전에 떼로 몰려오는 레이티아 거대겨울잠쥐 다섯 자매 중 하나다.
     *
     * 이름은 종명(레이티아 = 로마 속주 라이티아)과 같은 라틴 뿌리에서 따 favilla(잉걸)로 짓고,
     * 다섯이 모두 `-아`로 끝나 한배라는 것이 이름만으로 읽히게 했다. 속성을 이름에 그대로
     * 적지 않는 이유는 그러면 개체가 아니라 색표가 되기 때문이다.
     *
     * 다섯은 한배에서 난 같은 몸이라 능력치도 스킬도 같고, **갈리는 것은 속성과 걸음걸이
     * 뿐이다** — 공속·이속만 개체마다 다르게 섞는다는 규칙 그대로다. 그래서 이 던전에서
     * 고를 것은 "무엇을 데려갈까"가 아니라 "어느 색에 강한 편성인가"가 된다.
     *
     * 물량형이라고 능력치를 깎지 않는다 — 규칙대로 R 띠(2080~2200) 안에 서고, 던전이
     * 무거워지는 몫은 개체 정의가 아니라 그 관문의 레벨과 유형 배수가 갖는다.
     */
    id: "raitia-fire",
    enemyOnly: true,
    // 다섯 자매를 도감과 서사에서 한 갈래로 묶는다. 전투 능력치를 물려받는 값이 아니다.
    identityFamilyId: "raitia",
    // 이터널 시티로 밀려드는 복원체 무리라 공멸의 침투 임무와 같은 계보에 둔다.
    squad: "annihilation",
    name: "파비아",
    specimenNumber: "209",
    projectName: "ANNIHILATION SWARM — 과식 개체군",
    excavationSite: "슬로베니아 카르스트 동굴 퇴적층",
    fossilRecord: "동굴 퇴적층에서 같은 종의 두개골 수십 점이 한 층에 겹쳐 나왔다. 그중 다섯 점은 크기와 치열이 거의 같아 한배에서 난 개체로 분류했다.",
    observationProfile: {
      originYear: "약 200만 년 전",
      // E.C.는 무엇이든 갉아 보는 유생기형 인상을 기록하며 실제 생존 햇수로 읽지 않는다.
      restorationYear: "E.C. 2년",
      lifeStage: "유체",
      height: "0.94 m",
      weight: "21 kg",
    },
    catalogSummary: "앞니와 볼주머니가 과하게 복원된 겨울잠쥐 기반 표본.",
    unlockRecord: { status: "recorded", text: "복원 후 레이티아는 잠들지 않는다. 겨울잠에 들어야 할 시기가 와도 먹기를 멈추지 않고, 볼주머니가 가득 찬 뒤에도 앞니로 계속 갉는다. 한 마리가 먹이를 찾으면 울음이 아니라 앞니 소리로 알리고, 그 소리를 들은 자매들이 같은 자리로 한꺼번에 몰려든다. 셋째는 앞니가 식지 않는다. 갉는 속도가 빨라 마찰만으로 잉걸이 튀고, 자매들 중 가장 먼저 먹이에 닿는다." },
    squadNote: "공멸의 소모 물량. 지시받은 방향으로 한꺼번에 흘러가 통로를 메우고, 앞의 개체가 쓰러진 자리를 뒤의 개체가 그대로 밟고 넘어간다.",
    researcherTitle: "연구원",
    rarity: "R",
    portraitAssetId: "raitia-fire",
    origin: "겨울잠쥐",
    element: "fire",
    // 앞니로 갉으며 앞줄을 메우는 몸이라 방어형이다. 다섯이 모두 같은 역할을 맡는다.
    role: "tank",
    // 앞니로 갉는 개체라 붙어야 때린다.
    reachTier: "melee",
    excavationTrait: { primaryCurrency: "cheesecake", baseProductionPerHour: 1.4, efficiencyMultiplier: 1.00 },
    stats: {
      // 다섯이 같은 몸이라 오각형은 한 벌이고, 공속·이속만 자매마다 다르다. 전투력은 전부
      // R 띠(2080~2200) 안에 든다. 주문력은 어느 스킬도 읽지 않는 값이라 낮게 둔다
      // (쓰지 않는 능력치를 높게 적지 않는다).
      hp: 1400,
      def: 100,
      res: 92,
      atk: 90,
      ap: 18,
      attackSpeed: 64,
      moveSpeed: 96,
      // 부가 능력치는 전 개체 공통값이다(`COMMON_SECONDARY_STATS`).
      critChance: 10,
      critDamage: 150,
      energyGain: 26,
      lifeSteal: 0,
      ferocityGain: 0,
    },
    ferocityTrait: {
      name: "과식",
      // 공용 자기 공속 배율을 그대로 쓴다. 떼가 한꺼번에 폭주하면 앞줄이 버티는 시간이
      // 그만큼 짧아지는 것이 이 던전의 압박이다.
      effectId: "selfAttackSpeedMultiplier",
      bonusPercent: 60,
    },
    passive: {
      id: "raitia-fire-passive",
      name: "겨울잠",
      /*
       * 겨울잠쥐가 버티는 방법은 숨은 배율이 아니라 **눈에 보이는 회복**이다 — 위험해지면
       * 한 번 웅크렸다가 다시 일어난다. 공용 계약(`emergencyRecovery`)을 그대로 쓰므로
       * 새 전투 분기가 늘지 않는다.
       */
      kind: "emergencyRecovery",
      iconAssetId: "skill-icon-healing",
      effectType: "healing",
      value: 3,
      durationSeconds: 5,
      // 전용 분기가 없는 종류라 이 문장이 그대로 화면에 선다.
      desc: "전투당 한 번, 체력이 절반 이하가 되면 5초 동안 매초 최대 체력의 3%를 회복한다.",
    },
    basic: {
      id: "raitia-fire-basic",
      name: "앞니 갉기",
      // 앞에 서서 오래 갉는 몸이라 한 대는 얕다. 무서운 것은 한 마리의 세기가 아니라 수다.
      power: 70,
      iconAssetId: "skill-icon-physical",
      effectType: "physical",
      damageType: "physical",
      targeting: "single",
    },
    ultimate: {
      id: "raitia-fire-ult",
      name: "볼주머니 쏟기",
      power: 150,
      iconAssetId: "skill-icon-physical",
      effectType: "physical",
      damageType: "physical",
      cost: 100,
      // 제 주위만 때린다. 전장 전체를 때리면 떼로 나오는 개체가 서로의 궁극기를 겹쳐
      // 아군이 한 프레임에 통째로 녹는다.
      targeting: "nearbyEnemies",
      radius: 260,
    },
    // 한계 돌파 효과는 네 칸 모두 "없음"이다 — 정해 둔 효과라 나중에 이 자리에 다른 효과를 넣으면 그대로 바뀐다.
    breakthroughEffects: { basic: { kind: "none" }, ultimate: { kind: "none" }, ferocity: { kind: "none" }, passive: { kind: "none" } },
  },
  {
    /**
     * **실리아.** 치즈케이크 대작전에 떼로 몰려오는 레이티아 거대겨울잠쥐 다섯 자매 중 하나다.
     *
     * 이름은 종명(레이티아 = 로마 속주 라이티아)과 같은 라틴 뿌리에서 따 silex(부싯돌·자갈)로 짓고,
     * 다섯이 모두 `-아`로 끝나 한배라는 것이 이름만으로 읽히게 했다. 속성을 이름에 그대로
     * 적지 않는 이유는 그러면 개체가 아니라 색표가 되기 때문이다.
     *
     * 다섯은 한배에서 난 같은 몸이라 능력치도 스킬도 같고, **갈리는 것은 속성과 걸음걸이
     * 뿐이다** — 공속·이속만 개체마다 다르게 섞는다는 규칙 그대로다. 그래서 이 던전에서
     * 고를 것은 "무엇을 데려갈까"가 아니라 "어느 색에 강한 편성인가"가 된다.
     *
     * 물량형이라고 능력치를 깎지 않는다 — 규칙대로 R 띠(2080~2200) 안에 서고, 던전이
     * 무거워지는 몫은 개체 정의가 아니라 그 관문의 레벨과 유형 배수가 갖는다.
     */
    id: "raitia-earth",
    enemyOnly: true,
    // 다섯 자매를 도감과 서사에서 한 갈래로 묶는다. 전투 능력치를 물려받는 값이 아니다.
    identityFamilyId: "raitia",
    // 이터널 시티로 밀려드는 복원체 무리라 공멸의 침투 임무와 같은 계보에 둔다.
    squad: "annihilation",
    name: "실리아",
    specimenNumber: "210",
    projectName: "ANNIHILATION SWARM — 과식 개체군",
    excavationSite: "슬로베니아 카르스트 동굴 퇴적층",
    fossilRecord: "동굴 퇴적층에서 같은 종의 두개골 수십 점이 한 층에 겹쳐 나왔다. 그중 다섯 점은 크기와 치열이 거의 같아 한배에서 난 개체로 분류했다.",
    observationProfile: {
      originYear: "약 200만 년 전",
      // E.C.는 무엇이든 갉아 보는 유생기형 인상을 기록하며 실제 생존 햇수로 읽지 않는다.
      restorationYear: "E.C. 2년",
      lifeStage: "유체",
      height: "0.94 m",
      weight: "21 kg",
    },
    catalogSummary: "앞니와 볼주머니가 과하게 복원된 겨울잠쥐 기반 표본.",
    unlockRecord: { status: "recorded", text: "복원 후 레이티아는 잠들지 않는다. 겨울잠에 들어야 할 시기가 와도 먹기를 멈추지 않고, 볼주머니가 가득 찬 뒤에도 앞니로 계속 갉는다. 한 마리가 먹이를 찾으면 울음이 아니라 앞니 소리로 알리고, 그 소리를 들은 자매들이 같은 자리로 한꺼번에 몰려든다. 넷째는 볼주머니에 자갈을 채운다. 무거워 가장 늦게 도착하지만 앞줄에서 가장 오래 버티고, 자매가 쓰러진 자리를 제 몸으로 메운다." },
    squadNote: "공멸의 소모 물량. 지시받은 방향으로 한꺼번에 흘러가 통로를 메우고, 앞의 개체가 쓰러진 자리를 뒤의 개체가 그대로 밟고 넘어간다.",
    researcherTitle: "연구원",
    rarity: "R",
    portraitAssetId: "raitia-earth",
    origin: "겨울잠쥐",
    element: "earth",
    // 앞니로 갉으며 앞줄을 메우는 몸이라 방어형이다. 다섯이 모두 같은 역할을 맡는다.
    role: "tank",
    // 앞니로 갉는 개체라 붙어야 때린다.
    reachTier: "melee",
    excavationTrait: { primaryCurrency: "cheesecake", baseProductionPerHour: 1.4, efficiencyMultiplier: 1.00 },
    stats: {
      // 다섯이 같은 몸이라 오각형은 한 벌이고, 공속·이속만 자매마다 다르다. 전투력은 전부
      // R 띠(2080~2200) 안에 든다. 주문력은 어느 스킬도 읽지 않는 값이라 낮게 둔다
      // (쓰지 않는 능력치를 높게 적지 않는다).
      hp: 1400,
      def: 100,
      res: 92,
      atk: 90,
      ap: 18,
      attackSpeed: 50,
      moveSpeed: 80,
      // 부가 능력치는 전 개체 공통값이다(`COMMON_SECONDARY_STATS`).
      critChance: 10,
      critDamage: 150,
      energyGain: 26,
      lifeSteal: 0,
      ferocityGain: 0,
    },
    ferocityTrait: {
      name: "과식",
      // 공용 자기 공속 배율을 그대로 쓴다. 떼가 한꺼번에 폭주하면 앞줄이 버티는 시간이
      // 그만큼 짧아지는 것이 이 던전의 압박이다.
      effectId: "selfAttackSpeedMultiplier",
      bonusPercent: 60,
    },
    passive: {
      id: "raitia-earth-passive",
      name: "겨울잠",
      /*
       * 겨울잠쥐가 버티는 방법은 숨은 배율이 아니라 **눈에 보이는 회복**이다 — 위험해지면
       * 한 번 웅크렸다가 다시 일어난다. 공용 계약(`emergencyRecovery`)을 그대로 쓰므로
       * 새 전투 분기가 늘지 않는다.
       */
      kind: "emergencyRecovery",
      iconAssetId: "skill-icon-healing",
      effectType: "healing",
      value: 3,
      durationSeconds: 5,
      // 전용 분기가 없는 종류라 이 문장이 그대로 화면에 선다.
      desc: "전투당 한 번, 체력이 절반 이하가 되면 5초 동안 매초 최대 체력의 3%를 회복한다.",
    },
    basic: {
      id: "raitia-earth-basic",
      name: "앞니 갉기",
      // 앞에 서서 오래 갉는 몸이라 한 대는 얕다. 무서운 것은 한 마리의 세기가 아니라 수다.
      power: 70,
      iconAssetId: "skill-icon-physical",
      effectType: "physical",
      damageType: "physical",
      targeting: "single",
    },
    ultimate: {
      id: "raitia-earth-ult",
      name: "볼주머니 쏟기",
      power: 150,
      iconAssetId: "skill-icon-physical",
      effectType: "physical",
      damageType: "physical",
      cost: 100,
      // 제 주위만 때린다. 전장 전체를 때리면 떼로 나오는 개체가 서로의 궁극기를 겹쳐
      // 아군이 한 프레임에 통째로 녹는다.
      targeting: "nearbyEnemies",
      radius: 260,
    },
    // 한계 돌파 효과는 네 칸 모두 "없음"이다 — 정해 둔 효과라 나중에 이 자리에 다른 효과를 넣으면 그대로 바뀐다.
    breakthroughEffects: { basic: { kind: "none" }, ultimate: { kind: "none" }, ferocity: { kind: "none" }, passive: { kind: "none" } },
  },
  {
    /**
     * **벤티아.** 치즈케이크 대작전에 떼로 몰려오는 레이티아 거대겨울잠쥐 다섯 자매 중 하나다.
     *
     * 이름은 종명(레이티아 = 로마 속주 라이티아)과 같은 라틴 뿌리에서 따 ventus(바람)로 짓고,
     * 다섯이 모두 `-아`로 끝나 한배라는 것이 이름만으로 읽히게 했다. 속성을 이름에 그대로
     * 적지 않는 이유는 그러면 개체가 아니라 색표가 되기 때문이다.
     *
     * 다섯은 한배에서 난 같은 몸이라 능력치도 스킬도 같고, **갈리는 것은 속성과 걸음걸이
     * 뿐이다** — 공속·이속만 개체마다 다르게 섞는다는 규칙 그대로다. 그래서 이 던전에서
     * 고를 것은 "무엇을 데려갈까"가 아니라 "어느 색에 강한 편성인가"가 된다.
     *
     * 물량형이라고 능력치를 깎지 않는다 — 규칙대로 R 띠(2080~2200) 안에 서고, 던전이
     * 무거워지는 몫은 개체 정의가 아니라 그 관문의 레벨과 유형 배수가 갖는다.
     */
    id: "raitia-wind",
    enemyOnly: true,
    // 다섯 자매를 도감과 서사에서 한 갈래로 묶는다. 전투 능력치를 물려받는 값이 아니다.
    identityFamilyId: "raitia",
    // 이터널 시티로 밀려드는 복원체 무리라 공멸의 침투 임무와 같은 계보에 둔다.
    squad: "annihilation",
    name: "벤티아",
    specimenNumber: "211",
    projectName: "ANNIHILATION SWARM — 과식 개체군",
    excavationSite: "슬로베니아 카르스트 동굴 퇴적층",
    fossilRecord: "동굴 퇴적층에서 같은 종의 두개골 수십 점이 한 층에 겹쳐 나왔다. 그중 다섯 점은 크기와 치열이 거의 같아 한배에서 난 개체로 분류했다.",
    observationProfile: {
      originYear: "약 200만 년 전",
      // E.C.는 무엇이든 갉아 보는 유생기형 인상을 기록하며 실제 생존 햇수로 읽지 않는다.
      restorationYear: "E.C. 2년",
      lifeStage: "유체",
      height: "0.94 m",
      weight: "21 kg",
    },
    catalogSummary: "앞니와 볼주머니가 과하게 복원된 겨울잠쥐 기반 표본.",
    unlockRecord: { status: "recorded", text: "복원 후 레이티아는 잠들지 않는다. 겨울잠에 들어야 할 시기가 와도 먹기를 멈추지 않고, 볼주머니가 가득 찬 뒤에도 앞니로 계속 갉는다. 한 마리가 먹이를 찾으면 울음이 아니라 앞니 소리로 알리고, 그 소리를 들은 자매들이 같은 자리로 한꺼번에 몰려든다. 다섯째는 볼주머니를 비워 둔다. 가벼운 몸으로 먼저 달려 나가 먹이의 자리를 알리고, 앞니 소리가 가장 멀리 간다." },
    squadNote: "공멸의 소모 물량. 지시받은 방향으로 한꺼번에 흘러가 통로를 메우고, 앞의 개체가 쓰러진 자리를 뒤의 개체가 그대로 밟고 넘어간다.",
    researcherTitle: "연구원",
    rarity: "R",
    portraitAssetId: "raitia-wind",
    origin: "겨울잠쥐",
    element: "wind",
    // 앞니로 갉으며 앞줄을 메우는 몸이라 방어형이다. 다섯이 모두 같은 역할을 맡는다.
    role: "tank",
    // 앞니로 갉는 개체라 붙어야 때린다.
    reachTier: "melee",
    excavationTrait: { primaryCurrency: "cheesecake", baseProductionPerHour: 1.4, efficiencyMultiplier: 1.00 },
    stats: {
      // 다섯이 같은 몸이라 오각형은 한 벌이고, 공속·이속만 자매마다 다르다. 전투력은 전부
      // R 띠(2080~2200) 안에 든다. 주문력은 어느 스킬도 읽지 않는 값이라 낮게 둔다
      // (쓰지 않는 능력치를 높게 적지 않는다).
      hp: 1400,
      def: 100,
      res: 92,
      atk: 90,
      ap: 18,
      attackSpeed: 58,
      moveSpeed: 108,
      // 부가 능력치는 전 개체 공통값이다(`COMMON_SECONDARY_STATS`).
      critChance: 10,
      critDamage: 150,
      energyGain: 26,
      lifeSteal: 0,
      ferocityGain: 0,
    },
    ferocityTrait: {
      name: "과식",
      // 공용 자기 공속 배율을 그대로 쓴다. 떼가 한꺼번에 폭주하면 앞줄이 버티는 시간이
      // 그만큼 짧아지는 것이 이 던전의 압박이다.
      effectId: "selfAttackSpeedMultiplier",
      bonusPercent: 60,
    },
    passive: {
      id: "raitia-wind-passive",
      name: "겨울잠",
      /*
       * 겨울잠쥐가 버티는 방법은 숨은 배율이 아니라 **눈에 보이는 회복**이다 — 위험해지면
       * 한 번 웅크렸다가 다시 일어난다. 공용 계약(`emergencyRecovery`)을 그대로 쓰므로
       * 새 전투 분기가 늘지 않는다.
       */
      kind: "emergencyRecovery",
      iconAssetId: "skill-icon-healing",
      effectType: "healing",
      value: 3,
      durationSeconds: 5,
      // 전용 분기가 없는 종류라 이 문장이 그대로 화면에 선다.
      desc: "전투당 한 번, 체력이 절반 이하가 되면 5초 동안 매초 최대 체력의 3%를 회복한다.",
    },
    basic: {
      id: "raitia-wind-basic",
      name: "앞니 갉기",
      // 앞에 서서 오래 갉는 몸이라 한 대는 얕다. 무서운 것은 한 마리의 세기가 아니라 수다.
      power: 70,
      iconAssetId: "skill-icon-physical",
      effectType: "physical",
      damageType: "physical",
      targeting: "single",
    },
    ultimate: {
      id: "raitia-wind-ult",
      name: "볼주머니 쏟기",
      power: 150,
      iconAssetId: "skill-icon-physical",
      effectType: "physical",
      damageType: "physical",
      cost: 100,
      // 제 주위만 때린다. 전장 전체를 때리면 떼로 나오는 개체가 서로의 궁극기를 겹쳐
      // 아군이 한 프레임에 통째로 녹는다.
      targeting: "nearbyEnemies",
      radius: 260,
    },
    // 한계 돌파 효과는 네 칸 모두 "없음"이다 — 정해 둔 효과라 나중에 이 자리에 다른 효과를 넣으면 그대로 바뀐다.
    breakthroughEffects: { basic: { kind: "none" }, ultimate: { kind: "none" }, ferocity: { kind: "none" }, passive: { kind: "none" } },
  },
];

/** 콘텐츠 로드 시 잘못된 형식과 중복 번호를 즉시 실패시켜 저장 데이터와 UI 순서를 보호한다. */
export function validateSpecimenNumbers(relics: readonly RelicDef[]): void {
  const seen = new Set<string>();
  for (const relic of relics) {
    if (!/^\d{3}$/.test(relic.specimenNumber)) throw new Error(`개체번호는 세 자리 문자열이어야 합니다: ${relic.id}`);
    if (seen.has(relic.specimenNumber)) throw new Error(`중복 개체번호: ${relic.specimenNumber}`);
    seen.add(relic.specimenNumber);
  }
}

/** 이야기 등장 순서와 무관한 안정적인 번호순 복사본을 반환한다. */
export function sortRelicsBySpecimenNumber(relics: readonly RelicDef[]): RelicDef[] {
  return [...relics].sort((a, b) => a.specimenNumber.localeCompare(b.specimenNumber));
}

/** SSR→SR→R 순으로 묶고 같은 희귀도 안에서는 개체번호순을 유지한다. */
export function sortRelicsByRarity(relics: readonly RelicDef[]): RelicDef[] {
  const priority = { SSR: 0, SR: 1, R: 2 } as const;
  return [...relics].sort((a, b) => priority[a.rarity] - priority[b.rarity]
    || a.specimenNumber.localeCompare(b.specimenNumber));
}

validateSpecimenNumbers(RELICS);

const BY_ID = new Map(RELICS.map((r) => [r.id, r]));

export function getRelic(id: string): RelicDef {
  const found = BY_ID.get(id);
  if (!found) throw new Error(`알 수 없는 렐릭 id: ${id}`);
  return found;
}

/** 플레이어가 파티에 넣을 수 있는 렐릭. 이름 규칙이 아니라 명시적인 적 전용 계약을 따른다. */
export const PLAYABLE_RELICS = RELICS.filter((relic) => relic.enemyOnly !== true && relic.summonOnly !== true);

/**
 * 렐릭 정의의 **문구 필드**를 언어에 맞춰 갈아 끼울 수 있게 등록한다.
 *
 * 한국어는 위의 정의가 그대로 원본이고, 다른 언어만 개체 ID로 덮어쓴다 — 이 파일은 수치와
 * 서사를 함께 보며 고치는 콘텐츠 문서라, 이름 자리에 키만 남으면 어느 개체를 고치는 중인지
 * 알 수 없다. 자세한 이유는 `src/i18n/dataText.ts`의 머리 주석에 있다.
 *
 * **ID·에셋 키·수치는 등록하지 않는다.** 언어와 무관하고, 번역되면 데이터를 찾는 코드가 깨진다.
 * `specimenNumber`와 `projectName`도 그대로 둔다 — 번호와 내부 코드네임이라 언어를 타지 않는다.
 */
for (const relic of RELICS) {
  const key = (field: string): string => `relic.${relic.id}.${field}`;
  registerDataText(relic, "name", key("name"));
  registerDataText(relic, "origin", key("origin"));
  registerDataText(relic, "excavationSite", key("excavationSite"));
  registerDataText(relic, "fossilRecord", key("fossilRecord"));
  registerDataText(relic, "catalogSummary", key("catalogSummary"));
  registerDataText(relic, "squadNote", key("squadNote"));
  registerDataText(relic, "researcherTitle", key("researcherTitle"));
  registerDataText(relic.unlockRecord, "text", key("unlockRecord"));
  for (const field of ["originYear", "restorationYear", "lifeStage", "height", "weight"]) {
    registerDataText(relic.observationProfile, field, key(`observation.${field}`));
  }
  // 스킬은 슬롯 이름이 곧 자리라 개체 안에서 겹치지 않는다.
  registerDataText(relic.passive, "name", key("passive.name"));
  registerDataText(relic.passive, "desc", key("passive.desc"));
  registerDataText(relic.ferocityTrait, "name", key("ferocity.name"));
  registerDataText(relic.basic, "name", key("basic.name"));
  registerDataText(relic.ultimate, "name", key("ultimate.name"));
  // 이름을 가진 주기 스택(토리카의 「세 개의 뿔」)은 머리 위 칩과 쪽지에 그대로 선다.
  registerDataText(relic.basic, "statusEffectStackName", key("basic.stackName"));
  // 일반 공격이 순환하는 걸음마다 제 이름이 있고, 스킬 쪽지가 그 이름을 그대로 세운다.
  relic.basic.cycle?.forEach((step, index) => registerDataText(step, "name", key(`basic.step.${index}`)));
  // 프로젝트 코드네임은 관찰 일지 상단에 그대로 선다.
  registerDataText(relic, "projectName", key("projectName"));
}
