import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * **Phaser는 씬 인스턴스를 재사용한다.**
 *
 * 필드 초기값(`= 0`, `= false`)은 게임이 씬을 만들 때 **딱 한 번** 돈다. 한 판의 상태를 거기에
 * 두고 화면을 열 때마다 되돌리지 않으면, 두 번째 진입부터 지난 판의 값이 그대로 남는다 —
 * 실제로 상점의 첫 마디가 그랬다. `merchantLine`이 1 이상으로 남아 `tryFirstLine`이 곧바로
 * 되돌아갔고, **재진입부터는 점원이 영영 말을 걸지 않았다**(실측에서 12초를 기다려도 없었다).
 *
 * Phaser 씬은 DOM/WebGL 없이 세울 수 없으므로 여기서는 소스 계약만 고정한다.
 */
const sceneSource = (name: string): string => readFileSync(resolve(process.cwd(), `src/scenes/${name}`), "utf8");

describe("씬을 다시 열 때의 상태", () => {
  it("상점은 첫 마디의 상태를 진입할 때마다 되돌린다", () => {
    const source = sceneSource("ShopScene.ts");
    const init = source.slice(source.indexOf("  init("), source.indexOf("  create()"));
    for (const field of ["merchantLine", "entranceSettled", "merchantReady", "entranceAt"]) {
      expect(init, `${field}를 init에서 되돌려야 한다`).toContain(`this.${field} =`);
    }
  });

  it("고고학은 굴착 중 상태를 화면을 열 때 되돌린다", () => {
    /*
     * 굴착이 도는 중에 화면을 떠나면 `digging = true`가 씬 객체에 남는다 — 돌아온 판은 첫
     * 손짓부터 되돌아가 아무 칸도 파이지 않는다.
     */
    const source = sceneSource("ArchaeologyScene.ts");
    const create = source.slice(source.indexOf("  create()"), source.indexOf("  create()") + 1600);
    expect(create).toContain("this.digging = false;");
  });
});
