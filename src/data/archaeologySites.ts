import type { StrataRewardKind } from "./strataLayers";

/** 지도와 서버가 함께 읽는 유적 정의다. 사용자 표시 문장은 번역 키로만 보관한다. */
export interface ArchaeologySiteDefinition {
  readonly id: string;
  readonly nameKey: `archaeology.site.${string}.name`;
  readonly x: number; readonly y: number;
  readonly connectionIds: readonly string[];
  readonly layerId: string;
  readonly recommendedLevel: number;
  readonly minimumLevel: number;
  readonly prerequisiteSiteIds: readonly string[];
  readonly board: { readonly columns: number; readonly rows: number };
  readonly rewardKinds: readonly Extract<StrataRewardKind, "rawStone" | "rune" | "gold">[];
  readonly backgroundAssetKey: string;
  readonly nodeAssetKey: string;
}

/** 좌표는 1480×1180 지도 월드 안에서 관리하며 연결은 한쪽에만 적어 중복 선을 막는다. */
export const ARCHAEOLOGY_SITES: readonly ArchaeologySiteDefinition[] = [
  { id: "garden-gate", nameKey: "archaeology.site.garden-gate.name", x: 260, y: 820, connectionIds: ["sunken-archive"], layerId: "surface", recommendedLevel: 1, minimumLevel: 1, prerequisiteSiteIds: [], board: { columns: 5, rows: 5 }, rewardKinds: ["rawStone", "rune", "gold"], backgroundAssetKey: "archaeology_map", nodeAssetKey: "archaeology-node-gate" },
  { id: "sunken-archive", nameKey: "archaeology.site.sunken-archive.name", x: 790, y: 510, connectionIds: ["deep-sanctum"], layerId: "archive", recommendedLevel: 8, minimumLevel: 6, prerequisiteSiteIds: ["garden-gate"], board: { columns: 6, rows: 5 }, rewardKinds: ["rawStone", "rune", "gold"], backgroundAssetKey: "archaeology_map", nodeAssetKey: "archaeology-node-archive" },
  { id: "deep-sanctum", nameKey: "archaeology.site.deep-sanctum.name", x: 1220, y: 250, connectionIds: [], layerId: "abyss", recommendedLevel: 16, minimumLevel: 12, prerequisiteSiteIds: ["sunken-archive"], board: { columns: 6, rows: 6 }, rewardKinds: ["rawStone", "rune", "gold"], backgroundAssetKey: "archaeology_map", nodeAssetKey: "archaeology-node-sanctum" },
];

/** 외부 요청은 반드시 이 카탈로그를 거친다. */
export function findArchaeologySite(id: string): ArchaeologySiteDefinition | undefined {
  return ARCHAEOLOGY_SITES.find((site) => site.id === id);
}
