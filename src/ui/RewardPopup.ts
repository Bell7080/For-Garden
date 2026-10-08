import Phaser from "phaser";
import { t } from "../i18n";
import { formatCurrency } from "../core/formatCurrency";
import { setDebugRewardPopup } from "../debug";
import { drawHairline } from "./holo";
import type { PopupLayer } from "./PopupLayer";
import { COLOR, textStyle } from "./theme";
import { BASE_HEIGHT, BASE_WIDTH } from "../config/gameConfig";
import { drawGlyph } from "./glyphs";
import { FaceFrame } from "./FaceFrame";
import { RARITY_TONE } from "./rarityMark";
import { getRelic } from "../data/relics";
import type { RewardPopupItem } from "./rewardPopupModel";
import { sortRewardItems } from "./rewardOrder";
import { addFramedIcon, hasGuideOpeners } from "./itemFrame";
import { bindCurrencyGuide } from "./currencyGuideEntry";
import { addRuneFrame } from "./runeIcons";
import { openRuneInfoPopup } from "./RunePopup";
import { runePartOfTexture } from "./runePieceContent";
import { REWARD_POPUP_GRID, rewardGridLayout } from "./rewardPopupLayout";
import { pressIn, pressOut } from "./pressFeedback";
import { motionPolicy } from "../core/settings";
import { settingsManager } from "../managers/SettingsManager";
import { session } from "../state/session";
import type { PlayerExpReceipt } from "../core/playerLevel";
import { addPlayerExpGainRow } from "./PlayerExpGainRow";
import { PLAYER_EXP_ROW } from "./playerExpLayout";
import { guardInputAfterClose } from "./closeInputGuard";

// 기존 호출부는 UI 진입점 하나만 알면 되도록 순수 표시 변환도 함께 다시 내보낸다.
export { currencyRecordToRewardItems, productGrantsToRewardItems, type RewardPopupItem } from "./rewardPopupModel";

/** 상자 개봉·임무 수령·발굴 수확이 공유할 수 있는 한 개의 확정 보상 표기다. */
export interface RewardPopupOptions {
  title?: string;
  /** 결과의 중요도에 따라 공용 26px 제목보다 한 단계 크게 요청할 수 있다. */
  titleSize?: number;
  /** 뒤 화면을 누르는 암전 강도. 기본은 원래 화면의 맥락이 남는 은은한 검정이다. */
  dimAlpha?: number;
  items: readonly RewardPopupItem[];
  /**
   * 판 **밖 아래**에 서는 한 줄.
   *
   * 재화가 아니라 **이번 결과로 얼마나 올랐는가**를 말하는 자리다(원정 노드의 점수 증가분).
   * 액자로 세우면 지갑에 들어온 재화처럼 읽히고, 판 안에 넣으면 좁은 영수증이 더 좁아진다.
   * 판이 낮아 아래에 빈 자리가 남으므로 거기에 글자만 세운다.
   */
  footnote?: string;
  /**
   * 이 결과를 만든 스테미나가 올린 연구원 경험치(소탕). 주면 판 **머리**에 결과판과 같은 경험치
   * 블록(`PlayerExpGainRow`)이 서고, 판은 그만큼 위로 자란다.
   */
  playerExp?: PlayerExpReceipt;
  onConfirm?: () => void;
}

/** 한 줄 4칸을 담는 판 폭과 액자 크기. 줄 수에서 높이를 구하는 일은 `rewardGridLayout`이 맡는다. */
const REWARD_POPUP = { width: REWARD_POPUP_GRID.width, frame: REWARD_POPUP_GRID.frame, expGap: 40 } as const;

const RUNE_ICON_PATTERN = /^rune-(uncommon|rare|epic|legendary)-[012]$/;

/**
 * 서버에서 이미 지급이 확정된 결과를 짧게 확인시키는 공용 팝업이다.
 *
 * 진행을 막는 선택지가 아니라 영수증에 가까우므로 바깥·본문·안내 문구 어디를 눌러도 닫힌다.
 * 호출자는 지급 계산을 넘기지 않고, 확정된 아이콘과 수량만 전달한다. **액자는 하나도 빠짐없이
 * 눌린다** — 영수증 안의 재화·아이템·룬·장식은 무엇이든 눌러서 안내(또는 쪽지)가 열린다. 바깥을
 * 누르면 닫히는 팝업이라, 액자를 눌렀다는 것은 궁금해서 보고 싶다는 뜻이다.
 *
 * 칸이 많으면 가로로 밀지 않고 **줄이 아래로 늘어나며 촤르륵 쌓인다**(`rewardGridLayout`).
 */
