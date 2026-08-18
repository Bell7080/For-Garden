/**
 * 씬 사이를 오가는 진행 상태. 지금은 메모리에만 둔다.
 * (저장/서버 연동은 코어 루프가 굳은 뒤에 붙인다.)
 */

import type { Wallet } from "../core/gacha";
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
}

export const session: Session = {
  selectedStageId: null,
  party: [...STARTER_RELICS],
  cleared: new Set<string>(),
  owned: new Set(STARTER_RELICS),
  favorite: STARTER_RELICS[0],
  wallet: { fossil: 1200, amber: 10 },
};

/** 첫 스테이지와, 직전 스테이지를 깬 스테이지만 들어갈 수 있다. */
export function isStageUnlocked(stageId: string): boolean {
  const index = STAGES.findIndex((s) => s.id === stageId);
  if (index <= 0) return index === 0;
  return session.cleared.has(STAGES[index - 1].id);
}
