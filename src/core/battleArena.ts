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
  // 결투장 필드는 관중석 벽이 아래까지 내려와 바닥이 얕았다(원본 기준 1,000~1,400) — 두 편이 코앞에서 시작했다.
  // 그래서 원화를 `BATTLE_FIELD_FRAMING.duel`만큼 키워 좌측·상단을 잘라 내고(우하단 고정) 땅을 넓혔다.
  // 확대 뒤 바닥은 실측 약 670~1,440이라 관중석 벽 밑동(740)부터 앞 난간 앞(1,360)까지를 전장으로 쓴다.
  duel: { ...BASE_ARENA, top: 740 },
} as const satisfies Record<string, Arena>;

export type BattleArenaMode = keyof typeof BATTLE_ARENA;

/** 모드의 전장. 표에 없는 모드는 스토리 전장으로 수렴한다. */
export function battleArena(mode: string): Arena {
  return { ...(BATTLE_ARENA[mode as BattleArenaMode] ?? BASE_ARENA) };
}

/**
 * 전장 원화를 화면에 놓는 방식. 기본은 화면을 꽉 채우는 `cover`(배율 1, 가운데)이고,
 * 땅이 얕은 원화만 `zoom`으로 키운 뒤 `anchor`(0 = 왼쪽·위, 1 = 오른쪽·아래) 반대편을 잘라 낸다.
 * 위 `BATTLE_ARENA`의 땅 높이는 이 표의 틀로 잰 값이라 둘을 함께 고친다.
 */
export interface FieldFraming { zoom: number; anchorX: number; anchorY: number }

export const BATTLE_FIELD_FRAMING: Readonly<Record<string, FieldFraming>> = {
  duel: { zoom: 1.35, anchorX: 1, anchorY: 1 },
};
