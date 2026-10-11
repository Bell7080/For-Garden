import type { DialogueNode } from "../../core/dialogue";

/**
 * 한 줄로 이어지는 대사를 짧게 적기 위한 도우미다.
 *
 * 선택지가 없고 `nextId`를 적지 않은 노드는 바로 다음 노드로 이어진다. 마지막 노드와 분기 노드는
 * 건드리지 않으므로 데이터 모양은 손으로 적은 것과 같다. ID를 줄마다 이어 적다가 한 군데를 빠뜨려
 * 이야기가 중간에서 끊기는 실수를 막으려는 것이지, 새로운 규칙을 더하는 것이 아니다.
 */
export function linear(nodes: readonly DialogueNode[]): readonly DialogueNode[] {
  return nodes.map((node, index) => {
    const next = nodes[index + 1];
    if (!next || node.nextId || node.choices?.length) return node;
    return { ...node, nextId: next.id };
  });
}
