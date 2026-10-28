import { RAID_BOSS_ROLE, raidBossDef, raidBossGrowth } from "../core/raid";
import type { BattleStageDef, RelicDef } from "../core/types";
import { bountyRoundEnemy, bountyRoundLevel, BOUNTY_ROLE, BOUNTY_TIERS, getBountyTier } from "./bounty";
import { CAKE_OPERATION_TIERS, cakeOperationEnemies, cakeOperationEnemyDisplayLevel, cakeOperationRole, getCakeOperationTier } from "./cakeOperation";
import { requiredBreakthroughForLevel, type EncounterRole } from "../core/levelDesign";
import { isRaidDifficulty, type RaidDifficulty } from "./raid";
import { getRelic } from "./relics";
import { getStageEnemies, stageEnemyGrowth, stageEnemyRole } from "./stages";
import { duelGrownStats } from "../core/duelArena";
import { GUILD_GUARD_ELEMENTS } from "../core/guildPages";
import type { Element } from "../core/types";
import { guildGuardRoster } from "./guildGuard";
import { parseGuildWarSlotId } from "../core/guildWarMap";

/**
 * 편성 화면이 **어느 콘텐츠의 편성인가**.
 *
 * 스토리·레이드·현상수배·치즈케이크 대작전이 **같은 편성 화면**(`PartyScene`)을 쓴다. 콘텐츠마다
 * 편성 칸을 따로 그리던 때는 레이드는 카드 셋, 현상수배는 순서 칸, 대작전은 아예 편성 없이
 * 들어가서, 같은 "누구를 데려갈까"가 화면마다 다른 손짓이었다. 이제 다른 것은 **위에 서는 적**과
 * **전투 시작이 부르는 입장**뿐이고, 그 둘은 이 파일이 콘텐츠에서 읽어 온다.
 */
export type PartySceneData = PartyContent | { content?: "stage" };

/**
 * 결투 상대 하나 — 결투장 화면이 받은 그대로다(`DuelOpponentDto`). 가려진 칸은 `relicId`가 `null`이고
 * 레벨·전투력만 남는다. 편성 화면은 그 값을 서버에 다시 묻지 않는다.
 */
export interface DuelPartyOpponent {
  id: string;
  displayName: string;
  score: number;
  totalPower: number;
  units: readonly { relicId: string | null; level: number; breakthrough: number; power: number }[];
}

/** 정규화된 진입. 단계는 표에 있는 값만 남는다. */
export type PartyContent =
  | { content: "stage" }
  | { content: "raid"; raidId: string; bossRelicId: string; difficulty: RaidDifficulty }
  | { content: "bounty" | "cake"; tierId: string }
  /** 결투 공격 — 위에 상대 방어덱이 서고, 전투 시작이 도전권 하나를 쓴다. 시작 편성은 지난 공격덱이다. */
  | { content: "duel"; opponent: DuelPartyOpponent; attack: readonly string[] }
  /** 결투 방어덱 — 위에 적이 없고, 저장이 곧 게시다. 가릴 렐릭의 순서도 여기서 고른다. */
  | { content: "duelDefense"; defense: readonly string[]; blindChoice: readonly string[] }
  /** 길드 수호전 — 위에 적이 없고(웨이브로 몰려온다) 여섯 칸 두 줄이다. 그날의 적 속성을 함께 든다. */
  | { content: "guildGuard"; element: Element }
  /** 길드전 방어덱 — 지도의 칸 하나에 셋을 세운다. 위에 적이 없고 저장이 곧 배치다. 시작 편성은 그 칸에 지금 선 덱이다. */
  | { content: "guildWarDefense"; slotId: string; deck: readonly string[] }
  /** 길드전 공격 — 위에 상대 칸의 방어덱이 서고, 전투 시작이 공격 한 번을 쓴다. */
  | { content: "guildWar"; slotId: string; defenderName: string; units: readonly GuildWarPartyUnit[] };

/** 길드전 상대 칸의 방어덱 한 자리 — 전선(`getWarFront`)이 내려 준 공개 값 그대로다. */
export interface GuildWarPartyUnit { relicId: string; level: number; breakthrough: number; power: number }

const stringIds = (value: unknown, limit: number): string[] =>
  Array.isArray(value) ? value.filter((id): id is string => typeof id === "string").slice(0, limit) : [];

function normalizeDuelOpponent(value: unknown): DuelPartyOpponent | undefined {
  const source = value as Partial<DuelPartyOpponent> | undefined;
  if (!source || typeof source.id !== "string" || typeof source.displayName !== "string" || !Number.isFinite(source.score) || !Array.isArray(source.units) || source.units.length !== 3) return undefined;
  const units = source.units.map((unit) => ({
    relicId: typeof unit?.relicId === "string" ? unit.relicId : null,
    level: Number.isFinite(unit?.level) ? unit.level : 1,
    breakthrough: Number.isFinite(unit?.breakthrough) ? unit.breakthrough : 0,
    power: Number.isFinite(unit?.power) ? unit.power : 0,
  }));
  return { id: source.id, displayName: source.displayName, score: source.score as number, totalPower: Number.isFinite(source.totalPower) ? source.totalPower as number : 0, units };
}

