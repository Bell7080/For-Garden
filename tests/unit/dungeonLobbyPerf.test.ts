import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { CAKE_OPERATION_TIERS, cakeOperationEnemies } from "../../src/data/cakeOperation";
import { dungeonLineupSpawnOrder, dungeonLineupSpot } from "../../src/ui/dungeonLobbyLayout";

/**
 * 대작전 미리보기는 열다섯이 한꺼번에 선다. SD 한 몸이 정점 1만 6천 개라 열다섯이 저마다 스키닝하면
 * 그것만으로 한 프레임(16.7ms)을 넘겼다(실측 프레임당 약 33ms). 같은 개체는 한 몸만 자세를 계산하고
 * 나머지는 빌린다 — 그 계약은 눈으로만 보이고 값으로 남지 않아 소스의 모양으로 함께 지킨다.
 */
const lobby = readFileSync("src/ui/DungeonLobby.ts", "utf8");
const creature = readFileSync("src/puppets/IndexedPuppetCreature.ts", "utf8");

describe("던전 미리보기 SD", () => {
  it("는 앞줄(대표 얼굴)부터 세운다", () => {
    for (const count of [3, 10, 15]) {
      const order = dungeonLineupSpawnOrder(count);
      expect([...order].sort((a, b) => a - b)).toEqual(Array.from({ length: count }, (_, i) => i));
      const grounds = order.map((index) => dungeonLineupSpot(index, count).ground);
      for (let i = 1; i < grounds.length; i += 1) expect(grounds[i]).toBeLessThanOrEqual(grounds[i - 1]);
    }
  });

  it("는 대작전 어느 단계든 자세를 계산하는 몸이 다섯 자매 다섯뿐이다", () => {
    for (const tier of CAKE_OPERATION_TIERS) {
      const enemies = cakeOperationEnemies(tier);
      const leaders = new Set<string>();
      for (const index of dungeonLineupSpawnOrder(enemies.length)) leaders.add(enemies[index].id);
      expect(leaders.size).toBe(5);
      // 처음 선 몸(이끄는 몸)이 이름줄을 단 앞줄이어야 대표 얼굴이 가장 또렷하게 움직인다.
      const firstOf = new Map<string, number>();
      for (const index of dungeonLineupSpawnOrder(enemies.length)) if (!firstOf.has(enemies[index].id)) firstOf.set(enemies[index].id, index);
      for (const index of firstOf.values()) expect(dungeonLineupSpot(index, enemies.length).labeled).toBe(true);
    }
  });

  it("는 프레임 예산으로 나눠 멈춘 채 세우고, 함께 풀며, 같은 개체끼리 자세를 빌린다", () => {
    const body = lobby.slice(lobby.indexOf("private spawnLineupFigures"));
    expect(body).toContain("new PuppetCreationQueue(");
    expect(body).toContain("creationQueue: queue, startPaused: true");
    expect(body).toContain("Promise.allSettled(arrivals)");
    expect(body).toContain("puppet.followPose(leader)");
    expect(body).toContain("setAnimationFrozen(false)");
  });

  it("는 걷히는 옛 줄을 그 자리에서 멈춘다", () => {
    const body = lobby.slice(lobby.indexOf("private paintLineup"));
    expect(body.slice(0, body.indexOf("onComplete: () => previous.destroy()"))).toContain("freezeLineup(previous)");
  });

  it("빌린 자세는 제 재생기를 굴리지 않고, 이끄는 몸이 새 자세를 낼 때만 넘겨받는다", () => {
    const step = creature.slice(creature.indexOf("private step("), creature.indexOf("private ensureBuffers"));
    const follow = step.slice(step.indexOf("const leader = this.poseLeader"), step.indexOf("advancePuppet("));
    expect(follow).toContain("leader.poseVersion !== this.mirroredLeaderVersion");
    expect(follow).toMatch(/return;\s*\}\s*this\.poseLeader = undefined;/);
  });
});
