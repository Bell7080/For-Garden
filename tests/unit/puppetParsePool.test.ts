import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { resolveWorkerAssetUrl } from "../../src/puppets/puppetParsePool";

/**
 * 일꾼 무리가 **실제로 일을 하는지**를 고정한다.
 *
 * 이 무리는 실패해도 조용하다 — `loadPuppet`이 `null`을 받으면 예전 메인 스레드 경로로
 * 되돌아가므로 화면은 멀쩡하고, 대신 무리가 하는 일이 통째로 없어진다. 그래서 "화면이 뜬다"는
 * 회귀 신호가 되지 못하고 계약을 따로 박아 둬야 한다.
 */
describe("Puppet 해석 일꾼 무리", () => {
  it("는 상대 주소를 문서 기준으로 풀어 일꾼에게 넘긴다", () => {
    /*
     * `vite.config.ts`가 `base: "./"`라 묶음 주소는 `./puppets/char_001.zip`이다. 메인
     * 스레드는 문서(`/`)를 기준으로 풀어 맞게 가지만, 일꾼 스크립트는 `/assets/`에 놓이므로
     * 같은 문자열이 일꾼 안에서는 `/assets/puppets/char_001.zip`이 된다 — 그 주소는 SPA
     * 폴백에 걸려 **200과 함께 `index.html`**을 돌려주고, 일꾼은 그것을 puppet.json으로 읽다
     * `Unexpected token '<'`로 실패한다. 실측에서 묶음 열여덟 장이 **전부** 그랬다.
     */
    expect(resolveWorkerAssetUrl("./puppets/char_001.zip", "https://example.com/"))
      .toBe("https://example.com/puppets/char_001.zip");
    // 일꾼이 제 위치를 기준으로 다시 풀 여지가 남지 않도록 절대 주소여야 한다.
    expect(resolveWorkerAssetUrl("./puppets/char_001.zip", "https://example.com/")).not.toContain("./");
  });

  it("는 이미 절대인 주소와 하위 경로 배포를 그대로 지킨다", () => {
    expect(resolveWorkerAssetUrl("/puppets/char_001.zip", "https://example.com/game/"))
      .toBe("https://example.com/puppets/char_001.zip");
    // 하위 경로에 배포해도 그 경로 아래로 풀려야 한다 — `base`가 `./`인 이유가 이것이다.
    expect(resolveWorkerAssetUrl("./puppets/char_001.zip", "https://example.com/game/"))
      .toBe("https://example.com/game/puppets/char_001.zip");
    expect(resolveWorkerAssetUrl("https://cdn.example.com/a.zip", "https://example.com/"))
      .toBe("https://cdn.example.com/a.zip");
  });

  it("는 일꾼에게 넘기기 전에 반드시 그 해석을 거친다", () => {
    // 큐에 담기는 것이 원본 `url`로 되돌아가면 같은 버그가 조용히 되살아난다.
    const source = readFileSync(resolve(process.cwd(), "src/puppets/puppetParsePool.ts"), "utf8");
    const entry = source.slice(source.indexOf("export function parsePuppetOffThread"));
    expect(entry).toContain("resolveWorkerAssetUrl");
    expect(entry).toContain("waiting.push({ url: resolved");
  });
});
