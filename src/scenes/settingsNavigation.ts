/** 설정에서 닫을 때 되돌아갈 수 있는 씬만 명시해 외부 입력이 임의 씬을 시작하지 못하게 한다. */
export type SettingsReturnScene = "lobby" | "archaeology" | "relics" | "lab" | "shop";

/** 상점은 섹션이 늘어나더라도 이 목록에 등록된 값만 설정 왕복 데이터로 받는다. */
export type ShopSection = "premium";

export interface SettingsEntryData {
  returnScene?: SettingsReturnScene;
  /** 반환 데이터는 씬별 허용 필드만 담으며 SettingsScene 진입 시 다시 검증한다. */
  returnData?: { section: ShopSection };
  tab?: "sound" | "alerts" | "play" | "access" | "support";
}

const RETURN_SCENES: readonly SettingsReturnScene[] = ["lobby", "archaeology", "relics", "lab", "shop"];

/** Phaser 진입 데이터는 신뢰하지 않고 알려진 반환 씬과 상점 섹션만 새 객체로 복사한다. */
export function validateSettingsReturn(data: unknown): Required<Pick<SettingsEntryData, "returnScene">> & Pick<SettingsEntryData, "returnData"> {
  if (!data || typeof data !== "object") return { returnScene: "lobby" };
  const candidate = data as Record<string, unknown>;
  const returnScene = RETURN_SCENES.includes(candidate.returnScene as SettingsReturnScene)
    ? candidate.returnScene as SettingsReturnScene
    : "lobby";
  if (returnScene !== "shop" || !candidate.returnData || typeof candidate.returnData !== "object") return { returnScene };
  const section = (candidate.returnData as Record<string, unknown>).section;
  return section === "premium" ? { returnScene, returnData: { section } } : { returnScene };
}
