import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import ASSETS_SOURCE from "../../src/puppets/assets.ts?raw";

/** 배포 경로와 로딩 표가 함께 바뀌지 않으면 첫 카드·전투에서 늦게 ZIP을 파싱하므로 둘을 묶어 검사한다. */
describe("토리카 skin001 에셋 완전성", () => {
  const files = ["char_001_skin001.zip", "charSD_001_skin001.zip"] as const;

  it.each(files)("public/puppets/%s가 실제 ZIP으로 존재한다", (file) => {
    const path = resolve(process.cwd(), "public", "puppets", file);
    expect(existsSync(path)).toBe(true);
    // 존재만 하는 빈 더미를 통과시키지 않도록 ZIP local-file 헤더도 확인한다.
    expect(readFileSync(path).subarray(0, 4).toString("hex")).toBe("504b0304");
  });

  it("는 전신·SD 상수를 새 puppets URL과 각 프리로드 단계에 등록한다", () => {
    expect(ASSETS_SOURCE).toContain("puppets/char_001_skin001.zip");
    expect(ASSETS_SOURCE).toContain("puppets/charSD_001_skin001.zip");
    const groups = ASSETS_SOURCE.slice(ASSETS_SOURCE.indexOf("export const PUPPET_PRELOAD_GROUPS"));
    // 프리로드 표는 개별 상수 나열 대신 기본/스킨 레지스트리에서 자동으로 파생한다.
    expect(groups).toContain("skinAssets(PORTRAIT_SKINS)");
    expect(groups).toContain("skinAssets(ALLY_SD_SKINS)");
  });

  it("는 명시적 resolver에서 같은 렐릭 기본 외형으로만 폴백한다", () => {
    // Phaser import 없이 선택 순서와 토리카 전역 폴백 금지를 정적으로 지킨다.
    expect(ASSETS_SOURCE).toContain("PORTRAIT_SKINS[assetId]?.[equippedSkinId]) || portraitAssetFor(assetId)");
    expect(ASSETS_SOURCE).toContain("ALLY_SD_SKINS[relicId]?.[equippedSkinId]) || ALLY_SD_ASSETS[relicId]");
  });
});