export function openRewardPopup(scene: Phaser.Scene, popups: PopupLayer, options: RewardPopupOptions): void {
  const items = sortRewardItems(options.items.filter((item) => item.amount > 0));
  if (items.length === 0) {
    options.onConfirm?.();
    return;
  }
  // 안내창을 아직 잇지 않은 화면에서도 영수증의 액자는 같은 창을 연다.
  if (!hasGuideOpeners(scene)) bindCurrencyGuide({ scene, popups });

  const layout = rewardGridLayout(items.length);
  // 경험치 블록이 서면 판이 그만큼 위로 자라고, 영수증 줄은 판 아래쪽에 그대로 남는다.
  const expRoom = options.playerExp ? PLAYER_EXP_ROW.height + REWARD_POPUP.expGap : 0;
  const height = layout.height + expRoom;
  const shift = expRoom / 2;
  // 확인 입력점은 마지막 줄 **아래**다 — 액자 위를 누르면 그 액자의 안내창이 열린다.
  setDebugRewardPopup(true, items.length, { x: BASE_WIDTH / 2, y: BASE_HEIGHT / 2 + 140 + shift + layout.growHalf });
  // 확인 안내는 팝업 안이 아니라 화면 하단에 둔다. "어디를 눌러도 넘어간다"는 말은 팝업 밖의 말이다.
  let hint: Phaser.GameObjects.Text | undefined;
  popups.open({
    width: REWARD_POPUP.width,
    height,
    title: options.title ?? t("reward.title"),
    titleSize: options.titleSize,
    // 영수증은 원래 화면의 맥락을 남기되, 아래 작업판보다 높은 층에서 불필요한 돌아가기를 가린다.
    dim: true,
    dimAlpha: options.dimAlpha ?? 0.46,
    // 영수증이므로 팝업 안이든 밖이든 화면 아무 곳이나 누르면 닫힌다.
    closeOnBackdrop: true,
    // 화면 어디를 눌러도 닫히므로 오른쪽 위 X는 중복 조작이다.
    hideCloseButton: true,
    onClose: () => {
      hint?.destroy();
      setDebugRewardPopup(false);
      // 연타하던 손이 닫히자마자 뒤 화면을 누르지 않게 잠깐 막는다.
      guardInputAfterClose(scene);
      options.onConfirm?.();
    },
  }, (body, close) => {
    // 로비가 별도로 만든 우하단 뒤로가기(depth 2100)도 보상 확인 중에는 보이거나 눌리지 않는다.
    body.parentContainer?.setDepth(4000);
    if (options.playerExp) {
      // 블록의 레벨 판 위끝이 판 윗변(제목표) 아래로 한 뼘 내려서게 둔다.
      const blockY = -height / 2 + 64 + (PLAYER_EXP_ROW.badge.height / 2 - PLAYER_EXP_ROW.badge.y);
      addPlayerExpGainRow(scene, body, blockY, options.playerExp);
    }
    const reduced = motionPolicy(settingsManager.get()).nonEssentialRepeatFactor === 0;
    const strip = scene.add.container(0, shift);
    items.forEach((item, index) => {
      const cell = layout.cells[index]!;
      const holder = scene.add.container(cell.x, cell.y);
      strip.add(holder);
      addRewardCell(scene, popups, holder, item);
      if (item.label) strip.add(scene.add.text(cell.x, cell.labelY, item.label, textStyle({ role: "body", size: 18, color: COLOR.inkDim })).setOrigin(0.5));
      if (reduced) return;
      // 위에서 아래로, 줄 순서대로 떨어지듯 쌓인다. 첫 박자는 트윈의 `delay`가 기다린다(씬 시계가 아니다).
      const delay = index * REWARD_POPUP_GRID.staggerMs;
      holder.setAlpha(0).setY(cell.y - 46);
      scene.tweens.add({ targets: holder, alpha: 1, y: cell.y, duration: 260, delay, ease: "Back.Out" });
    });
    body.add(strip);

    body.add(drawHairline(scene, 0, 108 + shift + layout.growHalf, 700, { color: COLOR.accent, alpha: 0.3 }));
    if (options.footnote) {
      body.add(scene.add.text(0, height / 2 + 54, options.footnote, textStyle({ role: "display", size: 38, color: COLOR.sortieText }))
        .setOrigin(0.5)
        .setShadow(0, 4, "#000000", 6, false, true));
    }
    // 팝업 판이 아니라 화면 밑동에 반투명한 굵은 글자로 남겨, 누를 수 있는 곳이 화면 전체임을 알린다.
    hint = scene.add
      .text(scene.scale.width / 2, scene.scale.height - 130, t("reward.tapHint"), textStyle({ role: "emphasis", size: 30, color: COLOR.ink }))
      .setOrigin(0.5)
      .setAlpha(0.62)
      .setDepth(4000);
    hint.setShadow(0, 3, "#000000", 4, false, true);

    // 닫는 판은 **맨 아래**에 깐다 — 위에 덮으면 액자가 손을 받지 못해 눌러 볼 수 없다.
    const hit = scene.add.rectangle(0, 20 + layout.growHalf, REWARD_POPUP.width, height - 80, 0xffffff, 0).setInteractive({ useHandCursor: true });
    hit.on("pointerup", () => close());
    body.addAt(hit, 0);
  });
}

