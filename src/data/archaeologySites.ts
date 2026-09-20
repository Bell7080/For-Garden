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

/**
 * 유적 그물망.
 *
 * **한 줄기가 아니라 거미줄이다.** 관문 → 기록고 → 성소로 이어지는 외길 셋이던 때는 지도가
 * 사실상 목록 세 줄이었고, 옆으로 갈 곳이 없어 「어디를 팔까」가 언제나 「가장 깊은 곳」
 * 하나였다. 지금은 관문에서 세 갈래로 벌어지고, 갈라진 줄기끼리 옆으로도 이어지며, 마지막
 * 자리는 서로 다른 세 줄기를 모두 지나야 열린다 — 그래서 여섯 시간짜리 재사용 대기가 걸려도
 * 지금 갈 수 있는 자리가 늘 여럿 남는다.
 *
 * 좌표는 아래 월드 규격(`ARCHAEOLOGY_MAP_LAYOUT`) 안에서 관리하고, 연결은 **한쪽에만** 적어
 * 같은 선을 두 번 긋지 않는다. 지층은 다섯 겹을 섞어 쓴다 — 이름만 다르고 판이 같은 유적이
 * 나란히 서면 어느 쪽을 골라도 같은 판이 열린다.
 */
export const ARCHAEOLOGY_SITES: readonly ArchaeologySiteDefinition[] = [
  // ── 관문. 모든 줄기가 여기서 갈라진다. ──────────────────────────────────────
  { id: "garden-gate", nameKey: "archaeology.site.garden-gate.name", x: 250, y: 1430, connectionIds: ["collapsed-greenhouse", "rust-canal", "ash-terrace"], layerId: "surface", recommendedLevel: 1, minimumLevel: 1, prerequisiteSiteIds: [], board: { columns: 5, rows: 5 }, rewardKinds: ["rawStone", "rune", "gold"], backgroundAssetKey: "archaeology_map", nodeAssetKey: "archaeology-node-gate" },

  // ── 첫 갈래 셋. 같은 레벨대라 어느 쪽을 먼저 파도 막히지 않는다. ────────────
  { id: "collapsed-greenhouse", nameKey: "archaeology.site.collapsed-greenhouse.name", x: 560, y: 1160, connectionIds: ["sunken-archive", "rust-canal"], layerId: "surface", recommendedLevel: 3, minimumLevel: 2, prerequisiteSiteIds: ["garden-gate"], board: { columns: 5, rows: 5 }, rewardKinds: ["rawStone", "rune", "gold"], backgroundAssetKey: "archaeology_map", nodeAssetKey: "archaeology-node-gate" },
  { id: "rust-canal", nameKey: "archaeology.site.rust-canal.name", x: 300, y: 870, connectionIds: ["lantern-shaft"], layerId: "canal", recommendedLevel: 4, minimumLevel: 3, prerequisiteSiteIds: ["garden-gate"], board: { columns: 5, rows: 6 }, rewardKinds: ["rawStone", "rune", "gold"], backgroundAssetKey: "archaeology_map", nodeAssetKey: "archaeology-node-gate" },
  { id: "ash-terrace", nameKey: "archaeology.site.ash-terrace.name", x: 650, y: 1620, connectionIds: ["bone-quarry", "collapsed-greenhouse"], layerId: "surface", recommendedLevel: 5, minimumLevel: 4, prerequisiteSiteIds: ["garden-gate"], board: { columns: 5, rows: 5 }, rewardKinds: ["rawStone", "rune", "gold"], backgroundAssetKey: "archaeology_map", nodeAssetKey: "archaeology-node-gate" },

  // ── 둘째 줄. 기록고 계열이 여기서 시작한다. ────────────────────────────────
  { id: "sunken-archive", nameKey: "archaeology.site.sunken-archive.name", x: 900, y: 980, connectionIds: ["mirror-cistern", "lantern-shaft"], layerId: "archive", recommendedLevel: 8, minimumLevel: 6, prerequisiteSiteIds: ["collapsed-greenhouse"], board: { columns: 6, rows: 5 }, rewardKinds: ["rawStone", "rune", "gold"], backgroundAssetKey: "archaeology_map", nodeAssetKey: "archaeology-node-archive" },
  { id: "lantern-shaft", nameKey: "archaeology.site.lantern-shaft.name", x: 620, y: 590, connectionIds: ["mirror-cistern"], layerId: "canal", recommendedLevel: 9, minimumLevel: 7, prerequisiteSiteIds: ["rust-canal"], board: { columns: 5, rows: 6 }, rewardKinds: ["rawStone", "rune", "gold"], backgroundAssetKey: "archaeology_map", nodeAssetKey: "archaeology-node-archive" },
  { id: "bone-quarry", nameKey: "archaeology.site.bone-quarry.name", x: 1020, y: 1480, connectionIds: ["glass-furnace", "sunken-archive"], layerId: "archive", recommendedLevel: 10, minimumLevel: 8, prerequisiteSiteIds: ["ash-terrace"], board: { columns: 6, rows: 5 }, rewardKinds: ["rawStone", "rune", "gold"], backgroundAssetKey: "archaeology_map", nodeAssetKey: "archaeology-node-archive" },

  // ── 셋째 줄. 두 줄기가 합쳐지는 자리와 불에 녹은 자리다. ────────────────────
  { id: "mirror-cistern", nameKey: "archaeology.site.mirror-cistern.name", x: 1240, y: 700, connectionIds: ["deep-sanctum", "tideless-vault", "glass-furnace"], layerId: "archive", recommendedLevel: 12, minimumLevel: 10, prerequisiteSiteIds: ["sunken-archive", "lantern-shaft"], board: { columns: 6, rows: 5 }, rewardKinds: ["rawStone", "rune", "gold"], backgroundAssetKey: "archaeology_map", nodeAssetKey: "archaeology-node-archive" },
  { id: "glass-furnace", nameKey: "archaeology.site.glass-furnace.name", x: 1360, y: 1230, connectionIds: ["hollow-spire", "tideless-vault"], layerId: "furnace", recommendedLevel: 13, minimumLevel: 11, prerequisiteSiteIds: ["bone-quarry"], board: { columns: 6, rows: 6 }, rewardKinds: ["rawStone", "rune", "gold"], backgroundAssetKey: "archaeology_map", nodeAssetKey: "archaeology-node-sanctum" },

  // ── 심층 셋. 마지막 자리는 이 셋을 모두 지나야 열린다. ─────────────────────
  { id: "deep-sanctum", nameKey: "archaeology.site.deep-sanctum.name", x: 1540, y: 380, connectionIds: ["first-seed", "hollow-spire"], layerId: "abyss", recommendedLevel: 16, minimumLevel: 12, prerequisiteSiteIds: ["mirror-cistern"], board: { columns: 6, rows: 6 }, rewardKinds: ["rawStone", "rune", "gold"], backgroundAssetKey: "archaeology_map", nodeAssetKey: "archaeology-node-sanctum" },
  { id: "hollow-spire", nameKey: "archaeology.site.hollow-spire.name", x: 1680, y: 990, connectionIds: ["first-seed"], layerId: "furnace", recommendedLevel: 18, minimumLevel: 14, prerequisiteSiteIds: ["glass-furnace"], board: { columns: 6, rows: 6 }, rewardKinds: ["rawStone", "rune", "gold"], backgroundAssetKey: "archaeology_map", nodeAssetKey: "archaeology-node-sanctum" },
  { id: "tideless-vault", nameKey: "archaeology.site.tideless-vault.name", x: 1500, y: 1560, connectionIds: ["first-seed"], layerId: "abyss", recommendedLevel: 20, minimumLevel: 16, prerequisiteSiteIds: ["mirror-cistern", "glass-furnace"], board: { columns: 6, rows: 6 }, rewardKinds: ["rawStone", "rune", "gold"], backgroundAssetKey: "archaeology_map", nodeAssetKey: "archaeology-node-sanctum" },
  { id: "first-seed", nameKey: "archaeology.site.first-seed.name", x: 1880, y: 640, connectionIds: [], layerId: "abyss", recommendedLevel: 24, minimumLevel: 20, prerequisiteSiteIds: ["deep-sanctum", "hollow-spire", "tideless-vault"], board: { columns: 6, rows: 6 }, rewardKinds: ["rawStone", "rune", "gold"], backgroundAssetKey: "archaeology_map", nodeAssetKey: "archaeology-node-sanctum" },
];

/** 외부 요청은 반드시 이 카탈로그를 거친다. */
export function findArchaeologySite(id: string): ArchaeologySiteDefinition | undefined {
  return ARCHAEOLOGY_SITES.find((site) => site.id === id);
}
