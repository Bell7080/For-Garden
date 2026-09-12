/**
 * 여러 화면이 함께 쓰는 이름표.
 *
 * 능력치·역할·속성의 이름은 정보창·룬 쪽지·능력치 그래프가 저마다 적어 두고 있었다. 같은 축이
 * 어디서는 `공격`, 어디서는 `공격력`인 것은 자리 폭 때문에 의도한 것이지만, **표가 다섯 곳에
 * 흩어져 있으면 한 곳만 고쳐도 나머지가 옛 이름으로 남는다.** 그래서 긴 이름과 짧은 이름을
 * 한 표에 나란히 두고 화면이 자리에 맞는 쪽을 고른다.
 */
export const COMMON_KO = {
  // 능력치 — 긴 이름은 쪽지·설명문, 짧은 이름은 오각형 축처럼 폭이 좁은 자리다.
  "stat.hp": "체력",
  "stat.atk": "공격력",
  "stat.atk.short": "공격",
  "stat.def": "방어력",
  "stat.def.short": "방어",
  "stat.res": "저항력",
  "stat.res.short": "저항",
  "stat.ap": "주문력",
  "stat.ap.short": "주문",
  "stat.attackSpeed": "공격 속도",
  "stat.moveSpeed": "이동 속도",
  "stat.critChance": "치명타 확률",
  "stat.critDamage": "치명타 피해",
  "stat.energyGain": "궁극기 충전량",
  "stat.energyGain.rune": "궁극기 충전량 증가",
  "stat.ferocityGain.rune": "야성 획득 증가",
  "stat.lifeSteal": "피해 흡혈",
  "stat.range": "사거리",

  // 역할 — 전투 공식을 바꾸지 않는 특화 태그다.
  "role.warrior": "전사",
  "role.tank": "탱커",
  "role.assassin": "암살자",
  "role.support": "지원가",

  // 재화 — 데이터 키가 화면마다 다른 이름으로 노출되지 않게 한 표가 갖는다.
  "currency.gold": "골드",
  "currency.gems": "젬",
  "currency.fossil": "화석",
  "currency.amber": "호박석",
  "currency.cheesecake": "치즈케이크",
  "currency.dnaFragments": "DNA 조각",

  // 속성
  "element.fire": "불",
  "element.water": "물",
  "element.grass": "풀",
  "element.earth": "땅",
  "element.wind": "바람",
} as const;