/** 영수증 칸 하나 — 액자와 그것을 눌렀을 때 열리는 안내까지 한 곳에서 잇는다. */
function addRewardCell(scene: Phaser.Scene, popups: PopupLayer, holder: Phaser.GameObjects.Container, item: RewardPopupItem): void {
  const size = REWARD_POPUP.frame;
  if (item.relicId) {
    // 파편은 그 개체의 얼굴을 꽉 채운 유리 액자다 — 연구 결과판의 중복 파편과 같은 한 장이다.
    const def = getRelic(item.relicId);
    holder.add(new FaceFrame(scene, 0, 0, { portraitAssetId: def.portraitAssetId, size, color: RARITY_TONE[def.rarity].chip, gem: RARITY_TONE[def.rarity].chip, amount: formatCurrency(item.amount) }));
    return;
  }
  const texture = typeof item.icon === "string" ? item.icon : "";
  const runeMatch = RUNE_ICON_PATTERN.exec(texture);
  const part = runePartOfTexture(texture);
  if (runeMatch && part !== undefined) {
    // 룬은 가방·전리품과 같은 룬 액자다. 등급색 테두리와 주 옵션 뒷배경이 함께 선다.
    const rune = item.runeInstanceId ? session.runeInventory.find(({ instanceId }) => instanceId === item.runeInstanceId) : undefined;
    const rarity = (rune?.rarity ?? runeMatch[1]) as NonNullable<typeof rune>["rarity"];
    const frame = addRuneFrame(scene, 0, 0, size, rarity, rune?.part ?? part, rune ? { mainStats: rune.mainStats, engraved: rune.engravings.length > 0 } : {});
    holder.add(frame);
    if (rune) addPressOpen(scene, holder, size, () => openRuneInfoPopup(scene, popups, { runeInstanceId: rune.instanceId }));
    return;
  }
  // 액자·그림·그늘·수량은 어디서나 같은 공용 프리팹 한 장이 그린다. 증가량인 것은 창 제목이
  // 이미 말하므로 `+`를 붙이지 않는다. 재화·아이템 그림은 이 프리팹이 안내창까지 잇는다.
  const framed = addFramedIcon(scene, holder, 0, 0, size, texture, { amount: formatCurrency(item.amount) });
  // 계정 장식처럼 전용 텍스처가 없는 결과만 기존 홀로그램 글리프 체계로 대신하고, 이름 쪽지를 연다.
  if (typeof item.icon !== "string") {
    framed.addAt(drawGlyph(scene, item.icon.key, 0, 0, size * 0.56, COLOR.accent), 1);
    addPressOpen(scene, holder, size, () => openPlainNote(scene, popups, item));
  }
}

function addPressOpen(scene: Phaser.Scene, holder: Phaser.GameObjects.Container, size: number, open: () => void): void {
  const hit = scene.add.rectangle(0, 0, size, size, 0xffffff, 0).setInteractive({ useHandCursor: true });
  hit.on("pointerdown", () => pressIn(holder));
  hit.on("pointerout", () => pressOut(holder, "normal", { pop: false }));
  hit.on("pointerup", () => { pressOut(holder); open(); });
  holder.add(hit);
}

/** 전용 안내창이 없는 보상(장식 등)은 이름과 수량만 읽히는 작은 쪽지를 연다. */
function openPlainNote(scene: Phaser.Scene, popups: PopupLayer, item: RewardPopupItem): void {
  popups.open({ width: 620, height: 300, title: item.label ?? t("reward.title"), closeOnBackdrop: true }, (body) => {
    body.add(scene.add.text(0, 10, `×${formatCurrency(item.amount)}`, textStyle({ role: "display", size: 56, color: COLOR.accentText })).setOrigin(0.5));
  });
}
