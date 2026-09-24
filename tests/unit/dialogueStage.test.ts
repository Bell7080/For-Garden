import { describe, expect, it } from "vitest";
import { dialogueStandingOrder, resolveDialogueCast, type DialogueCastMember, type DialogueNode } from "../../src/core/dialogue";
import { OPENING_TRAIN } from "../../src/data/dialogues/openingTrain";
import { RECOLLECTION_STORIES } from "../../src/data/dialogues/recollections";
import { CHAPTERS } from "../../src/data/stages";
import { BACKGROUND, BACKGROUND_ASSETS } from "../../src/ui/backgroundAssets";
import {
  DIALOGUE_ACTS,
  DIALOGUE_BACKDROP,
  DIALOGUE_PANEL_TOP,
  DIALOGUE_STAGE_CUT,
  DIALOGUE_STAGE_FADE,
  DIALOGUE_STAGE_CROWD,
  DIALOGUE_STANDING_FRAME,
  dialogueStageSpot,
  explosionShards,
} from "../../src/ui/dialogueStageLayout";
import DIALOGUE_LAYER_SOURCE from "../../src/ui/DialogueLayer.ts?raw";

const BASE_WIDTH = 1080;

describe("이야기 무대 자리표", () => {
  it("는 몸을 칼같이 자르지 않고 어둠에 잠기게 한다", () => {
    // 대사판 윗선에서 자르던 때는 허리가 수평으로 잘린 단면이 반투명 판 위로 그대로 보였다.
    // 어둠은 판보다 위에서 시작해, 실제로 잘라 내는 선에서는 거의 불투명해야 한다.
    const { start, knee, kneeAlpha, end, endAlpha } = DIALOGUE_STAGE_FADE;
    expect(start).toBeLessThan(DIALOGUE_PANEL_TOP - 200);
    expect(start).toBeLessThan(knee);
    expect(knee).toBeLessThan(end);
    expect(kneeAlpha).toBeLessThan(endAlpha);
    expect(endAlpha).toBeGreaterThanOrEqual(0.95);
    expect(DIALOGUE_STAGE_CUT).toBe(end);
    expect(DIALOGUE_STAGE_CUT).toBeGreaterThan(DIALOGUE_PANEL_TOP);
    expect(DIALOGUE_LAYER_SOURCE).toContain("DIALOGUE_PANEL_TOP");
    expect(DIALOGUE_STANDING_FRAME.headY).toBeLessThan(DIALOGUE_STAGE_CUT / 2);
  });

  it("의 세 자리는 화면 안에서 좌우로 고르게 선다", () => {
    for (const size of [1, 2, 3]) {
      const left = dialogueStageSpot("left", size);
      const center = dialogueStageSpot("center", size);
      const right = dialogueStageSpot("right", size);
      expect(center.x).toBe(BASE_WIDTH / 2);
      expect(center.x - left.x).toBe(right.x - center.x);
      expect(left.x).toBeGreaterThan(0);
      expect(right.x).toBeLessThan(BASE_WIDTH);
      expect(left.zoom).toBe(right.zoom);
    }
  });

  it("는 여럿이 설수록 작게 벌려 세운다", () => {
    // 한 크기로 셋을 세우면 양옆이 가운데 사람의 그림자처럼 겹친다.
    expect(DIALOGUE_STAGE_CROWD[3].zoom).toBeLessThan(DIALOGUE_STAGE_CROWD[2].zoom);
    expect(DIALOGUE_STAGE_CROWD[2].zoom).toBeLessThanOrEqual(DIALOGUE_STAGE_CROWD[1].zoom);
    expect(dialogueStageSpot("left", 5)).toEqual(dialogueStageSpot("left", 3));
  });

  it("의 몸짓은 모두 제자리로 끝나고 머리를 화면 밖으로 내보내지 않는다", () => {
    for (const [act, steps] of Object.entries(DIALOGUE_ACTS)) {
      const last = steps.at(-1)!;
      // 제자리로 끝나지 않으면 대사가 쌓일수록 인물이 조금씩 흘러내린다.
      expect({ dx: last.dx, dy: last.dy }, act).toEqual({ dx: 0, dy: 0 });
      for (const step of steps) {
        expect(step.ms, act).toBeGreaterThan(0);
        // 튀어 오르는 높이는 머리 위 여백의 절반을 넘지 않는다.
        expect(-step.dy, act).toBeLessThan(DIALOGUE_STANDING_FRAME.headY / 4);
      }
    }
  });

  it("의 폭파 파편은 난수 없이 사방으로 고르게 튄다", () => {
    const shards = explosionShards(12);
    expect(shards).toEqual(explosionShards(12));
    const quadrants = new Set(shards.map(({ angle }) => Math.floor((((angle % 360) + 360) % 360) / 90)));
    expect(quadrants.size).toBe(4);
  });

  it("의 배경은 모두 원화 표에 있다", () => {
    const keys = new Set<string>(BACKGROUND_ASSETS.map(([key]) => key));
    for (const key of Object.values(DIALOGUE_BACKDROP)) expect(keys.has(key)).toBe(true);
    // 폭파 뒤 전장은 1-1이 실제로 싸우는 스토리 전장이다.
    expect(DIALOGUE_BACKDROP.battlefield).toBe(BACKGROUND.combat);
  });
});

