import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { Puppet, SKIN_MAX_INFLUENCES, applySkinTable, type PuppetSkinFrame } from "puppetforge";
import CREATURE_SOURCE from "../../src/puppets/IndexedPuppetCreature.ts?raw";

// 렌더러는 Phaser를 들여와 이 환경에서 import할 수 없으므로 상한은 소스에서 읽는다.
const SKIN_MAX_BONES = Number(/export const SKIN_MAX_BONES = (\d+)/.exec(CREATURE_SOURCE)?.[1]);

/**
 * GPU 스키닝은 애니메이션을 바꾸면 안 된다. 실제로 배포하는 묶음 전부를 두 길로 돌려
 * CPU `update()`가 낸 정점과 `updateSkin()` + 셰이더와 같은 식(`applySkinTable`)이 낸 정점을 견준다.
 * 묶음이 관절 수 상한을 넘으면 렌더러가 CPU로 되돌아가므로 그 묶음은 상한만 확인한다.
 */
const DIR = resolve(process.cwd(), "public", "puppets");
const FILES = readdirSync(DIR).filter((name) => name.endsWith(".zip")).sort();
const DT = 1 / 20;
const FRAMES = 30;

function skinVertices(frame: PuppetSkinFrame | null, rest: number[], out: Float32Array): Float32Array | null {
  if (!frame) return null;
  if (frame.mode === "vertices") return frame.vertices;
  return applySkinTable(rest, frame.table, frame.palette, out);
}

describe("GPU 스키닝 — 실제 묶음 전부가 CPU와 같은 정점을 낸다", () => {
  it("묶음이 있다", () => expect(FILES.length).toBeGreaterThan(20));

  it.each(FILES)("%s", async (file) => {
    const bytes = readFileSync(resolve(DIR, file));
    const cpu = await Puppet.load(new Uint8Array(bytes));
    // 원화는 필요 없고 상태만 따로 굴리면 되므로 두 번째 개체는 읽은 프로젝트의 사본으로 만든다.
    const gpu = Puppet.fromProject(structuredClone(cpu.project));
    if (!cpu.mesh) return;
    expect(cpu.project.bones.length).toBeLessThanOrEqual(SKIN_MAX_BONES);
    const rest = cpu.restVertices;
    const out = new Float32Array(rest.length);
    let worst = 0;
    let paletteFrames = 0;
    // 게임이 실제로 쓰는 순서와 같게 idle에서 시작해 다른 동작으로 넘어갔다 돌아온다.
    const names = cpu.animations;
    const order = ["idle", ...names.filter((name) => name !== "idle"), "idle"].filter((name) => names.includes(name));
    for (const name of order) {
      cpu.play(name);
      gpu.play(name);
      expect(gpu.skinTable(name)?.bones.length ?? 0).toBeGreaterThan(0);
      for (let frame = 0; frame < FRAMES; frame += 1) {
        const a = cpu.update(DT);
        const skin = gpu.updateSkin(DT);
        if (skin?.mode === "palette") paletteFrames += 1;
        const b = skinVertices(skin, rest, out);
        expect(b === null).toBe(a === null);
        if (!a || !b) continue;
        for (let i = 0; i < a.length; i += 1) worst = Math.max(worst, Math.abs(a[i] - b[i]));
      }
    }
    expect(worst).toBeLessThan(1e-2);
    expect(paletteFrames).toBeGreaterThan(0);
    expect(SKIN_MAX_INFLUENCES).toBe(4);
  }, 60_000);
});
