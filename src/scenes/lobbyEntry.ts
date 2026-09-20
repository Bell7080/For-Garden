/**
 * 로비로 **돌아올 때 어느 판이 다시 열리는가**.
 *
 * 출격·결투는 씬이 아니라 로비 위의 판이라(`openSortieMenu`·`openPvpMenu`), 거기서 고른
 * 콘텐츠를 보고 돌아오면 판이 사라진 로비가 남았다 — 스토리를 한 번 들여다보고 원정을
 * 보려면 출격을 다시 눌러 판을 다시 열어야 했다. 고른 자리로 되돌아가는 것이 맞으므로
 * 그 판을 진입 데이터로 들고 온다.
 *
 * Phaser 없는 순수 모듈인 이유는 **보내는 씬 여섯과 받는 로비가 같은 값을 읽어야** 하고,
 * 그 왕복을 테스트가 Phaser 없이 확인하기 위해서다.
 */

/** 로비가 다시 열 수 있는 판. 씬이 아니라 판이므로 이름도 판의 것이다. */
export type LobbyMenu = "sortie" | "duel";

/** 로비 진입 데이터. 자리를 넘기지 않고 들어온 사람은 판 없는 로비에 선다. */
export interface LobbySceneData {
  menu?: LobbyMenu;
}

/**
 * 돌아갈 자리를 들고 로비로 가는 진입 데이터.
 *
 * 씬마다 객체를 손으로 적지 않는다 — 오타가 나면 판이 조용히 안 열리고, 그 침묵은
 * "원래 그런 화면"과 구별되지 않는다.
 */
export const LOBBY_RETURN: Readonly<Record<LobbyMenu, LobbySceneData>> = {
  sortie: { menu: "sortie" },
  duel: { menu: "duel" },
};

/**
 * 진입 데이터에서 다시 열 판을 고른다.
 *
 * Phaser는 데이터 없이 시작한 씬에 직전 진입의 값을 그대로 남기므로(`consumeSceneEntry`
 * 참고) 모르는 값은 판 없음으로 수렴시킨다 — 판을 잘못 여는 것이 안 여는 것보다 나쁘다.
 */
export function normalizeLobbyEntry(data?: unknown): LobbyMenu | undefined {
  if (typeof data !== "object" || data === null || !("menu" in data)) return undefined;
  const menu = (data as LobbySceneData).menu;
  return menu === "sortie" || menu === "duel" ? menu : undefined;
}
