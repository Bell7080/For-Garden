import { describe, expect, it, vi } from "vitest";
import { sourceClass } from "../helpers/sourceClass";

function fixture() {
  const id = vi.fn(), email = vi.fn(), login = vi.fn();
  class Button {
    constructor(_s: unknown, _x: number, _y: number, public config: any) {}
    destroy() {} setAlpha() { return this; }
  }
  const Title = sourceClass("src/scenes/TitleScene.ts", "TitleScene", {
    Phaser: { Scene: class {} }, Button, t: (key: string) => key,
    TITLE_LOGIN_LAYOUT: { width: 100, height: 40 }, titleLoginSlots: () => [1, 2, 3, 4, 5],
    openAccountIdPopup: id, openAccountEmailPopup: email, accountApi: { login },
  });
  const scene = Object.assign(Object.create(Title.prototype), {
    scene: { isActive: () => true }, loginButtons: [], entryGeneration: 1, entryPending: false,
    popups: {}, showConnectFailure: vi.fn(),
  });
  const done = vi.fn(), enter = vi.fn();
  const build = () => scene.showLoginButtons(540, enter, false, done);
  const click = (key: string) => scene.loginButtons.find((b: Button) => b.config.label === `title.login.${key}`).config.onClick();
  build(); return { scene, id, email, login, done, enter, click, build };
}

describe("타이틀 인증창 단일 소유권", () => {
  it("ID 연타·언어 재구성·다른 인증 버튼은 하나의 창만 열며 취소 후 다시 고를 수 있다", () => {
    const f = fixture(); f.click("account"); f.click("account"); f.build(); f.click("email"); f.click("google");
    expect(f.id).toHaveBeenCalledTimes(1); expect(f.email).not.toHaveBeenCalled(); expect(f.login).not.toHaveBeenCalled();
    f.id.mock.calls[0][2].onClose(); f.click("email"); expect(f.email).toHaveBeenCalledTimes(1);
    f.email.mock.calls[0][4](); f.click("account"); expect(f.id).toHaveBeenCalledTimes(2);
  });
  it("소셜 로그인은 한 요청만 보내고 성공은 한 번만 진입하며 옛 씬 응답은 무시한다", async () => {
    const f = fixture(); let resolve!: (value: unknown) => void;
    f.login.mockReturnValue(new Promise(r => { resolve = r; }));
    f.click("google"); f.build(); f.click("apple"); expect(f.login).toHaveBeenCalledTimes(1);
    resolve({ ok: true }); await new Promise(r => setTimeout(r, 0)); expect(f.done).toHaveBeenCalledTimes(1);
    f.click("google"); f.scene.entryGeneration++; resolve({ ok: true });
    await new Promise(r => setTimeout(r, 0)); expect(f.done).toHaveBeenCalledTimes(1);
  });
});
