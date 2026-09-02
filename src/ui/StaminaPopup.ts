import Phaser from "phaser";
import type { GameApi } from "../api/contracts";
import { currencyGuide } from "../data/currencyGuide";
import { STAMINA_RECHARGE_SOURCES, staminaConsumable } from "../data/staminaRecharge";
import { staminaMaxForPlayer } from "../core/stamina";
import { InventoryManager } from "../managers/InventoryManager";
import { managerEvents } from "../managers/ManagerEvents";
import { session } from "../state/session";
import { Button } from "./Button";
import { CURRENCY_ICON_BY_WALLET } from "./currencyIcons";
import { drawHairline, drawLayer, slantedRect } from "./holo";
import { addItemFrame, ITEM_FRAME } from "./itemFrame";
import { PopupLayer } from "./PopupLayer";
import { addSectionTitle } from "./SectionTitle";
import { staminaTimerLine } from "./staminaDisplay";
import { COLOR, textStyle } from "./theme";

/**
 * 스테미나 전용 창.
 *
 * 다른 재화는 "무엇으로 얻고 어디에 쓰는가"만 읽으면 되지만(`CurrencyGuidePopup`), 스테미나는
 * **지금 얼마나 남았고 언제 차는지, 지금 채울 수 있는지**가 곧 다음 조작을 정한다. 그래서 상단
 * 줄의 칸에는 현재·최대만 두고 나머지는 이 창이 맡는다 — 작은 칸에 시간까지 밀어 넣으면 글자가
 * 칸을 넘고, 정작 자주 보는 두 수가 작아진다.
 */
const LAYOUT = {
  width: 720,
  height: 700,
  /** 액자가 서는 전용 레이어. 창 맨 위 가운데다. */
  frameY: -286,
  frameSize: 168,
  valueY: -150,
  timerY: -98,
  rechargeTitleY: -34,
  rechargeY: 60,
  rowHeight: 116,
  usesY: 186,
} as const;

/** 현재 값과 상한은 상단 줄과 같은 노란색 한 덩어리다. 시간만 얇은 회색으로 물러난다. */
const TONE = { value: "#ffe9a3", timer: COLOR.inkDim } as const;

export class StaminaPopup {
  private readonly inventory = new InventoryManager(session);
  private pending = false;

  constructor(private readonly scene: Phaser.Scene, private readonly popups: PopupLayer, private readonly api: GameApi) {}

  open(): void {
    const guide = currencyGuide("stamina");
    this.popups.open({ width: LAYOUT.width, height: LAYOUT.height, title: guide.name, dim: true, dimAlpha: 0.34 }, (body) => {
      const view = this.scene.add.container(0, 0);
      body.add(view);
      const render = (): void => { view.removeAll(true); this.paint(view); };
      render();
      // 회복 시간은 1초마다 다시 그리고, 창이 닫히면 타이머와 구독을 함께 놓는다.
      const timer = this.scene.time.addEvent({ delay: 1_000, loop: true, callback: render });
      const unsubscribe = managerEvents.subscribe("wallet", render);
      view.once(Phaser.GameObjects.Events.DESTROY, () => { timer.remove(); unsubscribe(); });
    });
  }