describe("무대에 선 사람", () => {
  it("은 무대를 적지 않은 노드에서 앞 무대를 물려받는다", () => {
    const trio: DialogueCastMember[] = [{ id: "dodi", slot: "left" }, { id: "torika", slot: "center" }];
    expect(resolveDialogueCast(trio, { standing: "dodi" })).toBe(trio);
    expect(resolveDialogueCast(trio, {})).toBe(trio);
    expect(resolveDialogueCast(trio, { cast: [] })).toEqual([]);
  });

  it("은 무대에 없는 화자를 혼자 가운데에 세운다", () => {
    // 한 명만 나오는 짧은 이야기는 `cast`를 적지 않아도 된다.
    expect(resolveDialogueCast([], { standing: "torika" })).toEqual([{ id: "torika", slot: "center" }]);
    expect(resolveDialogueCast([{ id: "torika", slot: "center" }], { standing: "lexia" })).toEqual([{ id: "lexia", slot: "center" }]);
  });
});

/** 흐름을 따라 노드마다 그 순간의 무대를 돌려준다. 선택지는 모든 갈래를 함께 훑는다. */
function walkStages(): { node: DialogueNode; cast: readonly DialogueCastMember[]; backdrop: string }[] {
  const byId = new Map(OPENING_TRAIN.nodes.map((node) => [node.id, node]));
  const visited: { node: DialogueNode; cast: readonly DialogueCastMember[]; backdrop: string }[] = [];
  const seen = new Set<string>();
  const queue: { id: string; cast: readonly DialogueCastMember[]; backdrop: string }[] = [
    { id: OPENING_TRAIN.startNodeId, cast: [], backdrop: OPENING_TRAIN.backdrop! },
  ];
  while (queue.length > 0) {
    const { id, cast: before, backdrop: previousBackdrop } = queue.shift()!;
    if (seen.has(id)) continue;
    seen.add(id);
    const node = byId.get(id)!;
    const cast = resolveDialogueCast(before, node);
    const backdrop = node.backdrop ?? previousBackdrop;
    visited.push({ node, cast, backdrop });
    for (const next of [node.nextId, ...(node.choices ?? []).map(({ nextId }) => nextId)]) {
      if (next) queue.push({ id: next, cast, backdrop });
    }
  }
  return visited;
}

describe("1장 오프닝 — 추락하는 방주", () => {
  const stages = walkStages();

  it("은 검은 화면의 제목표로 열리고 열차 객차에서 시작한다", () => {
    expect(OPENING_TRAIN.titleCard).toEqual({ title: "추락하는 방주", subtitle: "이터널 시티와 연구원" });
    expect(OPENING_TRAIN.backdrop).toBe("train");
    expect(DIALOGUE_BACKDROP.train).toBe(BACKGROUND.storyTrain);
  });

  it("의 모든 노드는 시작에서 닿을 수 있다", () => {
    expect(stages.map(({ node }) => node.id).sort()).toEqual(OPENING_TRAIN.nodes.map(({ id }) => id).sort());
  });

  it("은 표정을 적지 않고 몸짓은 말하는 사람에게만 건다", () => {
    for (const node of OPENING_TRAIN.nodes) {
      expect(node, node.id).not.toHaveProperty("expression");
      expect(node, node.id).not.toHaveProperty("motion");
      if (node.act) expect(node.standing, node.id).toBeDefined();
    }
  });

  it("의 화자는 늘 무대 위에 서 있다", () => {
    for (const { node, cast } of stages) {
      if (node.standing) expect(cast.map(({ id }) => id), node.id).toContain(node.standing);
    }
  });

  it("은 쁘띠 로그 셋이 차례로 나온 뒤 경보가 울리고 검은 베일의 코마가 선다", () => {
    const order = stages.map(({ node }) => node.id);
    const firstOf = (id: string): number => stages.findIndex(({ cast }) => cast.some((member) => member.id === id));
    expect(firstOf("torika")).toBeLessThan(firstOf("dodi"));
    expect(firstOf("dodi")).toBeLessThan(firstOf("parua"));
    const alarm = order.indexOf(stages.find(({ node }) => node.cue === "alarm")!.node.id);
    expect(firstOf("parua")).toBeLessThan(alarm);
    const koma = stages[firstOf("koma")];
    expect(firstOf("koma")).toBeGreaterThan(alarm);
    // 정체를 밝히지 않는다 — 실루엣으로 서고 이름표도 가린다.
    expect(koma.cast.find(({ id }) => id === "koma")?.veiled).toBe(true);
    for (const { node } of stages.filter(({ node }) => node.standing === "koma")) expect(node.speaker).toBe("???");
  });

  it("은 폭파와 함께 전장으로 넘어가고 1-1의 적 셋과 맞선다", () => {
    const blast = stages.findIndex(({ node }) => node.cue === "explosion");
    expect(blast).toBeGreaterThan(0);
    expect(stages[blast].node.backdrop).toBe("battlefield");
    expect(stages[blast].cast).toEqual([]);
    for (const { backdrop } of stages.slice(0, blast)) expect(backdrop).toBe("train");
    for (const { backdrop } of stages.slice(blast)) expect(backdrop).toBe("battlefield");

    // 오프닝이 끝나는 자리가 곧 첫 관문이다 — 폭파 뒤 선 공멸 셋이 1-1의 적 편성과 같다.
    const firstStage = CHAPTERS[0].stages[0];
    expect(firstStage.kind).toBe("battle");
    const stageEnemies = firstStage.kind === "battle" ? firstStage.enemies.map(({ relicId }) => relicId).sort() : [];
    const raiders = new Set(stages.slice(blast).flatMap(({ cast }) => cast.map(({ id }) => id)).filter((id) => ["toby", "amo", "ripa"].includes(id)));
    expect([...raiders].sort()).toEqual(stageEnemies);
  });

  it("의 스탠딩은 미리 읽기 순서에 모두 들어 있다", () => {
    const order = dialogueStandingOrder(OPENING_TRAIN);
    expect(order[0]).toBe("torika");
    for (const { cast } of stages) for (const { id } of cast) expect(order).toContain(id);
  });
});

