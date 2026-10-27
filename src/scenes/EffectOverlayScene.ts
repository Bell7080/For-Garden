import Phaser from "phaser";
import { motionPolicy } from "../core/settings";
import { EffectManager } from "../managers/EffectManager";
import { setOverlayEffects } from "../managers/overlayEffects";
import { setTempAdPlayer } from "../platform/rewardedAds";
import { playTempAdPopup } from "../ui/TempAdPopup";
import { PopupLayer } from "../ui/PopupLayer";
import { opsNoticeReceipt } from "../ui/opsNoticeText";
import { openRewardPopup } from "../ui/RewardPopup";
import { managerEvents } from "../managers/ManagerEvents";
import { onAccountDeleted } from "../api/accountDeleted";
import { accountApi } from "../api/AccountApi";
import { disconnectProgress } from "../api/backendSession";
import { saveManager } from "../state/SaveManager";
import { stopLiveOps } from "../managers/liveOps";
import { t } from "../i18n";
import { audioManager } from "../managers/AudioManager";

/**
 * 누른 자리에 답하는 얇은 겹 하나.
 *
 * 씬마다 클릭 이펙트를 붙이면 화면이 늘 때마다 빠뜨리고, 같은 조작이 어디서는 답하고
 * 어디서는 답하지 않는다. 그래서 **모든 씬 위에 늘 떠 있는 한 겹**이 포인터를 듣는다.
 * 부트가 한 번 띄우면 씬이 바뀌어도 그대로 남는다(`launch`는 아래 씬을 멈추지 않는다).
 *
 * 결은 두 가지다.
 * - 메뉴에서는 **근미래 홀로그램 장비를 누른 손맛** — 얇은 마름모 파문 한 겹이 빠르게 지나간다.
 * - 전장에서는 **작게 톡 튀는 조각 셋** — 단순한 SD가 뚜따시하는 화면과 같은 결이다.
 *
 * 이 겹은 아무것도 가로채지 않는다. 표시 객체에 입력을 걸지 않으므로 아래 씬의 버튼은
 * 평소대로 눌린다.
 */
export class EffectOverlayScene extends Phaser.Scene {
  static readonly KEY = "effect-overlay";

  private effects!: EffectManager;

  constructor() {
    super(EffectOverlayScene.KEY);
  }

  create(): void {
    // 전투 수치를 만들지 않는 입력 겹이지만 생성 옵션의 의미를 명시해 전투 설정과 혼동하지 않는다.
    this.effects = new EffectManager(this, { depth: 0, motion: motionPolicy({ presentation: { screenShake: false, battleUiMotion: "default" }, accessibility: { reduceMotion: false } }), damageNumbers: true });
    // 판 위에서 터뜨려야 하는 메뉴 연출(룬 세공 결과 등)이 이 겹을 찾을 수 있게 걸어 둔다.
    // 팝업이 제 씬에 파티클을 만들면 깊이 2000대의 판 아래에 묻히고, 화면마다 매니저를 하나 더
    // 만들면 emitter가 화면 수만큼 늘어난다.
    setOverlayEffects(this.effects);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => { setOverlayEffects(undefined); setTempAdPlayer(undefined); });
    // E2E(test 모드)는 3초를 기다리지 않는다 — 팝업 없이 곧바로 광고를 본 것으로 친다.
    if (import.meta.env?.MODE !== "test") setTempAdPlayer(() => playTempAdPopup(this));
    this.scene.bringToTop();
    this.bindLiveOps();
    // 모바일 우선 입력이라 손이 닿는 순간 답한다 — 떼는 순간까지 기다리면 눌린 느낌이 늦다.
    this.input.on(Phaser.Input.Events.POINTER_DOWN, (pointer: Phaser.Input.Pointer) => {
      // 씬이 바뀌면 새 씬이 위로 올라오므로 누를 때마다 다시 맨 앞으로 세운다.
      this.scene.bringToTop();
      // 이 겹에는 입력을 받는 표시 객체가 없어 hit test가 돌지 않으므로 `worldX`가 갱신되지
      // 않는다. FIT 배율은 포인터를 이미 게임 좌표로 옮겨 두므로 `x`·`y`를 그대로 쓴다.
      this.effects.tap(pointer.x, pointer.y, this.scene.isActive("battle") ? "tapBattle" : "tap");
      this.answerEmptyTap(pointer);
    });
  }

  /**
   * 아무것도 없는 자리를 누른 손에도 아주 작은 소리로 답한다. 이 겹이 맨 위라 아래 씬의 버튼보다 **먼저**
   * 듣는다 — 그래서 같은 사건이 아래로 다 흘러간 뒤(다음 태스크)에 본다. 그사이 버튼이 제 소리를 냈거나
   * 손 밑에 눌리는 개체가 하나라도 있으면 그 개체의 몫이라 울리지 않는다.
   */
  private answerEmptyTap(pointer: Phaser.Input.Pointer): void {
    const pressedAt = performance.now();
    setTimeout(() => {
      if (!audioManager || audioManager.heardSince(pressedAt)) return;
      for (const scene of this.game.scene.getScenes(true)) {
        if (scene === this || !scene.input?.enabled) continue;
        if (scene.input.hitTestPointer(pointer).some((hit) => hit.input?.enabled)) return;
      }
      audioManager.playUi("ui.tap");
    }, 0);
  }

  /** 운영팀이 보낸 우편·재화 조정의 안내와 계정 삭제 안내를 어느 화면 위에서나 띄운다. */
  private bindLiveOps(): void {
    const popups = new PopupLayer(this, 3000);
    let showing = false;
    type Receipt = ReturnType<typeof opsNoticeReceipt>;
    let queued: Receipt[] = [];
    const flush = (): void => {
      if (showing || queued.length === 0) return;
      const next = queued.shift() as Receipt;
      showing = true;
      this.scene.bringToTop();
      const done = (): void => { showing = false; flush(); };
      // 회수된 몫은 글줄로, 받은 몫은 보상 팝업과 같은 액자·수량으로 보여 준다. 사유는 아래에 적는다.
      const showGains = (): void => {
        if (next.items.length === 0) { done(); return; }
        openRewardPopup(this, popups, { title: t("ops.notice.title"), items: next.items, ...(next.reason ? { footnote: next.reason } : {}), onConfirm: done });
      };
      if (next.losses.length === 0) showGains();
      else popups.confirm({ title: t("ops.notice.title"), message: [...next.losses, next.reason].filter(Boolean).join("\n"), confirmLabel: t("settings.action.confirm"), cancelLabel: false }, showGains);
    };
    const offNotice = managerEvents.subscribe("opsNotice", ({ notices }) => {
      const receipt = opsNoticeReceipt(notices);
      if (receipt.items.length === 0 && receipt.losses.length === 0) return;
      queued.push(receipt);
      flush();
    });
    const offDeleted = onAccountDeleted(() => {
      stopLiveOps();
      this.scene.bringToTop();
      popups.confirm({ title: t("ops.deleted.title"), message: t("ops.deleted.body"), confirmLabel: t("settings.action.confirm"), cancelLabel: false }, () => {
        // 로그아웃이 실패해도 이 기기의 저장은 지운다 — 삭제된 계정으로는 어차피 이어 갈 수 없다.
        const leave = (): void => { disconnectProgress(); saveManager.reset(); window.location.reload(); };
        void accountApi.logout().then(leave, leave);
      });
    });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => { offNotice(); offDeleted(); });
  }
}
