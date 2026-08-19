/**
 * 씬 사이를 오가는 진행 상태. 지금은 메모리에만 둔다.
 * (저장/서버 연동은 코어 루프가 굳은 뒤에 붙인다.)
 */

import type { Wallet } from "../core/gacha";
import type { RelicProgress } from "../core/types";
import { STAGES } from "../data/stages";

/** 처음 시작할 때 쥐어 주는 렐릭. 셋이면 바로 출격할 수 있다. */
const STARTER_RELICS = ["anky", "rex", "dodo"];

export interface Session {
  /** 지도에서 고른 스테이지 id. */
  selectedStageId: string | null;
  /** 편성한 파티. 렐릭 id 3개, 0번이 전방이다. */
  party: string[];
  /** 클리어한 스테이지 id. */
  cleared: Set<string>;
  /** 보유한 렐릭. 뽑기로 늘어난다. */
  owned: Set<string>;
  /** 로비에 세워 두는 애착 렐릭. */
  favorite: string;
  wallet: Wallet;
  /** 렐릭 id별 성장/장착 상태다. 객체와 배열만 사용해 그대로 직렬화할 수 있다. */
  relicProgress: Record<string, RelicProgress>;
  /** 보유 Heart Gem id 목록이다. 중복 없는 직렬화 가능한 배열로 유지한다. */
  ownedHeartGemIds: string[];
}

/** 신규 렐릭에 부여하는 독립 복사 가능한 기본 성장 상태다. */
export function createInitialRelicProgress(): RelicProgress {
  return { level: 1, levelTitle: "복원체", dnaMastery: 0, heartGemSlots: [null, null, null] };
}

export const session: Session = {
  selectedStageId: null,
  party: [...STARTER_RELICS],
  cleared: new Set<string>(),
  owned: new Set(STARTER_RELICS),
  favorite: STARTER_RELICS[0],
  wallet: { fossil: 1200, amber: 10 },
  relicProgress: Object.fromEntries(STARTER_RELICS.map((id) => [id, createInitialRelicProgress()])),
  ownedHeartGemIds: ["vital-seed", "fang-core", "ancient-pulse"],
};

/** 첫 스테이지와, 직전 스테이지를 깬 스테이지만 들어갈 수 있다. */
export function isStageUnlocked(stageId: string): boolean {
  const index = STAGES.findIndex((s) => s.id === stageId);
  if (index <= 0) return index === 0;
  return session.cleared.has(STAGES[index - 1].id);
}
