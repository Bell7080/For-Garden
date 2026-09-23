/** 현상수배·치즈케이크 대작전이 함께 쓰는 던전 입구의 문구. */
export const DUNGEON_KO = {
  "dungeon.enemyPower": "적 전투력",
  "dungeon.reward": "보상",
  "dungeon.tier.level": "LV.{level}",
  // 야성 몫은 곱하기 전의 단계라 레벨 옆에 붉은 `+n`으로 갈라 선다.
  "dungeon.tier.bonus": "+{bonus}",
  "dungeon.multiplier": "x{value}",
  "dungeon.sortie": "출격",
  "dungeon.sweep": "소탕",
  "dungeon.sweep.title": "소탕 완료",
  // 물량형 던전의 편성 미리보기는 대표 얼굴만 세우므로 한꺼번에 몰려오는 수를 따로 적는다.
  "party.hordeCount": "적 {count}기",
} as const;
