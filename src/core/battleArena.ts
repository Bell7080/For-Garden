import type { Arena } from "./skirmish";

/**
 * 전투 모드마다 전장이 **어디부터 땅인가**.
 *
 * 전장 원화는 콘텐츠마다 다르고(`BATTLE_FIELD_BACKGROUND`), 원화마다 벽이 끝나고 바닥이
 * 시작하는 높이가 다르다. 모든 모드가 스토리 전장(6번)의 틀 하나를 쓰던 때는 대작전·현상수배·
 * 레이드의 적이 **벽 앞 허공에** 섰다 — 그 원화들은 바닥이 한참 아래에서 시작하기 때문이다.
 *
 * 값은 원화의 바닥 경계를 1080×1920 `cover` 기준으로 실측해 **그보다 한 뼘 안쪽**에 둔다.
 * 원화를 다시 구우면 같은 방법으로 재서 이 표만 고친다.
 *
 * 서버 재현(레이드 제출)도 이 표를 읽는다 — 화면과 재현의 전장이 다르면 자리·사거리·표적이
 * 갈려 규칙대로 싸운 판이 재현에서 다르게 끝난다.
 */
const BASE_ARENA: Arena = { left: 130, right: 950, top: 600, bottom: 1360 };

export const BATTLE_ARENA = {
  stage: BASE_ARENA,
  expedition: BASE_ARENA,
  expeditionBoss: BASE_ARENA,
  cake: { ...BASE_ARENA, top: 720 },
  bounty: { ...BASE_ARENA, top: 770 },
  raid: { ...BASE_ARENA, top: 860 },
} as const satisfies Record<string, Arena>;

export type BattleArenaMode = keyof typeof BATTLE_ARENA;

/** 모드의 전장. 표에 없는 모드는 스토리 전장으로 수렴한다. */
export function battleArena(mode: string): Arena {
  return { ...(BATTLE_ARENA[mode as BattleArenaMode] ?? BASE_ARENA) };
}
