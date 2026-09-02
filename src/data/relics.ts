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
      power: 95,
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
      power: 100,
      iconAssetId: "skill-icon-physical",
      effectType: "physical",
      damageType: "physical",
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
      cost: 300,
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
    element: "grass",
    role: "assassin",
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
    // 물가에서 주워 오는 것이 곧 그 아이의 일이라, 발굴 특화도 화석 회수 쪽에 붙인다.
    excavationTrait: { primaryCurrency: "fossil", baseProductionPerHour: 18, efficiencyMultiplier: 1.06 },
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
      allyEnergyGain: 2,
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
      cost: 50, targeting: "battlefieldAllies", healing: { kind: "teamMissingHpPercent", percent: 20 },
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
