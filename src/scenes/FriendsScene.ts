import Phaser from "phaser";
import { t } from "../i18n";
import { socialApi } from "../api/FakeSocialServer";
import { BASE_HEIGHT, BASE_WIDTH } from "../config/gameConfig";
import type { FriendProfile } from "../data/friends";
import { profileFrameOrDefault } from "../data/profileFrames";
import { getRelic } from "../data/relics";
import { setDebugScene } from "../debug";
import { friendProfileDisplay } from "../state/playerProfile";
import { addSceneBackground, BACKGROUND } from "../ui/backgrounds";
import { addBackButton } from "../ui/IconButton";
import { chipPoints, drawLayer, HOLO } from "../ui/holo";
import { InfoManager } from "../ui/info";
import { PlayerProfilePopup } from "../ui/PlayerProfilePopup";
import { compactProfileText } from "../ui/playerProfileLayout";
import { PopupLayer } from "../ui/PopupLayer";
import { ProfileAvatar } from "../ui/ProfileAvatar";
import { playSceneEntrance, startScene } from "../ui/screenTransition";
import { COLOR, PROFILE_MODIFIER_RARITY_COLOR, textStyle } from "../ui/theme";
import { pressIn, pressOut } from "../ui/pressFeedback";

const hex = (color: number): string => `#${color.toString(16).padStart(6, "0")}`;

/** 목록 한 줄의 자리. */
const FRIEND_ROW = { firstY: 330, gap: 270, width: 930, height: 230, avatar: { x: 180, size: 132 }, textX: 300 } as const;

/**
 * 로비의 친구 버튼에서 진입하는 친구 목록.
 *
 * 한 줄을 누르면 **자기 카드와 같은 플레이어 카드**가 친구의 공개 값으로 뜬다(`friendProfileDisplay`).
 * 친구 화면이 제 나름의 프로필을 따로 그리던 때는 같은 "한 사람의 카드"가 두 양식이었다. 줄의
 * 얼굴도 카드와 같은 한 장(`ProfileAvatar`)이라 그 친구가 두른 테두리가 목록에서부터 읽힌다.
 */
export class FriendsScene extends Phaser.Scene {
  private friends: FriendProfile[] = [];
  private content?: Phaser.GameObjects.Container;
  private popups!: PopupLayer;
  /** 친구 정보창은 생성 때부터 읽기 전용 권한으로 고정한다. */
  private info!: InfoManager;

  constructor() { super("friends"); }

  create(): void {
    setDebugScene("friends");
    addSceneBackground(this, BACKGROUND.lobby);
    // 기존 목록 화면과 같은 검은 유리 오버레이로 광장 원화는 남기고 정보 대비만 확보한다.
    this.add.rectangle(BASE_WIDTH / 2, BASE_HEIGHT / 2, BASE_WIDTH, BASE_HEIGHT, COLOR.void, 0.74).setDepth(-29);
    this.add.text(54, 76, t("friends.title"), textStyle({ role: "display", size: 52 })).setOrigin(0, 0);
    addBackButton(this, () => startScene(this, "lobby"));
    this.popups = new PopupLayer(this);
    this.info = new InfoManager(this, 3000, "friend");
    void this.loadFriends();
    // 화면이 한 뼘 아래에서 떠오르며 들어온다. 조각마다 트윈을 걸지 않고 카메라 하나를
    // 움직이므로, 이 뒤에 무엇을 더 세워도 함께 지나간다 — 그래서 `create`의 맨 끝이다.
    playSceneEntrance(this);
  }

  private async loadFriends(): Promise<void> {
    const response = await socialApi.getFriends();
    if (!this.scene.isActive()) return;
    this.friends = response.friends;
    this.renderList();
  }

  /** 친구 한 줄 — 테두리를 두른 얼굴, 이름·레벨·대표 수식어, 인사말, 마지막 접속. */
  private renderList(): void {
    this.content?.destroy();
    this.content = this.add.container(0, 0);
    this.friends.forEach((friend, index) => {
      const y = FRIEND_ROW.firstY + index * FRIEND_ROW.gap;
      const row = this.add.container(BASE_WIDTH / 2, y);
      const frame = profileFrameOrDefault(friend.frameId);
      row.add(drawLayer(this, 0, 0, chipPoints(FRIEND_ROW.width, FRIEND_ROW.height, { bevel: { topLeft: 42, topRight: 0, bottomRight: 42, bottomLeft: 0 } }), { fill: 0x1a1f27, alpha: HOLO.glass, edge: frame.color, edgeAlpha: 0.6 }));
      const avatarRelic = getRelic(friend.favoriteRelic.relicId);
      const left = -BASE_WIDTH / 2;
      const avatar = new ProfileAvatar(this, left + FRIEND_ROW.avatar.x, 0, {
        size: FRIEND_ROW.avatar.size, frameId: frame.id, portraitAssetId: avatarRelic.portraitAssetId,
        fallback: Array.from(friend.displayName.trim())[0] ?? "?",
      });
      row.add(avatar);
      const textX = left + FRIEND_ROW.textX;
      row.add(this.add.text(textX, -62, compactProfileText(friend.displayName, 12), textStyle({ role: "display", size: 36 })).setOrigin(0, 0.5));
      row.add(this.add.text(textX, -16, t("friends.researchLevel", { level: friend.level }), textStyle({ role: "emphasis", size: 24, color: COLOR.accentText })).setOrigin(0, 0.5));
      const modifier = friend.equippedModifiers[0];
      if (modifier) {
        row.add(this.add.text(textX + 170, -16, compactProfileText(modifier.displayName, 8), textStyle({ role: "emphasis", size: 22, color: hex(PROFILE_MODIFIER_RARITY_COLOR[modifier.rarity]) })).setOrigin(0, 0.5));
      }
      row.add(this.add.text(textX, 36, t("profile.bio.quoted", { bio: friend.status }), textStyle({ role: "emphasis", size: 25, color: COLOR.ink })).setOrigin(0, 0.5));
      row.add(this.add.text(FRIEND_ROW.width / 2 - 40, 80, friend.lastActive, textStyle({ role: "body", size: 22, color: COLOR.inkDim })).setOrigin(1, 0.5));
      const hit = this.add.rectangle(0, 0, FRIEND_ROW.width, FRIEND_ROW.height, 0xffffff, 0).setInteractive({ useHandCursor: true });
      hit.on("pointerdown", () => pressIn(row));
      hit.on("pointerout", () => pressOut(row, "normal", { pop: false }));
      hit.on("pointerup", () => { pressOut(row); this.openProfile(friend); });
      row.add(hit);
      this.content?.add(row);
    });
  }

  /** 친구 카드 — 자기 카드와 같은 한 장이되 편집이 없고, 애착 렐릭을 누르면 읽기 전용 정보창이 열린다. */
  private openProfile(friend: FriendProfile): void {
    if (this.popups.isOpen) return;
    new PlayerProfilePopup(this, this.popups, friendProfileDisplay(friend), () => undefined, undefined, {
      title: t("friends.profile"),
      onFavorite: () => this.info.showFriend(friend.favoriteRelic),
    }).open();
  }
}
