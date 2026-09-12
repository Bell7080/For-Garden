import { describe, expect, it } from "vitest";

/**
 * 얼굴 액자가 **깎인 두 모서리 밖으로 아무것도 내밀지 않는지** 소스에서 확인한다.
 *
 * 그림이 실제로 어디까지 그려지는지는 캔버스를 띄워야 알 수 있지만, 이 버그의 원인은 렌더가
 * 아니라 **방법 선택**이었다 — `setCrop`은 텍스처를 네모로 자르므로 비스듬히 깎인 모서리를
 * 덮지 못한다. 예전에는 잘려 나간 삼각형을 판 색으로 덮어 가렸는데, 그 삼각형은 액자
 * **바깥**이라 외곽선 너머로 검게 삐져나온 뿔이 되었다(원정 순위 줄·기여도 줄).
 * 지금은 덮는 대신 **그림을 안쪽 정사각에 들인다** — 그래서 "그 안쪽 비율을 쓰는가"와
 * "덮기·마스크로 되돌아가지 않았는가"를 계약으로 잡는다.
 */
const SOURCE = import.meta.glob("../../src/ui/{FaceFrame,itemFrame}.ts", { query: "?raw", import: "default", eager: true }) as Record<string, string>;
const FACE_FRAME_SOURCE = Object.entries(SOURCE).find(([path]) => path.endsWith("FaceFrame.ts"))![1];
/** `itemFrame.ts`는 Phaser를 들여오므로 node 환경에서는 소스 문자열로만 읽는다. */
const ITEM_FRAME_SOURCE = Object.entries(SOURCE).find(([path]) => path.endsWith("itemFrame.ts"))![1];

describe("얼굴 액자의 모서리 끊기", () => {
  it("는 그림을 액자 안쪽 정사각에 들인다", () => {
    // 78%(`ITEM_FRAME.icon`)면 네 꼭짓점이 모두 깎인 대각선 안쪽에 들어온다 — 재화 액자가
    // 이미 쓰는 비율이라 두 액자가 같은 규격으로 읽힌다.
    expect(FACE_FRAME_SOURCE).toContain("const inner = size * ITEM_FRAME.icon");
    expect(FACE_FRAME_SOURCE).toContain("size: inner,");
  });

  it("는 잘린 모서리를 판 색으로 덮지 않는다", () => {
    // 덮은 삼각형은 액자 **밖**이라 외곽선 너머로 검게 삐져나온 뿔처럼 보였다.
    expect(FACE_FRAME_SOURCE).not.toContain("paintBevelCut");
  });

  it("는 기하 마스크로 자르지 않는다", () => {
    // 기하 마스크는 컨테이너 이동을 물려받지 않아 스크롤하는 목록(가방·기여도 줄)에서 어긋난다.
    expect(FACE_FRAME_SOURCE).not.toContain("setMask");
    expect(FACE_FRAME_SOURCE).not.toContain("createGeometryMask");
  });

  it("는 파편의 결도 같은 안쪽 정사각 안에서만 그린다", () => {
    // 액자 한 변까지 채우면 깎인 두 모서리로 빛이 새어 액자 밖에 색 조각이 남는다.
    expect(FACE_FRAME_SOURCE).not.toMatch(/fillRect\(-half, -half \+ size \*/);
  });

  it("는 액자가 왼쪽 위·오른쪽 아래만 깎는다", () => {
    // 그림을 들이는 비율이 이 두 모서리의 깎임에서 나오므로, 깎는 자리가 바뀌면 함께 고쳐야 한다.
    expect(FACE_FRAME_SOURCE).toContain("topLeft: size * ITEM_FRAME.bevel, topRight: 0, bottomRight: size * ITEM_FRAME.bevel, bottomLeft: 0");
    const bevel = Number(ITEM_FRAME_SOURCE.match(/bevel:\s*([0-9.]+)/)![1]);
    expect(bevel).toBeGreaterThan(0);
    expect(bevel).toBeLessThan(0.5);
  });
});

describe("파편의 유리 결", () => {
  it("는 판을 조각으로 가르지 않는다", () => {
    expect(FACE_FRAME_SOURCE).toContain("paintGlassSheen");
    // 부채꼴 여덟 장과 그 사이의 검은 납선은 작은 액자 안에서 얼굴보다 먼저 읽혔다 —
    // 조각난 무늬가 그림을 덮은 셈이라, 가르지 않고 물낯처럼 일렁이는 띠와 광택만 남긴다.
    expect(FACE_FRAME_SOURCE).not.toContain("paintStainedGlass");
    expect(FACE_FRAME_SOURCE).not.toContain("medallion");
    expect(FACE_FRAME_SOURCE).toContain("ripples");
    expect(FACE_FRAME_SOURCE).toContain("sheen");
  });

  it("는 반짝임을 tween으로 만들지 않는다", () => {
    // 파편 액자는 목록에 여럿 설 수 있다. 움직이는 빛은 얼굴보다 먼저 읽히고 매 프레임 비용이 된다.
    expect(FACE_FRAME_SOURCE).not.toContain("tweens.add");
  });

  it("는 띠마다 다른 밝기를 주어 멈춘 채로 일렁인다", () => {
    const values = [...FACE_FRAME_SOURCE.matchAll(/alpha: ([0-9.]+) \}/g)].map((match) => Number(match[1]));
    expect(values.length).toBeGreaterThan(1);
    expect(new Set(values).size).toBeGreaterThan(1);
    // 겹쳐 밝아지는 합성이라 한 줄이라도 진하면 그 띠만 하얗게 떠 얼굴을 덮는다.
    for (const value of values) expect(value).toBeLessThanOrEqual(0.2);
  });
});
