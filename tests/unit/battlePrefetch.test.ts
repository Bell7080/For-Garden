import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { BOUNTY_TIERS } from "../../src/data/bounty";
import { CAKE_OPERATION_ENEMY_IDS } from "../../src/data/cakeOperation";
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

  it("는 로비에서도 도는데, 그 자리는 한 장씩 읽는다", () => {
    const helper = readFileSync("src/puppets/battlePrefetch.ts", "utf8");
    const lobby = sceneOf("LobbyScene");
    // 로비는 한참 머무는 화면이라 그 시간을 쓰지 않으면 출격 뒤의 대기가 거기서 시작한다.
    expect(lobby).toContain("prefetchIdlePuppets(this, relicCollection.validParty)");
    // **들어오는 연출이 끝난 뒤에** 시작한다 — 화면이 움직이는 동안 일꾼을 깨우면 연출이 끊긴다.
    expect(lobby).toContain("TRANSITION.sceneIn.duration");

    const idle = helper.slice(helper.indexOf("export function prefetchIdlePuppets"));
    // 일꾼이 넷인데 한꺼번에 던지면 로비가 여는 정보창·도감 카드가 그 뒤에 선다.
    expect(idle).toMatch(/for \(const asset of assets\) \{[\s\S]*await preloadPuppetAssets\(\[asset\]\)/);
    // 로비를 떠나면 남은 것은 읽지 않는다. 다음 화면의 제 몫 앞에 끼어들면 같은 줄 서기다.
    expect(idle).toContain('scene.events.once("shutdown"');
    expect(idle).toMatch(/if \(left\) return;/);
  });

  it("는 보유 렐릭 전부로 넓히지 않는다", () => {
    // 일꾼이 돌려주는 `ImageBitmap`은 그 묶음이 **처음 세워질 때까지** 남는다. 미리 읽고 쓰지
    // 않으면 한 장에 6.5MB가 그대로 붙잡혀, 열아홉을 다 읽으면 120MB가 아무도 보지 않는
    // 그림이 된다. 거주 규칙은 GPU에 올라간 뒤를 맡으므로 이 앞단은 읽는 양으로 막는다.
    const helper = readFileSync("src/puppets/battlePrefetch.ts", "utf8");
    expect(helper).not.toMatch(/owned|catalog|allRelics/);
    const lobby = sceneOf("LobbyScene");
    expect(lobby).toContain("prefetchIdlePuppets(this, relicCollection.validParty)");
    expect(lobby).not.toMatch(/prefetchIdlePuppets\(this, [^)]*owned/);
  });

  it("가 가리키는 적은 실제로 있는 개체다", () => {
    expect(CAKE_OPERATION_ENEMY_IDS.length).toBeGreaterThan(0);
    for (const id of CAKE_OPERATION_ENEMY_IDS) expect(getRelic(id), id).toBeTruthy();
    expect(getRelic(RAID_SEASON_BOSS.relicId)).toBeTruthy();
    for (const tier of BOUNTY_TIERS) for (const round of tier.rounds) expect(getRelic(round.relicId), round.relicId).toBeTruthy();
  });
});
