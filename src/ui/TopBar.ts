import Phaser from "phaser";
import { BASE_WIDTH } from "../config/gameConfig";
import { setDebugProgress } from "../debug";
import { session } from "../state/session";
import { drawGlyph } from "./glyphs";
import { formatCurrency } from "../core/formatCurrency";
import type { CurrencyIconKey } from "./currencyIcons";
import { chipPoints, drawGlassFade, drawHairline, drawLayer, drawRoundedLayer, HOLO } from "./holo";
import { COLOR, textStyle } from "./theme";

/**
 * 화면 위쪽 줄. 렐릭 · 로비 · 연구소 어디서든 같은 자리에 같은 모양으로 뜬다.
 *
 * 왼쪽은 플레이어 자신(프로필), 오른쪽은 가진 것(재화)과 설정이다. 판때기를 깔지 않고
 * 위에서 아래로 옅어지는 유리면만 둬서 배경 원화가 끊기지 않게 한다.
 */
/** 상단 줄에 세우는 재화 한 칸. 아이콘과 지갑에서 읽을 값을 함께 정한다. */
interface CurrencySlot {
  icon: CurrencyIconKey;
  read: () => number;
  /** 자릿수가 크게 늘어나는 재화만 K·M으로 줄인다. */
  compact?: boolean;
  color?: string;
}

/**
 * 화면별 재화 조합.
 *
 * 로비는 "지금 얼마나 가졌나"(보석·골드·스테미나), 모집은 "무엇으로 뽑을 수 있나"
 * (다이아·화석·호박석)를 묻는다. 화면마다 다른 것을 보여 주되 자리와 생김새는 같다.
 *
 * 도감처럼 **그 화면에서 재화를 쓰지 않는 곳은 아무것도 세우지 않는다**(`none`). 급여에 드는
 * 치즈케이크는 정보창의 급여 버튼이 "가진 수/드는 수"로 직접 말하므로, 위에 또 적으면 같은
 * 값을 두 곳에서 읽게 되고 정작 봐야 할 카드 그리드의 자리만 좁아진다.
 */
export type TopBarCurrencyContext = "default" | "recruit" | "none";

const SLOTS: Record<TopBarCurrencyContext, readonly CurrencySlot[]> = {
  default: [
    { icon: "currency-gems", read: () => session.wallet.gems, color: "#cfe6ff" },
    { icon: "currency-gold", read: () => session.wallet.gold, compact: true, color: "#ffdf9a" },
    { icon: "currency-stamina", read: () => session.wallet.stamina, color: "#ffe9a3" },
  ],
  recruit: [
    { icon: "currency-gems", read: () => session.wallet.gems, color: "#cfe6ff" },
    { icon: "currency-fossil", read: () => session.wallet.fossil, compact: true, color: "#e6dcc4" },
    { icon: "currency-amber", read: () => session.wallet.amber, color: "#ffc98a" },
  ],
  none: [],
};

/**
 * 재화 한 칸의 크기와 간격.
 *
 * 셋이 같은 폭이라 값이 늘어도 줄이 흔들리지 않는다. 아이콘은 칸 **안쪽**에 넉넉히 들어가고,
 * 칸 사이도 손가락 하나만큼 띄운다 — 붙여 놓으면 세 재화가 한 덩어리로 읽힌다.
 */
const SLOT = { width: 196, height: 74, icon: 62, gap: 24 } as const;

/**
 * 재화 줄이 놓이는 가로 자리(화면 폭 대비).
 *
 * 가운데에 두되 왼쪽 프로필과 오른쪽 설정을 피해 아주 조금 오른쪽으로 민다. 정확히 절반에
 * 두면 프로필의 이름줄과 부딪힌다.
 */
const CLUSTER_CENTER = 0.57;

export class TopBar {
  private readonly slots: { slot: CurrencySlot; text: Phaser.GameObjects.Text }[] = [];

