import { describe, expect, it } from "vitest";
import {
  ALLY_SD_ASSETS,
  PORTRAIT_ASSETS,
  PUPPET_PRELOAD_GROUPS,
} from "../../src/puppets/assets";

/** 새 캐릭터의 전신/SD 등록이 타이틀 사전 로딩에서 빠지지 않도록 레지스트리 계약을 고정한다. */
describe("Puppet 사전 로딩 레지스트리", () => {
  const preloadedUrls = PUPPET_PRELOAD_GROUPS.flat().map((asset) => asset.url);

  it.each(Object.entries(PORTRAIT_ASSETS))("전신 %s URL을 포함한다", (_id, asset) => {
    expect(preloadedUrls).toContain(asset.url);
  });

  it.each(Object.entries(ALLY_SD_ASSETS))("아군 SD %s URL을 포함한다", (_id, asset) => {
    expect(preloadedUrls).toContain(asset.url);
  });

  it("동일 URL을 한 번만 등록한다", () => {
    // 그룹 경계가 달라도 같은 ZIP을 두 번 요청하지 않는다는 URL 단위 계약이다.
    expect(new Set(preloadedUrls).size).toBe(preloadedUrls.length);
  });
});
