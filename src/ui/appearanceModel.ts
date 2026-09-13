import type { RelicSkinId } from "../core/types";
import type { WalletItemKey } from "../data/items";
import type { RelicSkinDef } from "../data/relicSkins";

/**
 * 외형 하나가 지금 어떤 상태인가.
 *
 * **넷을 한 축에 둔다.** 예전에는 `owned` 한 값으로만 갈라 "가진 것"과 "못 가진 것"뿐이었고,
 * 그래서 아직 열지 않은 외형과 값만 치르면 되는 외형이 같은 잿빛으로 섰다 — 무엇을 하면
 * 입을 수 있는지 화면이 말하지 못했다.
 *
 * - `equipped` — 지금 입고 있다.
 * - `owned` — 가졌지만 입고 있지 않다.
 * - `purchasable` — 아직 없고 **값이 정해져 있다**(그 값을 함께 들고 다닌다).
 * - `locked` — 아직 없고 값도 없다. 다른 데서 얻는 외형이다.
 * - `comingSoon` — 아직 열리지 않았다. 이름만 걸어 두고 얻는 길은 말하지 않는다.
 */
export type AppearanceState = "equipped" | "owned" | "purchasable" | "locked" | "comingSoon";

/** 전시관 한 칸이 읽는 값. 화면은 여기 담긴 것만 그린다. */
export interface AppearanceEntry {
  /** 기본 외형은 ID가 없다 — 저장의 선택값 `null`과 같은 뜻이다. */
  readonly skinId?: RelicSkinId;
  readonly name: string;
  readonly portraitAssetId: string;
  readonly state: AppearanceState;
  /** `purchasable`만 갖는다. 값 줄이 이 값을 그대로 읽는다. */
  readonly price?: { readonly currency: WalletItemKey; readonly amount: number };
}

/** 장착·소유 판정을 화면이 다시 세지 않도록 manager가 넘기는 지금 상태다. */
export interface AppearanceStatus {
  /** 그 외형을 가졌는가. */
  owns: (skinId: RelicSkinId) => boolean;
  /** 지금 입고 있는 추가 외형. 기본 외형을 입고 있으면 `undefined`다. */
  equippedId?: RelicSkinId;
}

/**
 * 기본 외형 한 칸과 추가 외형들을 **한 줄로** 세운다.
 *
 * 기본 외형은 렐릭 정의가 소유하므로 목록의 맨 앞에 ID 없는 칸으로 선다 — 추가 외형만
 * 늘어놓으면 "지금 입고 있는 것"이 목록에 없는 순간이 생긴다.
 */
export function appearanceEntries(
  defaultName: string,
  defaultPortraitAssetId: string,
  skins: readonly RelicSkinDef[],
  status: AppearanceStatus,
): AppearanceEntry[] {
  const base: AppearanceEntry = {
    name: defaultName,
    portraitAssetId: defaultPortraitAssetId,
    state: status.equippedId === undefined ? "equipped" : "owned",
  };
  return [base, ...skins.map((skin) => ({
    skinId: skin.id,
    name: skin.name,
    portraitAssetId: skin.portraitAssetId,
    state: appearanceState(skin, status),
    ...(skin.price ? { price: skin.price } : {}),
  }))];
}

/** 한 외형의 상태. 순서가 곧 우선순위다 — 열리지 않은 것은 가졌는지 묻지 않는다. */
export function appearanceState(skin: RelicSkinDef, status: AppearanceStatus): AppearanceState {
  if (skin.comingSoon) return "comingSoon";
  if (status.owns(skin.id)) return status.equippedId === skin.id ? "equipped" : "owned";
  return skin.price ? "purchasable" : "locked";
}

/** 가진 외형만 입을 수 있다. `equipped`는 이미 입고 있어 다시 누를 것이 없다. */
export function canEquipAppearance(entry: AppearanceEntry): boolean {
  return entry.state === "owned";
}

/** 그 칸의 원화를 흐리게 눌러야 하는가 — 아직 내 것이 아닌 외형만 눌러 둔다. */
export function isAppearanceDimmed(entry: AppearanceEntry): boolean {
  return entry.state !== "equipped" && entry.state !== "owned";
}
