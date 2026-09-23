import { normalizeMultiplier, type DungeonMultiplier } from "../core/dungeonShortcut";
import { raidBossDef } from "../core/raid";
import type { BattleStageDef, RelicDef } from "../core/types";
import { bountyRoundEnemy, bountyRoundLevel, BOUNTY_ROLE, BOUNTY_TIERS, getBountyTier } from "./bounty";
import { CAKE_OPERATION_TIERS, cakeOperationEnemies, cakeOperationEnemyDisplayLevel, cakeOperationRole, getCakeOperationTier } from "./cakeOperation";
import type { EncounterRole } from "../core/levelDesign";
import { RAID_SEASON_BOSS } from "./raid";
import { getRelic } from "./relics";
import { getStageEnemies, stageEnemyGrowth, stageEnemyRole } from "./stages";

/**
 * 편성 화면이 **어느 콘텐츠의 편성인가**.
 *
 * 스토리·레이드·현상수배·치즈케이크 대작전이 **같은 편성 화면**(`PartyScene`)을 쓴다. 콘텐츠마다
 * 편성 칸을 따로 그리던 때는 레이드는 카드 셋, 현상수배는 순서 칸, 대작전은 아예 편성 없이
 * 들어가서, 같은 "누구를 데려갈까"가 화면마다 다른 손짓이었다. 이제 다른 것은 **위에 서는 적**과
 * **전투 시작이 부르는 입장**뿐이고, 그 둘은 이 파일이 콘텐츠에서 읽어 온다.
 */
export type PartySceneData =
  | { content?: "stage" }
  | { content: "raid" }
  | { content: "bounty" | "cake"; tierId: string; multiplier: number };

/** 정규화된 진입. 배율은 표에 있는 값으로 좁혀 둔다. */
export type PartyContent =
  | { content: "stage" }
  | { content: "raid" }
  | { content: "bounty" | "cake"; tierId: string; multiplier: DungeonMultiplier };

/**
 * Phaser가 건넨 진입 데이터를 콘텐츠 하나로 좁힌다. 모르는 값·없는 단계는 **스토리**로 수렴한다 —
 * 지난 진입의 값으로 엉뚱한 던전의 편성이 뜨면 안 된다.
 */
export function normalizePartyContent(input: unknown): PartyContent {
  const data = (input ?? {}) as Partial<{ content: string; tierId: string; multiplier: number }>;
  if (data.content === "raid") return { content: "raid" };
  if (data.content === "bounty" && BOUNTY_TIERS.some(({ id }) => id === data.tierId)) {
    return { content: "bounty", tierId: data.tierId as string, multiplier: normalizeMultiplier(data.multiplier) };
  }
  if (data.content === "cake" && CAKE_OPERATION_TIERS.some(({ id }) => id === data.tierId)) {
    return { content: "cake", tierId: data.tierId as string, multiplier: normalizeMultiplier(data.multiplier) };
  }
  return { content: "stage" };
}

/** 미리보기에 선 적 하나. 정보창이 여는 스냅샷과 같은 모양이다. */
export interface PartyPreviewEnemy {
  def: RelicDef;
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
}

/**
 * 그 콘텐츠의 적을 **전투와 같은 함수**로 만든다. 미리보기만 기본 수치를 읽으면 여기서 본
 * 전투력이 실제 전투보다 낮게 보인다.
 */
export function partyPreview(content: PartyContent, stage: BattleStageDef): PartyPreview {
  if (content.content === "raid") {
    const def = raidBossDef(getRelic(RAID_SEASON_BOSS.relicId));
    const shown = [{ def, level: RAID_SEASON_BOSS.level, breakthrough: RAID_SEASON_BOSS.breakthrough }];
    return { shown, all: [def], role: "endless" };
  }
  if (content.content === "bounty") {
    const shown = getBountyTier(content.tierId).rounds.map((round, index) => ({
      def: bountyRoundEnemy(round), level: bountyRoundLevel(round), breakthrough: 0, round: index + 1,
    }));
    return { shown, all: shown.map(({ def }) => def), role: BOUNTY_ROLE };
  }
  if (content.content === "cake") {
    const tier = getCakeOperationTier(content.tierId);
    const all = cakeOperationEnemies(tier);
    // 다섯 자매가 차례로 되풀이되므로 앞의 다섯이 곧 이 판의 얼굴 전부다.
    const level = cakeOperationEnemyDisplayLevel(tier).level;
    const shown = all.slice(0, 5).map((def) => ({ def, level, breakthrough: 0 }));
    return { shown, all, role: cakeOperationRole(tier), hordeCount: all.length };
  }
  const all = getStageEnemies(stage);
  const growth = stageEnemyGrowth(stage);
  const shown = all.map((def, slot) => ({
    def, level: growth[slot]?.level ?? 1, breakthrough: growth[slot]?.breakthrough ?? 0,
  }));
  return { shown, all, role: stageEnemyRole(stage) };
}
