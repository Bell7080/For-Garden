import type { StrataRewardKind } from "./strataLayers";

/** 지도와 서버가 함께 읽는 유적 정의다. 사용자 표시 문장은 번역 키로만 보관한다. */
export interface ArchaeologySiteDefinition {
  readonly id: string;
  readonly nameKey: `archaeology.site.${string}.name`;
  readonly x: number; readonly y: number;
  /**
   * 지도에 그리는 줄기.
   *
   * **진행 조건이 아니다** — 이어진 두 자리는 그림상 한 갈래로 읽힐 뿐이고, 어느 자리를
   * 열지는 오직 `minimumLevel`이 정한다. 연결을 조건으로 삼으면 「저길 깨야 여기가 열린다」가
   * 되어, 재사용 대기가 걸린 자리 하나가 그 뒤 전부를 막는다.
   */
  readonly connectionIds: readonly string[];
  readonly layerId: string;
  readonly recommendedLevel: number;
  readonly minimumLevel: number;
  readonly board: { readonly columns: number; readonly rows: number };
  readonly rewardKinds: readonly Extract<StrataRewardKind, "rawStone" | "rune" | "gold">[];
  readonly backgroundAssetKey: string;
  readonly nodeAssetKey: string;
}

/**
 * 유적 그물망.
 *
 * **여는 조건은 플레이어 레벨 하나뿐이다.** 줄기는 그림이고 잠금이 아니다 — 앞 유적을 깨야
 * 다음이 열리던 때는 재사용 대기가 걸린 자리 하나가 그 뒤 전부를 여섯 시간 막았고, 「어디를
 * 팔까」가 다시 「열려 있는 유일한 곳」이 되었다. 레벨만 넘으면 열세 자리 중 아무 데나
 * 고르고, 줄기는 그 자리들이 어떻게 이어져 있는지를 보여 줄 뿐이다.
 *
 * 좌표는 아래 월드 규격(`ARCHAEOLOGY_MAP_LAYOUT`) 안에서 관리하고, 연결은 **한쪽에만** 적어
 * 같은 선을 두 번 긋지 않는다. 지층은 다섯 겹을 섞어 쓴다 — 이름만 다르고 판이 같은 유적이
 * 나란히 서면 어느 쪽을 골라도 같은 판이 열린다.
 */
