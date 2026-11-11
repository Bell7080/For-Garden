import { describe, expect, it } from "vitest";
import { ELEMENT_COUNTERS } from "../../src/core/element";
import { RAID_GUIDES } from "../../src/data/raidGuides";
import { PLAYABLE_RELICS, getRelic } from "../../src/data/relics";
import { t, type TextKey } from "../../src/i18n";

const playable = new Set(PLAYABLE_RELICS.map((relic) => relic.id));

describe("레이드 공략법 내용", () => {
  for (const guide of Object.values(RAID_GUIDES)) {
    const boss = getRelic(guide.bossId);
    it(`${guide.bossId}: 추천·차선책은 데려갈 수 있는 렐릭이고 서로 겹치지 않는다`, () => {
      const ids = [guide.recommendedRelicId, ...guide.alternativeRelicIds];
      for (const id of ids) expect(playable.has(id), id).toBe(true);
      expect(new Set(ids).size).toBe(ids.length);
      expect(ids).not.toContain(guide.bossId);
      // 차선책은 접어 두는 칸이라 둘을 넘기지 않는다 — 넘치면 펼쳤을 때 창이 판보다 길어진다.
      expect(guide.alternativeRelicIds.length).toBeGreaterThanOrEqual(1);
      expect(guide.alternativeRelicIds.length).toBeLessThanOrEqual(2);
    });

    it(`${guide.bossId}: 차선책은 모두 보스 속성을 이긴다 — 상성 줄과 추천이 서로 다른 말을 하지 않는다`, () => {
      for (const id of guide.alternativeRelicIds) {
        const relic = getRelic(id);
        expect(ELEMENT_COUNTERS[relic.element], id).toContain(boss.element);
      }
    });

    it(`${guide.bossId}: 이유는 갈래별 한 줄이고 모든 줄·차선책에 문구가 있다`, () => {
      expect(guide.reasonPoints.length).toBeGreaterThanOrEqual(2);
      expect(new Set(guide.reasonPoints).size).toBe(guide.reasonPoints.length);
      for (const kind of guide.reasonPoints) {
        const key = `raid.guide.${guide.bossId}.reason.${kind}` as TextKey;
        expect(t(key)).not.toBe(key);
        expect(t(`raid.guide.point.${kind}` as TextKey)).not.toContain("raid.guide");
      }
      for (const id of guide.alternativeRelicIds) {
        const key = `raid.guide.${guide.bossId}.alt.${id}` as TextKey;
        expect(t(key)).not.toBe(key);
      }
    });
  }
});
