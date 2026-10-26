import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("SSR 전조 무대 수명", () => {
  it("연구소를 떠날 때 미리 세운 WebGL 무대를 내린다", () => {
    const lab = readFileSync("src/scenes/LabScene.ts", "utf8");
    const shutdown = lab.slice(lab.indexOf("Phaser.Scenes.Events.SHUTDOWN"));
    expect(shutdown.slice(0, 900)).toContain("releaseSsrOmen()");
  });
  it("내릴 때 컨텍스트·판·관찰자를 모두 치운다", () => {
    const src = readFileSync("src/ui/SsrOmenCinematic.ts", "utf8");
    const body = src.slice(src.indexOf("export function releaseSsrOmen"));
    for (const call of ["omen.dispose()", "root.remove()", "observer?.disconnect()"]) expect(body).toContain(call);
  });
});
