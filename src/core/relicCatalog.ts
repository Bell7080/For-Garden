import type { RelicDef } from "./types";
import { t } from "../i18n";

/** 즐겨찾기 정렬에 필요한 최소 유대 기록이라 저장 모델과 비교 규칙을 느슨하게 결합한다. */
export interface CatalogBondOrder {
  bondLevel: number;
  bondXp: number;
}

/** 즐겨찾기 우선순위를 기존 도감 정렬에 합성할 때 주입하는 읽기 전용 상태다. */
export interface BookmarkedRelicOrder<T extends { id: string }> {
  bookmarked: ReadonlySet<string>;
  bondOf: (relic: T) => CatalogBondOrder;
  fallback: (a: T, b: T) => number;
}

/**
 * 보유 렐릭용 즐겨찾기 비교 함수.
 *
 * 즐겨찾기를 먼저 모으고, 그 안에서는 유대 레벨과 현재 경험치를 차례로 내림차순 비교한다.
 * 모든 즐겨찾기 키가 같거나 둘 다 일반 렐릭이면 화면이 고른 기존 비교 함수로 되돌아가므로
 * 정렬 기준의 동률 해소 규칙과 원래 배열의 안정성이 그대로 보존된다.
 */
export function compareBookmarkedOwnedRelics<T extends { id: string }>(a: T, b: T, order: BookmarkedRelicOrder<T>): number {
  const aBookmarked = order.bookmarked.has(a.id);
  const bBookmarked = order.bookmarked.has(b.id);
  if (aBookmarked !== bBookmarked) return aBookmarked ? -1 : 1;
  if (aBookmarked) {
    const aBond = order.bondOf(a);
    const bBond = order.bondOf(b);
    const bondOrder = bBond.bondLevel - aBond.bondLevel || bBond.bondXp - aBond.bondXp;
    if (bondOrder !== 0) return bondOrder;
  }
  return order.fallback(a, b);
}

/** 보유 여부에 따라 상세 창에 전달할 수 있는 기록의 공개 범위를 명시한다. */
export type RelicCatalogDisclosure =
  | { access: "silhouette"; specimenNumber: string; catalogSummary: string }
  | { access: "full"; specimenNumber: string; projectName: string; origin: string; excavationSite: string; record: string };

/**
 * 미보유 상태에서 이름·기원·발굴 기록이 실수로 UI 모델에 섞이지 않게 하는 순수 경계다.
 *
 * **적 전용 개체는 보유 여부를 묻지 않는다.** `enemyOnly`는 가챠에도 도감(`PLAYABLE_RELICS`)
 * 에도 서지 않으므로 「상세 기록은 개체 획득 후 해제됩니다」가 성립하지 않는다 — 영영 해제될
 * 수 없는 안내를 걸어 두면, 그 개체를 여는 유일한 자리(적 정보창)에서 소속 엠블럼도 관찰
 * 기록도 끝내 읽을 수 없다. 그 개체를 여는 손은 이미 전장에서 마주친 뒤라 처음부터 공개한다.
 */
export function getRelicCatalogDisclosure(def: RelicDef, owned: boolean): RelicCatalogDisclosure {
  if (!owned && def.enemyOnly !== true) return { access: "silhouette", specimenNumber: def.specimenNumber, catalogSummary: def.catalogSummary };
  return {
    access: "full",
    specimenNumber: def.specimenNumber,
    projectName: def.projectName,
    origin: def.origin,
    excavationSite: def.excavationSite,
    record: def.unlockRecord.status === "recorded" ? def.unlockRecord.text : t("error.profile.locked"),
  };
}
