import { describe, expect, it } from "vitest";
import { allowStatusCue, cueAngle, STATUS_CUE, stunOrbit, type StatusCueId } from "../../src/ui/statusCueEffects";
import { flatDiamondPoints, SIGNATURE_BOSS_IDS, signatureFor, waveCrestPoints } from "../../src/ui/signatureEffects";
import { getRelic } from "../../src/data/relics";

describe("상태 연출은 짧고 적다", () => {
  it("조각은 한 자리 수이고 3배속에서도 한 박자 안에 끝난다", () => {
    for (const [id, spec] of Object.entries(STATUS_CUE) as [StatusCueId, (typeof STATUS_CUE)[StatusCueId]][]) {
      expect(spec.pieces, id).toBeGreaterThan(0);
      expect(spec.pieces, id).toBeLessThan(10);
      expect(spec.ms, id).toBeLessThanOrEqual(900);
    }
  });

  it("같은 순간은 간격 안에서 다시 열지 않는다 — 광역 기절이 끓지 않는다", () => {
    expect(allowStatusCue("stun", 1000, undefined)).toBe(true);
    expect(allowStatusCue("stun", 1050, 1000)).toBe(false);
    expect(allowStatusCue("stun", 1000 + STATUS_CUE.stun.minGapMs, 1000)).toBe(true);
    // 강화는 편성 전원에게 한꺼번에 드므로 간격을 두지 않는다.
    expect(allowStatusCue("buff", 1000, 1000)).toBe(true);
  });

  it("위로 튀는 조각은 발밑으로 쏟아지지 않는다", () => {
    for (let index = 0; index < 5; index += 1) {
      expect(Math.sin(cueAngle(index, 5, true))).toBeLessThan(0);
    }
  });

  it("기절 별은 머리 둘레를 납작하게 한 바퀴 돌아 제자리로 온다", () => {
    const start = stunOrbit(0, 3, 0, 46);
    const end = stunOrbit(0, 3, 1, 46);
    expect(end.x).toBeCloseTo(start.x, 5);
    expect(end.y).toBeCloseTo(start.y, 5);
    const side = stunOrbit(0, 3, 0.25, 46);
    expect(Math.abs(side.y)).toBeLessThan(46 * 0.4);
  });
});

describe("보스·불사는 평타와 궁극기 둘 다 제 연출을 갖는다", () => {
  it("네 보스 모두 두 순간이 표에 있고 서로 겹치지 않는다", () => {
    const ids = new Set<string>();
    for (const relicId of SIGNATURE_BOSS_IDS) {
      expect(getRelic(relicId).enemyOnly, relicId).toBe(true);
      const basic = signatureFor(relicId, "basic");
      const ultimate = signatureFor(relicId, "ultimate");
      expect(basic, relicId).toBeDefined();
      expect(ultimate, relicId).toBeDefined();
      ids.add(basic!);
      ids.add(ultimate!);
    }
    expect(ids.size).toBe(SIGNATURE_BOSS_IDS.length * 2);
  });

  it("평타 순간은 보스 밖의 개체에게 열리지 않는다 — 난전이 연출로 덮이지 않는다", () => {
    for (const relicId of ["rex", "spino", "pachi", "ella", "torika", "koma"]) {
      expect(signatureFor(relicId, "basic"), relicId).toBeUndefined();
    }
  });

  it("물마루는 앞 끝이 안으로 말린다 — 언덕이 아니라 덮치는 물이다", () => {
    const crest = waveCrestPoints(360, 150, 70);
    const top = Math.min(...crest.map((point) => point.y));
    expect(top).toBeCloseTo(-150, 5);
    // 가장 높은 곳이 앞(오른쪽)으로 쏠린다.
    const peak = crest.find((point) => point.y === top)!;
    expect(peak.x).toBeGreaterThan(0);
    // 앞 끝 안쪽으로 다시 파고드는 점이 있다.
    const right = Math.max(...crest.map((point) => point.x));
    expect(crest.some((point) => point.x < right - 60 && point.y < -30 && point.x > 0)).toBe(true);
  });

  it("바닥 고리는 납작하게 눕는다", () => {
    const ring = flatDiamondPoints(200, 0.38);
    expect(ring).toHaveLength(4);
    expect(Math.abs(ring[0].y)).toBeLessThan(ring[1].x * 0.5);
  });
});
