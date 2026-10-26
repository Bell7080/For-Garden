import { describe, expect, it } from "vitest";
import { ancientChallengeFloor, ancientHighestCleared, ancientLastBrowsableBlock, groupAncientPeers } from "../../src/core/ancientStrata";
import { ANCIENT_PEERS, ancientPeerDirection, ancientPeerFaceX } from "../../src/ui/ancientStrataLayout";

describe("고대 지층 지도 — 진행·넘기기·친구 위치", () => {
  it("가장 깊이 깬 층을 진행 기록에서 읽고 다른 관문은 세지 않는다", () => {
    expect(ancientHighestCleared(["1-10", "ancient:1", "ancient:12", "ancient:3", "ancient-x:99"], 200)).toBe(12);
    expect(ancientHighestCleared([], 200)).toBe(0);
    expect(ancientHighestCleared(["ancient:999"], 200)).toBe(200);
  });

  it("도전 층은 깬 층의 다음이고 마지막 층에서 멈춘다", () => {
    expect(ancientChallengeFloor(0, 200)).toBe(1);
    expect(ancientChallengeFloor(57, 200)).toBe(58);
    expect(ancientChallengeFloor(200, 200)).toBe(200);
  });

  it("지금 구간과 그다음 한 구간까지만 넘긴다", () => {
    expect(ancientLastBrowsableBlock(1, 200)).toBe(1);
    expect(ancientLastBrowsableBlock(10, 200)).toBe(1);
    expect(ancientLastBrowsableBlock(11, 200)).toBe(2);
    expect(ancientLastBrowsableBlock(195, 200)).toBe(19);
  });

  it("친구는 도전 중인 층에 묶이고 들어오지 않은 사람은 서지 않는다", () => {
    const groups = groupAncientPeers([{ id: "a", highestCleared: 9 }, { id: "b", highestCleared: 0 }, { id: "c", highestCleared: 9 }, { id: "d", highestCleared: 30 }], 200);
    expect([...groups.keys()]).toEqual([10, 31]);
    expect(groups.get(10)!.map((peer) => peer.id)).toEqual(["a", "c"]);
  });

  it("얼굴 묶음은 화면 가운데 쪽으로 뻗어 가장자리에 잘리지 않는다", () => {
    for (let index = 0; index < 10; index++) {
      const direction = ancientPeerDirection(index);
      for (let slot = 0; slot < ANCIENT_PEERS.visible; slot++) {
        const x = 540 + [-250, 190, -130, 270, -220, 110, -270, 220, -150, 0][index] + ancientPeerFaceX(index, 148, slot);
        expect(x - ANCIENT_PEERS.face / 2).toBeGreaterThan(0);
        expect(x + ANCIENT_PEERS.face / 2).toBeLessThan(1080);
      }
      expect(Math.sign(ancientPeerFaceX(index, 104, 0))).toBe(direction);
    }
  });
});
