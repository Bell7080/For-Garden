import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * **다시 그리는 것이 새로 여는 것처럼 보이지 않게 한다.**
 *
 * 탭 하나·단계 하나·캐릭터 한 명을 눌렀을 뿐인데 화면이 한 뼘 아래에서 다시 떠오르거나, 판이
 * 꺼졌다 다시 부풀거나, 얼굴·원화가 빠졌다 들어오면 **새로고침된 것처럼** 읽힌다. 눈으로만
 * 보이는 일이라 소스의 모양으로 지킨다.
 */
const read = (path: string) => readFileSync(path, "utf8");

describe("다시 그리기", () => {
  it("는 씬을 직접 재시작하지 않고 연출을 건너뛰는 한 길을 지난다", () => {
    // `scene.restart`를 직접 부르면 `playSceneEntrance`가 들어오는 연출을 또 돌린다.
    for (const file of readdirSync("src/scenes")) {
      expect(read(`src/scenes/${file}`), file).not.toMatch(/this\.scene\.restart\(/);
    }
    const transition = read("src/ui/screenTransition.ts");
    expect(transition).toContain("export function restartScene(");
    expect(transition).toContain("pendingRefreshKey === scene.scene.key");
  });

  it("는 같은 판을 닫았다 다시 열면 갈아 끼운다", () => {
    const popup = read("src/ui/PopupLayer.ts");
    expect(popup).toContain("const refreshed = this.takeRefreshedLayer(options.title);");
    expect(popup).toContain("if (options.instant || refreshed) { layer.setAlpha(1); body.setScale(1); }");
  });

  it("는 이미 구운 얼굴·띠를 기다리지 않고 세운다", () => {
    expect(read("src/ui/FaceFrame.ts")).toContain("BAKED_FACE_KEYS.get(cacheKey)");
    expect(read("src/ui/RaidLayer.ts")).toContain("BAKED_BAND_KEYS.get(cacheKey)");
  });

  it("는 도감 격자를 바뀐 것이 있을 때만, 새 카드를 먼저 세우고 다시 그린다", () => {
    const relics = read("src/scenes/RelicsScene.ts");
    expect(relics).toContain("if (this.gridSignature() !== this.shownSignature) this.refresh();");
    expect(relics.indexOf("this.buildGrid();\n    for (const card of previousCards) card.destroy();")).toBeGreaterThan(0);
  });

  it("는 정보창에서 같은 원화를 다시 세우지 않는다", () => {
    const info = read("src/ui/info.ts");
    expect(info).toContain("this.portraitUrl === this.portraitAssetOf(def).url");
    expect(info).toContain("this.figureUrl === this.figureAssetOf(def).url");
  });

  it("는 편성에서 자리를 바꾼 SD를 새로 세우지 않고 옮긴다", () => {
    expect(read("src/scenes/PartyScene.ts")).toContain("moved.creature.x += PREVIEW_COLUMNS[i] - PREVIEW_COLUMNS[moved.from];");
  });

  it("는 레이드 탭을 씬 재시작 없이 바꾼다", () => {
    const raid = read("src/scenes/RaidScene.ts");
    expect(raid).not.toContain('startScene(this, "raid", { tab } satisfies RaidSceneData)');
    expect(raid).toContain("if (lastRaidList) this.renderList(lastRaidList);");
  });
});
