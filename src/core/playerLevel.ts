/**
 * 계정(연구원) 레벨 — **렐릭 레벨과 다른 축이다.**
 *
 * 렐릭 레벨은 "그 개체를 얼마나 먹였나"이고, 연구원 레벨은 "이 계정이 얼마나 오래 싸웠나"다.
 * 수집형 RPG가 계정 레벨을 두는 이유는 둘이다 — ① **콘텐츠를 한꺼번에 열지 않고 레벨에 따라
 * 하나씩 연다**(`contentUnlock.ts`), ② 스테미나 상한이 레벨을 따라 오른다(`stamina.ts`).
 *
 * **경험치는 쓴 스테미나에서 나온다(1 스테미나 = 1 EXP).** 명일방주·블루 아카이브·니케가 모두
 * 같은 규칙을 쓴다: 전투를 몇 판 돌았는지가 아니라 **얼마나 썼는지**로 재야 배율 입장·소탕도
 * 같은 값으로 셈해지고, 싼 판을 여러 번 도는 요령이 생기지 않는다. 스테미나를 쓰는 모든
 * 경계는 서버(`FakeServer`)에 있으므로 거기서만 더한다.
 */
export const PLAYER_LEVEL_CAP = 60;
/** 1 스테미나가 주는 경험치. 운영 조정은 이 수 하나만 움직인다. */
export const PLAYER_EXP_PER_STAMINA = 1;

/**
 * 다음 레벨까지 드는 경험치.
 *
 * 초반은 빠르다 — 1 → 2가 스토리 여덟 판 남짓이라 첫 날에 몇 단계를 오르며 콘텐츠가 하나씩
 * 열리는 것을 본다. 뒤로 갈수록 제곱으로 느려져, 스테미나 상한(`ABSOLUTE_STAMINA_MAX`)이 닿는
 * 60레벨은 매일 채워 쓰는 계정이 몇 달에 걸쳐 닿는다(누적 약 8만 8천).
 */
export function playerExpToNext(level: number): number {
  const k = Math.max(0, Math.min(PLAYER_LEVEL_CAP, Math.floor(level)) - 1);
  return Math.round(50 + 15 * k + 0.9 * k * k);
}

export interface PlayerLevelProgress { level: number; experience: number; experienceToNext: number; }

/** 저장에서 읽은 값을 규칙 안으로 되돌린다. 요구치는 저장값이 아니라 늘 공식에서 다시 구한다. */
export function normalizePlayerLevel(progress: Partial<PlayerLevelProgress> | undefined): PlayerLevelProgress {
  const level = Math.max(1, Math.min(PLAYER_LEVEL_CAP, Math.floor(Number(progress?.level) || 1)));
  const experienceToNext = playerExpToNext(level);
  const raw = Math.max(0, Math.floor(Number(progress?.experience) || 0));
  return { level, experience: level >= PLAYER_LEVEL_CAP ? 0 : Math.min(raw, experienceToNext - 1), experienceToNext };
}

export interface PlayerExpGrant { progress: PlayerLevelProgress; levelsGained: number; granted: number; }

/** 경험치를 더하고 넘친 만큼 레벨을 올린다. 상한에 닿으면 남는 몫은 버린다. */
export function grantPlayerExperience(progress: PlayerLevelProgress, amount: number): PlayerExpGrant {
  const start = normalizePlayerLevel(progress);
  const gain = Math.max(0, Math.floor(Number.isFinite(amount) ? amount : 0));
  let { level, experience } = start;
  if (level >= PLAYER_LEVEL_CAP || gain === 0) return { progress: start, levelsGained: 0, granted: 0 };
  experience += gain;
  while (level < PLAYER_LEVEL_CAP && experience >= playerExpToNext(level)) {
    experience -= playerExpToNext(level);
    level += 1;
  }
  if (level >= PLAYER_LEVEL_CAP) experience = 0;
  return { progress: { level, experience, experienceToNext: playerExpToNext(level) }, levelsGained: level - start.level, granted: gain };
}

/** 스테미나를 쓴 만큼의 경험치. */
export function playerExpForStamina(stamina: number): number {
  return Math.max(0, Math.floor(stamina)) * PLAYER_EXP_PER_STAMINA;
}
