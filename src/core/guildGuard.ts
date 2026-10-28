import { applyEncounterScaling, ENCOUNTER_ROLE, type EncounterRole } from "./levelDesign";
import type { Arena } from "./skirmish";
import type { Element, RelicDef } from "./types";

/**
 * 길드 수호전 — 넓은 필드 위쪽 바깥에서 그날 속성의 적이 웨이브로 몰려 내려오고, 두 줄로 세운
 * 여섯이 그것을 막는 판이다.
 *
 * **끝은 둘뿐이다** — 아군이 모두 쓰러지거나, 필드에 선 적이 상한(`GUILD_GUARD.overrunCap`)에 닿아
 * 방어선이 무너진다. 막을수록 다음 웨이브의 레벨과 머릿수가 오르므로 언젠가는 반드시 무너지고,
 * 무너지기 전까지 잡은 몫이 그 판의 점수다. 서버 재현의 길이를 묶기 위해 제한 시간
 * (`timeLimitSeconds`)이 있지만 그것은 "버텨냈다"로 끝나는 바닥이지 노리는 끝이 아니다.
 *
 * **세기는 레벨 하나와 자리의 몫(`ENCOUNTER_ROLE`)으로만 오른다** — 스테이지 전용 배율을 두지 않는다.
 * 무리는 `swarm`(가볍고 작게), 정예는 `elite`(혼자 서는 두꺼운 몸)로 서고, 웨이브마다 바뀌는 것은
 * 레벨과 서는 수뿐이다. 웨이브는 시간으로 오고(`waveIntervalSeconds`) 필드가 비면 조금 당겨 온다.
 *
 * 난수를 쓰지 않는다 — 누가 어디서 나오는지는 웨이브 번호에서만 정해지므로 서버가 편성과 날짜만으로
 * 같은 판을 다시 굴린다.
 */
export const GUILD_GUARD = {
  /** 하루에 막을 수 있는 횟수. 00:00 UTC에 돌아온다. */
  attemptsPerDay: 2,
  /** 편성 칸. 앞줄 셋(0~2) · 뒷줄 셋(3~5). */
  slots: 6,
  frontSlots: [0, 1, 2] as const,
  backSlots: [3, 4, 5] as const,
  /** 필드에 동시에 선 적이 이만큼에 닿으면 방어선이 무너진 것이다. */
  overrunCap: 24,
  /** 웨이브 사이. 필드가 먼저 비면 `emptyFieldDelay` 뒤에 다음 웨이브를 당겨 온다. */
  waveIntervalSeconds: 12,
  emptyFieldDelay: 1.5,
  /** 첫 웨이브는 전원이 서고 잠깐 숨을 고른 뒤에 내려온다. */
  firstWaveAt: 0,
  /** 서버 재현 길이를 묶는 바닥. 여기까지 버티면 "버텨냄"으로 끝난다(점수는 그대로). */
  timeLimitSeconds: 300,
  /** 미리 짜 두는 웨이브 수. 시간 안에 이보다 많이 올 수 없다(당겨 와도). */
  maxWaves: 60,
  startLevel: 1,
  levelPerWave: 3,
  maxLevel: 100,
  /** 무리 머릿수: 3 + 웨이브의 삼분의 일, 상한 8. */
  gruntBase: 3,
  gruntCap: 8,
  /** 정예는 셋째 웨이브부터 세 웨이브마다. 아홉 웨이브마다 하나씩 더 선다. */
  eliteEvery: 3,
  eliteExtraEvery: 9,
  /** 무리는 처치 점수 10 + 웨이브, 정예는 60 + 웨이브×5. */
  gruntScore: 10,
  eliteScore: 60,
  eliteScorePerWave: 5,
} as const;

export const GUILD_GUARD_FRONT_ROWS = 2;

/** 한 웨이브에 서는 몸 하나. 정의는 그 웨이브의 레벨로 이미 자라 있다. */
export interface HordeUnit {
  def: RelicDef;
  role: EncounterRole;
  bodyScale: number;
  score: number;
  level: number;
}

export interface HordeWave {
  index: number;
  level: number;
  units: HordeUnit[];
}

/** 난전 코어에 넘기는 웨이브 계약. 함수가 없어 그대로 직렬화된다. */
export interface HordeSpec {
  waves: readonly HordeWave[];
  overrunCap: number;
  waveIntervalSeconds: number;
  emptyFieldDelay: number;
  firstWaveAt: number;
  /** 몸이 서는 높이(필드 윗변보다 위 — 화면 바깥). */
  entryY: number;
}

/** 속성 하나의 명단. 무리는 가벼운 몸, 정예는 SR·SSR급이다. */
export interface GuildGuardRoster {
  grunts: readonly RelicDef[];
  elites: readonly RelicDef[];
}

