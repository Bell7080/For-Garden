/**
 * 상단 줄의 재화 슬롯.
 *
 * **Phaser 없는 순수 모듈에 둔다** — 어느 화면이 어느 재화를 세우는지는 눈으로 확인할 수
 * 없는 값이라, 화면과 회귀 테스트가 같은 표를 읽어야 지켜진다(`BACK_SLOT`과 같은 이유).
 *
 * 읽는 법은 적지 않는다. 키가 곧 지갑 칸이라 `session.wallet[key]` 하나뿐이고, 슬롯마다
 * 클로저를 적어 두면 키와 읽는 칸이 어긋난 줄이 조용히 생긴다.
 */
import type { CurrencyIconKey } from "./currencyIcons";
import type { WalletItemKey } from "../data/items";

export interface CurrencySlot {
  key: WalletItemKey;
  icon: CurrencyIconKey;
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
export type TopBarCurrencyContext = "default" | "recruit" | "none" | "archaeology" | "loot";

const SLOTS: Record<TopBarCurrencyContext, readonly CurrencySlot[]> = {
  default: [
    { key: "gems", icon: "currency-gems", color: "#cfe6ff" },
    { key: "gold", icon: "currency-gold", compact: true, color: "#ffdf9a" },
    { key: "stamina", icon: "currency-stamina", color: "#ffe9a3" },
  ],
  recruit: [
    { key: "gems", icon: "currency-gems", color: "#cfe6ff" },
    { key: "fossil", icon: "currency-fossil", compact: true, color: "#e6dcc4" },
    { key: "amber", icon: "currency-amber", color: "#ffc98a" },
  ],
  // 고고학은 제 경제를 갖는다 — 원석이 첫 칸에 서고, 탐사가 함께 캐내는 화석과
  // 늘 쓰는 골드가 뒤를 잇는다. 스테미나는 이 화면의 조작을 정하지 않으므로 세우지 않는다.
  archaeology: [
    { key: "rawStone", icon: "currency-orestone", compact: true, color: "#a9d8e8" },
    { key: "fossil", icon: "currency-fossil", compact: true, color: "#e6dcc4" },
    { key: "gold", icon: "currency-gold", compact: true, color: "#ffdf9a" },
  ],
  /**
   * 전리품 상점.
   *
   * **증표 둘만 세운다.** 지갑 재화라고 늘 보이는 것이 아니라는 것이 이 표의 뜻이다 —
   * 로비·도감에 세우면 평소 조작을 바꾸지 않는 수가 두 칸을 먹고, 정작 자주 보는 젬·골드·
   * 스테미나가 밀린다. 증표가 조작을 정하는 자리는 이 상점과 그 콘텐츠뿐이다.
   */
  loot: [
    { key: "raidSigil", icon: "currency-raid-sigil", compact: true, color: "#ffc98a" },
    { key: "salvageRecord", icon: "currency-salvage-record", compact: true, color: "#9fd0f0" },
  ],
  none: [],
};

export const TOP_BAR_SLOTS = SLOTS;

/** 자리별로 세우는 재화 키만 뽑는다. 무엇이 어디에 서는지를 테스트가 이 값으로 잰다. */
export const TOP_BAR_SLOT_KEYS: Record<TopBarCurrencyContext, readonly WalletItemKey[]> = {
  default: SLOTS.default.map(({ key }) => key),
  recruit: SLOTS.recruit.map(({ key }) => key),
  archaeology: SLOTS.archaeology.map(({ key }) => key),
  loot: SLOTS.loot.map(({ key }) => key),
  none: SLOTS.none.map(({ key }) => key),
};
