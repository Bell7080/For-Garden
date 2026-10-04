import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { pointInClip } from "../../src/ui/clipRect";

/**
 * 스크롤 창의 기하 마스크는 그리기만 자르고 입력은 자르지 않는다. 창 밖으로 밀린 카드의 입력면이 남으면 그 아래
 * 하단 탭·버튼이 눌리지 않는다(프리미엄 패키지 탭에서 로비를 눌러도 뒤의 패키지만 눌리던 버그).
 * 그래서 `setMask`로 자르는 파일이 `setInteractive`를 직접 부르는 것을 막고 `addClippedHit`만 허용한다.
 *
 * 아래 목록은 이 규칙 이전에 있던 파일들이다 — **늘리지 않고 줄이기만 한다.** 파일을 `addClippedHit`로 옮기면 목록에서도
 * 빼야 테스트가 통과한다(아직 위반인 파일만 남아야 한다).
 */
const LEGACY = [
  "src/scenes/ExpeditionScene.ts",
  "src/scenes/InteractionScene.ts",
  "src/scenes/LobbyScene.ts",
  "src/scenes/PartyScene.ts",
  "src/scenes/RaidScene.ts",
  "src/scenes/SettingsScene.ts",
  "src/scenes/StageMapScene.ts",
  "src/scenes/TitleScene.ts",
  "src/ui/AppearanceStrip.ts",
  "src/ui/ArchaeologyMapView.ts",
  "src/ui/EnemyInfoPopup.ts",
  "src/ui/ExpeditionEntryButton.ts",
  "src/ui/ExpeditionMapView.ts",
  "src/ui/ExpeditionRankingPopup.ts",
  "src/ui/IdleExcavationPopup.ts",
  "src/ui/InteractionCityPopup.ts",
  "src/ui/InventoryPopup.ts",
  "src/ui/MailPopup.ts",
  "src/ui/MissionsPopup.ts",
  "src/ui/ObservationJournal.ts",
  "src/ui/PassPopup.ts",
  "src/ui/PortraitCard.ts",
  "src/ui/RaidLayer.ts",
  "src/ui/StoryTitleCard.ts",
];

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sources(path);
    return path.endsWith(".ts") ? [path] : [];
  });
}

const all = sources("src").map((path) => path.replace(/\\/g, "/"));
const violating = all.filter((path) => {
  if (path.endsWith("ui/clippedHit.ts")) return false;
  const text = readFileSync(path, "utf8");
  return text.includes("setMask(") && text.includes("setInteractive(");
});

describe("스크롤 창 입력 제약", () => {
  it("마스크로 자르는 파일은 입력면을 직접 달지 않는다 — 새 위반은 허용 목록에 없다", () => {
    expect(violating.filter((path) => !LEGACY.includes(path))).toEqual([]);
  });

  it("허용 목록은 아직 위반인 파일만 든다 — 고쳤으면 목록에서 뺀다", () => {
    expect(LEGACY.filter((path) => !violating.includes(path))).toEqual([]);
  });

  it("프리미엄·상점 목록의 카드 입력면은 창 안에서만 받는다", () => {
    for (const path of ["src/scenes/PremiumScene.ts", "src/scenes/ShopScene.ts"]) {
      const text = readFileSync(path, "utf8");
      expect(text, path).toContain("addClippedHit(");
      expect(text, path).not.toMatch(/add\.rectangle\([^)]*\)\.setInteractive/);
    }
  });

  it("창 경계는 포함하고 밖은 거른다", () => {
    const clip = { left: 10, right: 110, top: 20, bottom: 220 };
    expect(pointInClip(clip, 10, 20)).toBe(true);
    expect(pointInClip(clip, 110, 220)).toBe(true);
    expect(pointInClip(clip, 60, 221)).toBe(false);
    expect(pointInClip(clip, 9, 100)).toBe(false);
  });
});
