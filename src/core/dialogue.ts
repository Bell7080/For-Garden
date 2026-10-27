import type { PortraitAssetId } from "./types";

/** 정적 대사 데이터가 참조할 수 있는 스탠딩 원화 키다. 런타임 객체는 데이터에 넣지 않는다. */
export type DialogueStandingAsset = PortraitAssetId | "obi";

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
  /**
   * 무전·통신 너머의 목소리. 만나지 못하고 들리는 사람이라 **옅은 푸른 투영**으로 세운다(마일리지 상점의 점원과
   * 같은 결). 얼굴은 가리지 않는다. 직접 만나면 적지 않는다.
   */
  remote?: boolean;
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
  | "shrink"
  /** 퍽 맞은 듯 세로로 꾹 눌렸다가 탱 하고 돌아온다 — 충격·타격. */
  | "squash"
  /** 말랑하게 늘었다 줄었다 하며 통통 튄다 — 신남·장난. */
  | "bounce"
  /** 푸르게 질려 잘게 떨다가 서서히 돌아온다 — 겁먹음. */
  | "fright"
  /** 붉게 빠직하며 부풀어 떤다 — 분노·폭주. */
  | "rage"
  /** 하얗게 질려 휘청인다 — 얼이 빠짐. */
  | "faint"
  /** 으쓱하며 한 뼘 부풀었다 돌아온다 — 자랑·우쭐. */
  | "puff";

/**
 * 장면에 붙는 안내 표지. 사람이 아닌 목소리(방송·경고·시스템·관제)가 말할 때 화면 가운데에
 * **글자 딱지**로 서서 지금 말하는 주체를 확실히 보여 준다 — 이름표만으로는 캐릭터가 없는
 * 장면에서 누구의 말인지 읽히지 않는다.
 */
export type DialogueSign = "announce" | "warning" | "system" | "broadcast" | "tower";

/**
 * 화면 전체의 연출. 스탠딩이 아니라 **장면**에 일어나는 일이다.
 *
 * `alarm`은 한 번 켜지면 `explosion`이나 배경이 바뀔 때까지 붉게 맥박친다 — 경보는 한 줄이
 * 아니라 그 뒤 몇 마디 내내 울리고 있어야 경보다.
 */
export type DialogueCue = "rumble" | "alarm" | "explosion" | "impact";

/**
 * 무대를 떠나는 방식. 적지 않으면 그 자리에서 옅어진다.
 *
 * `blastOff`는 쓰러진 SD가 튕겨 날아가 별이 되는 전투의 퇴장과 같은 문법이다 — 한 방 맞고
 * 하늘로 날아가며 "두고 보자~"를 외치는 우당탕탕 퇴장을 대사 화면에서도 그대로 읽히게 한다.
 */
export type DialogueLeave = "blastOff";

/** 이야기의 배경. 키와 원화의 대응은 `dialogueStageLayout.ts`의 표가 갖는다. */
export type DialogueBackdrop = "train" | "battlefield" | "relics";

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
  /** 이 노드에서 무대를 떠나는 사람이 어떻게 나가는가. `cast`로 빠진 사람에게만 걸린다. */
  leave?: DialogueLeave;
  /** 사람이 아닌 목소리의 딱지. 적은 노드에만 뜨고, 적지 않은 노드에서는 걷힌다. */
  sign?: DialogueSign;
  /** `standing`이 무대에 없어 혼자 서게 될 때 무전 목소리로 세울지. `cast`를 적은 노드는 멤버가 갖는다. */
  remote?: boolean;
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
  node: Pick<DialogueNode, "cast" | "standing" | "leave" | "remote"> & { speaker?: string },
): readonly DialogueCastMember[] {
  const cast = node.cast ?? previous;
  if (!node.standing || cast.some(({ id }) => id === node.standing)) return cast;
  // **떠나는 화자는 다시 세우지 않는다.** `leave`가 걸린 노드에서 화자가 무대에서 빠졌다면 그 화자가
  // 대사를 외치며 날아가는 것이다 — 가운데에 혼자 다시 세우면 화자는 남고 남은 아군이 대신 날아간다.
  if (node.leave) return cast;
  // 이 노드의 무대를 직접 적었는데 화자만 빠져 있고 화자가 앞 무대에 서 있었다면, 화자는 이 대사를 하며
  // 떠나는 것이다(퇴장 대사). 가운데에 혼자 다시 세우면 남은 사람들이 대신 사라진다.
  if (node.cast && previous.some(({ id }) => id === node.standing)) return cast;
  // 혼자 서 있던 사람과 주고받는 말이면 그 사람을 지우지 않고 곁에 세운다. 둘이 번갈아 말하는 장면에서
  // 말할 때마다 상대가 사라지면 대화가 아니라 독백 둘로 읽힌다. 지문(화자가 빈 노드)은 장면을 새로 여는
  // 자리라 여전히 혼자 세운다.
  if (node.speaker && previous.length === 1) {
    const other = previous[0]!;
    return [
      { ...other, slot: "left" },
      { id: node.standing, slot: "right", ...(node.remote ? { remote: true } : {}) },
    ];
  }
  // 무대에 없는 화자는 혼자 가운데에 선다. 짧은 이야기가 `cast` 없이 `standing`만 적어도 된다.
  return [{ id: node.standing, slot: "center", ...(node.remote ? { remote: true } : {}) }];
}

/** 이야기가 쓰는 스탠딩을 처음 서는 순서대로 모은다. 미리 읽기가 이 순서를 따른다. */
export function dialogueStandingOrder(
  story: DialogueStory,
  /** 스탠딩을 적지 않은 노드의 화자를 원화로 잇는 규칙. 데이터 계층이 넘긴다. */
  bySpeaker?: (speaker: string) => DialogueStandingAsset | undefined,
): DialogueStandingAsset[] {
  const seen = new Set<DialogueStandingAsset>();
  for (const node of story.nodes) {
    for (const member of node.cast ?? []) seen.add(member.id);
    const standing = node.standing ?? (node.speaker ? bySpeaker?.(node.speaker) : undefined);
    if (standing) seen.add(standing);
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
