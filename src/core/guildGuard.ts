import { applyEncounterScaling, ENCOUNTER_ROLE, type EncounterRole } from "./levelDesign";
import type { Arena } from "./skirmish";
import type { Element, RelicDef } from "./types";

/**
 * 길드 수호전 — 넓은 필드의 위쪽 장판 끝과 좌우 바깥에서 그날 속성의 적이 웨이브로 몰려오고, 두 줄로 세운
 * 여섯이 그것을 막는 판이다. 아군 진형이 선 아래쪽(뒤)에서는 오지 않는다.
 *
 * **끝은 둘뿐이다** — 아군이 모두 쓰러지거나, 필드에 선 적이 상한(`GUILD_GUARD.overrunCap`)에 닿아
 * 방어선이 무너진다. 막을수록 다음 웨이브의 레벨과 머릿수가 오르므로 언젠가는 반드시 무너지고,
 * 무너지기 전까지 잡은 몫이 그 판의 점수다. 서버 재현의 길이를 묶기 위해 제한 시간
 * (`timeLimitSeconds`)이 있지만 그것은 "버텨냈다"로 끝나는 바닥이지 노리는 끝이 아니다.
 *
 * **세기는 레벨 하나와 자리의 몫(`ENCOUNTER_ROLE`)으로만 오른다** — 스테이지 전용 배율을 두지 않는다.
 * 모든 적은 `swarm`(가볍고 작게 떼로 오는 몸)으로 선다(2026-10-28 응태 요청 — 정예 자리를 걷어 냈다). 웨이브마다
 * 바뀌는 것은 레벨과 서는 수, 그리고 명단에서 섞어 고른 얼굴뿐이다. 웨이브는 시간으로 오고(`waveIntervalSeconds`) 필드가 비면 조금 당겨 온다.
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
  /**
   * 필드에 쌓인 적(들어오는 중인 몸 · 지난 웨이브에서 남은 몸 포함 — `hordeFieldCount`)이 이만큼에 닿으면 방어선이
   * 무너진 것이다(2026-10-28 응태 요청 — 32 → 18, 치즈케이크 대작전 한 판 남짓의 무리).
   */
  overrunCap: 18,
  /**
   * 수호전 제약 — 아군이 받는 회복·보호막이 이만큼(%)만 든다(2026-10-28 응태 요청 — 여섯이 서로 고쳐 주며 끝없이
   * 버티던 판을 닫는다). 적에게는 들지 않는다.
   */
  allyRestorePercent: 50,
  /**
   * 웨이브 사이. 필드가 먼저 비면 `emptyFieldDelay` 뒤에 다음 웨이브를 당겨 온다. 필드가 비어 아군이 서 있는 시간이
   * 길지 않도록 짧게 둔다(2026-10-28 응태 요청 — 12초 · 1.5초 → 8초 · 0.5초).
   */
  waveIntervalSeconds: 8,
  emptyFieldDelay: 0.5,
  /** 첫 웨이브는 전원이 서고 잠깐 숨을 고른 뒤에 내려온다. */
  firstWaveAt: 0,
  /** 서버 재현 길이를 묶는 바닥. 여기까지 버티면 "버텨냄"으로 끝난다(점수는 그대로). */
  timeLimitSeconds: 300,
  /** 미리 짜 두는 웨이브 수. 시간 안에 이보다 많이 올 수 없다(당겨 와도). */
  maxWaves: 80,
  startLevel: 1,
  /**
   * 웨이브마다 레벨이 4씩 오른다(2026-10-29 응태 요청 — 2 → 4, 상한 100 → 200). 적당히 오른 웨이브에서 이미 확실히 강해져
   * 아주 긴 웨이브를 밀지 않아도 점수가 크게 쌓이고, 상한을 풀어 깊은 웨이브에서도 계속 세진다.
   */
  levelPerWave: 4,
  maxLevel: 200,
  /**
   * 머릿수: 5 + 웨이브의 사분의 일, 상한 10. 상한(18)이 치즈케이크 대작전 한 판(10~15)을 조금 넘는 무리라, 한 웨이브가
   * 그 절반 남짓이어야 "다 못 치우면 쌓인다"가 몇 웨이브에 걸쳐 일어난다(한 번에 15씩 오면 두 웨이브 만에 끝났다).
   */
  gruntBase: 5,
  gruntPerWaves: 4,
  gruntCap: 10,
  /** 처치 점수 30 + 웨이브 × 10 — 깊이 갈수록 한 마리 몫이 가파르게 커서 오래 끄는 것보다 한두 웨이브 더 오르는 쪽이 이득이다. */
  gruntScore: 30,
  gruntScorePerWave: 10,
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
  /** 위에서 오는 몸이 나타나는 높이 — 필드 윗변보다 위, 원화의 장판이 시작하는 끝. */
  entryY: number;
  /** 아군이 받는 회복·보호막이 이만큼(%)만 든다. 없으면 깎지 않는다. */
  allyRestorePercent?: number;
}

