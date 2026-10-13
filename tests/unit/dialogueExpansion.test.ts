import { describe, expect, it } from "vitest";
import { resolveDialogueCast, type DialogueCastMember, type DialogueNode } from "../../src/core/dialogue";
import { CHAPTER_1_STORIES, STAGE_1_5_POST, STAGE_1_6_POST, STAGE_1_8_PRE, STAGE_1_9_PRE } from "../../src/data/dialogues/chapter1";
import { CHAPTER_2_STORIES } from "../../src/data/dialogues/chapter2";
import { OPENING_TRAIN } from "../../src/data/dialogues/openingTrain";
import { speakerStanding } from "../../src/data/dialogues/speakerStanding";
import { DIALOGUE_ACTS, DIALOGUE_ACT_FILL, DIALOGUE_REMOTE, DIALOGUE_SIGN } from "../../src/ui/dialogueStageLayout";

/** 흐름을 따라 노드마다 그 순간의 무대를 돌려준다(화자 이름으로 스탠딩을 잇는 규칙 포함). */
function walk(nodes: readonly DialogueNode[], start: string) {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const out: { node: DialogueNode; before: readonly DialogueCastMember[]; cast: readonly DialogueCastMember[] }[] = [];
  let before: readonly DialogueCastMember[] = [];
  for (let id: string | undefined = start; id; ) {
    const raw: DialogueNode = byId.get(id)!;
    const node = { ...raw, standing: raw.standing ?? (raw.speaker ? speakerStanding(raw.speaker) : undefined) };
    const cast = resolveDialogueCast(before, node);
    out.push({ node, before, cast });
    before = cast;
    id = raw.nextId;
  }
  return out;
}

describe("새 몸짓", () => {
  it("은 크기·색까지 모두 제자리로 끝난다", () => {
    for (const [act, steps] of Object.entries(DIALOGUE_ACTS)) {
      const last = steps.at(-1)!;
      expect({ sx: last.sx ?? 1, sy: last.sy ?? 1, fill: last.fill ?? 0 }, act).toEqual({ sx: 1, sy: 1, fill: 0 });
    }
  });

  it("중 색을 입히는 것은 겁(푸름)·분노(붉음)·얼빠짐(하양)이다", () => {
    for (const act of ["fright", "rage", "faint"] as const) {
      expect(DIALOGUE_ACT_FILL[act]).toBeTypeOf("number");
      expect(DIALOGUE_ACTS[act].some((step) => (step.fill ?? 0) > 0), act).toBe(true);
    }
    expect(DIALOGUE_ACT_FILL.rage).not.toBe(DIALOGUE_ACT_FILL.fright);
  });
});

describe("딱지와 무전", () => {
  it("의 딱지는 다섯 종류가 모두 색을 갖는다", () => {
    expect(Object.keys(DIALOGUE_SIGN).sort()).toEqual(["announce", "broadcast", "system", "tower", "warning"]);
  });

  it("의 오프닝 안내 방송은 딱지를 달고, 다음 노드에서 걷힌다", () => {
    const alarm = OPENING_TRAIN.nodes.find(({ id }) => id === "alarm")!;
    expect(alarm.sign).toBe("broadcast");
    expect(OPENING_TRAIN.nodes.find(({ id }) => id === "sense")!.sign).toBeUndefined();
  });

  it("의 투영은 얼굴 어둠이 반투명 겹으로 쌓인다", () => {
    expect(DIALOGUE_REMOTE.face.layers).toBeGreaterThan(1);
    expect(DIALOGUE_REMOTE.face.layers * DIALOGUE_REMOTE.face.alphaPerLayer).toBeGreaterThan(0.5);
  });

  it("1-6 후의 스테라·켄토는 무전 목소리로 가운데에 서고 곁의 둘은 그대로 남는다", () => {
    for (const { node, cast } of walk(STAGE_1_6_POST.nodes, STAGE_1_6_POST.startNodeId)) {
      if (node.speaker !== "스테라" && node.speaker !== "켄토") continue;
      const voice = cast.find(({ id }) => id === node.standing);
      expect(voice, node.id).toMatchObject({ slot: "center", remote: true });
      expect(cast, node.id).toHaveLength(3);
    }
  });
});