export function guardWaveLevel(index: number): number {
  return Math.min(GUILD_GUARD.maxLevel, GUILD_GUARD.startLevel + GUILD_GUARD.levelPerWave * (index - 1));
}

export function guardWaveCounts(index: number): { grunts: number; elites: number } {
  const grunts = Math.min(GUILD_GUARD.gruntCap, GUILD_GUARD.gruntBase + Math.floor(index / 3));
  const elites = index >= GUILD_GUARD.eliteEvery && index % GUILD_GUARD.eliteEvery === 0
    ? 1 + Math.floor((index - GUILD_GUARD.eliteEvery) / GUILD_GUARD.eliteExtraEvery)
    : 0;
  return { grunts, elites };
}

export function guardUnitScore(role: "grunt" | "elite", index: number): number {
  return role === "grunt" ? GUILD_GUARD.gruntScore + index : GUILD_GUARD.eliteScore + GUILD_GUARD.eliteScorePerWave * index;
}

/** 웨이브 번호에서만 정해지는 웨이브 하나. 누가 서는지는 명단을 번호로 돌려 고른다. */
export function buildGuardWave(roster: GuildGuardRoster, index: number): HordeWave {
  if (roster.grunts.length === 0) throw new RangeError("수호전 명단에 무리가 없습니다.");
  const level = guardWaveLevel(index);
  const { grunts, elites } = guardWaveCounts(index);
  const units: HordeUnit[] = [];
  for (let i = 0; i < grunts; i += 1) {
    const base = roster.grunts[(index * 7 + i * 3) % roster.grunts.length];
    units.push(grownUnit(base, "swarm", level, guardUnitScore("grunt", index)));
  }
  for (let i = 0; i < elites && roster.elites.length > 0; i += 1) {
    const base = roster.elites[(index + i * 5) % roster.elites.length];
    // 정예는 무리 사이에 끼어 온다 — 줄 가운데쯤에 넣어 맨 끝에 혼자 따로 서지 않게 한다.
    units.splice(Math.min(units.length, 2 + i * 3), 0, grownUnit(base, "elite", level, guardUnitScore("elite", index)));
  }
  return { index, level, units };
}

function grownUnit(base: RelicDef, role: EncounterRole, level: number, score: number): HordeUnit {
  return {
    def: { ...base, encounterRole: role, stats: applyEncounterScaling(base.stats, level, role, 1) },
    role,
    bodyScale: ENCOUNTER_ROLE[role].bodyScale,
    score,
    level,
  };
}

export function buildGuardWaves(roster: GuildGuardRoster): HordeWave[] {
  return Array.from({ length: GUILD_GUARD.maxWaves }, (_, i) => buildGuardWave(roster, i + 1));
}

/**
 * 수호전 필드. 원정 전장 원화(위로 길게 뻗은 길)를 쓴다. 적은 윗변보다 위, 화면 바깥에서 들어와 길을 내려온다.
 * 윗변은 그 원화에서 길(바닥)이 시작하는 높이(약 550)보다 한 뼘 안쪽이다 — 더 올리면 물과 폐허 위에 선다.
 */
export const GUILD_GUARD_ARENA: Arena = { left: 110, right: 970, top: 600, bottom: 1300 };
export const GUILD_GUARD_ENTRY_Y = -140;

/**
 * 여섯 칸의 자리. 앞줄이 위(적 쪽), 뒷줄이 아래다.
 *
 * **얼마나 앞으로 나설 수 있는가**(`leashTop`)도 자리가 정한다. 앞줄은 필드 끝까지 쫓아 올라가 원거리 무리도
 * 붙잡을 수 있고, 뒷줄은 필드 가운데까지만 나서 진형의 뒤를 지킨다 — 뒷줄까지 끝없이 올라가면 지원가가 무리 한가운데에 선다.
 */
export function guildGuardSlotSpot(slot: number): { x: number; y: number; leashTop: number } {
  if (!Number.isInteger(slot) || slot < 0 || slot >= GUILD_GUARD.slots) throw new RangeError("수호전 칸은 0~5입니다.");
  const column = slot % 3;
  const front = slot < 3;
  const x = [300, 540, 780][column];
  return front ? { x, y: 1040, leashTop: GUILD_GUARD_ARENA.top } : { x, y: 1220, leashTop: 820 };
}

export function guildGuardHordeSpec(roster: GuildGuardRoster): HordeSpec {
  return {
    waves: buildGuardWaves(roster),
    overrunCap: GUILD_GUARD.overrunCap,
    waveIntervalSeconds: GUILD_GUARD.waveIntervalSeconds,
    emptyFieldDelay: GUILD_GUARD.emptyFieldDelay,
    firstWaveAt: GUILD_GUARD.firstWaveAt,
    entryY: GUILD_GUARD_ENTRY_Y,
  };
}

