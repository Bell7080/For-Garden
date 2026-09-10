import Phaser from "phaser";
import { formatCurrency } from "../core/formatCurrency";
import { setDebugRewardPopup } from "../debug";
import { drawHairline } from "./holo";
import type { PopupLayer } from "./PopupLayer";
import { COLOR, textStyle } from "./theme";
import { BASE_HEIGHT, BASE_WIDTH } from "../config/gameConfig";
import { drawGlyph } from "./glyphs";
import type { RewardPopupItem } from "./rewardPopupModel";
import { addFramedIcon } from "./itemFrame";

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
  onConfirm?: () => void;
}

/** 모바일 안전 여백 안에서 네 칸까지 한 줄에 담고, 그 이상은 같은 줄을 가로로 훑는 낮은 규격이다. */
const REWARD_POPUP = { width: 920, height: 360, viewport: 820, frame: 158, gap: 198, frameY: -8 } as const;

/**
 * 서버에서 이미 지급이 확정된 결과를 짧게 확인시키는 공용 팝업이다.
 *
 * 진행을 막는 선택지가 아니라 영수증에 가까우므로 바깥·본문·안내 문구 어디를 눌러도 닫힌다.
 * 호출자는 지급 계산을 넘기지 않고, 확정된 아이콘과 수량만 전달한다.
 */
export function openRewardPopup(scene: Phaser.Scene, popups: PopupLayer, options: RewardPopupOptions): void {
  const items = options.items.filter((item) => item.amount > 0);
  if (items.length === 0) {
    options.onConfirm?.();
    return;
  }

  // 팝업 중심은 기준 게임 화면 중심이며 E2E에는 내용 대신 표시 칸 수와 확인 입력점만 알린다.
  setDebugRewardPopup(true, items.length, { x: BASE_WIDTH / 2, y: BASE_HEIGHT / 2 });
  // 확인 안내는 팝업 안이 아니라 화면 하단에 둔다. "어디를 눌러도 넘어간다"는 말은 팝업 밖의 말이다.
  let hint: Phaser.GameObjects.Text | undefined;
  popups.open({
    width: REWARD_POPUP.width,
    height: REWARD_POPUP.height,
    title: options.title ?? "획득 보상",
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
      options.onConfirm?.();
    },
  }, (body, close) => {
    // 로비가 별도로 만든 우하단 뒤로가기(depth 2100)도 보상 확인 중에는 보이거나 눌리지 않는다.
    body.parentContainer?.setDepth(4000);
    const strip = scene.add.container(0, 0);
    const contentWidth = (items.length - 1) * REWARD_POPUP.gap + REWARD_POPUP.frame;
    const overflow = Math.max(0, contentWidth - REWARD_POPUP.viewport);
    // 한 개부터 네 개까지는 전체 묶음의 중심을 원점에 맞추고, 넘칠 때만 좌우 끝까지 이동시킨다.
    const startX = -((items.length - 1) * REWARD_POPUP.gap) / 2;
    items.forEach((item, index) => {
      const x = startX + index * REWARD_POPUP.gap;
      // 액자·그림·그늘·수량은 어디서나 같은 공용 프리팹 한 장이 그린다. 증가량인 것은 창 제목이
      // 이미 말하므로 `+`를 붙이지 않는다.
      const holder = addFramedIcon(scene, strip, x, REWARD_POPUP.frameY, REWARD_POPUP.frame, typeof item.icon === "string" ? item.icon : "", {
        amount: formatCurrency(item.amount),
      });
      // 계정 장식처럼 전용 텍스처가 없는 결과만 기존 홀로그램 글리프 체계로 대신한다.
      if (typeof item.icon !== "string") holder.addAt(drawGlyph(scene, item.icon.key, 0, 0, REWARD_POPUP.frame * 0.56, COLOR.accent), 1);
      if (item.label) strip.add(scene.add.text(x, 91, item.label, textStyle({ role: "body", size: 18, color: COLOR.inkDim })).setOrigin(0.5));
    });

    body.add(strip);

    // 내용만 잘라 액자들이 닫기 버튼이나 안전 여백을 침범하지 않게 한다.
    const maskShape = scene.make.graphics({ x: body.x, y: body.y });
    maskShape.fillStyle(0xffffff).fillRect(-REWARD_POPUP.viewport / 2, -100, REWARD_POPUP.viewport, 205);
    strip.setMask(maskShape.createGeometryMask());

    body.add(drawHairline(scene, 0, 108, 700, { color: COLOR.accent, alpha: 0.3 }));
    if (options.footnote) {
      body.add(scene.add.text(0, REWARD_POPUP.height / 2 + 54, options.footnote, textStyle({ role: "display", size: 38, color: COLOR.sortieText }))
        .setOrigin(0.5)
        .setShadow(0, 4, "#000000", 6, false, true));
    }
    // 팝업 판이 아니라 화면 밑동에 반투명한 굵은 글자로 남겨, 누를 수 있는 곳이 화면 전체임을 알린다.
    hint = scene.add
      .text(scene.scale.width / 2, scene.scale.height - 130, overflow > 0 ? "좌우로 밀어 확인 · 화면을 눌러 확인" : "화면을 눌러 확인", textStyle({ role: "emphasis", size: 30, color: COLOR.ink }))
      .setOrigin(0.5)
      .setAlpha(0.62)
      .setDepth(4000);
    hint.setShadow(0, 3, "#000000", 4, false, true);

    // 짧은 누름은 확인, 가로 끌기는 보상 줄 이동으로 갈라 눌러 닫기와 스크롤을 함께 보존한다.
    const hit = scene.add.rectangle(0, 20, REWARD_POPUP.width, REWARD_POPUP.height - 80, 0xffffff, 0).setInteractive({ useHandCursor: true });
    let downX = 0; let stripX = 0; let dragged = false;
    hit.on("pointerdown", (pointer: Phaser.Input.Pointer) => { downX = pointer.x; stripX = strip.x; dragged = false; });
    hit.on("pointermove", (pointer: Phaser.Input.Pointer) => {
      if (!pointer.isDown || overflow === 0) return;
      const delta = pointer.x - downX; dragged ||= Math.abs(delta) > 8;
      strip.x = Phaser.Math.Clamp(stripX + delta, -overflow / 2, overflow / 2);
    });
    hit.on("pointerup", () => { if (!dragged) close(); });
    body.add(hit);
  });
}