describe("화자 이름으로 일러스트 잇기", () => {
  it("는 전신이 있는 사람과 오비를 찾고 사람이 아닌 목소리는 찾지 않는다", () => {
    expect(speakerStanding("티아")).toBe("tia");
    expect(speakerStanding("오비")).toBe("obi");
    expect(speakerStanding("스피나")).toBe("seira");
    expect(speakerStanding("안내 방송")).toBeUndefined();
    expect(speakerStanding("???")).toBeUndefined();
  });

  it("로 이은 1장·2장의 화자는 늘 무대 위에 서 있고 말하는 사람이 사라지지 않는다", () => {
    for (const story of [...CHAPTER_1_STORIES, ...CHAPTER_2_STORIES]) {
      for (const { node, before, cast } of walk(story.nodes, story.startNodeId)) {
        if (!node.standing || (node.leave)) continue;
        // 무대를 직접 적고 화자가 앞 무대에서 빠져나가는 퇴장 대사는 예외다.
        if (node.cast && before.some(({ id }) => id === node.standing)) continue;
        expect(cast.some(({ id }) => id === node.standing), `${story.id}.${node.id}`).toBe(true);
        // 화자를 세우려고 앞 무대를 갈아엎지 않는다(앞 사람이 하나라도 남는다).
        if (before.length > 0 && !node.cast) expect(cast, `${story.id}.${node.id}`).toBe(before);
      }
    }
  });
});

describe("버그 — 날아가는 사람", () => {
  it("1-5 후에는 말하는 토비가 날아가고 남은 아군이 대신 사라지지 않는다", () => {
    const steps = walk(STAGE_1_5_POST.nodes, STAGE_1_5_POST.startNodeId);
    const away = steps.find(({ node }) => node.id === "away")!;
    expect(away.node.leave).toBe("blastOff");
    expect(away.before.some(({ id }) => id === "toby")).toBe(true);
    expect(away.cast.map(({ id }) => id).sort()).toEqual(["dodi", "torika"]);
  });

  it("퇴장 대사의 화자를 가운데에 다시 세우지 않는다", () => {
    const before: DialogueCastMember[] = [{ id: "torika", slot: "left" }, { id: "koma", slot: "right" }];
    const cast = [{ id: "torika" as const, slot: "left" as const }];
    expect(resolveDialogueCast(before, { standing: "koma", cast })).toEqual(cast);
    // 앞 무대에 없던 화자는 여전히 혼자 가운데에 선다.
    expect(resolveDialogueCast(before, { standing: "lexia", cast })).toEqual([{ id: "lexia", slot: "center" }]);
  });
});

describe("티아", () => {
  it("의 1-8 대사는 연구원님을 부르는 해요체이고 소매의 첫 조각을 말한다", () => {
    const lines = STAGE_1_8_PRE.nodes.filter(({ speaker }) => speaker === "티아").map(({ body }) => body);
    expect(lines.length).toBeGreaterThanOrEqual(6);
    expect(lines.join(" ")).toContain("연구원님");
    expect(lines.join(" ")).toContain("처음 주운 조각");
    for (const line of lines) expect(line, line).not.toMatch(/(했다|한다|이야|야)[.!]?$/);
  });

  it("와 오비는 직접 만나기 전에는 문 너머 목소리로 선다", () => {
    const inside = walk(STAGE_1_9_PRE.nodes, STAGE_1_9_PRE.startNodeId).find(({ node }) => node.id === "inside")!;
    expect(inside.cast.find(({ id }) => id === "obi")).toMatchObject({ slot: "center", remote: true });
  });
});
