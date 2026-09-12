import Phaser from "phaser";
import { t } from "../i18n";
import type { AdPresentationResult, GameApi } from "../api/contracts";
import { completedAdToken } from "../data/adRewards";
import { currencyGuide } from "../data/currencyGuide";
import { STAMINA_RECHARGE_SOURCES, staminaAdSlot, staminaConsumable, type StaminaRechargeSource } from "../data/staminaRecharge";
import { staminaMaxForPlayer } from "../core/stamina";
import { InventoryManager } from "../managers/InventoryManager";
import { managerEvents } from "../managers/ManagerEvents";
import { presentRewardedAd } from "../platform/rewardedAds";
import { session } from "../state/session";
import { Button } from "./Button";
import { CURRENCY_ICON_BY_WALLET } from "./currencyIcons";
import { chipPoints, drawHairline, drawLayer } from "./holo";
import { addFramedIcon } from "./itemFrame";
import { formatCurrency } from "../core/formatCurrency";
import { PopupLayer } from "./PopupLayer";
import { addSectionTitle } from "./SectionTitle";
import { staminaTimerLine } from "./staminaDisplay";
import { heroStack, POPUP_BEVEL_RATIO, staminaPopupLayout } from "./staminaPopupLayout";
import { COLOR, textStyle } from "./theme";

/**
 * 스테미나 전용 창.
 *
 * 다른 재화는 "무엇으로 얻고 어디에 쓰는가"만 읽으면 되지만(`CurrencyGuidePopup`), 스테미나는
 * **지금 얼마나 남았고 언제 차는지, 지금 채울 수 있는지**가 곧 다음 조작을 정한다. 그래서 상단
 * 줄의 칸에는 현재·최대만 두고 나머지는 이 창이 맡는다 — 작은 칸에 시간까지 밀어 넣으면 글자가
 * 칸을 넘고, 정작 자주 보는 두 수가 작아진다.
 *
 * 창 안의 판과 칸은 **팝업 몸판과 같은 모양 규칙**(`chipPoints`, 같은 비율의 모서리 깎임)을 쓴다.
 * 다른 도형(네모·`slantedRect`)을 섞으면 몸판의 깎인 왼쪽 위 모서리를 넘어 밖으로 삐져나오고,
 * 창 하나 안에서 두 종류의 판때기가 보인다.
 */
// 아래 두 구역은 나란히 서므로 창 높이는 **둘 중 긴 쪽**이 정한다.
const LAYOUT = staminaPopupLayout(Math.max(currencyGuide("stamina").uses.length, currencyGuide("stamina").sources.length));

/** 현재 값과 상한은 상단 줄과 같은 노란색 한 덩어리다. 시간만 얇은 회색으로 물러난다. */
const TONE = { value: "#ffe9a3", timer: COLOR.inkDim } as const;

/** 칸 하나가 세우는 조각들의 자리. 세 칸이 같은 값을 쓰므로 여기 한 곳에만 둔다. */
/**
 * 칸 한 장의 자리표.
 *
 * **충전 칸에서 가장 먼저 읽어야 하는 것은 이름이 아니라 "얼마나 차는가"다.** 예전에는 회복량이
 * 흐린 19px 한 줄에 보유 수와 함께 묻혀 있어, 세 수단을 비교하려면 글씨를 들여다봐야 했다.
 * 이제 액자를 키우고 그 아래에 `+30`을 크게 세우며, 가진 수는 가방 칸과 같은 양식으로 **액자
 * 우하단**에 겹친다 — 같은 "얼마나 가졌나"가 화면마다 다른 자리에 서지 않게 한다.
 */
const CELL = { frameY: -84, frameSize: 108, gainY: 6, nameY: 48, detailY: 82, buttonY: 112, buttonHeight: 62, padX: 14 } as const;

