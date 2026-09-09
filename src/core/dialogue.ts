/** 정적 대사 데이터가 참조할 수 있는 스탠딩 원화 키다. 런타임 객체는 데이터에 넣지 않는다. */
export type DialogueStandingAsset = "torika" | "lexia" | "seira";

/** 대사에서 허용하는 짧은 Puppet 반응이다. 임의 애니메이션 이름 주입을 막는다. */
export type DialogueMotion = "idle" | "hit" | "attack";

/**
 * 선택 결과는 실행 함수가 아니라 제한된 명령만 가진다.
 * 저장/API 경계가 대상과 정수 범위를 검증할 수 있어 콘텐츠 데이터가 임의 코드를 실행하지 못한다.
 */
export type DialogueEffect = { type: "bondXp"; relicId: string; amount: number };

export interface DialogueChoice {
  id: string;
  label: string;
  nextId?: string;
  effect?: DialogueEffect;
}

/** 한 노드는 문장, 표시 상태, 직선 이동 또는 선택 분기를 모두 표현한다. */
export interface DialogueNode {
  id: string;
  speaker: string;
  body: string;
  standing?: DialogueStandingAsset;
  expression?: string;
  motion?: DialogueMotion;
  nextId?: string;
  choices?: readonly DialogueChoice[];
}

export interface DialogueStory {
  id: string;
  startNodeId: string;
  nodes: readonly DialogueNode[];
}

/** 씬과 무관한 분기 커서로 마지막 노드와 잘못된 데이터 참조를 한 곳에서 판정한다. */
export class DialogueFlow {
  private readonly byId: Map<string, DialogueNode>;
  private currentId: string;
  /** 최초 노드는 Puppet 비동기 표시가 끝나기 전 생성 입력과 경쟁하지 않도록 잠긴 채 시작한다. */
  private inputLocked = true;

  constructor(readonly story: DialogueStory) {
    this.byId = new Map(story.nodes.map((node) => [node.id, node]));
    if (this.byId.size !== story.nodes.length) throw new Error("대사 노드 ID는 중복될 수 없습니다.");
    if (!this.byId.has(story.startNodeId)) throw new Error("대사 시작 노드가 없습니다.");
    this.currentId = story.startNodeId;
    for (const node of story.nodes) {
      if (node.nextId && !this.byId.has(node.nextId)) throw new Error(`다음 대사 노드가 없습니다: ${node.nextId}`);
      for (const choice of node.choices ?? []) if (choice.nextId && !this.byId.has(choice.nextId)) throw new Error(`선택지 다음 노드가 없습니다: ${choice.nextId}`);
    }
  }

  get current(): DialogueNode { return this.byId.get(this.currentId)!; }

  /**
   * 최초 표시 전 입력과 같은 프레임의 연속 pointer 이벤트는 현재 노드를 소비하지 않는다.
   * 호출자는 Puppet을 포함한 현재 노드 표시가 끝난 뒤 `markCurrentNodeReady`로 잠금을 풀어야 한다.
   */
  advance(choiceId?: string): { node?: DialogueNode; effect?: DialogueEffect; completed: boolean } {
    // UI 타이핑 상태와 별개인 흐름 잠금이 타이틀 진입 입력과 비동기 Puppet 로딩의 경쟁을 차단한다.
    if (this.inputLocked) return { node: this.current, completed: false };
    this.inputLocked = true;
    const node = this.current;
    let nextId = node.nextId;
    let effect: DialogueEffect | undefined;
    if (node.choices?.length) {
      const choice = node.choices.find(({ id }) => id === choiceId);
      if (!choice) { this.inputLocked = false; throw new Error("현재 노드에 없는 선택지입니다."); }
      nextId = choice.nextId;
      effect = choice.effect;
    } else if (choiceId) {
      this.inputLocked = false;
      throw new Error("선택지가 없는 노드입니다.");
    }
    if (!nextId) return { effect, completed: true };
    this.currentId = nextId;
    return { node: this.current, effect, completed: false };
  }

  /** Puppet을 포함한 현재 노드 표시가 끝났음을 알려 최초 표시 및 노드 사이 입력 잠금을 해제한다. */
  markCurrentNodeReady(): void { this.inputLocked = false; }
}