/**
 * Phaser가 건넨 진입 데이터를 콘텐츠 하나로 좁힌다. 모르는 값·없는 단계는 **스토리**로 수렴한다 —
 * 지난 진입의 값으로 엉뚱한 던전의 편성이 뜨면 안 된다.
 */
export function normalizePartyContent(input: unknown): PartyContent {
  const data = (input ?? {}) as Partial<{ content: string; tierId: string; raidId: string; bossRelicId: string; difficulty: string; opponent: unknown; attack: unknown; defense: unknown; blindChoice: unknown; element: string; slotId: string; deck: unknown; defenderName: string; units: unknown }>;
  if (data.content === "duel") {
    const opponent = normalizeDuelOpponent(data.opponent);
    if (opponent) return { content: "duel", opponent, attack: stringIds(data.attack, 3) };
  }
  if (data.content === "duelDefense") {
    const defense = stringIds(data.defense, 3);
    return { content: "duelDefense", defense, blindChoice: stringIds(data.blindChoice, 3).filter((id) => defense.includes(id)).slice(0, 2) };
  }
  if (data.content === "guildWarDefense" && parseGuildWarSlotId(data.slotId)) {
    return { content: "guildWarDefense", slotId: data.slotId as string, deck: stringIds(data.deck, 3) };
  }
  if (data.content === "guildWar" && parseGuildWarSlotId(data.slotId) && Array.isArray(data.units) && data.units.length === 3) {
    const units = (data.units as Partial<GuildWarPartyUnit>[]).map((unit) => ({
      relicId: typeof unit?.relicId === "string" ? unit.relicId : "",
      level: Number.isFinite(unit?.level) ? unit.level as number : 1,
      breakthrough: Number.isFinite(unit?.breakthrough) ? unit.breakthrough as number : 0,
      power: Number.isFinite(unit?.power) ? unit.power as number : 0,
    }));
    if (units.every(({ relicId }) => relicId.length > 0)) {
      return { content: "guildWar", slotId: data.slotId as string, defenderName: typeof data.defenderName === "string" ? data.defenderName : "", units };
    }
  }
  if (data.content === "guildGuard" && (GUILD_GUARD_ELEMENTS as readonly string[]).includes(data.element ?? "")) {
    return { content: "guildGuard", element: data.element as Element };
  }
  // 레이드는 **어느 판인가**까지 있어야 한다 — 판 ID가 빠진 진입은 어느 체력을 깎을지 모른다.
  if (data.content === "raid" && typeof data.raidId === "string" && typeof data.bossRelicId === "string" && isRaidDifficulty(data.difficulty)) {
    return { content: "raid", raidId: data.raidId, bossRelicId: data.bossRelicId, difficulty: data.difficulty };
  }
  if (data.content === "bounty" && BOUNTY_TIERS.some(({ id }) => id === data.tierId)) {
    return { content: "bounty", tierId: data.tierId as string };
  }
  if (data.content === "cake" && CAKE_OPERATION_TIERS.some(({ id }) => id === data.tierId)) {
    return { content: "cake", tierId: data.tierId as string };
  }
  return { content: "stage" };
}

/**
 * 진 판의 「편성 바꾸기」가 가는 곳. **그 판에 들어온 콘텐츠의 편성**으로 돌아간다 — 스토리는 스토리
 * 편성, 대작전·현상수배는 그 단계의 편성이다. 결투는 같은 상대와 다시 싸울 수 없어 편성이 상대에 묶여
 * 있으므로, 결투장으로 가서 상대 고르기 창을 곧바로 연다(고른 상대의 공격 편성이 그다음이다).
 */
export type DefeatPartyRoute =
  | { scene: "party"; data: PartyContent }
  | { scene: "duel"; data: { openOpponents: true } }
  /** 길드전 공격은 칸에 묶여 있어 길드전 판으로 돌아가 칸을 다시 고른다. */
  | { scene: "guild"; data: { page: "war" } };

export function defeatPartyRoute(input: { mode: string; tierId?: string }): DefeatPartyRoute {
  if (input.mode === "duel") return { scene: "duel", data: { openOpponents: true } };
  if (input.mode === "guildWar") return { scene: "guild", data: { page: "war" } };
  if ((input.mode === "cake" || input.mode === "bounty") && typeof input.tierId === "string") {
    return { scene: "party", data: normalizePartyContent({ content: input.mode, tierId: input.tierId }) };
  }
  return { scene: "party", data: { content: "stage" } };
}