/** 속성 하나의 명단 — 그날 몰려오는 얼굴들. 모두 무리(`swarm`)로 선다. */
export interface GuildGuardRoster {
  units: readonly RelicDef[];
}

export function guardWaveLevel(index: number): number {
  return Math.min(GUILD_GUARD.maxLevel, GUILD_GUARD.startLevel + GUILD_GUARD.levelPerWave * (index - 1));
}

export function guardWaveCount(index: number): number {
  return Math.min(GUILD_GUARD.gruntCap, GUILD_GUARD.gruntBase + Math.floor(index / GUILD_GUARD.gruntPerWaves));
}

export function guardUnitScore(index: number): number {
  return GUILD_GUARD.gruntScore + GUILD_GUARD.gruntScorePerWave * index;
}

/**
 * 웨이브 번호에서만 정해지는 웨이브 하나. 누가 서는지는 명단에서 **섞어** 고른다 — 난수 대신 웨이브·순번을 섞은
 * 값이라 서버 재현이 같은 얼굴을 고른다.
 */
export function buildGuardWave(roster: GuildGuardRoster, index: number): HordeWave {
  if (roster.units.length === 0) throw new RangeError("수호전 명단이 비었습니다.");
  const level = guardWaveLevel(index);
  const units: HordeUnit[] = [];
  for (let i = 0; i < guardWaveCount(index); i += 1) {
    const base = roster.units[guardPick(index, i) % roster.units.length];
    units.push(grownUnit(base, "swarm", level, guardUnitScore(index)));
  }
  return { index, level, units };
}