export class StaminaPopup {
  private readonly inventory = new InventoryManager(session);
  private pending = false;
  private message = "";
  private repaint: (() => void) | undefined;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly popups: PopupLayer,
    private readonly api: GameApi,
    /** 광고 표시는 플랫폼 다리를 통과한다. SDK가 없으면 성공을 흉내 내지 않고 실패로 돌아온다. */
    private readonly presentAd: (slotId: string) => Promise<AdPresentationResult> = presentRewardedAd,
  ) {}

  open(): void {
    const guide = currencyGuide("stamina");
    this.popups.open({ width: LAYOUT.width, height: LAYOUT.height, title: guide.name, dim: true, dimAlpha: 0.34 }, (body) => {
      const view = this.scene.add.container(0, 0);
      body.add(view);
      const render = (): void => { view.removeAll(true); this.paint(view); };
      this.repaint = render;
      render();
      // 회복 시간은 1초마다 다시 그리고, 창이 닫히면 타이머와 구독을 함께 놓는다.
      const timer = this.scene.time.addEvent({ delay: 1_000, loop: true, callback: render });
      const unsubscribe = managerEvents.subscribe("wallet", render);
      view.once(Phaser.GameObjects.Events.DESTROY, () => { timer.remove(); unsubscribe(); this.repaint = undefined; });
    });
  }

  /** 액자 → 수치 → 시간 → 충전 → 사용처 순서로 한 번에 그린다. */
  private paint(view: Phaser.GameObjects.Container): void {
    const amount = session.wallet.stamina;
    const maximum = staminaMaxForPlayer(session);
    const full = amount >= maximum;
    const timer = staminaTimerLine(amount, maximum, session.staminaUpdatedAt, Date.now());

    // 전용 판: 이 창에서 가장 먼저 읽어야 하는 "지금 얼마 남았나"를 그림과 수 한 덩어리로 모은다.
    view.add(drawLayer(this.scene, 0, LAYOUT.hero.y, panelShape(LAYOUT.hero.width, LAYOUT.hero.height), { fill: 0x101720, alpha: 0.9, edge: COLOR.accent, edgeAlpha: 0.35 }));
    // 시간 줄이 없는 순간(가득 참)에도 남은 둘이 위로 쏠리지 않도록 덩어리째 가운데에 세운다.
    const stack = heroStack(LAYOUT.hero.y, timer !== undefined);
    addFramedIcon(this.scene, view, 0, stack.frameY, LAYOUT.frameSize, CURRENCY_ICON_BY_WALLET.stamina);
    view.add(this.scene.add.text(0, stack.valueY, `${amount.toLocaleString()} / ${maximum.toLocaleString()}`, textStyle({ role: "display", size: 52, color: TONE.value })).setOrigin(0.5).setShadow(2, 6, "#05070a", 7, false, true));
    if (timer && stack.timerY !== undefined) view.add(this.scene.add.text(0, stack.timerY, timer, textStyle({ role: "body", size: 22, color: TONE.timer })).setOrigin(0.5));

    this.paintRecharge(view, full);

    // 창이 커진 만큼 아래를 비워 두지 않는다. 다른 재화 안내창과 같은 두 구역(획득처·사용처)을
    // 같은 순서로 세워, 스테미나만 다른 화면에서 온 것처럼 보이지 않게 한다.
    const guide = currencyGuide("stamina");
    view.add(drawHairline(this.scene, 0, LAYOUT.hairlineY, LAYOUT.hero.width, { color: COLOR.accent, alpha: 0.32 }));
    const half = LAYOUT.hero.width / 2;
    view.add(addSectionTitle(this.scene, -half, LAYOUT.usesTitleY, t("stamina.sources"), { size: 24 }));
    guide.sources.forEach((row, index) => {
      view.add(this.scene.add.text(-half + 14, LAYOUT.usesFirstRowY + index * LAYOUT.usesRowHeight, `◆  ${row}`, textStyle({ role: "body", size: 22, color: COLOR.ink })).setOrigin(0, 0.5));
    });
    view.add(addSectionTitle(this.scene, 12, LAYOUT.usesTitleY, t("stamina.uses"), { size: 24 }));
    guide.uses.forEach((row, index) => {
      view.add(this.scene.add.text(26, LAYOUT.usesFirstRowY + index * LAYOUT.usesRowHeight, `◆  ${row}`, textStyle({ role: "body", size: 22, color: COLOR.ink })).setOrigin(0, 0.5));
    });
  }

  /**
   * 지금 채울 수 있는 세 수단.
   *
   * 표(`STAMINA_RECHARGE_SOURCES`)에 있는 것만, **같은 폭·같은 높이의 칸으로 나란히** 세운다 —
   * 가진 것을 쓰는 토닉, 값을 치르는 다이아, 시간을 치르는 광고는 서로 대체재라 어느 하나를
   * 더 크게 세우면 값을 비교하기 전에 크기가 먼저 답을 정해 버린다.
   */
  private paintRecharge(view: Phaser.GameObjects.Container, full: boolean): void {
    view.add(addSectionTitle(this.scene, -LAYOUT.hero.width / 2, LAYOUT.rechargeTitleY, t("stamina.recharge"), { size: 24 }));
    STAMINA_RECHARGE_SOURCES.forEach((source, index) => {
      const x = LAYOUT.cell.centers[index];
      if (x === undefined) return;
      view.add(this.paintCell(source, x, full));
    });
    if (this.message) {
      view.add(this.scene.add.text(0, LAYOUT.cell.y + LAYOUT.cell.height / 2 + 20, this.message, textStyle({ role: "body", size: 19, color: COLOR.inkDim })).setOrigin(0.5));
    }
  }

  /** 칸 한 장. 그림·이름·값 한 줄·버튼 하나가 세 수단 모두 같은 자리에 선다. */
  private paintCell(source: StaminaRechargeSource, x: number, full: boolean): Phaser.GameObjects.Container {
    const cell = this.scene.add.container(x, LAYOUT.cell.y);
    const { width, height } = LAYOUT.cell;
    cell.add(drawLayer(this.scene, 0, 0, panelShape(width, height), { fill: 0x141a22, alpha: 0.94, edge: COLOR.accent, edgeAlpha: 0.28 }));
    
    const view = this.cellContent(source, full);
    // 액자·그림·가진 수는 가방 칸·보상 액자와 같은 공용 프리팹 한 장이 그린다.
    if (view.texture) {
      addFramedIcon(this.scene, cell, 0, CELL.frameY, CELL.frameSize, view.texture, {
        amount: view.owned === undefined ? undefined : formatCurrency(view.owned),
      });
    }
    // 회복량은 이 칸의 이유다. 이름보다 크게, 스테미나와 같은 색으로 세운다.
    cell.add(this.scene.add.text(0, CELL.gainY, `+${view.gain}`, textStyle({ role: "display", size: 40, color: TONE.value }))
      .setOrigin(0.5).setShadow(0, 3, "#05070a", 4, false, true));
    cell.add(this.scene.add.text(0, CELL.nameY, view.name, textStyle({ role: "emphasis", size: 22 })).setOrigin(0.5));
    if (view.detail) cell.add(this.scene.add.text(0, CELL.detailY, view.detail, textStyle({ role: "body", size: 19, color: COLOR.inkDim })).setOrigin(0.5));
    const button = new Button(this.scene, 0, CELL.buttonY, {
      width: width - CELL.padX * 2, height: CELL.buttonHeight, label: view.label, fontSize: 24, variant: "primary",
      cost: view.cost, onClick: () => { void this.run(source); },
    }).setEnabled(view.enabled && !full && !this.pending);
    cell.add(button);
    return cell;
  }

  /** 세 수단이 화면에 세울 값. 회복량·값·남은 횟수는 전부 데이터에서 읽고 여기서 지어내지 않는다. */
  private cellContent(source: StaminaRechargeSource, full: boolean): {
    texture?: string; name: string; gain: number; detail: string; label: string; enabled: boolean;
    /** 액자 우하단에 겹칠 보유 수. 광고처럼 가진 것이 없는 수단은 비운다. */
    owned?: number;
    cost?: { icon: "currency-gems"; amount: number; affordable: boolean };
  } {
    if (source.kind === "consumable") {
      const item = staminaConsumable(source.itemId);
      const owned = session.itemInventory.find(({ itemId }) => itemId === source.itemId)?.quantity ?? 0;
      return {
        texture: `item-${source.itemId}`,
        name: item?.definition.name ?? "",
        gain: item?.amount ?? 0,
        detail: "",
        owned,
        label: t("stamina.spend"),
        enabled: item !== undefined && owned > 0,
      };
    }
    if (source.kind === "currency") {
      const held = session.wallet[source.currency];
      return {
        texture: CURRENCY_ICON_BY_WALLET[source.currency],
        name: source.name,
        gain: source.amount,
        detail: "",
        owned: held,
        label: t("stamina.recharge"),
        enabled: held >= source.cost,
        cost: { icon: "currency-gems", amount: source.cost, affordable: held >= source.cost },
      };
    }
    const ad = staminaAdSlot(source.slotId);
    const used = session.dailyAdRewards.claimsBySlot[source.slotId] ?? 0;
    const limit = ad?.slot.dailyLimitUtc ?? 0;
    return {
      texture: CURRENCY_ICON_BY_WALLET.stamina,
      name: source.name,
      gain: ad?.amount ?? 0,
      // 남은 횟수는 다음에 누를 수 있는지를 정하므로 이름 아래 한 줄로 남긴다.
      detail: t("stamina.adRemaining", { left: Math.max(0, limit - used), limit }),
      label: t("stamina.watchAd"),
      enabled: ad !== undefined && used < limit && !full,
    };
  }

  /** 어느 칸을 눌러도 차감과 회복 확정은 서버가 한 처리 단위로 맡고, 화면은 그 결과만 다시 읽는다. */
  private async run(source: StaminaRechargeSource): Promise<void> {
    if (this.pending) return;
    this.pending = true; this.message = ""; this.repaint?.();
    try {
      if (source.kind === "consumable") await this.inventory.useConsumable(this.api, source.itemId);
      else if (source.kind === "currency") await this.inventory.rechargeStamina(this.api, source.id);
      else await this.watchAd(source.slotId);
    } catch {
      this.message = t("stamina.rechargeFailed");
    } finally {
      this.pending = false; this.repaint?.();
    }
  }

  /** 취소·SDK 미준비는 성공을 흉내 내지 않고, 다른 두 수단은 그대로 남긴다. */
  private async watchAd(slotId: string): Promise<void> {
    const verificationToken = completedAdToken(await this.presentAd(slotId));
    if (!verificationToken) { this.message = t("stamina.adCancelled"); return; }
    await this.inventory.claimAdReward(this.api, { slotId, verificationToken, requestId: adRequestId() });
  }
}

/** 팝업 몸판과 같은 비율로 깎은 판. 창 안의 모든 판과 칸이 이 한 함수를 쓴다. */
function panelShape(width: number, height: number): number[] {
  const unit = Math.min(width, height) * POPUP_BEVEL_RATIO;
  return chipPoints(width, height, { bevel: { topLeft: unit, topRight: 0, bottomRight: unit, bottomLeft: 0 } });
}

/** 재전송으로 같은 광고 보상이 두 번 확정되지 않게 한다. */
function adRequestId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `stamina-ad-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