/** 미리보기에 선 적 하나. 정보창이 여는 스냅샷과 같은 모양이다. */
export interface PartyPreviewEnemy {
  /** 결투에서 가려진 칸만 비어 있다 — 누구인지 모르므로 `?` 실루엣과 레벨·전투력만 선다. */
  def: RelicDef | null;
  /** 그 개체의 전투력. 가려진 칸은 정의가 없어 이 값이 유일한 무게다. */
  power?: number;
  level: number;
  breakthrough: number;
  /** 현상수배만 — 이 정예가 몇 번째 라운드에 서는지(1부터). 아래 같은 열의 아군이 상대한다. */
  round?: number;
}

export interface PartyPreview {
  /** 위 줄에 세울 적. 물량형은 대표 얼굴(자매 다섯)만 선다. */
  shown: PartyPreviewEnemy[];
  /** 실제로 서는 적 전부. 종합 전투력과 자동 편성·상성 방향이 이 목록을 읽는다. */
  all: RelicDef[];
  /** 그 적이 서는 조우 유형. 몸집과 머리 위 표식이 이 값을 읽는다. */
  role: EncounterRole;
  /** 물량형이면 한꺼번에 몰려오는 수. 대표 얼굴만 세우므로 수를 따로 말한다. */
  hordeCount?: number;
  /** 적 편 총 전투력을 정의에서 더하지 않고 이 값으로 적는다(가려진 칸이 있는 결투). */
  totalPower?: number;
}

/**
 * 그 콘텐츠의 적을 **전투와 같은 함수**로 만든다. 미리보기만 기본 수치를 읽으면 여기서 본
 * 전투력이 실제 전투보다 낮게 보인다.
 */
export function partyPreview(content: PartyContent, stage: BattleStageDef): PartyPreview {
  if (content.content === "duelDefense" || content.content === "guildWarDefense") return { shown: [], all: [], role: "normal" };
  // 수호전은 위에 세울 적이 없다 — 그날 속성의 명단이 자동 배치의 상성 방향만 정한다.
  if (content.content === "guildGuard") {
    const roster = guildGuardRoster(content.element);
    return { shown: [], all: [...new Set(roster.units)], role: "swarm" };
  }
  if (content.content === "guildWar") {
    // 방어덱은 게시한 순간의 레벨·돌파로 선다 — 입장이 돌려줄 스냅샷과 같은 성장 축이다(룬만 빠진다).
    const shown = content.units.map((unit) => {
      const base = getRelic(unit.relicId);
      return { def: { ...base, stats: duelGrownStats(base, unit.level, unit.breakthrough) }, level: unit.level, breakthrough: unit.breakthrough, power: unit.power };
    });
    return { shown, all: shown.map(({ def }) => def), role: "normal", totalPower: content.units.reduce((sum, { power }) => sum + power, 0) };
  }
  if (content.content === "duel") {
    // 보이는 칸은 입장이 세울 것과 같은 성장(`duelGrownStats`)으로 선다. 가려진 칸은 상성 계산에도 들지 않는다.
    const shown = content.opponent.units.map((unit) => {
      if (!unit.relicId) return { def: null, level: unit.level, breakthrough: unit.breakthrough, power: unit.power };
      const base = getRelic(unit.relicId);
      return { def: { ...base, stats: duelGrownStats(base, unit.level, unit.breakthrough) }, level: unit.level, breakthrough: unit.breakthrough, power: unit.power };
    });
    return { shown, all: shown.flatMap(({ def }) => (def ? [def] : [])), role: "normal", totalPower: content.opponent.totalPower };
  }
  if (content.content === "raid") {
    const def = raidBossDef(getRelic(content.bossRelicId), content.difficulty);
    const shown = [{ def, ...raidBossGrowth(content.difficulty) }];
    return { shown, all: [def], role: RAID_BOSS_ROLE };
  }
  if (content.content === "bounty") {
    const shown = getBountyTier(content.tierId).rounds.map((round, index) => ({
      def: bountyRoundEnemy(round), level: bountyRoundLevel(round), breakthrough: requiredBreakthroughForLevel(bountyRoundLevel(round)), round: index + 1,
    }));
    return { shown, all: shown.map(({ def }) => def), role: BOUNTY_ROLE };
  }
  if (content.content === "cake") {
    const tier = getCakeOperationTier(content.tierId);
    const all = cakeOperationEnemies(tier);
    // 다섯 자매가 차례로 되풀이되므로 앞의 다섯이 곧 이 판의 얼굴 전부다.
    const level = cakeOperationEnemyDisplayLevel(tier).level;
    const shown = all.slice(0, 5).map((def) => ({ def, level, breakthrough: requiredBreakthroughForLevel(level) }));
    return { shown, all, role: cakeOperationRole(tier), hordeCount: all.length };
  }
  const all = getStageEnemies(stage);
  const growth = stageEnemyGrowth(stage);
  const shown = all.map((def, slot) => ({
    def, level: growth[slot]?.level ?? 1, breakthrough: growth[slot]?.breakthrough ?? 0,
  }));
  return { shown, all, role: stageEnemyRole(stage) };
}