  /** 액자 → 수치 → 시간 → 충전 → 사용처 순서로 한 번에 그린다. */
  private paint(view: Phaser.GameObjects.Container): void {
    const amount = session.wallet.stamina;
    const maximum = staminaMaxForPlayer(session);
    // 전용 레이어: 판을 하나 깔고 그 가운데에 액자를 세운다. 이 창에서 가장 먼저 읽어야 하는
    // 것이 "지금 얼마 남았나"라 그림과 수를 한 덩어리로 위에 모은다.
    view.add(drawLayer(this.scene, 0, LAYOUT.frameY + 78, slantedRect(LAYOUT.width - 96, 320, 18), { fill: 0x101720, alpha: 0.9, edge: COLOR.accent, edgeAlpha: 0.35 }));
    view.add(addItemFrame(this.scene, 0, LAYOUT.frameY, LAYOUT.frameSize));
    view.add(this.scene.add.image(0, LAYOUT.frameY, CURRENCY_ICON_BY_WALLET.stamina).setDisplaySize(LAYOUT.frameSize * ITEM_FRAME.icon, LAYOUT.frameSize * ITEM_FRAME.icon));
    view.add(this.scene.add.text(0, LAYOUT.valueY, `${amount.toLocaleString()} / ${maximum.toLocaleString()}`, textStyle({ role: "display", size: 52, color: TONE.value })).setOrigin(0.5).setShadow(2, 6, "#05070a", 7, false, true));
    const timer = staminaTimerLine(amount, maximum, session.staminaUpdatedAt, Date.now());
    if (timer) view.add(this.scene.add.text(0, LAYOUT.timerY, timer, textStyle({ role: "body", size: 22, color: TONE.timer })).setOrigin(0.5));

    this.paintRecharge(view, amount >= maximum);
    view.add(addSectionTitle(this.scene, -LAYOUT.width / 2 + 48, LAYOUT.usesY, "사용처", { size: 24 }));
    guideRows().forEach((row, index) => {
      view.add(this.scene.add.text(-LAYOUT.width / 2 + 62, LAYOUT.usesY + 54 + index * 44, `◆  ${row}`, textStyle({ role: "body", size: 22, color: COLOR.ink })).setOrigin(0, 0.5));
    });
  }

  /**
   * 지금 채울 수 있는 수단들.
   *
   * 표(`STAMINA_RECHARGE_SOURCES`)에 있는 것만 세운다 — 아직 경계가 없는 젬 충전·광고 보급은
   * 자리를 비워 둔다. 가진 것이 없거나 이미 가득 찼으면 줄은 남기고 조작만 잠근다.
   */
  private paintRecharge(view: Phaser.GameObjects.Container, full: boolean): void {
    view.add(addSectionTitle(this.scene, -LAYOUT.width / 2 + 48, LAYOUT.rechargeTitleY, "충전", { size: 24 }));
    STAMINA_RECHARGE_SOURCES.forEach((source, index) => {
      const item = staminaConsumable(source.itemId);
      if (!item) return;
      const y = LAYOUT.rechargeY + index * LAYOUT.rowHeight;
      const owned = session.itemInventory.find(({ itemId }) => itemId === source.itemId)?.quantity ?? 0;
      view.add(drawLayer(this.scene, 0, y, slantedRect(LAYOUT.width - 96, 92, 14), { fill: 0x141a22, alpha: 0.94, edge: COLOR.accent, edgeAlpha: 0.28 }));
      const frameSize = 74;
      view.add(addItemFrame(this.scene, -LAYOUT.width / 2 + 96, y, frameSize));
      if (this.scene.textures.exists(`item-${source.itemId}`)) {
        view.add(this.scene.add.image(-LAYOUT.width / 2 + 96, y, `item-${source.itemId}`).setDisplaySize(frameSize * ITEM_FRAME.icon, frameSize * ITEM_FRAME.icon));
      }
      view.add(this.scene.add.text(-LAYOUT.width / 2 + 152, y - 14, item.definition.name, textStyle({ role: "display", size: 26 })).setOrigin(0, 0.5));
      view.add(this.scene.add.text(-LAYOUT.width / 2 + 152, y + 18, `+${item.amount}  ·  보유 ${owned}`, textStyle({ role: "body", size: 20, color: COLOR.inkDim })).setOrigin(0, 0.5));
      const use = new Button(this.scene, LAYOUT.width / 2 - 130, y, {
        width: 132, height: 64, label: "사용", fontSize: 24, variant: "primary",
        onClick: () => this.use(source.itemId),
      }).setEnabled(owned > 0 && !full && !this.pending);
      view.add(use);
    });
    view.add(drawHairline(this.scene, 0, LAYOUT.usesY - 44, LAYOUT.width - 96, { color: COLOR.accent, alpha: 0.32 }));
  }

  /** 차감과 회복 확정은 서버가 한 처리 단위로 맡고, 화면은 그 결과만 다시 읽는다. */
  private use(itemId: string): void {
    if (this.pending) return;
    this.pending = true;
    void this.inventory.useConsumable(this.api, itemId).finally(() => { this.pending = false; });
  }
}

/** 사용처만 안내표에서 그대로 읽는다. 획득처는 위의 충전 줄이 눌러서 쓰는 형태로 이미 말한다. */
function guideRows(): readonly string[] { return currencyGuide("stamina").uses; }