  constructor(scene: Phaser.Scene, y = 40, options: { onSettings?: () => void; currencies?: TopBarCurrencyContext } = {}) {
    drawGlassFade(scene, BASE_WIDTH / 2, y + 30, BASE_WIDTH, 150, { topAlpha: 0.92, bottomAlpha: 0 });
    drawHairline(scene, BASE_WIDTH / 2, y + 96, BASE_WIDTH, { color: COLOR.accent, alpha: 0.18 });

    this.buildProfile(scene, 28, y + 4);

    // 재화는 오른쪽에서 왼쪽으로 쌓는다. 설정 아이콘이 오른쪽 끝을 차지하기 때문이다.
    const slots = SLOTS[options.currencies ?? "default"];
    const span = slots.length * SLOT.width + (slots.length - 1) * SLOT.gap;
    const first = BASE_WIDTH * CLUSTER_CENTER - span / 2 + SLOT.width / 2;
    slots.forEach((slot, index) => {
      this.slots.push({ slot, text: this.buildSlot(scene, first + index * (SLOT.width + SLOT.gap), y + 46, slot) });
    });

    // 설정 — 오른쪽 끝. 재화보다 뒤에 두어 손이 먼저 닿지 않게 한다.
    const settings = scene.add.container(BASE_WIDTH - 58, y + 46);
    settings.add(drawGlyph(scene, "settings", 0, 0, 42, 0xc9ccd2));
    const hit = scene.add.rectangle(BASE_WIDTH - 58, y + 46, 84, 84, 0xffffff, 0).setInteractive({ useHandCursor: true });
    hit.on("pointerdown", () => settings.setScale(1.12));
    hit.on("pointerout", () => settings.setScale(1));
    hit.on("pointerup", () => {
      settings.setScale(1);
      options.onSettings?.();
    });

    this.refresh();
  }

  /**
   * 재화 한 칸.
   *
   * 판때기 대신 살짝 기울어진 유리 조각 하나를 깔고, 아이콘은 그 왼쪽 끝을 **밖으로 물고**
   * 앉는다. 아이콘이 칸 안에 갇히면 작아져 무슨 재화인지 알아보기 어렵다.
   */
  private buildSlot(scene: Phaser.Scene, cx: number, cy: number, slot: CurrencySlot): Phaser.GameObjects.Text {
    // 테두리를 두르지 않는다. 옅은 유리 한 겹이면 값이 어디까지인지 충분히 읽힌다. 이 줄만
    // 기울이지 않고 둥근 면을 쓰는 이유는 `drawRoundedLayer`에 적어 두었다.
    drawRoundedLayer(scene, cx, cy, SLOT.width, SLOT.height, { fill: 0x05070a, alpha: 0.46, radius: SLOT.height / 2 });
    // 아이콘은 칸 안쪽에 온전히 들어간다. 잘린 모서리에 걸치면 그림이 반쯤 잘려 보인다.
    const iconX = cx - SLOT.width / 2 + SLOT.icon * 0.56;
    scene.add.image(iconX + 3, cy + 4, slot.icon).setDisplaySize(SLOT.icon, SLOT.icon).setTint(0x05070a).setAlpha(0.55);
    scene.add.image(iconX, cy, slot.icon).setDisplaySize(SLOT.icon, SLOT.icon);
    return scene.add
      .text(cx + SLOT.width / 2 - 20, cy, "", textStyle({ role: "emphasis", size: 28, color: slot.color ?? COLOR.ink }))
      .setOrigin(1, 0.5);
  }

  /** 왼쪽 위 플레이어 칩. 아직 아바타 아트가 없어 이름 머리글자를 넣는다. */
  private buildProfile(scene: Phaser.Scene, x: number, y: number): void {
    const size = 84;
    drawLayer(scene, x + size / 2, y + size / 2, chipPoints(size, size, {
      bevel: { topLeft: size * 0.3, topRight: 0, bottomRight: size * 0.3, bottomLeft: 0 },
    }), { fill: 0x1f2632, alpha: HOLO.glass, edge: COLOR.accent, edgeAlpha: 0.55 });
    scene.add.text(x + size / 2, y + size / 2, "R", textStyle({ role: "display", size: 40, color: COLOR.accentText })).setOrigin(0.5);
    scene.add.text(x + size + 16, y + 14, "연구원", textStyle({ role: "emphasis", size: 26 })).setOrigin(0, 0);
    scene.add
      .text(x + size + 16, y + 48, "LV.1  이터널 시티", textStyle({ role: "body", size: 20, color: COLOR.inkDim }))
      .setOrigin(0, 0);
  }

  refresh(): void {
    for (const { slot, text } of this.slots) {
      const amount = slot.read();
      text.setText(slot.compact ? formatCurrency(amount) : amount.toLocaleString());
    }
    setDebugProgress(session.wallet, session.owned);
  }
}
