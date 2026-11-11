import Phaser from "phaser";
import { t } from "../i18n";
import type { TextKey } from "../i18n";
import { profileFrameOrDefault } from "../data/profileFrames";
import { drawLayer, HoloBar, slantedRect } from "./holo";
import { ITEM_GUIDE, itemGuideHeight } from "./itemGuideLayout";
import { ProfileAvatar } from "./ProfileAvatar";
import type { PopupLayer } from "./PopupLayer";
import { shrinkTextToWidth } from "./textFit";
import { COLOR, textStyle } from "./theme";
import type { PortraitAssetId } from "../core/types";

const hex = (color: number): string => `#${color.toString(16).padStart(6, "0")}`;

export interface ProfileFrameGuideOptions {
  readonly frameId: string;
  /** 지금 얼굴 — 테두리를 그 위에 씌워 보인다(선택창과 같은 미리보기). */
  readonly avatar: { portraitAssetId?: PortraitAssetId; fallback: string };
  /** 「효과」 아래 본문의 문구 키. 테두리가 어디서 열리는지는 부르는 자리가 안다. */
  readonly descriptionKey: TextKey;
}

/**
 * 프로필 테두리 안내창 — **재료·소비품 안내창과 같은 한 벌**이다(`ItemGuidePopup`).
 *
 * 보상 줄에 테두리가 아이템 액자와 나란히 서는 자리(첫 결제 선물)에서, 다른 액자는 누르면 안내창이
 * 열리는데 테두리만 아무 일이 없으면 그 칸이 무엇인지 알 길이 없다. 위 판에 지금 얼굴에 씌운 모습과
 * 테두리 이름을, 그 아래 「효과」 줄에 무엇인지를 적는다. 자리·크기는 아이템 안내창의 배치표를 그대로 읽는다.
 */
export function openProfileFrameGuide(scene: Phaser.Scene, popups: PopupLayer, options: ProfileFrameGuideOptions): void {
  const frame = profileFrameOrDefault(options.frameId);
  const height = itemGuideHeight(false, 0);
  const top = -height / 2;
  popups.open({ width: ITEM_GUIDE.width, height, title: frame.displayName, dim: true, dimAlpha: 0.34 }, (body) => {
    const { hero, section } = ITEM_GUIDE;
    const heroY = top + hero.top + hero.height / 2;
    body.add(drawLayer(scene, 0, heroY, slantedRect(hero.width, hero.height, 22), { fill: 0x101720, alpha: 0.9, edge: frame.color, edgeAlpha: 0.45 }));
    const avatarX = -hero.width / 2 + 48 + hero.frameSize / 2;
    body.add(new ProfileAvatar(scene, avatarX, heroY, { size: Math.round(hero.frameSize * 0.8), frameId: frame.id, portraitAssetId: options.avatar.portraitAssetId, fallback: options.avatar.fallback }));
    const textRight = hero.width / 2 - 40;
    const textWidth = textRight - (avatarX + hero.frameSize / 2 + 24);
    body.add(scene.add.text(textRight, heroY - 28, t("profile.frameGuide.kind"), textStyle({ role: "emphasis", size: 22, color: COLOR.inkDim })).setOrigin(1, 0.5));
    const name = scene.add.text(textRight, heroY + 18, frame.displayName, textStyle({ role: "display", size: 40, color: hex(frame.color) })).setOrigin(1, 0.5).setShadow(2, 6, "#05070a", 7, false, true);
    body.add(shrinkTextToWidth(name, textWidth));

    const sectionY = top + section.top;
    body.add(scene.add.text(-section.width / 2, sectionY, t("inventory.guide.effect"), textStyle({ role: "display", size: 27, color: COLOR.accentText })).setOrigin(0, 0.5));
    new HoloBar(scene, 0, sectionY + 32, section.width, 5, { color: COLOR.accent, trackAlpha: 0.5 }).addTo(body).setValue(1);
    body.add(scene.add.text(-section.width / 2 + 15, sectionY + 60, t(options.descriptionKey), textStyle({ role: "body", size: 24, color: COLOR.ink, wrap: section.width - 30 })).setOrigin(0, 0));
  });
}
