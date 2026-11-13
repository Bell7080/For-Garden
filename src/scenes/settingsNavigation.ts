/** 설정에서 닫을 때 되돌아갈 수 있는 씬만 명시해 외부 입력이 임의 씬을 시작하지 못하게 한다. */
export type SettingsReturnScene = "lobby" | "interaction" | "archaeology" | "relics" | "lab" | "premium";

/** 프리미엄 화면은 섹션이 늘어나더라도 이 목록에 등록된 값만 설정 왕복 데이터로 받는다. */
export type PremiumSection = "premium";

export interface SettingsEntryData {
  returnScene?: SettingsReturnScene;
  /** 반환 데이터는 씬별 허용 필드만 담으며 SettingsScene 진입 시 다시 검증한다. */
  returnData?: { section: PremiumSection };
  tab?: "sound" | "alerts" | "play" | "access" | "support";
  /** 탭을 바꿔 다시 세울 때 떠난 탭의 자리 — 새 내용이 그쪽 반대편에서 밀려 들어온다(`slideTabPage`). */
  slideFrom?: number;
  /**
   * 설정을 그 씬 **위에 겹쳐** 열었다는 표시. 전투는 설정 씬으로 넘어가면 판이 통째로 사라지고, 편성·지도·던전
   * 입구처럼 진입 데이터를 들고 선 화면은 설정에서 돌아올 길(`returnScene`)이 없다 — 그래서 그 씬은 잠들어
   * 기다리고 설정이 닫히며 다시 깨운다(`BattleScene.openSettingsOverlay` · `openSettingsOver`).
   */
  overlayOf?: SettingsOverlayHost;
}

/** 설정을 겹쳐 열 수 있는 씬. 외부 입력이 임의 씬을 깨우지 못하게 목록으로 받는다. */
export const SETTINGS_OVERLAY_HOSTS = [
  "battle", "party", "stageMap", "raid", "bounty", "cakeOperation", "duel", "guild", "event", "pvpPreview",
] as const;
export type SettingsOverlayHost = typeof SETTINGS_OVERLAY_HOSTS[number];

/** 겹쳐 연 씬만 검증해 돌려준다. 모르는 값은 겹치지 않은 것으로 본다. */
export function validateSettingsOverlay(data: unknown): SettingsOverlayHost | undefined {
  if (!data || typeof data !== "object") return undefined;
  const host = (data as Record<string, unknown>).overlayOf;
  return SETTINGS_OVERLAY_HOSTS.includes(host as SettingsOverlayHost) ? host as SettingsOverlayHost : undefined;
}

const RETURN_SCENES: readonly SettingsReturnScene[] = ["lobby", "interaction", "archaeology", "relics", "lab", "premium"];

/** Phaser 진입 데이터는 신뢰하지 않고 알려진 반환 씬과 프리미엄 섹션만 새 객체로 복사한다. */
export function validateSettingsReturn(data: unknown): Required<Pick<SettingsEntryData, "returnScene">> & Pick<SettingsEntryData, "returnData"> {
  if (!data || typeof data !== "object") return { returnScene: "lobby" };
  const candidate = data as Record<string, unknown>;
  const returnScene = RETURN_SCENES.includes(candidate.returnScene as SettingsReturnScene)
    ? candidate.returnScene as SettingsReturnScene
    : "lobby";
  if (returnScene !== "premium" || !candidate.returnData || typeof candidate.returnData !== "object") return { returnScene };
  const section = (candidate.returnData as Record<string, unknown>).section;
  return section === "premium" ? { returnScene, returnData: { section } } : { returnScene };
}
