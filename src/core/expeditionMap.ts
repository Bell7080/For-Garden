import {
  EXPEDITION_COMBAT_TYPES,
  EXPEDITION_MAP_BALANCE,
  EXPEDITION_NON_COMBAT_TYPES,
} from "../data/expedition";

/** 원정에서 화면과 저장 모델이 공통으로 사용하는 완전한 노드 종류다. */
export type ExpeditionNodeType = "normal" | "elite" | "horde" | "rest" | "treasure" | "boss";

/** 하단 1층에서 상단 20층으로 이어지는 한 맵 노드의 직렬화 가능한 모양이다. */
export interface ExpeditionMapNode {
  id: string;
  floor: number;
  column: number;
  type: ExpeditionNodeType;
  predecessorIds: string[];
  successorIds: string[];
}

/** 저장 시 seed를 맵과 함께 보존하면 같은 seed용 RNG를 다시 주입해 완전히 복원할 수 있다. */
export interface ExpeditionMap {
  seed: string;
  nodes: ExpeditionMapNode[];
}

/** 생성기는 난수 구현을 소유하지 않으며 호출자가 저장 seed로 만든 RNG만 전달한다. */
export interface GenerateExpeditionMapInput {
  seed: string;
  random: () => number;
}

const ROUTE_TYPES = [...EXPEDITION_COMBAT_TYPES, ...EXPEDITION_NON_COMBAT_TYPES] as const;
type RouteNodeType = (typeof ROUTE_TYPES)[number];

/** 외부 RNG 계약을 검사해 잘못된 값이 맵 인덱스를 조용히 오염시키지 않게 한다. */
function roll(random: () => number): number {
  const value = random();
  if (!Number.isFinite(value) || value < 0 || value >= 1) throw new RangeError("원정 난수는 0 이상 1 미만이어야 합니다.");
  return value;
}

/** 후보 열을 중복 없이 뽑아 왼쪽에서 오른쪽 순서로 정렬한다. */
function chooseColumns(count: number, random: () => number): number[] {
  const columns = Array.from({ length: EXPEDITION_MAP_BALANCE.columns }, (_, column) => column);
  for (let index = columns.length - 1; index > 0; index -= 1) {
    const target = Math.floor(roll(random) * (index + 1));
    [columns[index], columns[target]] = [columns[target], columns[index]];
  }
  return columns.slice(0, count).sort((left, right) => left - right);
}

/** 정적 가중치와 직전 층의 제한을 함께 적용해 노드 종류를 결정한다. */
function chooseType(previous: RouteNodeType | undefined, streak: number, nonCombatStreak: number, random: () => number): RouteNodeType {
  const candidates = ROUTE_TYPES.filter((type) => {
    if (type === previous && streak >= EXPEDITION_MAP_BALANCE.maxConsecutiveSameType) return false;
    return !(EXPEDITION_NON_COMBAT_TYPES.includes(type as "rest" | "treasure") && nonCombatStreak >= EXPEDITION_MAP_BALANCE.maxConsecutiveNonCombat);
  });
  const total = candidates.reduce((sum, type) => sum + EXPEDITION_MAP_BALANCE.typeWeights[type], 0);
  let target = roll(random) * total;
  for (const type of candidates) {
    target -= EXPEDITION_MAP_BALANCE.typeWeights[type];
    if (target < 0) return type;
  }
  return candidates[candidates.length - 1];
}

/** 양쪽 층의 모든 노드가 적어도 한 간선을 갖도록 가장 가까운 열끼리 연결한다. */
function connectFloors(previous: ExpeditionMapNode[], next: ExpeditionMapNode[]): void {
  const nearest = (node: ExpeditionMapNode, candidates: ExpeditionMapNode[]) => candidates.reduce((best, candidate) =>
    Math.abs(candidate.column - node.column) < Math.abs(best.column - node.column) ? candidate : best);
  const connect = (from: ExpeditionMapNode, to: ExpeditionMapNode) => {
    if (!from.successorIds.includes(to.id)) from.successorIds.push(to.id);
    if (!to.predecessorIds.includes(from.id)) to.predecessorIds.push(from.id);
  };
  previous.forEach((node) => connect(node, nearest(node, next)));
  next.forEach((node) => connect(nearest(node, previous), node));
}