/** 웨이브 번호·순번에서 고르는 섞인 수(정수 해시). 같은 입력이면 늘 같은 값이다. */
function guardPick(index: number, slot: number): number {
  let h = Math.imul(index + 1, 0x9e3779b1) ^ Math.imul(slot + 7, 0x85ebca6b);
  h ^= h >>> 15; h = Math.imul(h, 0x2c1b3c6d); h ^= h >>> 13;
  return h >>> 0;
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

/** 미리보기 한 칸 — 그 개체가 처음 서는 웨이브의 레벨로 자란 정의다. */
export interface GuardRosterEntry { def: RelicDef; level: number; wave: number }

/**
 * 그날 명단의 얼굴들 — 개체마다 **처음 서는 웨이브**의 모습으로 한 번씩 선다. 웨이브를
 * 실제로 짜는 함수(`buildGuardWave`)를 그대로 훑으므로 미리보기와 전투가 서로 다른 레벨을 말하지 않는다.
 * `firstWavePower`의 재료로 첫 웨이브도 함께 돌려준다.
 */
export function guardRosterPreview(roster: GuildGuardRoster): { entries: GuardRosterEntry[]; firstWave: HordeWave } {
  const seen = new Map<string, GuardRosterEntry>();
  let firstWave: HordeWave | undefined;
  for (let index = 1; index <= GUILD_GUARD.maxWaves; index += 1) {
    const wave = buildGuardWave(roster, index);
    firstWave ??= wave;
    for (const unit of wave.units) {
      if (seen.has(unit.def.id)) continue;
      seen.set(unit.def.id, { def: unit.def, level: unit.level, wave: index });
    }
    if (seen.size >= new Set(roster.units.map(({ id }) => id)).size) break;
  }
  const entries = [...seen.values()].sort((a, b) => a.wave - b.wave);
  return { entries, firstWave: firstWave! };
}

/**
 * 수호전 필드(`guild_guard_field` — 난간 너머 성채가 보이는 넓은 광장). 1080×1920에 `cover`로 깔면 난간이 약 460에서
 * 끝나고 그 아래부터 화면 밑동까지, 좌우 화면 끝까지 바닥 타일이 이어진다. 그래서 적은 **두 길**로 온다 —
 * 위에서는 난간 바로 아래 장판 끝(`GUILD_GUARD_ENTRY_Y`)에서 스르륵 나타나 걸어 내려오고(하늘에서 떨어지지 않는다),
 * 옆에서는 화면 밖에서 필드 윗부분(`GUILD_GUARD_SIDE_BAND`)으로 슉 미끄러져 들어온다. 아군 진형이 선 아래쪽은 쓰지 않는다.
 */
export const GUILD_GUARD_ARENA: Arena = { left: 110, right: 970, top: 600, bottom: 1300 };
export const GUILD_GUARD_ENTRY_Y = 490;
/** 옆에서 들어오는 높이 띠 — 필드 윗변부터 앞줄(1040) 한참 위까지. 진형 뒤로 돌아 들어오지 않는다. */
export const GUILD_GUARD_SIDE_BAND = { top: 640, bottom: 940 } as const;
/** 옆에서 들어오는 몸이 서는 화면 밖 거리(필드 끝에서 바깥으로). 화면(0~1080) 밖이라 보이지 않는 곳에서 출발한다. */
const SIDE_ENTRY_OUTSET = 220;

export type HordeEntrySide = "top" | "left" | "right";

/**
 * 적이 없을 때 아군이 서는 대기 자리 — 칸 자리를 필드 가운데 쪽으로 당긴 곳이다(`guildGuardIdleSpot`).
 * 그 둘레 `standRadius` 안이면 제자리에 서 있고, 밖이면 `arriveRadius`까지 다가와 멈춘다.
 */
export const GUILD_GUARD_IDLE = { pullX: 0.25, liftY: 110, standRadius: 230, arriveRadius: 60 } as const;

export function guildGuardIdleSpot(slot: number): { x: number; y: number } {
  const spot = guildGuardSlotSpot(slot);
  const centerX = (GUILD_GUARD_ARENA.left + GUILD_GUARD_ARENA.right) / 2;
  return { x: Math.round(spot.x + (centerX - spot.x) * GUILD_GUARD_IDLE.pullX), y: spot.y - GUILD_GUARD_IDLE.liftY };
}

/**
 * 들어오는 몸의 투명도 — 위에서 오는 몸은 장판 끝에서 0으로 나타나 필드 윗변에서 1이 된다. 옆에서 오는 몸은 화면 밖에서
 * 출발하므로 처음부터 1이다. 화면만 읽고 전투 규칙에는 쓰지 않는다.
 */
export function hordeEntryAlpha(fighter: { hordeEntering?: boolean; hordeEntry?: HordeEntrySide; y: number }, arena: Arena, entryY: number = GUILD_GUARD_ENTRY_Y): number {
  if (!fighter.hordeEntering || fighter.hordeEntry === "left" || fighter.hordeEntry === "right") return 1;
  const span = Math.max(1, arena.top - entryY);
  return Math.min(1, Math.max(0, (fighter.y - entryY) / span));
}

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
    allyRestorePercent: GUILD_GUARD.allyRestorePercent,
  };
}

/**
 * 웨이브 몸들이 서는 자리 — 위(장판 끝) · 왼쪽 · 오른쪽 세 길로 나눠 선다. 몇째 몸이 어느 길로 오는지와 높이는
 * 번호에서만 정해진다(난수를 쓰지 않는다). 같은 길로 오는 몸이 여럿이면 위는 옆으로 퍼지고 뒤로 한 뼘씩 물러서며,
 * 옆은 바깥으로 한 걸음씩 밀려 차례로 들어온다.
 */
export function hordeEntrySpots(arena: Arena, entryY: number, count: number, wave: number): { x: number; y: number; from: HordeEntrySide }[] {
  const width = arena.right - arena.left;
  const sides: readonly HordeEntrySide[] = ["top", "left", "right"];
  const seen: Record<HordeEntrySide, number> = { top: 0, left: 0, right: 0 };
  return Array.from({ length: count }, (_, i) => {
    const from = sides[(i + wave) % sides.length];
    const k = seen[from]++;
    const jitter = ((wave * 37 + i * 53) % 100) / 100;
    if (from === "top") {
      const perRow = 5;
      const row = Math.floor(k / perRow);
      const column = k % perRow;
      const shift = row % 2 === 0 ? 0 : 0.09;
      const ratio = Math.min(0.95, Math.max(0.05, 0.1 + (0.8 * column) / (perRow - 1) + shift + (jitter - 0.5) * 0.12));
      return { x: Math.round(arena.left + width * ratio), y: entryY - row * 40, from };
    }
    const band = GUILD_GUARD_SIDE_BAND;
    const y = Math.round(band.top + (band.bottom - band.top) * ((jitter + k * 0.37) % 1));
    const out = SIDE_ENTRY_OUTSET + k * 90;
    return { x: from === "left" ? arena.left - out : arena.right + out, y, from };
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
