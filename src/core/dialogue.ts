/** 정적 대사 데이터가 참조할 수 있는 스탠딩 원화 키다. 런타임 객체는 데이터에 넣지 않는다. */
export type DialogueStandingAsset =
  | "torika" | "lexia" | "seira" | "dodi" | "parua"
  | "koma" | "toby" | "amo" | "ripa";

/** 스탠딩이 서는 세 자리. 좌표는 화면이 아니라 `dialogueStageLayout.ts` 한 표가 갖는다. */
export type DialogueStageSlot = "left" | "center" | "right";

/**
 * 무대에 선 한 명.
 *
 * `veiled`는 아직 정체를 밝히지 않은 인물을 **검은 실루엣**으로 세운다. 이름을 `???`로 가리는
 * 것만으로는 화면에 선 그림이 이미 누구인지 말해 버린다.
 */
export interface DialogueCastMember {
  id: DialogueStandingAsset;
  slot: DialogueStageSlot;
  veiled?: boolean;
}

/**
 * 말하는 스탠딩의 연출.
 *
 * **표정을 바꾸지 않는다.** 스탠딩은 늘 idle로 서 있고, 기분은 몸 전체를 옮겨서 말한다 —
 * 통통 튀기·부들부들 떨기·끄덕이기처럼 수집형 RPG 대사 화면이 흔히 쓰는 문법이다. 표정
 * 이름(`smile`)을 데이터에 적던 때는 화면이 그 낱말을 화자 이름 옆에 그대로 적었다.
 */
export type DialogueAct =
  /** 한 번 가볍게 뛴다 — 반가움·기운. */
  | "hop"
  /** 두 번 연달아 뛴다 — 들뜸. */
  | "hopTwice"
  /** 좌우로 짧게 흔든다 — 놀람·항의. */
  | "shake"
  /** 제자리에서 잘게 떤다 — 긴장·수줍음. */
  | "tremble"
  /** 한 번 숙였다 돌아온다 — 수긍·인사. */
  | "nod"
  /** 화면 쪽으로 한 뼘 다가왔다 돌아간다 — 관심. */
  | "lean"
  /** 뒤로 움찔 물러났다 돌아온다 — 당황. */
  | "recoil"
  /** 아래로 움츠러들었다 천천히 돌아온다 — 부끄러움. */
  | "shrink";

/**
 * 화면 전체의 연출. 스탠딩이 아니라 **장면**에 일어나는 일이다.
 *
 * `alarm`은 한 번 켜지면 `explosion`이나 배경이 바뀔 때까지 붉게 맥박친다 — 경보는 한 줄이
 * 아니라 그 뒤 몇 마디 내내 울리고 있어야 경보다.
 */
export type DialogueCue = "rumble" | "alarm" | "explosion" | "impact";

/** 이야기의 배경. 키와 원화의 대응은 `dialogueStageLayout.ts`의 표가 갖는다. */
export type DialogueBackdrop = "train" | "battlefield";

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

/**
 * 한 노드는 문장, 무대 상태, 직선 이동 또는 선택 분기를 모두 표현한다.
 *
 * **무대는 적지 않으면 그대로 이어진다.** `cast`를 적은 노드만 선 사람을 통째로 바꾸고(`[]`는
 * 모두 퇴장), 적지 않은 노드는 앞 노드의 무대를 물려받는다. `standing`은 그중 **지금 말하는
 * 사람**이라 밝게 앞으로 서고 나머지는 한 톤 가라앉는다. 무대에 없는 사람이 `standing`이면
 * 가운데에 혼자 세운다 — 한 명만 나오는 짧은 이야기는 `cast`를 적지 않아도 된다.
 */
export interface DialogueNode {
  id: string;
  /** 비워 두면 화자 이름표를 세우지 않는 지문이다. */
  speaker: string;
  body: string;
  standing?: DialogueStandingAsset;
  cast?: readonly DialogueCastMember[];
  act?: DialogueAct;
  cue?: DialogueCue;
  /** 이 노드에서 배경을 바꾼다. `explosion`과 함께 적으면 섬광 속에서 갈린다. */
  backdrop?: DialogueBackdrop;
  nextId?: string;
  choices?: readonly DialogueChoice[];
}

/** 이야기에 들어가는 순간 검은 화면 위에서 열렸다 사라지는 제목과 부제. */
export interface DialogueTitleCard {
  title: string;
  subtitle: string;
}

export interface DialogueStory {
  id: string;
  startNodeId: string;
  /** 첫 노드 앞에 깔리는 배경. 없으면 그 이야기를 여는 씬의 기본 판이 선다. */
  backdrop?: DialogueBackdrop;
  titleCard?: DialogueTitleCard;
  nodes: readonly DialogueNode[];
}

/** 이 노드를 지난 뒤 무대에 선 사람. 무대를 적지 않은 노드는 앞 무대를 그대로 물려받는다. */
export function resolveDialogueCast(
  previous: readonly DialogueCastMember[],
  node: Pick<DialogueNode, "cast" | "standing">,
): readonly DialogueCastMember[] {
  const cast = node.cast ?? previous;
  if (!node.standing || cast.some(({ id }) => id === node.standing)) return cast;
  // 무대에 없는 화자는 혼자 가운데에 선다. 짧은 이야기가 `cast` 없이 `standing`만 적어도 된다.
  return [{ id: node.standing, slot: "center" }];
}

/** 이야기가 쓰는 스탠딩을 처음 서는 순서대로 모은다. 미리 읽기가 이 순서를 따른다. */
export function dialogueStandingOrder(story: DialogueStory): DialogueStandingAsset[] {
  const seen = new Set<DialogueStandingAsset>();
  for (const node of story.nodes) {
    for (const member of node.cast ?? []) seen.add(member.id);
    if (node.standing) seen.add(node.standing);
  }
  return [...seen];
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
      const slots = (node.cast ?? []).map(({ slot }) => slot);
      if (new Set(slots).size !== slots.length) throw new Error(`한 자리에 두 명을 세울 수 없습니다: ${node.id}`);
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