/** Phaser에 의존하지 않고 1~19층 갈래가 20층 단일 보스로 합류하는 결정적 맵을 만든다. */
export function generateExpeditionMap(input: GenerateExpeditionMapInput): ExpeditionMap {
  if (input.seed.length === 0) throw new Error("복원 가능한 원정 맵에는 비어 있지 않은 seed가 필요합니다.");
  const floors: ExpeditionMapNode[][] = [];
  const columnHistory = new Map<number, { type: RouteNodeType; streak: number; nonCombatStreak: number }>();
  for (let floor = 1; floor <= EXPEDITION_MAP_BALANCE.routeFloors; floor += 1) {
    const span = EXPEDITION_MAP_BALANCE.nodesPerFloor.max - EXPEDITION_MAP_BALANCE.nodesPerFloor.min + 1;
    const count = EXPEDITION_MAP_BALANCE.nodesPerFloor.min + Math.floor(roll(input.random) * span);
    const requiredCombat = EXPEDITION_MAP_BALANCE.requiredCombatFloors.includes(floor as 1);
    const nodes = chooseColumns(count, input.random).map((column): ExpeditionMapNode => {
      const history = columnHistory.get(column);
      const type = requiredCombat
        ? EXPEDITION_COMBAT_TYPES[Math.floor(roll(input.random) * EXPEDITION_COMBAT_TYPES.length)]
        : chooseType(history?.type, history?.streak ?? 0, history?.nonCombatStreak ?? 0, input.random);
      const nonCombat = EXPEDITION_NON_COMBAT_TYPES.includes(type as "rest" | "treasure");
      columnHistory.set(column, {
        type,
        streak: history?.type === type ? history.streak + 1 : 1,
        nonCombatStreak: nonCombat ? (history?.nonCombatStreak ?? 0) + 1 : 0,
      });
      return { id: `f${floor}-c${column}`, floor, column, type, predecessorIds: [], successorIds: [] };
    });
    floors.push(nodes);
    if (floor > 1) connectFloors(floors[floor - 2], nodes);
  }
  const boss: ExpeditionMapNode = { id: "f20-boss", floor: EXPEDITION_MAP_BALANCE.bossFloor, column: 2, type: "boss", predecessorIds: [], successorIds: [] };
  connectFloors(floors[floors.length - 1], [boss]);
  const map = { seed: input.seed, nodes: [...floors.flat(), boss] };
  const errors = validateExpeditionMap(map);
  if (errors.length > 0) throw new Error(`유효하지 않은 원정 맵: ${errors.join("; ")}`);
  return map;
}

/** 도달 가능성, 순방향 층 연결, 양방향 ID 일관성과 마지막 보스 불변식을 검사한다. */
export function validateExpeditionMap(map: ExpeditionMap): string[] {
  const errors: string[] = [];
  const byId = new Map(map.nodes.map((node) => [node.id, node]));
  if (byId.size !== map.nodes.length) errors.push("노드 ID가 중복되었습니다.");
  const bosses = map.nodes.filter((node) => node.floor === EXPEDITION_MAP_BALANCE.bossFloor && node.type === "boss");
  if (bosses.length !== 1 || map.nodes.some((node) => node.type === "boss" && node.floor !== EXPEDITION_MAP_BALANCE.bossFloor)) errors.push("20층에는 단일 보스만 있어야 합니다.");
  for (const node of map.nodes) {
    if (node.floor === 1 && node.predecessorIds.length > 0) errors.push(`${node.id}: 시작층에 선행 노드가 있습니다.`);
    if (node.floor > 1 && node.predecessorIds.length === 0) errors.push(`${node.id}: 선행 경로가 없습니다.`);
    if (node.floor < EXPEDITION_MAP_BALANCE.bossFloor && node.successorIds.length === 0) errors.push(`${node.id}: 후행 경로가 없습니다.`);
    for (const successorId of node.successorIds) {
      const successor = byId.get(successorId);
      if (!successor || successor.floor !== node.floor + 1) errors.push(`${node.id}: 다음 층이 아닌 후행 연결입니다.`);
      else if (!successor.predecessorIds.includes(node.id)) errors.push(`${node.id}: 후행 연결의 역참조가 없습니다.`);
    }
  }
  const reachable = new Set(map.nodes.filter((node) => node.floor === 1).map((node) => node.id));
  for (let floor = 1; floor < EXPEDITION_MAP_BALANCE.bossFloor; floor += 1) {
    map.nodes.filter((node) => node.floor === floor && reachable.has(node.id)).forEach((node) => node.successorIds.forEach((id) => reachable.add(id)));
  }
  map.nodes.filter((node) => !reachable.has(node.id)).forEach((node) => errors.push(`${node.id}: 시작점에서 도달할 수 없습니다.`));
  return errors;
}