describe("다른 이야기", () => {
  it("도 표정 이름을 들고 있지 않다", () => {
    for (const story of RECOLLECTION_STORIES) {
      for (const node of story.nodes) expect(node, `${story.id}.${node.id}`).not.toHaveProperty("expression");
    }
  });
});

describe("1-1 뒤의 막 — 공멸 삼인조의 퇴각", () => {
  it("은 전장에서 삼인조로 시작해, 날아가 별이 된 뒤 쁘띠 로그 셋이 마무리한다", async () => {
    const { OPENING_RETREAT } = await import("../../src/data/dialogues/openingRetreat");
    expect(OPENING_RETREAT.backdrop).toBe("battlefield");
    const byId = new Map(OPENING_RETREAT.nodes.map((node) => [node.id, node]));
    const order: DialogueNode[] = [];
    for (let node = byId.get(OPENING_RETREAT.startNodeId); node; node = node.nextId ? byId.get(node.nextId) : undefined) order.push(node);
    expect(order).toHaveLength(OPENING_RETREAT.nodes.length);
    const ids = (cast: readonly DialogueCastMember[] | undefined) => (cast ?? []).map(({ id }) => id).sort();
    expect(ids(order[0].cast)).toEqual(["amo", "ripa", "toby"]);
    // 날아가는 퇴장은 무대를 비우는 마디에 걸린다 — 빠지는 사람에게만 걸리는 방식이라서다.
    const away = order.find((node) => node.leave === "blastOff")!;
    expect(away.cast).toEqual([]);
    const after = order.slice(order.indexOf(away) + 1);
    expect(ids(after[0].cast)).toEqual(["dodi", "parua", "torika"]);
    for (const node of after) if (node.standing) expect(["torika", "dodi", "parua"]).toContain(node.standing);
  });

  it("은 전투 입력이 넘긴 막으로 찾을 수 있다", async () => {
    const { OPENING_RETREAT } = await import("../../src/data/dialogues/openingRetreat");
    const { getRecollectionStory } = await import("../../src/data/dialogues/recollections");
    expect(getRecollectionStory(OPENING_RETREAT.id)).toBe(OPENING_RETREAT);
  });
});

describe("장면 연출의 층", () => {
  it("경보와 섬광은 대사판 위에 서고, 화면을 덮는 층은 진동 폭보다 넉넉히 화면 밖으로 뻗는다", async () => {
    const source = (await import("../../src/ui/DialogueStage.ts?raw")).default;
    const depth = /const DEPTH = \{[^}]*alarm: (\d+), flash: (\d+)/.exec(source)!;
    // 대사판(600) 아래에 두면 판의 짙은 유리가 아래쪽만 눌러 화면이 위아래로 갈려 보였다.
    expect(Number(depth[1])).toBeGreaterThan(600);
    expect(Number(depth[2])).toBeGreaterThan(600);
    const { DIALOGUE_OVERSCAN, DIALOGUE_CUES } = await import("../../src/ui/dialogueStageLayout");
    const maxShake = Math.max(...Object.values(DIALOGUE_CUES).map(({ shakeIntensity }) => shakeIntensity)) * 1920;
    expect(DIALOGUE_OVERSCAN).toBeGreaterThan(maxShake);
  });
});
