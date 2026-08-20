import type { RelicDef } from "./types";

/** 보유 여부에 따라 상세 창에 전달할 수 있는 기록의 공개 범위를 명시한다. */
export type RelicCatalogDisclosure =
  | { access: "silhouette"; specimenNumber: string; catalogSummary: string }
  | { access: "full"; specimenNumber: string; projectName: string; origin: string; excavationSite: string; record: string };

/** 미보유 상태에서 이름·기원·발굴 기록이 실수로 UI 모델에 섞이지 않게 하는 순수 경계다. */
export function getRelicCatalogDisclosure(def: RelicDef, owned: boolean): RelicCatalogDisclosure {
  if (!owned) return { access: "silhouette", specimenNumber: def.specimenNumber, catalogSummary: def.catalogSummary };
  return {
    access: "full",
    specimenNumber: def.specimenNumber,
    projectName: def.projectName,
    origin: def.origin,
    excavationSite: def.excavationSite,
    record: def.unlockRecord.status === "recorded" ? def.unlockRecord.text : "설정 기록이 잠금 상태입니다.",
  };
}
