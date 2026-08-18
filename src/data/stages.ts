import type { StageDef } from "../core/types";

/**
 * 스테이지. 지도에서 아래에서 위로 올라가는 순서 그대로다.
 * 적은 언제나 3명으로 구성된다.
 */
export const STAGES: StageDef[] = [
  { id: "1-1", name: "격리 구역", enemies: ["husk-raptor", "husk-wing", "husk-raptor"] },
  { id: "1-2", name: "붕괴한 온실", enemies: ["husk-shell", "husk-raptor", "husk-wing"] },
  { id: "1-3", name: "침수된 배양실", enemies: ["husk-wing", "husk-shell", "husk-raptor"] },
  { id: "1-4", name: "표본 보관고", enemies: ["husk-shell", "husk-wing", "husk-shell"] },
  { id: "1-5", name: "제1구역 관제탑", enemies: ["husk-shell", "husk-raptor", "husk-shell"] },
];

export function getStage(id: string): StageDef {
  const found = STAGES.find((s) => s.id === id);
  if (!found) throw new Error(`알 수 없는 스테이지 id: ${id}`);
  return found;
}
