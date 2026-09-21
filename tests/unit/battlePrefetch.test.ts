import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { BOUNTY_TIERS } from "../../src/data/bounty";
import { CAKE_OPERATION_ENEMY_ID } from "../../src/data/cakeOperation";
import { RAID_SEASON_BOSS } from "../../src/data/raid";
import { getRelic } from "../../src/data/relics";

/**
 * 전투 진입 대기는 **눈으로만 보이고 값으로는 남지 않는다** — SD가 하나씩 쏙, 쏙 서던 것이
 * 루프 안의 `await` 한 줄이었고, 되돌려 놓아도 타입도 테스트도 아무 말을 하지 않았다.
 * 그래서 그 한 줄의 모양을 소스에서 직접 읽어 고정한다.
 */
const battleScene = readFileSync("src/scenes/BattleScene.ts", "utf8");

describe("전투 SD 생성", () => {
  it("은 여섯을 한꺼번에 읽는다", () => {
    // 일꾼이 넷인데(`puppetParsePool`) 하나씩 기다리면 한 명만 일하고 셋이 논다.
    const body = battleScene.slice(battleScene.indexOf("private async spawnFighters"));
    const spawn = body.slice(0, body.indexOf("this.syncViews()"));
    expect(spawn).toContain("await Promise.all(spawns)");
    expect(spawn).not.toMatch(/for \([^)]*\) \{[\s\S]*?await spawnPuppet/);
  });

  it("은 한 마리가 실패해도 나머지를 세운다", () => {
    // `Promise.all`은 하나가 거절되면 전부를 버린다 — 약속마다 삼켜야 그 한 마리만 빠진다.
    const body = battleScene.slice(battleScene.indexOf("private async spawnFighters"));
    expect(body.slice(0, body.indexOf("await Promise.all"))).toContain(".catch(");
  });

  it("은 기다리는 동안 씬을 떠나면 도착한 전부를 놓는다", () => {
    const body = battleScene.slice(battleScene.indexOf("await Promise.all(spawns)"));
    const guard = body.slice(0, body.indexOf("for (const entry of ready)"));
    expect(guard).toContain("!this.scene.isActive()");
    expect(guard).toContain("creature.destroy()");
  });
});

describe("전투 SD 미리 읽기", () => {
  const sceneOf = (name: string) => readFileSync(`src/scenes/${name}.ts`, "utf8");

  it("는 전투를 여는 네 화면이 모두 지난다", () => {
    // 누가 나갈지는 고르는 순간 이미 정해진다 — 그 시간을 버리면 진입 직후의 빈 전장이 된다.
    for (const scene of ["PartyScene", "CakeOperationScene", "BountyScene", "RaidScene"]) {
      expect(sceneOf(scene), scene).toContain("prefetchBattlePuppets");
    }
  });

  it("는 화면을 붙잡지 않는다", () => {
    // 미리 읽기가 화면을 막으면 고치려던 멈춤이 자리만 옮긴 셈이 된다.
    const helper = readFileSync("src/puppets/battlePrefetch.ts", "utf8");
    expect(helper).toContain("void preloadPuppetAssets");
    expect(helper).not.toMatch(/export async function prefetchBattlePuppets/);
  });

  it("가 가리키는 적은 실제로 있는 개체다", () => {
    expect(getRelic(CAKE_OPERATION_ENEMY_ID)).toBeTruthy();
    expect(getRelic(RAID_SEASON_BOSS.relicId)).toBeTruthy();
    for (const tier of BOUNTY_TIERS) for (const round of tier.rounds) expect(getRelic(round.relicId), round.relicId).toBeTruthy();
  });
});
