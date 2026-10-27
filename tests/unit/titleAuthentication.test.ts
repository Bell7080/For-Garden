import { describe, expect, it, vi } from "vitest";
import { sourceClass } from "../helpers/sourceClass";

function fixture() {
  const id = vi.fn(), email = vi.fn(), login = vi.fn(), getState = vi.fn();
  const reconcile = vi.fn(() => false);
  const backend = vi.fn((): unknown => null);
  const startup = vi.fn();
  class Button {
    constructor(_s: unknown, _x: number, _y: number, public config: any) {}
    destroy() {} setAlpha() { return this; }
  }
  const Title = sourceClass("src/scenes/TitleScene.ts", "TitleScene", {
    Phaser: { Scene: class {} }, Button, t: (key: string) => key,
    TITLE_LOGIN_LAYOUT: { width: 100, height: 40 }, titleLoginSlots: () => [1, 2, 3, 4, 5],
    openAccountIdPopup: id, openAccountEmailPopup: email, accountApi: { login, getState },
    backendAccount: backend, checkStartupGate: startup, reconcileLaunchEpoch: reconcile, packageInfo: { version: "test" },
  });
  const scene = Object.assign(Object.create(Title.prototype), {
    scene: { isActive: () => true, start: vi.fn() }, loginButtons: [], entryGeneration: 1, entryPending: false,
    popups: {}, showConnectFailure: vi.fn(),
  });
  const done = vi.fn(), enter = vi.fn();
  const build = () => scene.showLoginButtons(540, enter, false, done);
  const click = (key: string) => scene.loginButtons.find((b: Button) => b.config.label === `title.login.${key}`).config.onClick();
  build(); return { scene, id, email, login, getState, reconcile, backend, startup, done, enter, click, build };
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


it("게스트도 인증에 성공한 뒤 입장 문구 단계로 이어지고 자동 진입하지 않는다", async () => {
  const f = fixture();
  f.getState.mockResolvedValue({ ok: true });
  f.click("guest"); f.click("guest");
  await new Promise(r => setTimeout(r, 0));
  expect(f.getState).toHaveBeenCalledTimes(1);
  expect(f.done).toHaveBeenCalledTimes(1);
  expect(f.enter).not.toHaveBeenCalled();
});
it("인증 선택 전에 서버 세대를 맞추고 과거 저장이 지워졌으면 부트로 돌아간다", async () => {
  const f = fixture();
  f.scene.gate = Promise.resolve({ gate: "open", config: { launchEpoch: "new" } });
  expect(await f.scene.prepareEntry()).toBe(true);
  expect(f.reconcile).toHaveBeenCalledWith("new");
  f.reconcile.mockReturnValue(true);
  expect(await f.scene.prepareEntry()).toBe(false);
  expect(f.scene.scene.start).toHaveBeenCalledWith("boot");
  expect(f.login).not.toHaveBeenCalled(); expect(f.getState).not.toHaveBeenCalled();
});
it("이전 타이틀 세대의 늦은 설정 응답은 토큰을 지우거나 화면을 바꾸지 않는다", async () => {
  const f = fixture(); let resolve!: (value: unknown) => void;
  f.scene.gate = new Promise(r => { resolve = r; });
  const preparing = f.scene.prepareEntry(); f.scene.entryGeneration++;
  resolve({ gate: "open", config: { launchEpoch: "new" } });
  expect(await preparing).toBe(false);
  expect(f.reconcile).not.toHaveBeenCalled(); expect(f.scene.scene.start).not.toHaveBeenCalled();
});

it("초기 설정을 못 읽은 원격 빌드는 로그인 전 재시도하고 세대 확인을 먼저 끝낸다", async () => {
  const f = fixture();
  f.backend.mockReturnValue({});
  f.scene.gate = Promise.resolve({ gate: "open", config: null });
  f.startup.mockResolvedValue({ gate: "open", config: { launchEpoch: "new" } });
  f.scene.showConnectFailure.mockImplementation((_code: string, _detail: unknown, retry: () => void) => retry());
  expect(await f.scene.prepareEntry()).toBe(true);
  expect(f.startup).toHaveBeenCalledTimes(1);
  expect(f.reconcile).toHaveBeenCalledWith("new");
  expect(f.getState).not.toHaveBeenCalled(); expect(f.login).not.toHaveBeenCalled();
});
