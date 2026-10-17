import type { GameSettings } from "../state/session";
import { normalizeSettings } from "./settings";

/**
 * 환경설정 값이 누구 것인지를 가르는 표다. 이 표 하나가 기준이다.
 *
 * - **계정의 값**: 전투 배속·자동 궁극기·글 속도·연출 건너뛰기·편성 추천 직군·던전 단계. 기기를 바꿔도 따라와야 하는
 *   플레이 습관이라 서버가 갖는다.
 * - **기기의 값**: 소리·진동·알림 예약·연출 강도·그래픽·글자 크기·움직임 줄이기·언어. 기기마다 달라야 하거나(스피커·
 *   화면·OS 알림 예약) 서버 답을 기다리기 전에 필요한 것(언어·글자 크기·소리)이라 로컬에만 둔다.
 */
export const ACCOUNT_GAME_SETTING_KEYS = ["battleSpeed", "autoUltimate", "formationRoleHint", "skipUltimatePresentation", "textSpeed", "dungeonTiers"] as const;

export type AccountGameSettingKey = (typeof ACCOUNT_GAME_SETTING_KEYS)[number];
export type AccountGameSettings = Pick<GameSettings["game"], AccountGameSettingKey>;
export type SettingsPatch = { [K in keyof GameSettings]?: Partial<GameSettings[K]> };

/** 설정 한 벌에서 계정의 값만 뽑는다. */
export function accountGameSettings(game: GameSettings["game"]): AccountGameSettings {
  return { battleSpeed: game.battleSpeed, autoUltimate: game.autoUltimate, formationRoleHint: game.formationRoleHint, skipUltimatePresentation: game.skipUltimatePresentation, textSpeed: game.textSpeed, dungeonTiers: { ...game.dungeonTiers } };
}

/** 부분 변경에서 계정의 값만 떼어 낸다. 없으면 `null`이다. 허용 목록 밖의 키는 버린다. */
export function accountPartOfPatch(patch: SettingsPatch): Partial<AccountGameSettings> | null {
  const game = patch.game;
  if (!game) return null;
  const out: Partial<AccountGameSettings> = {};
  for (const key of ACCOUNT_GAME_SETTING_KEYS) if (key in game && game[key] !== undefined) (out as Record<string, unknown>)[key] = game[key];
  return Object.keys(out).length > 0 ? out : null;
}

/** 서버 상태를 기기에 맞출 때 쓴다: 계정의 값은 서버 것, 나머지는 이 기기 것을 그대로 둔다. */
export function mergeServerSettings(local: unknown, server: unknown): GameSettings {
  const mine = normalizeSettings(local);
  const theirs = normalizeSettings(server);
  return normalizeSettings({ ...mine, game: { ...mine.game, ...accountGameSettings(theirs.game) }, account: theirs.account });
}
