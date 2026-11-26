import { readdirSync } from "node:fs";
import { resolve } from "node:path";
import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";

/**
 * GPU 텍스처 키는 묶음 안의 이름(`character.name`)에서 나온다(`ensureTexture`).
 * 전신과 SD가 같은 이름을 쓰면 먼저 올라간 그림이 그 키를 차지해, 노칸·은테·히스의
 * 전장 SD 자리에 전신 원화가 서는 일이 있었다(v0.552.2). 묶음마다 이름이 달라야 한다.
 */
describe("Puppet 묶음 이름", () => {
  it("모든 ZIP의 character.name이 서로 다르다", () => {
    const dir = resolve(process.cwd(), "public/puppets");
    const owners = new Map<string, string[]>();
    for (const file of readdirSync(dir).filter((name) => name.endsWith(".zip"))) {
      const project = JSON.parse(execFileSync("unzip", ["-p", resolve(dir, file), "puppet.json"], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 }));
      const name: string = project.character.name;
      owners.set(name, [...(owners.get(name) ?? []), file]);
    }
    const duplicated = [...owners].filter(([, files]) => files.length > 1);
    expect(duplicated).toEqual([]);
  });
});
