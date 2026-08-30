import Phaser from "phaser";
import { BASE_WIDTH } from "../config/gameConfig";
import { setDebugProgress } from "../debug";
import { session } from "../state/session";
import { drawGlyph } from "./glyphs";
import { formatCurrency } from "../core/formatCurrency";
import type { CurrencyIconKey } from "./currencyIcons";
import { chipPoints, drawGlassFade, drawHairline, drawLayer, HoloBar, HOLO } from "./holo";
import { addCurrencyChip, CURRENCY_CHIP } from "./CurrencyChip";
import { COLOR, textStyle } from "./theme";
import { playerProfileDisplay, profileAvatarContent, type PlayerProfileDisplay } from "../state/playerProfile";
import { managerEvents } from "../managers/ManagerEvents";
import { compactTopBarName, TOP_BAR_LAYOUT } from "./topBarLayout";

/** 상단 줄에는 공개 표시 모델과 공개 동작만 들어오며 인증 비밀을 받을 자리가 없다. */
export interface TopBarOptions { onSettings?: () => void; onProfile?: (profile: PlayerProfileDisplay) => void; currencies?: TopBarCurrencyContext; profile?: boolean }

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
 * 셋이 같은 폭이라 값이 늘어도 줄이 흔들리지 않는다. 칸 사이는 손가락 하나만큼 띄운다 —
 * 붙여 놓으면 세 재화가 한 덩어리로 읽힌다. 칸 자체를 그리는 일은 `CurrencyChip`이 맡는다.
 */
const SLOT = CURRENCY_CHIP;

/**
 * 재화 줄이 놓이는 가로 자리(화면 폭 대비).
 *
 * 가운데에 두되 왼쪽 프로필과 오른쪽 설정을 피해 아주 조금 오른쪽으로 민다. 정확히 절반에
 * 두면 프로필의 이름줄과 부딪힌다.
 */
// 1080px에서 세 재화 칸의 왼쪽 끝을 415px에 두어, 최대 390px인 프로필과 25px 안전 간격을
// 확보한다. 프로필을 억지로 줄이지 않고 묶음을 오른쪽으로 옮겨 SLOTS의 세 칸도 그대로 보존한다.
const CLUSTER_CENTER = TOP_BAR_LAYOUT.clusterCenter;

export class TopBar {
  private readonly slots: { slot: CurrencySlot; text: Phaser.GameObjects.Text }[] = [];
  private readonly unsubscribe: (() => void)[] = [];
  private profileName?: Phaser.GameObjects.Text;
  private profileDetail?: Phaser.GameObjects.Text;
  private profileModifier?: Phaser.GameObjects.Text;
  private profileExperience?: HoloBar;
  /** 클릭과 manager 이벤트가 항상 같은 최신 공개 스냅샷을 보도록 TopBar가 모델을 소유한다. */
  private profile?: PlayerProfileDisplay;

