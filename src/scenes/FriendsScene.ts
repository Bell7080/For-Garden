import Phaser from "phaser";
import { socialApi } from "../api/FakeSocialServer";
import { BASE_HEIGHT, BASE_WIDTH } from "../config/gameConfig";
import { DAILY_HELPER_LIMIT } from "../core/social";
import type { FriendProfile } from "../data/friends";
import { getRelic } from "../data/relics";
import { setDebugScene } from "../debug";
import { addSceneBackground, BACKGROUND } from "../ui/backgrounds";
import { Button } from "../ui/Button";
import { addBackButton } from "../ui/IconButton";
import { PortraitCard } from "../ui/PortraitCard";
import { chipPoints, drawHairline, drawLayer, HOLO } from "../ui/holo";
import { COLOR, textStyle } from "../ui/theme";
import { InfoManager } from "../ui/info";

/** 로비의 친구 버튼에서 진입하는 최소 소셜 화면이며 목록과 프로필을 같은 씬에서 전환한다. */
export class FriendsScene extends Phaser.Scene {
  private friends: FriendProfile[] = [];
  private points = 0;
  private usesToday = 0;
  private content?: Phaser.GameObjects.Container;
  private title?: Phaser.GameObjects.Text;
  private summary?: Phaser.GameObjects.Text;
  /** 친구 정보창은 생성 때부터 읽기 전용 권한으로 고정한다. */
  private info!: InfoManager;

  constructor() { super("friends"); }

  create(): void {
    setDebugScene("friends");
    addSceneBackground(this, BACKGROUND.lobby);
    // 기존 목록 화면과 같은 검은 유리 오버레이로 광장 원화는 남기고 정보 대비만 확보한다.
    this.add.rectangle(BASE_WIDTH / 2, BASE_HEIGHT / 2, BASE_WIDTH, BASE_HEIGHT, COLOR.void, 0.74).setDepth(-29);
    this.title = this.add.text(54, 76, "친구", textStyle({ role: "display", size: 52 })).setOrigin(0, 0);
    this.summary = this.add.text(BASE_WIDTH - 54, 88, "동기화 중", textStyle({ role: "emphasis", size: 25, color: COLOR.accentText })).setOrigin(1, 0);
    addBackButton(this, () => this.scene.start("lobby"));
    this.info = new InfoManager(this, 1001, "friend");
    void this.loadFriends();
  }

  /** 서버가 확정한 공개 프로필과 일일 대여 상태를 받은 뒤 목록을 그린다. */
  private async loadFriends(): Promise<void> {
    const response = await socialApi.getFriends();
    this.friends = response.friends;
    this.points = response.friendPoints;
    this.usesToday = response.helperUsesToday;
    this.renderList();
  }

  /** 친구 한 행 전체를 눌러 프로필로 들어가게 하며 목록에 불필요한 전투 수치는 노출하지 않는다. */
  private renderList(): void {
    this.content?.destroy();
    this.content = this.add.container(0, 0);
    this.title?.setText("친구");
    this.updateSummary();
    this.friends.forEach((friend, index) => {
      const relic = getRelic(friend.favoriteRelic.relicId);
      const y = 330 + index * 300;
      const panel = drawLayer(this, BASE_WIDTH / 2, y, chipPoints(930, 236, { bevel: { topLeft: 42, topRight: 0, bottomRight: 42, bottomLeft: 0 } }), { fill: 0x1a1f27, alpha: HOLO.glass, edge: COLOR.accent, edgeAlpha: 0.42 });
      const card = new PortraitCard(this, 190, y, { width: 190, height: 200, portraitAssetId: relic.portraitAssetId, label: relic.name, level: friend.favoriteRelic.level, rarity: relic.rarity });
      const name = this.add.text(330, y - 76, `${friend.name}  ·  연구 LV.${friend.researcherLevel}`, textStyle({ role: "emphasis", size: 31 })).setOrigin(0, 0);
      const status = this.add.text(330, y - 20, friend.status, textStyle({ role: "body", size: 27, color: COLOR.inkDim })).setOrigin(0, 0);
      const active = this.add.text(900, y + 62, friend.lastActive, textStyle({ role: "body", size: 23, color: COLOR.accentText })).setOrigin(1, 0);
      const hit = this.add.rectangle(BASE_WIDTH / 2, y, 930, 236, 0xffffff, 0).setInteractive({ useHandCursor: true });
      hit.on("pointerdown", () => card.setScale(1.06));
      hit.on("pointerout", () => card.setScale(1));
      hit.on("pointerup", () => { card.setScale(1); this.renderProfile(friend); });
      this.content?.add([panel, card, name, status, active, hit]);
    });
  }