export const ARCHAEOLOGY_SITES: readonly ArchaeologySiteDefinition[] = [
  // ── 관문. 모든 줄기가 여기서 갈라진다. ──────────────────────────────────────
  { id: "garden-gate", nameKey: "archaeology.site.garden-gate.name", x: 250, y: 1430, connectionIds: ["collapsed-greenhouse", "rust-canal", "ash-terrace"], layerId: "surface", recommendedLevel: 1, minimumLevel: 1, board: { columns: 5, rows: 5 }, rewardKinds: ["rawStone", "rune", "gold"], backgroundAssetKey: "archaeology_map", nodeAssetKey: "archaeology-node-gate" },

  // ── 첫 갈래 셋. 레벨이 조금씩 높아질 뿐 서로를 막지 않는다. ────────────────
  { id: "collapsed-greenhouse", nameKey: "archaeology.site.collapsed-greenhouse.name", x: 560, y: 1160, connectionIds: ["sunken-archive", "rust-canal"], layerId: "surface", recommendedLevel: 3, minimumLevel: 2, board: { columns: 5, rows: 5 }, rewardKinds: ["rawStone", "rune", "gold"], backgroundAssetKey: "archaeology_map", nodeAssetKey: "archaeology-node-gate" },
  { id: "rust-canal", nameKey: "archaeology.site.rust-canal.name", x: 300, y: 870, connectionIds: ["lantern-shaft"], layerId: "canal", recommendedLevel: 4, minimumLevel: 3, board: { columns: 5, rows: 6 }, rewardKinds: ["rawStone", "rune", "gold"], backgroundAssetKey: "archaeology_map", nodeAssetKey: "archaeology-node-gate" },
  { id: "ash-terrace", nameKey: "archaeology.site.ash-terrace.name", x: 650, y: 1620, connectionIds: ["bone-quarry", "collapsed-greenhouse"], layerId: "surface", recommendedLevel: 5, minimumLevel: 4, board: { columns: 5, rows: 5 }, rewardKinds: ["rawStone", "rune", "gold"], backgroundAssetKey: "archaeology_map", nodeAssetKey: "archaeology-node-gate" },

  // ── 둘째 줄. 기록고 계열이 여기서 시작한다. ────────────────────────────────
  { id: "sunken-archive", nameKey: "archaeology.site.sunken-archive.name", x: 900, y: 980, connectionIds: ["mirror-cistern", "lantern-shaft"], layerId: "archive", recommendedLevel: 8, minimumLevel: 6, board: { columns: 6, rows: 5 }, rewardKinds: ["rawStone", "rune", "gold"], backgroundAssetKey: "archaeology_map", nodeAssetKey: "archaeology-node-archive" },
  { id: "lantern-shaft", nameKey: "archaeology.site.lantern-shaft.name", x: 620, y: 590, connectionIds: ["mirror-cistern"], layerId: "canal", recommendedLevel: 9, minimumLevel: 7, board: { columns: 5, rows: 6 }, rewardKinds: ["rawStone", "rune", "gold"], backgroundAssetKey: "archaeology_map", nodeAssetKey: "archaeology-node-archive" },
  { id: "bone-quarry", nameKey: "archaeology.site.bone-quarry.name", x: 1020, y: 1480, connectionIds: ["glass-furnace", "sunken-archive"], layerId: "archive", recommendedLevel: 10, minimumLevel: 8, board: { columns: 6, rows: 5 }, rewardKinds: ["rawStone", "rune", "gold"], backgroundAssetKey: "archaeology_map", nodeAssetKey: "archaeology-node-archive" },

  // ── 셋째 줄. 두 줄기가 합쳐지는 자리와 불에 녹은 자리다. ────────────────────
  { id: "mirror-cistern", nameKey: "archaeology.site.mirror-cistern.name", x: 1240, y: 700, connectionIds: ["deep-sanctum", "tideless-vault", "glass-furnace"], layerId: "archive", recommendedLevel: 12, minimumLevel: 10, board: { columns: 6, rows: 5 }, rewardKinds: ["rawStone", "rune", "gold"], backgroundAssetKey: "archaeology_map", nodeAssetKey: "archaeology-node-archive" },
  { id: "glass-furnace", nameKey: "archaeology.site.glass-furnace.name", x: 1360, y: 1230, connectionIds: ["hollow-spire", "tideless-vault"], layerId: "furnace", recommendedLevel: 13, minimumLevel: 11, board: { columns: 6, rows: 6 }, rewardKinds: ["rawStone", "rune", "gold"], backgroundAssetKey: "archaeology_map", nodeAssetKey: "archaeology-node-sanctum" },

  // ── 심층 넷. 레벨 사다리의 끝이라 가장 늦게 열린다. ────────────────────────
  { id: "deep-sanctum", nameKey: "archaeology.site.deep-sanctum.name", x: 1540, y: 380, connectionIds: ["first-seed", "hollow-spire"], layerId: "abyss", recommendedLevel: 16, minimumLevel: 12, board: { columns: 6, rows: 6 }, rewardKinds: ["rawStone", "rune", "gold"], backgroundAssetKey: "archaeology_map", nodeAssetKey: "archaeology-node-sanctum" },
  { id: "hollow-spire", nameKey: "archaeology.site.hollow-spire.name", x: 1680, y: 990, connectionIds: ["first-seed"], layerId: "furnace", recommendedLevel: 18, minimumLevel: 14, board: { columns: 6, rows: 6 }, rewardKinds: ["rawStone", "rune", "gold"], backgroundAssetKey: "archaeology_map", nodeAssetKey: "archaeology-node-sanctum" },
  { id: "tideless-vault", nameKey: "archaeology.site.tideless-vault.name", x: 1500, y: 1560, connectionIds: ["first-seed"], layerId: "abyss", recommendedLevel: 20, minimumLevel: 16, board: { columns: 6, rows: 6 }, rewardKinds: ["rawStone", "rune", "gold"], backgroundAssetKey: "archaeology_map", nodeAssetKey: "archaeology-node-sanctum" },
  { id: "first-seed", nameKey: "archaeology.site.first-seed.name", x: 1880, y: 640, connectionIds: [], layerId: "abyss", recommendedLevel: 24, minimumLevel: 20, board: { columns: 6, rows: 6 }, rewardKinds: ["rawStone", "rune", "gold"], backgroundAssetKey: "archaeology_map", nodeAssetKey: "archaeology-node-sanctum" },
];

/** 외부 요청은 반드시 이 카탈로그를 거친다. */
export function findArchaeologySite(id: string): ArchaeologySiteDefinition | undefined {
  return ARCHAEOLOGY_SITES.find((site) => site.id === id);
}
