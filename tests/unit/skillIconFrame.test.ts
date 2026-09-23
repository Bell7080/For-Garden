import { describe, expect, it } from "vitest";

/** Node API 대신 Vite의 glob을 쓴다 — 브라우저 타입만 켜진 typecheck에서도 그대로 통과한다. */
const SOURCES = import.meta.glob("../../src/ui/*.ts", { query: "?raw", import: "default", eager: true }) as Record<string, string>;

function source(path: string): string {
  const text = SOURCES[path];
  expect(text, `${path}를 읽지 못했다`).toBeTypeOf("string");
  return text;
}

describe("스킬 아이콘 액자", () => {
  it("액자의 비례는 전부 한 변에 대한 비율이다", () => {
    /*
     * **픽셀로 못 박으면 150이 아닌 자리에서 통째로 어긋난다.** 이름 획 둘레의 검은 띠가
     * 5px로 굳어 있던 때는 96짜리 폭주 뱃지에서 그 띠가 16px 글자의 획을 메워 「폭주」 두
     * 글자가 검은 덩어리로 뭉갰다. 돌파 표(108)와 뱃지(96)가 같은 표를 읽으므로 값이 다시
     * 픽셀로 돌아오면 여기서 걸린다.
     */
    const text = source("../../src/ui/SkillIconFrame.ts");
    const table = text.slice(text.indexOf("const SKILL_ICON_FRAME = {"));
    const body = table.slice(0, table.indexOf("} as const;"));
    const values = [...body.matchAll(/^\s{2}(\w+): ([\d.]+),$/gm)];
    expect(values.length).toBeGreaterThanOrEqual(8);
    for (const [, key, raw] of values) {
      const value = Number(raw);
      expect(value, `${key}는 한 변에 대한 비율이어야 한다`).toBeGreaterThan(0);
      expect(value, `${key}는 한 변에 대한 비율이어야 한다`).toBeLessThan(1);
    }
  });

  it("폭주·역할 뱃지는 제 나름의 판·비네트·테두리를 다시 그리지 않는다", () => {
    /*
     * 뱃지는 옆에 나란히 선 스킬 액자 셋과 **같은 한 장**이고 다른 것은 색과 크기뿐이다.
     * 제 나름으로 그리던 때는 안쪽 칸이 없고 층 순서가 갈려 혼자 다른 양식으로 읽혔다.
     * 폭주와 역할은 같은 뱃지 기둥에 쌓이므로 **한 함수**(`addInfoBadge`)가 둘을 함께 세운다.
     */
    const text = source("../../src/ui/info.ts");
    for (const name of ["export function addInfoFerocityBadge(", "export function addInfoRoleBadge("]) {
      const at = text.indexOf(name);
      expect(at, name).toBeGreaterThan(-1);
      expect(text.slice(at, text.indexOf("\n}\n", at)), name).toContain("addInfoBadge(scene, popups, parent, x, y, {");
    }
    const start = text.indexOf("function addInfoBadge(");
    expect(start).toBeGreaterThan(-1);
    const body = text.slice(start, text.indexOf("\n}\n", start));
    expect(body).toContain("addSkillIconFrame(scene, {");
    for (const forbidden of ["drawLayer(", "drawInnerVignette(", "drawShapeOutline(", "chipArtShape(", "bakeChipArt("]) {
      expect(body, `뱃지가 ${forbidden}으로 다시 그리고 있다`).not.toContain(forbidden);
    }
  });
});
