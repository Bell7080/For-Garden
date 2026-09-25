import { describe, expect, it } from "vitest";
import { PROFILE_FRAMES } from "../../src/data/profileFrames";
import { PLAYER_PROFILE_LAYOUT } from "../../src/ui/playerProfileLayout";
import { POPUP_BODY_BEVEL_RATIO, POPUP_TITLE_SIZE, popupTitleBand } from "../../src/ui/popupGeometry";
import {
  profileFrameAnchors, profileFrameExtentPoints, profileFrameReach, profileFrameShapes, PROFILE_FRAME_REACH,
} from "../../src/ui/profileFrameGeometry";

const STYLES = PROFILE_FRAMES.map((frame) => frame.style);

describe("프로필 테두리 모양", () => {
  it("모든 장식이 약속한 거리 안에 든다", () => {
    for (const style of STYLES) {
      for (const size of [60, 132, 180, 200]) expect(profileFrameReach(size, style), `${style}@${size}`).toBeLessThanOrEqual(size * PROFILE_FRAME_REACH);
    }
  });

  it("변 가운데 장식은 깎이고 남은 구간의 가운데에 선다", () => {
    const size = 200;
    const a = profileFrameAnchors(size);
    const top = profileFrameShapes(size, "gem").diamonds[0];
    // 윗변은 x = -half + bevel 부터 half 까지다.
    expect(top.x).toBeCloseTo((-a.half + a.bevel + a.half) / 2);
    const crown = profileFrameShapes(size, "crown").crown!;
    const xs = crown.map((p) => p.x);
    expect((Math.min(...xs) + Math.max(...xs)) / 2).toBeCloseTo(a.top.x);
    expect(Math.min(...xs)).toBeGreaterThan(-a.half + a.bevel);
  });

  it("괄호는 깎인 모서리의 빗변 밖 허공에 뜨지 않는다", () => {
    const size = 200;
    const a = profileFrameAnchors(size);
    for (const stroke of profileFrameShapes(size, "bracket").strokes) {
      for (const p of stroke.points) {
        // 빗변(x + y = -half*2 + bevel)보다 바깥쪽 모서리 네모 안(깎여 나간 자리)에 들어가지 않는다.
        const inCutTopLeft = p.x < -a.half + a.bevel && p.y < -a.half + a.bevel && p.x + p.y < -2 * a.half + a.bevel - size * 0.2;
        const inCutBottomRight = p.x > a.half - a.bevel && p.y > a.half - a.bevel && p.x + p.y > 2 * a.half - a.bevel + size * 0.2;
        expect(inCutTopLeft || inCutBottomRight).toBe(false);
      }
    }
  });
});

describe("프로필 카드의 얼굴 자리", () => {
  const { popup, header } = PLAYER_PROFILE_LAYOUT;
  const { avatar } = header;
  const half = { w: popup.width / 2, h: popup.height / 2 };
  const bevel = Math.min(popup.width, popup.height) * POPUP_BODY_BEVEL_RATIO;
  const margin = 6;

  it("어떤 테두리도 팝업 몸판·제목표 띠·이름줄을 넘지 않는다", () => {
    const titleBottom = -half.h + popupTitleBand(POPUP_TITLE_SIZE.note);
    for (const style of STYLES) {
      for (const p of profileFrameExtentPoints(avatar.size, style)) {
        const x = avatar.x + p.x;
        const y = avatar.y + p.y;
        const label = `${style} (${x.toFixed(0)}, ${y.toFixed(0)})`;
        expect(x - p.pad, label).toBeGreaterThanOrEqual(-half.w + margin);
        expect(y - p.pad, label).toBeGreaterThanOrEqual(titleBottom + margin);
        // 몸판의 왼쪽 위 빗변: (-w, -h + bevel) → (-w + bevel, -h).
        expect(x + y - p.pad * Math.SQRT2, label).toBeGreaterThanOrEqual(-half.w - half.h + bevel + margin);
        expect(x + p.pad, label).toBeLessThanOrEqual(header.textLeft - margin);
      }
    }
  });
});
