import { describe, expect, it } from "vitest";
import { createSkirmish, fireUltimate, stepSkirmish, type Arena, type SkirmishEvent } from "../../src/core/skirmish";
import { getRelic, RELICS } from "../../src/data/relics";
import { RAID_BOSS_POOL } from "../../src/data/raid";
import { ENEMY_SD_ASSETS_BY_ID, portraitAssetFor } from "../../src/puppets/assets";
import { raidBossDef } from "../../src/core/raid";
import { passiveDescription } from "../../src/ui/skillPresentation";

const ARENA: Arena = { left: 130, right: 950, top: 600, bottom: 1360 };

describe("코아틀 — 셋째 레이드 보스", () => {
  const boss = getRelic("quetzalcoatlus");

  it("바람 속성의 전사이고 공멸의 적이다", () => {
    expect(boss.element).toBe("wind");
    expect(boss.role).toBe("warrior");
    expect(boss.squad).toBe("annihilation");
    expect(boss.enemyOnly).toBe(true);
    expect(boss.unlockRecord.status).toBe("recorded");
  });

  it("레이드 보스 풀에 서고 전신·SD 원화가 모두 연결된다", () => {
    expect(RAID_BOSS_POOL).toContain("quetzalcoatlus");
    expect(portraitAssetFor(boss.portraitAssetId).url).toContain("raid_003.zip");
    expect(ENEMY_SD_ASSETS_BY_ID[boss.id].url).toContain("raidSD_003.zip");
  });

  it("회복은 주지 않고 궁극기 때만 조금 보호막을 두른다", () => {
    expect(boss.ultimate.selfShieldMaxHpPercent).toBeGreaterThan(0);
    expect(boss.ultimate.selfShieldMaxHpPercent).toBeLessThanOrEqual(5);
    expect(JSON.stringify(boss)).not.toMatch(/Healing|heal/);
  });

  it("패시브 문장은 급강하와 치명타를 함께 말한다", () => {
    const text = passiveDescription(boss.passive);
    expect(text).toContain("돌진");
    expect(text).toContain("치명타 확률이 25% 오른다");
  });

  it("세 보스의 속성이 겹치지 않는다", () => {
    const elements = RAID_BOSS_POOL.map((id) => getRelic(id).element);
    expect(new Set(elements).size).toBe(RAID_BOSS_POOL.length);
  });

  it("전투가 열리면 표적에게 급강하해 기절시킨다", () => {
    const state = createSkirmish([getRelic("torika"), getRelic("amo")], [boss], ARENA);
    const events: SkirmishEvent[] = [];
    for (let frame = 0; frame < 60 * 12 && !events.some((event) => event.kind === "charge"); frame += 1) events.push(...stepSkirmish(state, 1 / 60));
    const charge = events.find((event): event is Extract<SkirmishEvent, { kind: "charge" }> => event.kind === "charge");
    expect(charge).toBeDefined();
    expect(state.fighters.some((fighter) => fighter.side === "player" && fighter.stunnedFor > 0)).toBe(true);
  });

  it("궁극기는 한 줄로 뚫고 지나가며 길 위의 아군을 모두 친다", () => {
    const state = createSkirmish([getRelic("torika"), getRelic("amo")], [boss], ARENA);
    const [first, second, bossFighter] = state.fighters;
    bossFighter.openingChargeReady = false;
    bossFighter.x = 200; bossFighter.y = 1000;
    first.x = 350; first.y = 1000;
    second.x = 500; second.y = 1000;
    bossFighter.targetId = first.id;
    bossFighter.energy = bossFighter.def.ultimate.cost;
    const events = fireUltimate(state, bossFighter.id);
    const hits = events.filter((event) => event.kind === "attack").map((event) => event.kind === "attack" && event.targetId);
    expect(hits).toEqual(expect.arrayContaining([first.id, second.id]));
    expect(first.stunnedFor).toBeGreaterThan(0);
    expect(second.stunnedFor).toBeGreaterThan(0);
    expect(bossFighter.shield.amount).toBeGreaterThan(0);
  });

  it("타보아의 스킬 이름은 똬리를 되풀이하지 않는다", () => {
    const taboa = RELICS.find((relic) => relic.id === "taboa")!;
    const names = [taboa.passive.name, taboa.basic.name, taboa.ultimate.name, taboa.ferocityTrait.name];
    expect(names.filter((name) => name.includes("똬리"))).toEqual([]);
  });

  it("레이드 보스 자리에 세우면 강인함을 가진 보스로 서고, 30초 전투가 끝까지 돈다", () => {
    const def = raidBossDef(boss);
    expect(def.encounterRole).toBe("boss");
    const state = createSkirmish([getRelic("torika"), getRelic("amo"), getRelic("rex")], [def], ARENA);
    for (let frame = 0; frame < 60 * 30 && state.phase === "fight"; frame += 1) stepSkirmish(state, 1 / 60);
    expect(state.fighters.every((fighter) => Number.isFinite(fighter.hp))).toBe(true);
  });
});