  constructor(scene: Phaser.Scene, y = 40, options: TopBarOptions = {}) {
    drawGlassFade(scene, BASE_WIDTH / 2, y + 30, BASE_WIDTH, 150, { topAlpha: 0.92, bottomAlpha: 0 });
    drawHairline(scene, BASE_WIDTH / 2, y + 96, BASE_WIDTH, { color: COLOR.accent, alpha: 0.18 });

    // 프로필은 "지금 나"를 묻는 화면(로비·모집)의 것이다. 목록만 훑는 화면에서는 세우지
    // 않는다 — 볼 일 없는 이름표가 목록 제목과 같은 높이에서 자리를 다툰다.
    if (options.profile !== false) this.buildProfile(scene, 28, y + 4, playerProfileDisplay(session), options.onProfile);

    // 재화는 오른쪽에서 왼쪽으로 쌓는다. 설정 아이콘이 오른쪽 끝을 차지하기 때문이다.
    const slots = SLOTS[options.currencies ?? "default"];
    const span = slots.length * SLOT.width + (slots.length - 1) * SLOT.gap;
    const first = BASE_WIDTH * CLUSTER_CENTER - span / 2 + SLOT.width / 2;
    slots.forEach((slot, index) => {
      this.slots.push({ slot, text: this.buildSlot(scene, first + index * (SLOT.width + SLOT.gap), y + 46, slot) });
    });

    // 설정 — 오른쪽 끝. 콜백이 없는 장면에서는 장식만 남기고 보이지 않는 입력면을 만들지
    // 않는다. 눌러도 반응 없는 아이콘을 인터랙티브 컨트롤처럼 노출하지 않기 위해서다.
    const settings = scene.add.container(BASE_WIDTH - 58, y + 46);
    settings.add(drawGlyph(scene, "settings", 0, 0, 42, 0xc9ccd2));
    if (options.onSettings) {
      const hit = scene.add.rectangle(BASE_WIDTH - 58, y + 46, 84, 84, 0xffffff, 0).setInteractive({ useHandCursor: true });
      hit.on("pointerdown", () => settings.setScale(1.12));
      hit.on("pointerout", () => settings.setScale(1));
      hit.on("pointerup", () => { settings.setScale(1); options.onSettings?.(); });
    } else settings.setAlpha(0.38);

    this.refresh();
    // TopBar는 mutation/API 출처를 구분하지 않고 manager가 확정한 표시 이벤트만 소비한다.
    this.unsubscribe.push(managerEvents.subscribe("wallet", () => this.refresh()));
    this.unsubscribe.push(managerEvents.subscribe("publicProfile", ({ profile }) => this.refreshProfile(profile)));
    // 같은 씬으로 재진입할 때 이전 TopBar가 남지 않도록 shutdown에서 모든 구독을 한 번에 해제한다.
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.destroy());
  }

  /** 명시 호출과 씬 shutdown 모두에서 안전한 구독 정리 경계다. */
  destroy(): void { this.unsubscribe.splice(0).forEach((unsubscribe) => unsubscribe()); }

  /** 재화 한 칸. 생김새는 `CurrencyChip` 한 곳이 정하고 여기서는 자리와 색만 고른다. */
  private buildSlot(scene: Phaser.Scene, cx: number, cy: number, slot: CurrencySlot): Phaser.GameObjects.Text {
    return addCurrencyChip(scene, cx, cy, slot.icon, { color: slot.color });
  }

  /** 왼쪽 위 플레이어 칩. 아바타가 없을 때만 표시 이름 머리글자를 넣는다. */
  private buildProfile(scene: Phaser.Scene, x: number, y: number, profile: PlayerProfileDisplay, onProfile?: (profile: PlayerProfileDisplay) => void): void {
    this.profile = profile;
    const size = 84;
    const chip = scene.add.container(0, 0);
    chip.add(drawLayer(scene, x + size / 2, y + size / 2, chipPoints(size, size, {
      bevel: { topLeft: size * 0.3, topRight: 0, bottomRight: size * 0.3, bottomLeft: 0 },
    }), { fill: 0x1f2632, alpha: HOLO.glass, edge: COLOR.accent, edgeAlpha: 0.55 }));
    const avatar = profileAvatarContent(profile, (key) => scene.textures.exists(key));
    if (avatar.assetKey) chip.add(scene.add.image(x + size / 2, y + size / 2, avatar.assetKey).setDisplaySize(size - 10, size - 10));
    else chip.add(scene.add.text(x + size / 2, y + size / 2, avatar.fallback, textStyle({ role: "display", size: 40, color: COLOR.accentText })).setOrigin(0.5));
    const contentLeft = x + size + TOP_BAR_LAYOUT.profile.contentGap;
    const contentRight = TOP_BAR_LAYOUT.profile.maxRight;
    // 첫 줄은 요청된 이름과 레벨만 양끝에 맞춘다. 공개 ID는 상세 팝업에서만 보여 정보 위계를 지킨다.
    this.profileName = scene.add.text(contentLeft, y + 11, compactTopBarName(profile.displayName), textStyle({ role: "emphasis", size: 24 })).setOrigin(0, 0);
    this.profileDetail = scene.add.text(contentRight, y + 13, `LV.${profile.level}`, textStyle({ role: "body", size: 18, color: COLOR.inkDim })).setOrigin(1, 0);
    // 가장자리 바에 별도 배경 판을 더하지 않고 공용 HoloBar의 얇은 홈과 채움만 둔다.
    this.profileExperience = new HoloBar(scene, (contentLeft + contentRight) / 2, y + 51, contentRight - contentLeft, 9, { color: COLOR.accent, trackAlpha: 0.62 }).addTo(chip);
    this.profileModifier = scene.add.text(contentLeft, y + 63, "", textStyle({ role: "body", size: 16, color: COLOR.accentText })).setOrigin(0, 0);
    chip.add([this.profileName, this.profileDetail, this.profileModifier]);
    this.refreshProfile(profile);
    if (onProfile) {
      // 얼굴과 두 텍스트를 하나의 넓은 입력면으로 묶고 기존 홀로그램 규칙대로 눌렀을 때 확대한다.
      const hit = scene.add.rectangle(176, y + size / 2, 344, 96, 0xffffff, 0).setInteractive({ useHandCursor: true });
      hit.on("pointerdown", () => chip.setScale(1.07));
      hit.on("pointerout", () => chip.setScale(1));
      // 생성 시 profile 인자를 캡처하지 않고 이벤트로 교체된 최신 멤버 모델을 넘긴다.
      hit.on("pointerup", () => { chip.setScale(1); if (this.profile) onProfile(this.profile); });
      chip.add(hit);
    }
  }

  refresh(): void {
    for (const { slot, text } of this.slots) {
      const amount = slot.read();
      text.setText(slot.compact ? formatCurrency(amount) : amount.toLocaleString());
    }
    setDebugProgress(session.wallet, session.owned);
  }

  /** 공개 이벤트 한 번으로 최신 모델과 상단의 이름·레벨·경험치·대표 수식어를 함께 교체한다. */
  private refreshProfile(profile: PlayerProfileDisplay): void {
    this.profile = profile;
    this.profileName?.setText(compactTopBarName(profile.displayName));
    this.profileDetail?.setText(`LV.${Math.max(1, profile.level).toLocaleString()}`);
    this.profileExperience?.setValue(profile.experience / Math.max(1, profile.experienceToNext));
    // 상단에는 대표 하나만 노출하고 전체 장착 목록은 PlayerProfilePopup에 남겨 재화와 충돌하지 않는다.
    this.profileModifier?.setText(profile.equippedModifiers[0] ? `〈${profile.equippedModifiers[0].displayName}〉` : "");
  }
}
