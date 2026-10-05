import type { StrataRewardKind } from "./strataLayers";

/** 결정 한 단계. 단계는 앞에서부터 오래 방치한 순서다. */
export interface StrataCrystalStage {
  readonly afterHours: number;
  /** 한 판의 굴착 횟수에 더하는 몫이다. */
  readonly digs: number;
  /** 원석 배율에 곱하는 몫이다(골드는 제곱근). */
  readonly yield: number;
}

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
  /**
   * 한 번 판 뒤 다시 열릴 때까지의 시간(시간 단위).
   *
   * **깊은 유적일수록 길다.** 대기가 모두 같던 때는 고레벨 유적이 굴착 횟수와 보상으로 앞서면서도
   * 같은 속도로 돌아와, 얕은 유적이 올라갈수록 쓸 이유가 없었다.
   */
  readonly cooldownHours: number;
  /**
   * 원석·골드 보상 배율(결정 전 기본값). 같은 지층을 쓰는 유적끼리 판은 같아도 몫이 갈린다.
   * 골드는 제곱근만 받는다 — 값싼 재화가 배율째 부풀면 시세가 어긋난다.
   * 치즈케이크·젬·화석·호박석·룬은 수량을 키우지 않는다(`strataCrystal.ts`).
   */
  readonly yield: number;
  /**
   * 오래 방치하면 맺히는 결정 단계. 없으면 이 유적은 결정이 없다.
   *
   * 마지막으로 판 시각부터 `afterHours`가 지나면 그 단계가 되고, 판을 열 때 굴착 횟수가 `digs`만큼
   * 늘고 원석 배율이 `yield`만큼 곱해진다. 얕은 유적만 갖는다 — 깊은 유적은 긴 대기가 같은 일을 한다.
   */
  readonly crystal?: readonly StrataCrystalStage[];
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
 * 다음이 열리던 때는 재사용 대기가 걸린 자리 하나가 그 뒤 전부를 막았다. 레벨만 넘으면 여덟
 * 자리 중 아무 데나 고르고, 줄기는 그 자리들이 어떻게 이어져 있는지를 보여 줄 뿐이다.
 *
 * **여덟 곳이다.** 이름만 다르고 판이 같은 곁다리가 열세 곳까지 늘었던 것을 걷어 냈다 — 같은
 * 지층을 쓰는 유적은 대기와 배율로 갈라 어느 쪽을 골라도 같은 선택이 되지 않게 한다.
 * 좌표는 아래 월드 규격(`ARCHAEOLOGY_MAP_LAYOUT`) 안에서 관리하고, 연결은 **한쪽에만** 적어
 * 같은 선을 두 번 긋지 않는다.
 */
