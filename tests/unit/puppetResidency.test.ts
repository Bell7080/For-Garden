import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  PUPPET_IDLE_KEEP,
  emptyPuppetResidency,
  isPuppetResident,
  releasePuppet,
  retainPuppet,
} from "../../src/core/puppetResidency";

const url = (n: number): string => `puppets/char_${String(n).padStart(3, "0")}.zip`;

/** 여럿을 차례로 붙잡았다 그대로 놓는다. 오가는 화면의 축약이다. */
function cycle(count: number): { evicted: string[]; idle: readonly string[] } {
  let state = emptyPuppetResidency();
  const evicted: string[] = [];
  for (let index = 0; index < count; index += 1) state = retainPuppet(state, url(index));
  for (let index = 0; index < count; index += 1) {
    const next = releasePuppet(state, url(index));
    state = next.state;
    evicted.push(...next.evict);
  }
  return { evicted, idle: state.idle };
}

describe("Puppet 원화 거주 규칙", () => {
  it("쓰는 곳이 남아 있으면 절대 내리지 않는다", () => {
    // 살아 있는 표시 객체가 쓰는 그림을 지우면 그 자리에서 렌더가 터진다.
    let state = retainPuppet(retainPuppet(emptyPuppetResidency(), url(1)), url(1));
    const first = releasePuppet(state, url(1), 0);
    expect(first.evict).toEqual([]);
    expect(isPuppetResident(first.state, url(1))).toBe(true);

    state = first.state;
    expect(releasePuppet(state, url(1), 0).evict).toEqual([url(1)]);
  });

  it("마지막 하나를 놓아도 곧바로 내리지 않는다", () => {
    // 되돌아가는 한 걸음까지 다시 읽으면 고쳐 둔 진입 대기가 그대로 돌아온다.
    const { evicted, idle } = cycle(PUPPET_IDLE_KEEP);
    expect(evicted).toEqual([]);
    expect(idle).toHaveLength(PUPPET_IDLE_KEEP);
  });

  it("idle 자리가 넘치면 오래 놓인 것부터 내린다", () => {
    const { evicted, idle } = cycle(PUPPET_IDLE_KEEP + 3);
    expect(evicted).toEqual([url(0), url(1), url(2)]);
    expect(idle).toHaveLength(PUPPET_IDLE_KEEP);
    // 가장 나중에 놓은 것이 남는다 — 방금 떠난 화면으로 되돌아가는 걸음이 가장 잦다.
    expect(idle.at(-1)).toBe(url(PUPPET_IDLE_KEEP + 2));
  });

  it("다시 붙잡으면 idle에서 빠져나와 내려갈 차례를 잃는다", () => {
    let state = emptyPuppetResidency();
    for (let index = 0; index < PUPPET_IDLE_KEEP; index += 1) {
      state = releasePuppet(retainPuppet(state, url(index)), url(index)).state;
    }
    // 가장 먼저 놓여 다음에 내려갈 차례였던 것을 도로 잡는다.
    state = retainPuppet(state, url(0));
    expect(state.idle).not.toContain(url(0));

    const next = releasePuppet(retainPuppet(state, url(99)), url(99));
    // 자리가 하나 비었으므로 아직 아무것도 내려가지 않는다.
    expect(next.evict).toEqual([]);
  });

  it("도감 한 화면이 들고 있는 봉우리가 그대로 풀린다", () => {
    // 카드 한 장마다 전신 하나를 올리므로 스물다섯이 동시에 산다. 화면을 떠나면 그 전부가
    // 놓이고 idle 자리만큼만 남아야 한다 — 그러지 않던 때는 165MB가 끝까지 붙잡혔다.
    const { evicted, idle } = cycle(25);
    expect(evicted).toHaveLength(25 - PUPPET_IDLE_KEEP);
    expect(idle).toHaveLength(PUPPET_IDLE_KEEP);
  });

  it("한 장이 6.5MB라 idle 자리는 한 판의 전투보다 작다", () => {
    // 아군 여섯 + 적 다섯을 전부 남기면 71MB가 되고, 전투를 한 번 지난 계정이 도감을 열
    // 때의 봉우리가 그만큼 높아진다.
    expect(PUPPET_IDLE_KEEP).toBeLessThan(11);
    expect(PUPPET_IDLE_KEEP).toBeGreaterThan(0);
  });
});

describe("거주 규칙을 지나지 않는 길을 남기지 않는다", () => {
  const assets = readFileSync("src/puppets/assets.ts", "utf8");

  it("원화를 얻는 두 길이 모두 붙잡는다", () => {
    // `loadPortraitTexture`는 붙잡을 표시 객체를 **필수 인자로** 받는다 — 선택으로 두면
    // 새 화면이 그 인자를 빠뜨려도 타입이 통과하고, 그 묶음만 조용히 영영 남는다.
    expect(assets).toMatch(/loadPortraitTexture\([\s\S]*?holder: Phaser\.GameObjects\.GameObject,\n\)/);
    expect(assets).toContain("bindPuppetLifetime(scene, holder, asset.url)");
    // 세우는 길도 같다. 붙잡는 것이 `await`보다 앞서야 읽는 사이에 내려가지 않는다.
    expect(assets).toMatch(/retainPuppetAsset\(asset\.url\);\n(?:.*\n)*?\s*let creature/);
    expect(assets).toContain("releasePuppetAsset(scene, asset.url);");
  });

  it("세우다 실패한 자리도 붙잡은 것을 되돌린다", () => {
    // 전투는 실패한 한 마리를 삼키고 넘어가므로, 되돌리지 않으면 쓰는 곳이 없는 묶음이
    // 영영 내려가지 않는다.
    expect(assets).toMatch(/\} catch \(error\) \{\n\s*releasePuppetAsset\(scene, asset\.url\);\n\s*throw error;/);
  });

  it("내릴 때는 파싱 결과까지 함께 놓는다", () => {
    // 일꾼 경로의 `Puppet`은 압축 원본을 들고 있지 않다. 텍스처만 지우면 다시 올릴 그림이
    // 없어 그 개체가 다음부터 서지 못한다.
    const evictBlock = assets.slice(assets.indexOf("for (const evicted of next.evict)")).slice(0, 900);
    for (const dropped of ["scene.textures.remove(key)", "loaded.delete(evicted)", "anchorCache.delete(evicted)"]) {
      expect(evictBlock).toContain(dropped);
    }
  });

  it("같은 그림을 다른 묶음이 함께 쓰면 지우지 않는다", () => {
    // 텍스처 키는 ZIP 안의 이름에서 나오므로 서로 다른 묶음이 같은 키를 쓸 수 있다. 한쪽을
    // 내린다고 지우면 아직 살아 있는 다른 쪽이 그 자리에서 터진다.
    const evictBlock = assets.slice(assets.indexOf("for (const evicted of next.evict)")).slice(0, 900);
    expect(evictBlock).toContain("if (!shared) scene.textures.remove(key)");
    expect(evictBlock).toMatch(/residency\.users[\s\S]*residency\.idle/);
  });

  it("얼굴 액자는 구운 뒤에 원본을 놓는다", () => {
    // 원정 순위표가 100줄을 세우므로 판이 사는 동안 붙잡으면 거기 선 개체의 전신이 전부 남는다.
    const faceFrame = readFileSync("src/ui/FaceFrame.ts", "utf8");
    expect(faceFrame).toContain("withPuppetTexture(scene, asset,");
    expect(faceFrame).not.toContain("loadPortraitTexture");
  });
});