  /** 공개 프로필은 애착 렐릭과 상태만 보여 주고, 여기서 일일 조력자 대여를 확정한다. */
  private renderProfile(friend: FriendProfile): void {
    this.content?.destroy();
    this.content = this.add.container(0, 0);
    this.title?.setText("친구 프로필");
    this.updateSummary();
    const relic = getRelic(friend.favoriteRelic.relicId);
    const card = new PortraitCard(this, BASE_WIDTH / 2, 610, { width: 500, height: 620, portraitAssetId: relic.portraitAssetId, label: relic.name, level: friend.favoriteRelic.level, rarity: relic.rarity, affinity: { element: relic.element, role: relic.role } });
    // 렐릭 카드는 서버 공개 DTO만 넘기는 공용 읽기 전용 정보창의 진입점이다.
    card.hit.on("pointerup", () => this.info.showFriend(friend.favoriteRelic));
    const name = this.add.text(BASE_WIDTH / 2, 1020, friend.name, textStyle({ role: "display", size: 48 })).setOrigin(0.5);
    const meta = this.add.text(BASE_WIDTH / 2, 1088, `연구 LV.${friend.researcherLevel}  ·  ${friend.lastActive}`, textStyle({ role: "body", size: 27, color: COLOR.inkDim })).setOrigin(0.5);
    const status = this.add.text(BASE_WIDTH / 2, 1160, `“${friend.status}”`, textStyle({ role: "body", size: 30, color: COLOR.ink })).setOrigin(0.5);
    const line = drawHairline(this, BASE_WIDTH / 2, 1230, 760, { color: COLOR.accent, alpha: 0.4 });
    const rule = this.add.text(BASE_WIDTH / 2, 1270, "일반 스토리·재료·일일 복원 전용\n대여 시 양쪽 친구 포인트 +10", textStyle({ role: "body", size: 27, color: COLOR.inkDim, align: "center", lineSpacing: 8 })).setOrigin(0.5, 0);
    const rent = new Button(this, BASE_WIDTH / 2, 1455, { width: 660, height: 112, label: "애착 렐릭 조력자 대여", sub: "고난도·랭킹·공동 보스 사용 불가", variant: "primary", onClick: () => void this.rentHelper(friend, rent) });
    const back = new Button(this, 300, 1690, { width: 360, height: 92, label: "친구 목록", onClick: () => this.renderList() });
    this.content.add([card, name, meta, status, line, rule, rent, back]);
  }

  /** 중복 입력을 잠근 뒤 서버 결과만으로 포인트와 남은 횟수를 갱신한다. */
  private async rentHelper(friend: FriendProfile, button: Button): Promise<void> {
    button.setEnabled(false);
    try {
      const result = await socialApi.rentFavoriteRelic(friend.id);
      this.points = result.friendPoints;
      this.usesToday = DAILY_HELPER_LIMIT - result.remaining;
      button.setSub(`대여 완료 · 나 +${result.renterPointsEarned} / 친구 +${result.ownerPointsEarned}`);
      this.updateSummary();
    } catch (error) {
      button.setSub(error instanceof Error ? error.message : "대여할 수 없습니다");
    }
  }

  /** 목록과 프로필 상단이 같은 포인트·일일 제한 표기를 공유한다. */
  private updateSummary(): void { this.summary?.setText(`FP ${this.points}  ·  조력 ${Math.max(0, DAILY_HELPER_LIMIT - this.usesToday)}/${DAILY_HELPER_LIMIT}`); }
}