/** 웨이브 몸들이 서는 자리. 화면 위 바깥에서 줄지어 엇갈려 선다(번호에서만 정해진다). */
export function hordeEntrySpots(arena: Arena, entryY: number, count: number, wave: number): { x: number; y: number }[] {
  const width = arena.right - arena.left;
  const perRow = 5;
  return Array.from({ length: count }, (_, i) => {
    const row = Math.floor(i / perRow);
    const column = i % perRow;
    const jitter = (((wave * 37 + i * 53) % 100) / 100 - 0.5) * 0.12;
    const shift = row % 2 === 0 ? 0 : 0.09;
    const ratio = Math.min(0.95, Math.max(0.05, 0.1 + (0.8 * column) / (perRow - 1) + shift + jitter));
    return { x: Math.round(arena.left + width * ratio), y: entryY - row * 90 };
  });
}

/** 하루 판의 열쇠(UTC 날짜 번호). 도전 횟수와 기록이 이 번호로 묶인다. */
export function guildGuardDayKey(now: number): number {
  return Math.floor(now / 86_400_000);
}

export interface GuildGuardAttemptState {
  day: number;
  used: number;
}

export function guildGuardAttemptsLeft(state: GuildGuardAttemptState | undefined, now: number): number {
  if (!state || state.day !== guildGuardDayKey(now)) return GUILD_GUARD.attemptsPerDay;
  return Math.max(0, GUILD_GUARD.attemptsPerDay - state.used);
}

/** 편성 검증 — 여섯 칸, 빈칸은 null, 같은 렐릭 두 번 금지, 최소 한 명. */
export function normalizeGuildGuardFormation(slots: readonly (string | null)[]): (string | null)[] {
  if (slots.length !== GUILD_GUARD.slots) throw new RangeError("수호전 편성은 여섯 칸입니다.");
  const seen = new Set<string>();
  const out = slots.map((id) => {
    if (id === null) return null;
    if (typeof id !== "string" || id.length === 0 || seen.has(id)) throw new RangeError("수호전 편성이 올바르지 않습니다.");
    seen.add(id);
    return id;
  });
  if (seen.size === 0) throw new RangeError("수호전 편성이 비었습니다.");
  return out;
}

/** 길드 안 순위: 오늘 최고 점수 내림차순, 같으면 먼저 낸 사람. */
export interface GuildGuardRecord { accountId: string; name: string; score: number; at: number; level?: number; faceRelicId?: string }
export function rankGuildGuardMembers<T extends GuildGuardRecord>(records: readonly T[]): (T & { rank: number })[] {
  return [...records].sort((a, b) => b.score - a.score || a.at - b.at).map((record, i) => ({ ...record, rank: i + 1 }));
}

/** 길드 점수 = 길드원 오늘 최고 점수의 합. */
export function guildGuardTotal(records: readonly { score: number }[]): number {
  return records.reduce((sum, record) => sum + Math.max(0, Math.round(record.score)), 0);
}

export type GuildGuardElement = Element;

/**
 * 칸마다 추천하는 직군 — 앞줄은 몸으로 막는 탱커·전사, 뒷줄은 뒤에서 받치는 지원가·암살자다.
 * 편성 화면의 빈 칸이 이 표를 읽고, 자동 배치(`arrangeGuardFormation`)도 같은 순서로 세운다.
 */
export const GUILD_GUARD_SLOT_ROLES: readonly (readonly RelicDef["role"][])[] = [
  ["tank", "warrior"], ["tank", "warrior"], ["tank", "warrior"],
  ["support", "assassin"], ["support", "assassin"], ["support", "assassin"],
];

const GUARD_FRONT_PRIORITY: Readonly<Record<RelicDef["role"], number>> = { tank: 0, warrior: 1, assassin: 2, support: 3 };

/**
 * 고른 렐릭을 여섯 칸에 세운다 — 앞줄을 먼저 몸으로 막는 직군이 채우고 나머지가 뒷줄에 선다.
 * 같은 직군끼리는 들어온 순서를 지키고, 모자란 칸은 비워 둔다.
 */
export function arrangeGuardFormation(relics: readonly RelicDef[]): (string | null)[] {
  const ordered = relics
    .slice(0, GUILD_GUARD.slots)
    .map((relic, index) => ({ relic, index }))
    .sort((a, b) => GUARD_FRONT_PRIORITY[a.relic.role] - GUARD_FRONT_PRIORITY[b.relic.role] || a.index - b.index)
    .map(({ relic }) => relic.id);
  return Array.from({ length: GUILD_GUARD.slots }, (_, slot) => ordered[slot] ?? null);
}
