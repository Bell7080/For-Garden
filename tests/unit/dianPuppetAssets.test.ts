import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import { DIAN_PORTRAIT_METADATA, DIAN_SD_METADATA, KURO_SD_METADATA, SHIRO_SD_METADATA } from "../../src/puppets/assetMetadata";
import { DIAN_ASSET, DIAN_SD_ASSET, KURO_SD_ASSET, PUPPET_PRELOAD_GROUPS, SHIRO_SD_ASSET } from "../../src/puppets/assets";

/** 배포 ZIP에서 puppet.json만 읽어 테스트용 압축 해제 파일을 저장소에 남기지 않는다. */
function project(file: string): { character: { width: number; height: number }; bones: Array<{ name: string; x: number; y: number }> } {
  return JSON.parse(execFileSync("unzip", ["-p", resolve(process.cwd(), "public/puppets", file), "puppet.json"], { encoding: "utf8" }));
}

const cases = [
  ["char_020.zip", DIAN_ASSET, DIAN_PORTRAIT_METADATA],
  ["charSD_020.zip", DIAN_SD_ASSET, DIAN_SD_METADATA],
  ["charSD_020_black.zip", KURO_SD_ASSET, KURO_SD_METADATA],
  ["charSD_020_white.zip", SHIRO_SD_ASSET, SHIRO_SD_METADATA],
] as const;

describe("디안과 귀속 늑대 Puppet 에셋", () => {
  it.each(cases)("%s는 puppets 아래 실제 ZIP과 측정 메타데이터를 가진다", (file, asset, metadata) => {
    const path = resolve(process.cwd(), "public/puppets", file);
    expect(existsSync(path)).toBe(true);
    expect(existsSync(resolve(process.cwd(), "public", file))).toBe(false);
    expect(asset.url).toMatch(new RegExp(`puppets/${file}$`));
    const json = project(file);
    expect([metadata.imageWidth, metadata.imageHeight]).toEqual([json.character.width, json.character.height]);
    expect(metadata.content.left).toBeLessThan(metadata.content.right);
    expect(metadata.content.top).toBeLessThan(metadata.content.bottom);
    expect(metadata.content).toMatchSnapshot();
    // 관절은 이름별 원본 좌표와 일치해야 하며 SD의 눈 없음도 null로 명시한다.
    const point = (name: string) => { const bone = json.bones.find((item) => item.name === name); return bone && [bone.x, bone.y]; };
    expect(metadata.joints?.center).toEqual(point("중심1"));
    expect(metadata.joints?.head).toEqual(point("머리1"));
    expect(metadata.joints?.feet).toEqual([point("발1"), point("발2")]);
    expect(metadata.joints?.eyes).toEqual(point("눈1") ? [point("눈1"), point("눈2")] : null);
  });

  it("는 전신을 첫 그룹, 디안·쿠로·시로 SD를 둘째 그룹에 중복 없이 등록한다", () => {
    expect(PUPPET_PRELOAD_GROUPS[0]).toContain(DIAN_ASSET);
    for (const asset of [DIAN_SD_ASSET, KURO_SD_ASSET, SHIRO_SD_ASSET]) expect(PUPPET_PRELOAD_GROUPS[1]).toContain(asset);
    const urls = PUPPET_PRELOAD_GROUPS.flat().map(({ url }) => url);
    expect(new Set(urls).size).toBe(urls.length);
  });
});
