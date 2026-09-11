import { describe, expect, it } from "vitest";

/**
 * 얼굴 액자가 **깎인 두 모서리에서 그림을 끊는지** 소스에서 확인한다.
 *
 * 그림이 실제로 어디까지 그려지는지는 캔버스를 띄워야 알 수 있지만, 이 버그의 원인은 렌더가
 * 아니라 **방법 선택**이었다 — `setCrop`은 텍스처를 네모로 자르므로 비스듬히 깎인 모서리를
 * 덮지 못한다. 그래서 "덮는 그림이 있는가"와 "마스크로 되돌아가지 않았는가"를 계약으로 잡는다.
 * 픽셀이 아니라 버그의 정의를 그대로 재는 방식이라(WebGL 복구 회귀와 같은 결) 원화가 바뀌어도
 * 흔들리지 않는다.
 */
const SOURCE = import.meta.glob("../../src/ui/{FaceFrame,itemFrame}.ts", { query: "?raw", import: "default", eager: true }) as Record<string, string>;
const FACE_FRAME_SOURCE = Object.entries(SOURCE).find(([path]) => path.endsWith("FaceFrame.ts"))![1];
/** `itemFrame.ts`는 Phaser를 들여오므로 node 환경에서는 소스 문자열로만 읽는다. */
const ITEM_FRAME_SOURCE = Object.entries(SOURCE).find(([path]) => path.endsWith("itemFrame.ts"))![1];

describe("얼굴 액자의 모서리 끊기", () => {
  it("는 깎인 모서리를 덮는 그림을 그린다", () => {
    expect(FACE_FRAME_SOURCE).toContain("paintBevelCut");
    // 두 모서리 모두 덮는다 — 한쪽만 덮으면 나머지 한쪽에서 그림이 계속 삐져나온다.
    const fills = FACE_FRAME_SOURCE.match(/fillPoints/g) ?? [];
    expect(fills.length).toBeGreaterThanOrEqual(2);
  });

  it("는 기하 마스크로 자르지 않는다", () => {
    // 기하 마스크는 컨테이너 이동을 물려받지 않아 스크롤하는 목록(가방·기여도 줄)에서 어긋난다.
    expect(FACE_FRAME_SOURCE).not.toContain("setMask");
    expect(FACE_FRAME_SOURCE).not.toContain("createGeometryMask");
  });

  it("는 덮는 삼각형이 액자 바탕과 같은 색을 쓴다", () => {
    // 다른 색으로 덮으면 그 모서리만 색이 달라 액자가 두 조각으로 보인다.
    expect(FACE_FRAME_SOURCE).toContain("paintBevelCut(scene, size, ITEM_FRAME.fill)");
  });

  it("는 덮기가 그림보다 뒤에, 외곽선보다 앞에 온다", () => {
    // 순서가 뒤집히면 덮기가 그림에 가려지거나 외곽선을 지운다.
    const cut = FACE_FRAME_SOURCE.indexOf("this.add(paintBevelCut");
    const face = FACE_FRAME_SOURCE.indexOf("void this.loadFace");
    const outline = FACE_FRAME_SOURCE.indexOf("this.add(drawShapeOutline");
    expect(face).toBeLessThan(cut);
    expect(cut).toBeLessThan(outline);
  });

  it("는 액자가 왼쪽 위·오른쪽 아래만 깎는다", () => {
    // 덮는 삼각형의 자리가 이 두 모서리에 맞춰져 있으므로, 깎는 모서리가 바뀌면 함께 고쳐야 한다.
    expect(FACE_FRAME_SOURCE).toContain("topLeft: size * ITEM_FRAME.bevel, topRight: 0, bottomRight: size * ITEM_FRAME.bevel, bottomLeft: 0");
    const bevel = Number(ITEM_FRAME_SOURCE.match(/bevel:\s*([0-9.]+)/)![1]);
    expect(bevel).toBeGreaterThan(0);
    expect(bevel).toBeLessThan(0.5);
  });
});

describe("파편의 스테인드글라스", () => {
  it("는 판을 납선으로 가른다", () => {
    expect(FACE_FRAME_SOURCE).toContain("paintStainedGlass");
    // 색유리만 깔면 색판 한 겹이라 유리로 읽히지 않는다 — 가르는 검은 선이 있어야 조각이 된다.
    expect(FACE_FRAME_SOURCE).toContain("lead");
    expect(FACE_FRAME_SOURCE).toContain("medallion");
  });

  it("는 반짝임을 tween으로 만들지 않는다", () => {
    // 파편 액자는 목록에 여럿 설 수 있다. 움직이는 빛은 얼굴보다 먼저 읽히고 매 프레임 비용이 된다.
    expect(FACE_FRAME_SOURCE).not.toContain("tweens.add");
  });

  it("는 판마다 다른 밝기를 주어 멈춘 채로 반짝인다", () => {
    const alphas = FACE_FRAME_SOURCE.match(/paneAlpha: \[([^\]]+)\]/);
    expect(alphas).not.toBeNull();
    const values = alphas![1].split(",").map((value) => Number(value.trim()));
    expect(new Set(values).size).toBeGreaterThan(1);
    // 겹쳐 밝아지는 합성이라 한 판이라도 진하면 그 조각만 하얗게 떠 얼굴을 덮는다.
    for (const value of values) expect(value).toBeLessThanOrEqual(0.2);
  });
});
