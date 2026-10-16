import { describe, expect, it } from "vitest";
import { KO } from "../../src/i18n/ko";
import { RECOLLECTION_ENTRIES, RECOLLECTION_GROUPS, recollectionEcho, recollectionEntriesOf, RECOLLECTION_ECHO_MAX_LENGTH } from "../../src/data/recollectionCatalog";
import { getRecollectionStory } from "../../src/data/dialogues/recollections";
import { recollectionArtCrop, recollectionArtFocus, recollectionListHeight, recollectionRowAt, recollectionRowY, recollectionViewportHeight, RECOLLECTION_LAYOUT } from "../../src/ui/recollectionLayout";

describe("회고 창", () => {
  it("의 흐르는 창은 팝업 몸판 안에 들고 탭 줄과 겹치지 않는다", () => {
    const { popup, viewport, tab, layer } = RECOLLECTION_LAYOUT;
    expect(viewport.top).toBeGreaterThan(-popup.height / 2);
    expect(viewport.bottom).toBeLessThan(tab.y - tab.height / 2);
    expect(layer.width).toBeLessThan(popup.width);
  });

  it("은 줄이 창보다 많으면 흐르고, 판 밖으로 쌓지 않는다", () => {
    // 1장이 가장 길다 — 예전에는 이 줄들이 판 밑변 아래로 삐져나갔다.
    const longest = Math.max(...RECOLLECTION_GROUPS.map((group) => recollectionEntriesOf(group).length));
    expect(recollectionListHeight(longest)).toBeGreaterThan(recollectionViewportHeight());
  });

  it("의 줄 판정은 줄 위에서만 줄을 돌려준다", () => {
    expect(recollectionRowAt(recollectionRowY(2), 5)).toBe(2);
    expect(recollectionRowAt(recollectionRowY(0) + RECOLLECTION_LAYOUT.layer.height / 2 + 6, 5)).toBeUndefined();
    expect(recollectionRowAt(recollectionRowY(7), 5)).toBeUndefined();
  });

  it("은 원화를 늘이지 않고, 잘라 낸 띠를 판 가운데에 둔다", () => {
    const crop = recollectionArtCrop(1882, 3344, 930, 196, 0.3);
    expect(crop.cropWidth * crop.scale).toBeCloseTo(930, 3);
    expect(crop.cropHeight * crop.scale).toBeCloseTo(196, 3);
    // 띠의 중심이 그림 중심에서 벗어난 만큼 그림을 반대로 옮긴다.
    const centerY = (crop.cropY + crop.cropHeight / 2 - 3344 / 2) * crop.scale;
    expect(crop.offsetY + centerY).toBeCloseTo(0, 6);
  });

  it("은 이야기마다 같은 무대의 다른 띠를 보인다", () => {
    const foci = new Set(RECOLLECTION_ENTRIES.map(({ storyId }) => recollectionArtFocus(storyId).toFixed(2)));
    expect(foci.size).toBeGreaterThan(RECOLLECTION_ENTRIES.length * 0.6);
    for (const { storyId } of RECOLLECTION_ENTRIES) {
      const focus = recollectionArtFocus(storyId);
      expect(focus).toBeGreaterThanOrEqual(0.16);
      expect(focus).toBeLessThanOrEqual(0.84);
    }
  });

  it("의 모든 이야기는 한 줄 줄거리를 갖는다", () => {
    for (const { storyId } of RECOLLECTION_ENTRIES) {
      expect(KO[`recollection.summary.${storyId}` as keyof typeof KO], storyId).toBeTruthy();
    }
  });

  it("의 뒷배경 대사는 한 줄에 드는 그 이야기의 대사다", () => {
    for (const { storyId } of RECOLLECTION_ENTRIES) {
      const story = getRecollectionStory(storyId);
      const echo = recollectionEcho(story);
      if (!echo) continue;
      expect(echo.length).toBeLessThanOrEqual(RECOLLECTION_ECHO_MAX_LENGTH);
      expect(story.nodes.some((node) => node.body.trim() === echo && node.speaker)).toBe(true);
    }
  });
});
