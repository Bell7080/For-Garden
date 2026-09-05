import { POISON } from "../core/skirmish";
import type { BasicAttack, RelicDef } from "../core/types";

/**
 * 렐릭 정의. 최종 30종을 목표로 하되, 지금은 파티 편성과 전투 규칙을 검증할 만큼만 둔다.
 * 밸런스 수치는 데이터일 뿐이므로 코드 수정 없이 여기서 조정한다.
 */
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
    excavationTrait: { primaryCurrency: "fossil", baseProductionPerHour: 0.30, efficiencyMultiplier: 1.10 },
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
    ferocityTrait: { name: "전투의 여왕은 나야.", effectId: "rexBattleQueen", criticalChancePoints: 25, allDamageLifeStealPoints: 25 },
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
      // kind가 battleMaidMastery인 패시브는 passiveDescription()이 실제 능력치로 다시 문장을 만들므로
      // 이 원문은 데이터 문서화용일 뿐 화면에는 쓰이지 않는다.
      desc: "전투 시작 시, 전투에 필요한 네 가지 능력이 25% 오른다.",
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
      cost: 110,
      damageHealingPercent: 50,
      // 궁극기 대상 방식은 설명문이나 렐릭 ID가 아니라 코어가 읽는 계약이다.
      targeting: "single",
      // damageHealingPercent가 있는 스킬은 skillDescription()이 대상·피해·회복을 한 문장으로
    },
  },
  {
    id: "anky",
    squad: "fang",
    name: "토리카",
    specimenNumber: "014",
    projectName: "BASTION HORN",
    excavationSite: "고비 사막 백악기 퇴적층",
    // 발굴 기록은 장소·보존 상태·복원 연구 특징만 담고, 복원 이후 생활 관찰과 분리한다.
    fossilRecord: "모래폭풍 뒤 드러난 난각 군집 곁에서 어린 개체의 골격을 수습했다. 눌렸어도 볏과 짧은 뿔의 배열은 또렷했다.",
    observationProfile: {
      originYear: "약 6,800만 년 전",
      // 유치원생 콘셉트의 인간형 신체 나잇대만 나타내며, 해츨링 후기 화석이 암시하는 순수한 성향과 함께 사용한다.
      restorationYear: "E.C. 6년",
      lifeStage: "해츨링 후기",
      height: "1.08 m",
      weight: "186 kg",
    },
    catalogSummary: "유치원생 또래의 키를 지닌 트리케라톱스 해츨링 표본.",
    unlockRecord: { status: "recorded", text: "토리카는 작은 뿔로도 누군가의 앞을 막아 서려 한다. 겁이 나면 한 걸음 물러서지만, 지켜야 할 일이 생기면 자기 생각을 또박또박 말한다. 식사 시간에는 누구보다 씩씩하고 먹성도 좋아 마지막 접시까지 챙긴다. 칭찬을 받으면 볏 끝까지 붉어진 채 친구 몫부터 슬쩍 내미는 습관이 있다." },
    rarity: "SR",
    portraitAssetId: "torika",
    origin: "트리케라톱스",
    element: "earth",
    role: "tank",
    // 들이받아 막아서는 전방 탱커.
    reachTier: "melee",
    // 발굴 특화는 전투 능력치와 무관한 운영 데이터다.
    excavationTrait: { primaryCurrency: "gold", baseProductionPerHour: 25, efficiencyMultiplier: 1.05 },
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
    // 폭주 기본 공격은 여러 대상을 자주 때리므로, 방어력 300%인 궁극기보다 낮은 15% 추가 피해로 제한한다.
    ferocityTrait: { name: "다들 그만해!", effectId: "splashDamage", damagePercent: 100, defenseDamagePercent: 15, attackSpeedBonusPercent: 20, radius: 220, statusEffect: { kind: "stagger", seconds: 0.1 } },
    passive: {
      id: "anky-passive",
      name: "온화한 방패",
      kind: "emergencyRecovery",
      iconAssetId: "skill-icon-buff",
      effectType: "healing",
      value: 7,
      durationSeconds: 5,
      desc: "전투당 한 번, 체력이 절반 이하가 되면 [[regeneration|지속 회복]]한다.",
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
      // 광역 제어가 이 개체의 값이므로 게이지를 낮춰 더 자주 돌게 한다.
      cost: 100,
      // 궁극기 대상 방식은 설명문이나 렐릭 ID가 아니라 코어가 읽는 계약이다.
      targeting: "nearbyEnemies",
      // 반경은 전투 엔진의 대상 판정용 값이며 플레이어에게는 이해하기 쉬운 대상 범위로 바꿔 표시한다.
      radius: 220,
      statusEffects: [{ kind: "stun", seconds: 3.5 }],
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
    excavationTrait: { primaryCurrency: "cheesecake", baseProductionPerHour: 0.80, efficiencyMultiplier: 1.10 },
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
    ferocityTrait: { name: "잠행", effectId: "stealthLeap", durationSeconds: 3, leapTarget: "lowestHpEnemy", landingDistance: 172 },
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
      combo: { chancePercent: 40, hitCount: 2, missingHpHealingPercentPerHit: 5 },
      // combo가 있는 BasicAttack은 skillDescription()이 구조화 필드로 다시 문장을 만들므로
    } satisfies BasicAttack,
    ultimate: {
      id: "spino-ult",
      name: "범람의 포식자",
      power: 200,
      iconAssetId: "skill-icon-physical",
      effectType: "physical",
      damageType: "physical",
      cost: 200,
      // 공격력 200%에 현재 공격 속도 150%를 더해, 두 성장 축을 함께 쓰되 공속 누적의 비중은 절제한다.
      attackSpeedPower: 150,
      // 궁극기 대상 방식은 설명문이나 렐릭 ID가 아니라 코어가 읽는 계약이다.
      targeting: "single",
      statusEffects: [{ kind: "stun", seconds: 3 }],
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
    excavationTrait: { primaryCurrency: "gold", baseProductionPerHour: 27.5, efficiencyMultiplier: 1.08 },
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
    ferocityTrait: { name: "폭주", effectId: "packHunt", stealthDurationSeconds: 3, retriggerPackHunt: true, sharedTargetAttackSpeedPercent: 25 },
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
      power: 80,
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
    // 보석은 희소성을 유지하되 기본 보관 4시간에 슬롯 하나가 최소 정수 1개를 만든다.
    excavationTrait: { primaryCurrency: "gems", baseProductionPerHour: 0.25, efficiencyMultiplier: 1.12 },
    stats: {
      hp: 760,
      def: 48,
      res: 86,
      atk: 96,
      ap: 118,
      attackSpeed: 96,
      moveSpeed: 94,
      critChance: 10,
      critDamage: 150,
      energyGain: 26,
      lifeSteal: 0,
      ferocityGain: 0,
    },
    // 공격 속도 +100%는 속도 x2이며, 계산 결과 공격 간격이 50%가 되는 계약이다.
    ferocityTrait: { name: "인비저블 썸띵?", effectId: "selfAttackSpeedMultiplier", bonusPercent: 100 },
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
      lowestHpAllyHealingFromDamagePercent: 50,
      // lowestHpAllyHealingFromDamagePercent가 있는 스킬은 skillDescription()이 대상·피해·회복을
    },
    ultimate: {
      id: "dodo-ult",
      name: "세기의 대발견... 맞죠?!",
      power: 200,
      iconAssetId: "skill-icon-magical",
      effectType: "magical",
      damageType: "magical",
      cost: 250,
      allyHealingPower: 200,
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
    excavationTrait: { primaryCurrency: "fossil", baseProductionPerHour: 0.28, efficiencyMultiplier: 1.06 },
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
    // 한자리에 버티는 아이가 아니라 물살을 타고 이리저리 뛰어드는 아이라, 폭주도 발이 빨라지고
    // 표적을 계속 바꾸는 쪽으로 발현한다 — 표식을 옮기는 패시브와 한 덩어리로 움직인다.
    ferocityTrait: { name: "이크티오 다이브!", effectId: "ichthyoDive", moveSpeedPercent: 100 },
    passive: {
      // kind가 shimmerMark인 패시브는 passiveDescription()이 구조화 필드로 다시 문장을 만들므로
      // 이 desc는 표시되지 않는 데이터 문서용 사본이다. 수치를 고치면 함수 쪽 분기도 함께 본다.
      id: "tia-passive",
      name: "반짝반짝 첨벙첨벙!",
      kind: "shimmerMark",
      iconAssetId: "skill-icon-magical",
      effectType: "magical",
      // 표식이 옮겨 갈 때 터지는 추가 피해의 주문력 계수(%)다.
      value: 100,
      desc: "적을 타격하면 반짝이는 표식을 남기고, 표식이 없는 적을 타격하면 표식이 옮겨가며 추가 마법 피해를 입힌다.",
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
      // 표식은 한 번에 한 명만 달 수 있으므로 기본 공격도 한 명을 겨눈다 — 범위로 여럿을 함께
      // 때리면 한 번 휘두를 때마다 표식이 여러 번 옮겨 가 무엇이 표식인지 읽히지 않는다.
      targeting: "single",
    },
    ultimate: {
      id: "tia-ult",
      name: "반짝이는 건 다 내 거야!",
      power: 240,
      scalingStat: "ap",
      iconAssetId: "skill-icon-magical",
      effectType: "magical",
      damageType: "magical",
      cost: 240,
      // 궁극기 대상 방식은 설명문이나 렐릭 ID가 아니라 코어가 읽는 계약이다.
      targeting: "nearbyEnemies",
      radius: 300,
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
    excavationTrait: { primaryCurrency: "gold", baseProductionPerHour: 31.5, efficiencyMultiplier: 1.10 },
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
      cost: 200,
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
    excavationTrait: { primaryCurrency: "fossil", baseProductionPerHour: 0.28, efficiencyMultiplier: 1.14 },
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
      cost: 260,
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
    excavationTrait: { primaryCurrency: "fossil", baseProductionPerHour: 0.26, efficiencyMultiplier: 1.04 },
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
      desc: "한 방에 받는 피해가 최대 체력의 40%를 넘지 않는다.",
    },
    basic: {
      id: "pachi-basic",
      name: "철거 스윙",
      power: 90,
      iconAssetId: "skill-icon-physical",
      effectType: "physical",
      damageType: "physical",
      targeting: "single",
      // 네 번째 배트가 헬멧을 울린다. 확정 치명타(periodicCritical)와 달리 부가 효과의 주기다.
      statusEffectEvery: 4,
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
      cost: 250,
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
    excavationTrait: { primaryCurrency: "cheesecake", baseProductionPerHour: 0.76, efficiencyMultiplier: 1.12 },
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
      desc: "전투를 시작할 때 현재 체력이 가장 낮은 적을 표적으로 삼고 그 자리로 도약한다. 적을 처치하면 즉시, 그 밖에는 10초마다 다시 고른다.",
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
      cost: 220,
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
    excavationTrait: { primaryCurrency: "gold", baseProductionPerHour: 26.5, efficiencyMultiplier: 1.06 },
    // 주문력에 전부 몰아준 마법형 디버프 딜러다. 공격력은 쓰는 스킬이 하나도 없으므로 가장 낮고,
    // 뒷줄에서 한 자 한 자 적는 손이라 공격 속도와 이동 속도도 낮다.
    stats: {
      hp: 900,
      def: 54,
      res: 112,
      atk: 58,
      ap: 180,
      attackSpeed: 74,
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
      desc: "저주에 걸린 적에게 기본 공격을 직접 적중시킬 때마다 이번 전투 동안 주문력이 2% 증가한다. 최대 10회까지 쌓인다.",
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
      cost: 200,
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
    excavationTrait: { primaryCurrency: "gold", baseProductionPerHour: 26.0, efficiencyMultiplier: 1.07 },
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
      value: 7,
      durationSeconds: 7,
      // 태생 치명타는 전 개체 공통이므로 암살자의 치명타형 정체성은 패시브가 만든다.
      criticalChancePercent: 5,
      criticalDamagePercent: 25,
      desc: "전투 시작 시 7초 동안 은신 상태로 진입한다.",
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
      cost: 150,
      // 아무도 때리지 않는다. 자리를 잡는 것이 전부이고 피해는 이어질 트릭 카드 한 장이 낸다.
      targeting: "self",
      // 위력을 적지 않는다. 이 궁극기의 피해는 곧 이어질 트릭 카드 한 장의 몫이라, 여기에
      // 숫자를 두면 평타 위력을 조정한 뒤 이 한 방만 옛 값으로 남는다.
      selfSetup: {
        stealthSeconds: 3,
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
    excavationTrait: { primaryCurrency: "fossil", baseProductionPerHour: 0.31, efficiencyMultiplier: 1.1 },
    /**
     * **공격력이 로스터 최저다**(46). 이 개체의 기본 공격은 방어력에서 피해를 뽑고 궁극기는
     * 아무도 때리지 않으므로, 공격력은 어디에도 쓰이지 않는다 — 쓰지 않는 능력치를 높게 적으면
     * 실전에 없는 힘이 전투력만 부풀린다(스테라의 주문력이 그랬다).
     *
     * 대신 체력·방어력·저항력이 모두 로스터 최고다. 저항이 방어보다 낮지 않은 이유는 아군의
     * 몫을 대신 받는 개체라 물리든 마법이든 가리지 않고 맞기 때문이다.
     */
    stats: {
      hp: 1640,
      def: 158,
      res: 150,
      atk: 46,
      ap: 24,
      attackSpeed: 68,
      moveSpeed: 70,
      critChance: 10,
      critDamage: 150,
      energyGain: 26,
      lifeSteal: 0,
      ferocityGain: 0,
    },
    // 맞은 만큼이 곧 회복량이 된다. 잃은 체력 비례라 아플수록 많이 돌아오고, 희열이 쌓여 있을수록
    // 더 돈다 — 안전한 자리로 물러나면 겹이 식어 회복도 함께 줄어든다.
    ferocityTrait: { name: "한 판 더", effectId: "oneMoreRound", missingHpPercentPerBasic: 2.5, missingHpPercentPerElationStack: 0.15, allyDamageHealPercent: 8 },
    passive: {
      // kind가 painfulElation인 패시브는 passiveDescription()이 구조화 필드로 문장을 만들므로
      // 이 desc는 표시되지 않는 데이터 문서용 사본이다. 수치를 고치면 함수 쪽 분기도 함께 본다.
      id: "nodonia-passive",
      name: "고통의 희열",
      kind: "painfulElation",
      iconAssetId: "skill-icon-buff",
      effectType: "buff",
      // Passive.value는 공용 필수 필드라, 이 패시브에서는 겹 하나가 올리는 비율을 담아 둔다.
      value: 4,
      durationSeconds: 5,
      elation: { maxStacks: 10, percentPerStack: 4, seconds: 5 },
      desc: "적에게 피격당할 때마다 희열이 한 겹 쌓여 겹당 방어력·저항력이 4%씩 오른다. 최대 열 겹까지 쌓이고 5초 동안 남으며, 다시 맞으면 유지 시간이 처음부터 다시 흐른다.",
    },
    basic: {
      id: "nodonia-basic",
      name: "착한 아이에게는 포상을",
      // 방어력에서 피해를 뽑는다. 앞에 서는 것이 곧 세지는 것이라, 단단해질수록 손도 매워진다.
      power: 60,
      scalingStat: "def",
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
      // 감쇠가 아니라 방어·저항 증가다 — 뚫을 창이 있으면 뚫려야 하므로, 방어 관통과 고정
      // 피해는 이 버티기를 그대로 지나간다.
      selfBulwark: { seconds: 3, redirectPercent: 100, defenseResistancePercent: 200, healFromTakenPercent: 40 },
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
    excavationTrait: { primaryCurrency: "fossil", baseProductionPerHour: 0.34, efficiencyMultiplier: 1.14 },
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
    // 굳어서 단단해지고, 그 상태로 권을 딱 한 바퀴(발경 3연) 몰아친다.
    ferocityTrait: { name: "금강불괴(金剛不壞)", effectId: "adamantBody", defenseResistancePercent: 120, hastenedAttacks: 3, attackSpeedPercent: 150 },
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
      // 세 가지 권법을 차례로 반복한다. 붙이고(보호막) — 흔들고(경직) — 쓸어낸다(광역·회복).
      cycle: [
        { name: "점(粘)", power: 90, shieldFromDamagePercent: 60 },
        { name: "화(化)", power: 120, statusEffects: [{ kind: "stagger", seconds: 0.1 }] },
        { name: "발(發)", power: 150, targeting: "nearbyEnemies", radius: 200, damageHealingPercent: 35 },
      ],
    },
    ultimate: {
      id: "ella-ult",
      name: "인(引)",
      iconAssetId: "skill-icon-buff",
      effectType: "buff",
      cost: 140,
      // 아무도 때리지 않는다. 끌어당겨 붙잡아 두고 버틴 시간을 보호막으로 바꾸는 것이 전부다.
      targeting: "self",
      selfGuard: {
        seconds: 5,
        defenseResistancePercent: 150,
        pull: { radius: 420, distance: 150 },
        tauntSeconds: 5,
        shieldFromTakenPercent: 20,
      },
    },
  },

  // --- 적 개체. 폭주해 이터널 시티를 위협하는 실패작들이다. ---
  {
    id: "husk-raptor",
    squad: "gear",
    name: "토비",
    specimenNumber: "201",
    projectName: "SEALED",
    excavationSite: "비공개",
    // 발굴 기록은 장소·보존 상태·복원 연구 특징만 담고, 복원 이후 생활 관찰과 분리한다.
    fossilRecord: "출처가 봉인된 운송함에서 갈고리 발톱과 불완전한 골격을 인계받았다. 복원 흔적이 겹쳐 원래의 매장 상태는 판독할 수 없다.",
    catalogSummary: "날렵한 체형과 갈고리 발톱이 관측된 미확인 개체.",
    unlockRecord: { status: "sealed", reason: "pending-lore" },
    rarity: "R",
    portraitAssetId: "toby",
    origin: "실패한 벨로키랍토르 개체",
    element: "fire",
    role: "assassin",
    // 갈퀴로 할퀴는 근접 허스크.
    reachTier: "melee",
    // 발굴 특화는 전투 능력치와 무관한 운영 데이터다.
    excavationTrait: { primaryCurrency: "gold", baseProductionPerHour: 22.5, efficiencyMultiplier: 1.00 },
    stats: {
      hp: 620,
      def: 38,
      res: 30,
      atk: 92,
      ap: 48,
      attackSpeed: 106,
      moveSpeed: 110,
      critChance: 12,
      critDamage: 150,
      energyGain: 24,
      lifeSteal: 0,
      ferocityGain: 0,
    },
    ferocityTrait: { name: "맹추", effectId: "attackIntervalReduction", reductionPercent: 12 },
    passive: {
      id: "husk-raptor-passive",
      name: "무리 본능",
      kind: "bleedStreak",
      iconAssetId: "skill-icon-physical",
      effectType: "physical",
      value: 3,
      desc: "같은 적을 연속으로 3번 맞히면 [[bleed|출혈]]을 남긴다.",
    },
    basic: {
      id: "husk-raptor-basic",
      name: "갈퀴 할퀴기",
      power: 100,
      iconAssetId: "skill-icon-physical",
      effectType: "physical",
      damageType: "physical",
    },
    ultimate: {
      id: "husk-raptor-ult",
      name: "무리 사냥",
      power: 170,
      iconAssetId: "skill-icon-physical",
      effectType: "physical",
      damageType: "physical",
      cost: 100,
      // 궁극기 대상 방식은 설명문이나 렐릭 ID가 아니라 코어가 읽는 계약이다.
      targeting: "single",
    },
  },
  {
    id: "husk-shell",
    squad: "rogue",
    name: "아모",
    specimenNumber: "202",
    projectName: "SEALED",
    excavationSite: "비공개",
    // 발굴 기록은 장소·보존 상태·복원 연구 특징만 담고, 복원 이후 생활 관찰과 분리한다.
    fossilRecord: "출처 불명의 암괴 안에 두꺼운 골판 조각이 층층이 남아 있었다. 복원 연구에서도 외피 결합부의 비정상적인 중첩이 확인됐다.",
    catalogSummary: "두꺼운 외피를 가진 미확인 개체.",
    unlockRecord: { status: "sealed", reason: "pending-lore" },
    rarity: "R",
    portraitAssetId: "amo",
    origin: "실패한 갑주 개체",
    element: "earth",
    role: "tank",
    // 몸통으로 밀어붙이는 근접 허스크.
    reachTier: "melee",
    // 발굴 특화는 전투 능력치와 무관한 운영 데이터다.
    excavationTrait: { primaryCurrency: "fossil", baseProductionPerHour: 0.25, efficiencyMultiplier: 1.00 },
    stats: {
      hp: 980,
      def: 92,
      res: 70,
      atk: 66,
      ap: 44,
      attackSpeed: 74,
      moveSpeed: 64,
      critChance: 5,
      critDamage: 140,
      energyGain: 18,
      lifeSteal: 0,
      ferocityGain: 0,
    },
    ferocityTrait: { name: "농성", effectId: "damageReduction", reductionPercent: 12 },
    passive: {
      id: "husk-shell-passive",
      name: "굳은 껍질",
      kind: "frontGuard",
      iconAssetId: "skill-icon-buff",
      effectType: "buff",
      value: 15,
      desc: "전방에서 받는 피해가 15% 줄어든다.",
    },
    basic: {
      id: "husk-shell-basic",
      name: "몸통 박치기",
      power: 100,
      iconAssetId: "skill-icon-physical",
      effectType: "physical",
      damageType: "physical",
    },
    ultimate: {
      id: "husk-shell-ult",
      name: "붕괴 압사",
      power: 160,
      iconAssetId: "skill-icon-physical",
      effectType: "physical",
      damageType: "physical",
      cost: 100,
      // 궁극기 대상 방식은 설명문이나 렐릭 ID가 아니라 코어가 읽는 계약이다.
      targeting: "single",
    },
  },
  {
    id: "husk-wing",
    squad: "eye",
    name: "리파",
    specimenNumber: "203",
    projectName: "SEALED",
    excavationSite: "비공개",
    // 발굴 기록은 장소·보존 상태·복원 연구 특징만 담고, 복원 이후 생활 관찰과 분리한다.
    fossilRecord: "봉인 구역에서 파손된 날개뼈 묶음을 회수했다. 골편마다 서로 다른 복원 흔적이 남아 단일 표본 여부조차 확정하지 못했다.",
    catalogSummary: "날개 형태의 사지가 관측된 미확인 개체.",
    unlockRecord: { status: "sealed", reason: "restricted" },
    rarity: "R",
    portraitAssetId: "ripa",
    origin: "실패한 익룡 개체",
    element: "water",
    role: "support",
    // 날갯짓과 굉음이 조금 떨어진 곳까지 닿는다.
    reachTier: "mid",
    // 발굴 특화는 전투 능력치와 무관한 운영 데이터다.
    excavationTrait: { primaryCurrency: "cheesecake", baseProductionPerHour: 0.60, efficiencyMultiplier: 1.00 },
    stats: {
      hp: 580,
      def: 34,
      res: 62,
      atk: 84,
      ap: 102,
      attackSpeed: 100,
      moveSpeed: 114,
      critChance: 10,
      critDamage: 150,
      energyGain: 27,
      lifeSteal: 0,
      ferocityGain: 0,
    },
    ferocityTrait: { name: "역풍", effectId: "teamMoveSpeedBonus", bonusPercent: 12 },
    passive: {
      id: "husk-wing-passive",
      name: "잔존 신호",
      kind: "emergencyRecovery",
      iconAssetId: "skill-icon-healing",
      effectType: "healing",
      value: 5,
      durationSeconds: 5,
      desc: "전투당 한 번, 체력이 절반 이하가 되면 [[regeneration|지속 회복]]한다.",
    },
    basic: {
      id: "husk-wing-basic",
      name: "날개 후려치기",
      power: 100,
      iconAssetId: "skill-icon-magical",
      effectType: "magical",
      damageType: "magical",
    },
    ultimate: {
      id: "husk-wing-ult",
      name: "굉음 확산",
      power: 150,
      iconAssetId: "skill-icon-magical",
      effectType: "magical",
      damageType: "magical",
      cost: 100,
      // 궁극기 대상 방식은 설명문이나 렐릭 ID가 아니라 코어가 읽는 계약이다.
      targeting: "single",
    },
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
    excavationTrait: { primaryCurrency: "fossil", baseProductionPerHour: 0.30, efficiencyMultiplier: 1.12 },
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
      teamAttackSpeedPercent: 20, cleanseShieldAttackPercent: 200, cleanseCooldownSeconds: 7,
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
      cost: 80, targeting: "battlefieldAllies", healing: { kind: "teamMissingHpPercent", percent: 15 },
    },
  },
  {
    // 원정 최종층의 단독 보스. 리바이어던 멜빌레이의 거대한 턱과 심해 포식자 모티브를 담는다.
    id: "pontos",
    squad: "fang",
    name: "폰토스",
    specimenNumber: "220",
    projectName: "ABYSSAL CROWN",
    excavationSite: "페루 피스코 분지 심해 퇴적층",
    // 발굴 기록은 장소·보존 상태·복원 연구 특징만 담고, 복원 이후 생활 관찰과 분리한다.
    fossilRecord: "심해 퇴적층의 저산소 점토가 거대한 턱뼈와 척추 마디를 보존했다. 압력 복원 연구에서 고래형 골격의 비정상적인 내구성이 확인됐다.",
    catalogSummary: "리바이어던 멜빌레이를 모티브로 복원된 거대 고래형 심해 개체.",
    unlockRecord: { status: "sealed", reason: "restricted" },
    rarity: "SSR",
    portraitAssetId: "pontos",
    origin: "리바이어던 멜빌레이",
    element: "water",
    role: "tank",
    // 거대한 턱은 리치가 길지만 일부러 근거리로 둔다 — 보스가 한 걸음 물러서면 붙는 데
    // 그만큼이 더 걸려 첫 해일이 5초쯤 늦고, 그만큼 원정 최종층이 통째로 쉬워진다.
    reachTier: "melee",
    /**
     * 최종 보스만 갖는 기절 저항이다. **제어를 없애는 값이 아니라 잠그지 못하게 하는 값이다.**
     *
     * 기절은 공격 쿨다운까지 멈추므로, 저항이 0이면 제어형 하나가 보스의 행동을 통째로 지울 수
     * 있다. 토리카에게 잠깐 **매 타격 1초** 기절을 줘 봤을 때 첫 해일이 24.7초에서 **72.7초**로
     * 밀려 40초를 돌려도 해일이 한 번도 나오지 않았다 — 최종 관문이 "얼마나 버티나"가 아니라
     * "기절을 가졌나"로 갈린 것이다.
     *
     * 지금의 들이받기(두 타마다 0.5초)는 저항이 0이어도 26.3초·35.2초로 원래 구간
     * (24.7초·33.5초) 안이라 이 값이 없어도 당장은 문제가 없다. 그래도 남겨 두는 이유는 그
     * 취약점이 개체가 아니라 **보스 쪽 성질**이기 때문이다 — 다음에 더 센 제어기가 들어오면
     * 같은 자리가 다시 무너진다. 50%는 어떤 제어든 절반으로 줄여 잠금을 막으면서도(0.5초는
     * 0.25초로 남아) 제어를 무의미하게 만들지 않는다. 면역(100)이나 85%로 올리면 반대로
     * 제어 개체가 보스전에서 통째로 쓸모없어진다.
     *
     * 저항을 적지 않은 일반 적에게는 기절이 그대로 다 들어간다.
     */
    stunResistancePercent: 50,
    // 적 전용 정의도 RelicDef의 완전한 정적 계약을 지켜 공용 정보창이 예외 없이 표시한다.
    excavationTrait: { primaryCurrency: "fossil", baseProductionPerHour: 0, efficiencyMultiplier: 1.00 },
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
      baseDamageReductionPercent: 50,
      maxDamageReductionPercent: 99,
      maxReductionAtHpPercent: 50,
      // 체력 기반 경감과 반올림까지 끝난 최종 받는 피해가 10 이하인 공격만 완전히 무효화한다.
      ignoreDamageAtOrBelow: 10,
      // kind가 abyssalPressure인 패시브는 passiveDescription()이 구조화 필드로 다시 문장을
      // 만들므로 이 원문은 데이터 문서화용일 뿐 화면에는 쓰이지 않는다.
      desc: "매초 기본 주문력의 2%가 복리로 누적되고, 현재 체력에 따라 받는 모든 피해가 50~99% 감소한다. 최종 받는 피해가 10 이하인 공격은 무효화한다.",
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

/** 플레이어가 파티에 넣을 수 있는 렐릭. 일반 허스크와 전용 보스 폰토스는 빠진다. */
export const PLAYABLE_RELICS = RELICS.filter((r) => !r.id.startsWith("husk-") && r.id !== "pontos");