export const ARCHAEOLOGY_SITES: readonly ArchaeologySiteDefinition[] = [
  // ── 관문과 첫 갈래. 1레벨부터 열려(서로를 막지 않는다) 대기 중에도 갈 곳이 남는다. 결정이 맺힌다. ────
  { id: "garden-gate", nameKey: "archaeology.site.garden-gate.name", x: 250, y: 1430, connectionIds: ["rust-canal", "sunken-archive"], layerId: "surface", cooldownHours: 6, yield: 1, crystal: [{ afterHours: 24, digs: 1, yield: 2.5 }, { afterHours: 72, digs: 2, yield: 6.5 }], recommendedLevel: 1, minimumLevel: 1, board: { columns: 5, rows: 5 }, rewardKinds: ["rawStone", "rune", "gold"], backgroundAssetKey: "archaeology_map", nodeAssetKey: "archaeology-node-gate" },
  { id: "rust-canal", nameKey: "archaeology.site.rust-canal.name", x: 300, y: 870, connectionIds: ["sunken-archive"], layerId: "canal", cooldownHours: 6, yield: 1, crystal: [{ afterHours: 24, digs: 1, yield: 2.2 }, { afterHours: 72, digs: 2, yield: 5.5 }], recommendedLevel: 4, minimumLevel: 1, board: { columns: 5, rows: 6 }, rewardKinds: ["rawStone", "rune", "gold"], backgroundAssetKey: "archaeology_map", nodeAssetKey: "archaeology-node-gate" },

  // ── 둘째 줄. 기록고가 여기서 시작한다. ─────────────────────────────────────
  { id: "sunken-archive", nameKey: "archaeology.site.sunken-archive.name", x: 900, y: 980, connectionIds: ["glass-furnace"], layerId: "archive", cooldownHours: 12, yield: 1.5, crystal: [{ afterHours: 36, digs: 1, yield: 1.6 }, { afterHours: 72, digs: 2, yield: 3 }], recommendedLevel: 8, minimumLevel: 6, board: { columns: 6, rows: 5 }, rewardKinds: ["rawStone", "rune", "gold"], backgroundAssetKey: "archaeology_map", nodeAssetKey: "archaeology-node-archive" },

  // ── 셋째 줄. 불에 녹은 자리다. 심층으로 가는 길목이다. ─────────────────────
  { id: "glass-furnace", nameKey: "archaeology.site.glass-furnace.name", x: 1360, y: 1230, connectionIds: ["deep-sanctum", "hollow-spire", "tideless-vault"], layerId: "furnace", cooldownHours: 24, yield: 2.2, recommendedLevel: 13, minimumLevel: 10, board: { columns: 6, rows: 6 }, rewardKinds: ["rawStone", "rune", "gold"], backgroundAssetKey: "archaeology_map", nodeAssetKey: "archaeology-node-sanctum" },

  // ── 심층 넷. 레벨 사다리의 끝이라 가장 늦게 열리고 가장 오래 기다린다. ──────
  { id: "deep-sanctum", nameKey: "archaeology.site.deep-sanctum.name", x: 1540, y: 380, connectionIds: ["first-seed"], layerId: "abyss", cooldownHours: 48, yield: 3, recommendedLevel: 16, minimumLevel: 12, board: { columns: 6, rows: 6 }, rewardKinds: ["rawStone", "rune", "gold"], backgroundAssetKey: "archaeology_map", nodeAssetKey: "archaeology-node-sanctum" },
  { id: "hollow-spire", nameKey: "archaeology.site.hollow-spire.name", x: 1680, y: 990, connectionIds: ["first-seed"], layerId: "furnace", cooldownHours: 60, yield: 3.8, recommendedLevel: 18, minimumLevel: 14, board: { columns: 6, rows: 6 }, rewardKinds: ["rawStone", "rune", "gold"], backgroundAssetKey: "archaeology_map", nodeAssetKey: "archaeology-node-sanctum" },
  { id: "tideless-vault", nameKey: "archaeology.site.tideless-vault.name", x: 1500, y: 1560, connectionIds: ["first-seed"], layerId: "abyss", cooldownHours: 72, yield: 3.6, recommendedLevel: 20, minimumLevel: 16, board: { columns: 6, rows: 6 }, rewardKinds: ["rawStone", "rune", "gold"], backgroundAssetKey: "archaeology_map", nodeAssetKey: "archaeology-node-sanctum" },
  { id: "first-seed", nameKey: "archaeology.site.first-seed.name", x: 1880, y: 640, connectionIds: [], layerId: "abyss", cooldownHours: 72, yield: 4.2, recommendedLevel: 24, minimumLevel: 20, board: { columns: 6, rows: 6 }, rewardKinds: ["rawStone", "rune", "gold"], backgroundAssetKey: "archaeology_map", nodeAssetKey: "archaeology-node-sanctum" },
];

/** 외부 요청은 반드시 이 카탈로그를 거친다. */
export function findArchaeologySite(id: string): ArchaeologySiteDefinition | undefined {
  return ARCHAEOLOGY_SITES.find((site) => site.id === id);
}
