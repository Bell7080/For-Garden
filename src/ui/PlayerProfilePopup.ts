import Phaser from "phaser";
import { t, type TextKey } from "../i18n";
import { profileAvatarContent, type PlayerProfileDisplay, type PublicProfileModifier } from "../state/playerProfile";
import type { ContentId } from "../core/contentUnlock";
import { profileFrameOrDefault, type ProfileFrameDefinition } from "../data/profileFrames";
import { getRelic } from "../data/relics";
import { HoloBar, chipPoints, drawLayer, drawShapeOutline, HOLO, slantedRect } from "./holo";
import type { PopupLayer } from "./PopupLayer";
import { COLOR, PROFILE_MODIFIER_RARITY_COLOR, textStyle } from "./theme";
import { setDebugPlayerProfileOpen } from "../debug";
import { compactProfileText, PLAYER_PROFILE_LAYOUT, profileProgressRatio } from "./playerProfileLayout";
import { ProfileAvatar } from "./ProfileAvatar";
import { addSectionTitle } from "./SectionTitle";
import { AffinityBadge } from "./AffinityBadge";
import { ELEMENT_ICON, ROLE_ICON } from "./affinityIcons";
import { addBreakthroughGradeMark, RARITY_TONE } from "./rarityMark";
import { drawGlyph } from "./glyphs";
import { battleAssetFor, enableHitOnClick, portraitAssetForSkin, sdAssetForSkin, spawnPuppet, withPuppetTexture } from "../puppets/assets";
import { computeFaceBandFrame } from "../puppets/anchors";
import { bakeBandTexture } from "./faceTexture";
import { relicAppearanceManager } from "../managers/RelicAppearanceManager";
import { powerSavingPolicy } from "../core/settings";
import { session } from "../state/session";
import { pressIn, pressOut } from "./pressFeedback";

/** 희귀도는 theme 의미 토큰 표만 거치므로 DTO가 임의 색 문자열을 주입할 수 없다. */
function modifierColor(modifier: PublicProfileModifier): number {
  return PROFILE_MODIFIER_RARITY_COLOR[modifier.rarity];
}

const hex = (color: number): string => `#${color.toString(16).padStart(6, "0")}`;

/** 콘텐츠 이름은 그 콘텐츠의 화면이 이미 쓰는 문구를 빌린다 — 같은 말을 두 번 적지 않는다. */
export function contentNameKey(id: ContentId): TextKey {
  const keys: Record<ContentId, TextKey> = {
    excavation: "excavation.title", interaction: "interaction.title", cakeOperation: "cake.title", bounty: "bounty.title",
    expedition: "expedition.entry", raid: "raid.title", duel: "lobby.duel", archaeology: "nav.archaeology",
  };
  return keys[id];
}

/** 자기 카드의 각 요소를 눌렀을 때 여는 창. 편집 탭을 따로 두지 않고 고칠 것을 직접 누른다. */
export interface ProfileEditors {
  avatar: () => void;
  nickname: () => void;
  bio: () => void;
  /** 얻은 수식어가 하나도 없으면 비운다 — 고를 것이 없는 줄은 눌리지 않는다. */
  modifiers?: () => void;
}

/**
 * 플레이어 카드 — 수집형 RPG의 프로필 한 장.
 *
 * 위에서부터 **누구인가**(테두리를 두른 얼굴·레벨·닉네임·수식어·UID·경험치·한 줄 소개),
 * **누구를 아끼는가**(애착 렐릭이 홀로그램 바닥 위에 서서 숨 쉬고, 옆에 레벨·돌파·유대·전투력),
 * **무엇을 이뤘나**(스토리 진행·원정 최고·도감·결투장)를 쌓는다. 자기 카드에만 편집이 선다.
 */
export class PlayerProfilePopup {
  private opened = false;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly layer: PopupLayer,
    private readonly profile: PlayerProfileDisplay,
    private readonly onClose: () => void,
    /** 자기 카드에만 온다 — 각 요소를 누르면 그 요소만 고치는 창이 열린다. 친구 카드에는 없다. */
    private readonly editors?: ProfileEditors,
    /** 친구 카드: 머리글과, 애착 렐릭을 눌렀을 때 여는 읽기 전용 정보창. */
    private readonly options: { title?: string; onFavorite?: () => void } = {},
  ) {}

  open(options: { instant?: boolean } = {}): void {
    if (this.opened || this.layer.isOpen) return;
    this.opened = true;
    setDebugPlayerProfileOpen(true);
    const layout = PLAYER_PROFILE_LAYOUT;
    this.layer.open({ ...layout.popup, title: this.options.title ?? t("profile.title"), dim: true, closeOnBackdrop: true, instant: options.instant, onClose: () => {
      this.opened = false; setDebugPlayerProfileOpen(false); this.onClose();
    } }, (body) => {
      const frame = profileFrameOrDefault(this.profile.frameId);
      this.buildHeader(body, frame);
      this.buildBio(body, frame);
      this.buildShowcase(body, frame);
      this.buildRecords(body);
      this.buildNextUnlock(body);
    });
  }

  /** 씬 종료나 외부 조작도 PopupLayer의 단일 닫기 경로를 사용하게 한다. */
  close(): void { if (this.opened) this.layer.closeTop(); }

  /** 테두리를 두른 얼굴 → 이름·수식어·UID → 경험치 줄. */
  private buildHeader(body: Phaser.GameObjects.Container, frame: ProfileFrameDefinition): void {
    const { header } = PLAYER_PROFILE_LAYOUT;
    const { avatar } = header;
    // 얼굴과 테두리는 상단 줄·선택창과 같은 한 장이다. 누르면 사진·테두리 선택창이 열린다.
    const face = new ProfileAvatar(this.scene, avatar.x, avatar.y, {
      size: avatar.size, frameId: frame.id, portraitAssetId: this.profile.avatar?.portraitAssetId,
      fallback: profileAvatarContent(this.profile, () => false).fallback,
    });
    body.add(face);
    if (this.editors) this.bindEdit(body, face, avatar.x, avatar.y, avatar.size + 40, avatar.size + 40, this.editors.avatar);

    // 레벨은 얼굴 밑변에 반쯤 걸친 칩이다 — 이 계정을 한 줄로 말하는 수라 얼굴과 한 덩어리로 선다.
    const chip = slantedRect(header.levelChip.width, header.levelChip.height, 14);
    body.add(drawLayer(this.scene, avatar.x, header.levelChip.y, chip, { fill: 0x0c1118, alpha: 0.96 }));
    body.add(drawShapeOutline(this.scene, avatar.x, header.levelChip.y, chip, { color: frame.color, alpha: 0.9, width: 3 }));
    const levelTag = this.scene.add.text(avatar.x - 34, header.levelChip.y + 2, "LV", textStyle({ role: "display", size: 20, color: COLOR.inkDim })).setOrigin(1, 0.5);
    const levelValue = this.scene.add.text(avatar.x - 28, header.levelChip.y, String(this.profile.level), textStyle({ role: "display", size: 36, color: COLOR.accentText })).setOrigin(0, 0.5);
    body.add([levelTag, levelValue]);

    const left = header.textLeft;
    const name = this.scene.add.text(left, header.nameY, compactProfileText(this.profile.displayName, 12), textStyle({ role: "display", size: 50, color: COLOR.ink }))
      .setOrigin(0, 0.5).setShadow(0, 3, "#000000", 6, false, true);
    body.add(name);
    if (this.editors) {
      // 고칠 수 있는 글자 옆에는 연필 하나만 — "편집" 같은 말을 적지 않아도 눌러 볼 자리로 읽힌다.
      const pencilX = left + name.width + 30;
      body.add(drawGlyph(this.scene, "edit", pencilX, header.nameY, 28, COLOR.accent, 0.85));
      this.bindEdit(body, name, left + (name.width + 60) / 2, header.nameY, name.width + 70, 70, this.editors.nickname);
    }

    // 수식어는 이름 바로 아래 한 줄. 장착한 것만 서고 비었으면 그 줄은 비어 있다.
    const { modifiers } = PLAYER_PROFILE_LAYOUT;
    this.profile.equippedModifiers.forEach((modifier, index) => {
      const x = left + modifiers.width / 2 + index * (modifiers.width + modifiers.gap);
      const color = modifierColor(modifier);
      body.add(drawLayer(this.scene, x, header.modifierY, chipPoints(modifiers.width, modifiers.height, { bevel: { topLeft: 12, topRight: 0, bottomRight: 12, bottomLeft: 0 } }), { fill: 0x161d26, alpha: 0.92, edge: color, edgeAlpha: 0.9 }));
      body.add(this.scene.add.text(x, header.modifierY, compactProfileText(modifier.displayName, 8), textStyle({ role: "emphasis", size: 20, color: hex(color) })).setOrigin(0.5));
    });

    if (this.editors?.modifiers) {
      const rowWidth = header.textRight - left;
      if (this.profile.equippedModifiers.length === 0) body.add(drawGlyph(this.scene, "edit", left + 18, header.modifierY, 24, COLOR.accent, 0.7));
      this.bindEdit(body, undefined, left + rowWidth / 2, header.modifierY, rowWidth, modifiers.height + 8, this.editors.modifiers);
    }

    // UID는 누르면 복사된다 — 친구 추가에 쓰는 수라 옮겨 적게 하지 않는다.
    const uid = this.scene.add.text(left, header.uidY, t("profile.uid", { uid: this.profile.displayId }), textStyle({ role: "emphasis", size: 24, color: COLOR.inkDim })).setOrigin(0, 0.5);
    body.add(uid);
    uid.setInteractive({ useHandCursor: true }).on("pointerup", () => {
      void navigator.clipboard?.writeText(this.profile.displayId).then(() => uid.setText(t("profile.uidCopied")), () => undefined);
      this.scene.time.delayedCall(1200, () => { if (uid.active) uid.setText(t("profile.uid", { uid: this.profile.displayId })); });
    });
    if (this.profile.researchDays !== undefined) {
      body.add(this.scene.add.text(header.textRight, header.uidY, t("profile.researchDays", { days: this.profile.researchDays.toLocaleString() }), textStyle({ role: "emphasis", size: 24, color: COLOR.accentText })).setOrigin(1, 0.5));
    }

    // 친구 카드는 경험치를 공개하지 않는다 — 그 자리에 마지막 접속 한 줄이 선다.
    if (this.profile.lastActive !== undefined) {
      body.add(this.scene.add.text(left, header.expValueY - 12, t("profile.lastActive", { time: this.profile.lastActive }), textStyle({ role: "emphasis", size: 24, color: COLOR.accentText })).setOrigin(0, 0.5));
      return;
    }
    const width = header.textRight - left;
    const bar = new HoloBar(this.scene, left + width / 2, header.expY, width, header.expHeight, { color: frame.color, trackAlpha: 0.85, outline: true, ticks: 9 }).addTo(body);
    bar.setValue(this.profile.levelCapped ? 1 : profileProgressRatio(this.profile.experience, this.profile.experienceToNext));
    body.add(this.scene.add.text(left, header.expValueY, "EXP", textStyle({ role: "display", size: 22, color: hex(frame.color) })).setOrigin(0, 0.5));
    body.add(this.scene.add.text(header.textRight, header.expValueY,
      this.profile.levelCapped ? "MAX" : `${this.profile.experience.toLocaleString()} / ${this.profile.experienceToNext.toLocaleString()}`,
      textStyle({ role: "emphasis", size: 22, color: COLOR.ink })).setOrigin(1, 0.5));
  }

  /** 한 줄 소개. 따옴표 사이에 서는 그 사람의 말이라 본문 글꼴이다. 비었으면 줄을 세우지 않는다. */
  private buildBio(body: Phaser.GameObjects.Container, frame: ProfileFrameDefinition): void {
    // 남의 카드에서 빈 소개는 줄째 비운다. 자기 카드는 빈 줄도 세워 둬야 눌러서 적을 자리가 있다.
    if (!this.profile.bio && !this.editors) return;
    const { bio } = PLAYER_PROFILE_LAYOUT;
    const shape = slantedRect(bio.width, bio.height, 18);
    body.add(drawLayer(this.scene, 0, bio.y, shape, { fill: 0x0c1118, alpha: 0.78, edge: frame.color, edgeAlpha: 0.5 }));
    // 인사말은 **말하는 한 줄**이라 본문 글꼴이 아니라 강조 글꼴로 세우고, 따옴표도 같은 글자 안에 둔다 —
    // 큰 따옴표를 따로 세우면 그 한 글자만 다른 크기·굵기로 떠 판 구석의 얼룩처럼 읽혔다.
    if (this.profile.bio) {
      body.add(this.scene.add.text(0, bio.y, t("profile.bio.quoted", { bio: this.profile.bio }), textStyle({ role: "emphasis", size: 30, color: COLOR.ink, wrap: bio.width - 140 }))
        .setOrigin(0.5).setShadow(0, 2, "#05070a", 4, false, true));
    }
    if (this.editors) {
      body.add(drawGlyph(this.scene, "edit", bio.width / 2 - 44, bio.y, 26, COLOR.accent, 0.8));
      this.bindEdit(body, undefined, 0, bio.y, bio.width, bio.height, this.editors.bio);
    }
  }

  /** 누를 수 있는 요소 위에 투명한 입력면을 얹고, 누르는 동안 그 요소가 공용 눌림 연출로 눌린다. */
  private bindEdit(body: Phaser.GameObjects.Container, target: (Phaser.GameObjects.GameObject & Phaser.GameObjects.Components.Transform) | undefined, x: number, y: number, width: number, height: number, onTap: () => void): void {
    const hit = this.scene.add.rectangle(x, y, width, height, 0xffffff, 0).setInteractive({ useHandCursor: true });
    hit.on("pointerdown", () => { if (target) pressIn(target); });
    hit.on("pointerout", () => { if (target) pressOut(target, "normal", { pop: false }); });
    hit.on("pointerup", () => { if (target) pressOut(target); onTap(); });
    body.add(hit);
  }

  /**
   * 애착 렐릭의 무대 — 투영 바닥 위에 SD가 서서 숨 쉰다(idle).
   *
   * 얼굴 액자 한 장으로 두면 "누구인가"까지만 말한다. 수집형 RPG의 프로필이 대표 캐릭터를
   * **움직이는 채로** 세우는 이유는 그 계정이 무엇을 아끼는지가 그 한 자리에서 읽히기 때문이다.
   * 누르면 한 번 튄다. 옆에는 그 개체가 얼마나 컸는지(레벨·돌파·유대·전투력)를 적는다.
   */
  private buildShowcase(body: Phaser.GameObjects.Container, frame: ProfileFrameDefinition): void {
    const { showcase } = PLAYER_PROFILE_LAYOUT;
    const height = showcase.bottom - showcase.top;
    const centerY = (showcase.top + showcase.bottom) / 2;
    const favorite = this.profile.competitiveStats.favoriteRelic;
    const tone = favorite ? RARITY_TONE[favorite.rarity].chip : 0x1a222c;
    const panel = chipPoints(showcase.width, height, { bevel: { topLeft: 40, topRight: 0, bottomRight: 40, bottomLeft: 0 } });
    // 판은 윗변 한 줄만 그 개체의 희귀도 색으로 긋는다 — 사방을 겹겹이 두르면 무대가 액자 속 액자가 된다.
    body.add(drawLayer(this.scene, 0, centerY, panel, { fill: 0x0a0f16, alpha: 0.9, edge: tone, edgeAlpha: 0.8, edgeWidth: 3 }));
    // 판 위에 그 개체의 전신을 **얼굴 위주로** 은은하게 깐다 — 바닥과 SD보다 뒤다(순서를 먼저 잡아 둔다).
    const backdrop = this.scene.add.container(0, centerY);
    body.add(backdrop);
    if (favorite) void this.bakeShowcaseBackdrop(backdrop, favorite.relicId, favorite.skinId, panel, height);
    body.add(this.drawGridFloor(frame.color, centerY, height));
    addSectionTitle(this.scene, -showcase.width / 2, showcase.titleY + 18, t("profile.section.favorite"), { parent: body, size: 26 });

    if (!favorite) {
      body.add(this.scene.add.text(0, centerY, t("profile.unset"), textStyle({ role: "emphasis", size: 30, color: COLOR.inkDim })).setOrigin(0.5));
      return;
    }

    // 발밑 투영 그림자 — 서 있는 자리를 바닥에 붙인다.
    body.add(this.scene.add.ellipse(showcase.sd.x, showcase.sd.groundY, 220, 46, frame.color, 0.18));
    body.add(this.scene.add.ellipse(showcase.sd.x, showcase.sd.groundY, 150, 28, 0x000000, 0.45));
    const stage = this.scene.add.container(0, 0);
    body.add(stage);
    // 친구 카드는 서버가 공개한 외형을, 자기 카드는 제 장착을 읽는다.
    const sdAsset = favorite.skinId !== undefined
      ? sdAssetForSkin(favorite.relicId, favorite.skinId) ?? battleAssetFor(favorite.relicId)
      : relicAppearanceManager.sdAssetFor(favorite.relicId);
    void spawnPuppet(this.scene, sdAsset, {
      x: showcase.sd.x, groundY: showcase.sd.groundY, height: showcase.sd.height, depth: 0,
    }).then((puppet) => {
      if (!stage.active) { puppet.destroy(); return; }
      puppet.setDecorativeUpdateFactor(powerSavingPolicy(session.settings).idlePuppetUpdateFactor);
      puppet.setAlpha(0);
      stage.add(puppet);
      this.scene.tweens.add({ targets: puppet, alpha: 1, duration: 260 });
      enableHitOnClick(this.scene, puppet);
    }).catch(() => undefined);
    if (this.options.onFavorite) {
      // 친구의 애착 렐릭은 SD 자리를 누르면 읽기 전용 정보창이 열린다.
      const hit = this.scene.add.rectangle(showcase.sd.x, showcase.sd.groundY - showcase.sd.height / 2, 300, showcase.sd.height, 0xffffff, 0).setInteractive({ useHandCursor: true });
      hit.on("pointerup", () => this.options.onFavorite?.());
      body.add(hit);
    }

    const { info } = showcase;
    const relic = getRelic(favorite.relicId);
    body.add(this.scene.add.text(info.left, info.rarityY, favorite.rarity, textStyle({ role: "display", size: 32, color: hex(RARITY_TONE[favorite.rarity].chip) })).setOrigin(0, 0.5));
    body.add(this.scene.add.text(info.left, info.nameY, compactProfileText(favorite.displayName, 9), textStyle({ role: "display", size: 48, color: COLOR.ink })).setOrigin(0, 0.5).setShadow(0, 3, "#000000", 6, false, true));
    addBreakthroughGradeMark(this.scene, body, showcase.width / 2 - 64, info.rarityY + 16, 54, favorite.breakthroughGrade);
    body.add(new AffinityBadge(this.scene, info.left + 34, info.badgeY, ELEMENT_ICON[relic.element], 64, 0.6));
    body.add(new AffinityBadge(this.scene, info.left + 104, info.badgeY + 4, ROLE_ICON[relic.role], 50, 0.6));

    const rows: [TextKey, string][] = [
      ["profile.favorite.level", `LV.${favorite.level}`],
      ...(favorite.bondLevel !== undefined ? [["profile.favorite.bond", `${favorite.bondLevel}`] as [TextKey, string]] : []),
      ["profile.favorite.power", favorite.power.toLocaleString()],
    ];
    const rowWidth = showcase.width / 2 - info.left - 36;
    rows.forEach(([labelKey, value], index) => {
      const y = info.firstRowY + index * info.rowGap;
      body.add(drawLayer(this.scene, info.left + rowWidth / 2, y, slantedRect(rowWidth, 46, 12), { fill: 0x121a24, alpha: 0.85, shadow: false }));
      body.add(this.scene.add.text(info.left + 18, y, t(labelKey), textStyle({ role: "body", size: 22, color: COLOR.inkDim })).setOrigin(0, 0.5));
      body.add(this.scene.add.text(info.left + rowWidth - 18, y, value, textStyle({ role: "display", size: 28, color: index === rows.length - 1 ? COLOR.accentText : COLOR.ink })).setOrigin(1, 0.5));
    });
  }

  /**
   * 애착 렐릭의 전신을 얼굴 위주로 잘라 판 실루엣대로 구워 깐다.
   *
   * **판을 채우되 은은하게** 선다(`showcase.backdrop.alpha`) — 앞에 선 SD와 수치가 먼저 읽혀야
   * 하므로 그림은 분위기만 남긴다. SD가 서는 왼쪽은 녹여 두어 두 몸이 겹쳐 뭉개지지 않게 한다.
   * 구운 뒤 원본은 놓는다(`withPuppetTexture`) — 카드가 그리는 것은 구운 제 텍스처뿐이다.
   */
  private async bakeShowcaseBackdrop(backdrop: Phaser.GameObjects.Container, relicId: string, skinId: string | null | undefined, panel: readonly number[], height: number): Promise<void> {
    const { showcase } = PLAYER_PROFILE_LAYOUT;
    const spec = showcase.backdrop;
    const asset = skinId !== undefined ? portraitAssetForSkin(getRelic(relicId).portraitAssetId, skinId) : relicAppearanceManager.portraitAssetFor(relicId);
    const key = await withPuppetTexture(this.scene, asset, ({ key: source, anchors }) => {
      if (!backdrop.active) return undefined;
      const crop = computeFaceBandFrame(asset, anchors.head, {
        width: showcase.width, height,
        crop: spec.crop / ((asset.cardZoom ?? 1) * (asset.portraitZoom ?? 1)),
        headX: spec.headX, anchorY: spec.anchorY,
      });
      return bakeBandTexture(this.scene, source, { width: showcase.width, height }, crop, { shape: panel, from: 0, fade: spec.fade });
    }).catch(() => undefined);
    if (!key || !backdrop.active) return;
    const image = this.scene.add.image(0, 0, key).setAlpha(0);
    backdrop.add(image);
    this.scene.tweens.add({ targets: image, alpha: spec.alpha, duration: 260 });
  }

  /**
   * 투영 바닥 — 소실점으로 모이는 세로줄과 뒤로 갈수록 촘촘해지는 가로줄.
   * 한 줄이 느리게 앞으로 훑고 지나가 판이 켜져 있는 장비처럼 보이게 한다.
   */
  private drawGridFloor(color: number, centerY: number, height: number): Phaser.GameObjects.Container {
    const { showcase } = PLAYER_PROFILE_LAYOUT;
    const floor = this.scene.add.container(0, 0);
    const graphics = this.scene.add.graphics();
    const horizon = showcase.grid.horizonY;
    const bottom = centerY + height / 2 - 18;
    const nearHalf = showcase.width / 2 - 30;
    const farHalf = nearHalf * 0.35;
    graphics.lineStyle(2, color, 0.22);
    for (let column = 0; column <= showcase.grid.columns; column += 1) {
      const ratio = column / showcase.grid.columns - 0.5;
      graphics.lineBetween(ratio * farHalf * 2, horizon, ratio * nearHalf * 2, bottom);
    }
    for (let row = 0; row <= showcase.grid.rows; row += 1) {
      const depth = (row / showcase.grid.rows) ** 1.8;
      const y = horizon + (bottom - horizon) * depth;
      const half = farHalf + (nearHalf - farHalf) * depth;
      graphics.lineStyle(2, color, 0.1 + 0.2 * depth);
      graphics.lineBetween(-half, y, half, y);
    }
    floor.add(graphics);
    const scan = this.scene.add.rectangle(0, horizon, nearHalf * 2, 4, color, 0.5).setBlendMode(Phaser.BlendModes.ADD);
    floor.add(scan);
    this.scene.tweens.add({
      targets: scan, y: bottom, alpha: { from: 0.05, to: 0.45 }, duration: 2600, repeat: -1, ease: "Sine.easeIn",
      onUpdate: () => { const depth = (scan.y - horizon) / Math.max(1, bottom - horizon); scan.setScale(0.35 + 0.65 * depth, 1); },
    });
    return floor;
  }

  /** 연구 기록 네 칸 — 진행이 있는 것은 옅은 줄로 얼마나 왔는지도 함께 말한다. */
  private buildRecords(body: Phaser.GameObjects.Container): void {
    const { records } = PLAYER_PROFILE_LAYOUT;
    addSectionTitle(this.scene, -PLAYER_PROFILE_LAYOUT.showcase.width / 2, records.titleY, t("profile.section.records"), { parent: body, size: 26 });
    const stats = this.profile.competitiveStats;
    const story = stats.storyProgress;
    const collection = this.profile.collection;
    // 공개하지 않은 기록은 칸째 뺀다 — 0이나 "기록 없음"으로 채우면 없는 기록을 있는 것처럼 말한다.
    const tiles: { labelKey: TextKey; value: string; sub?: string; progress?: number }[] = [
      {
        labelKey: "profile.record.story",
        value: stats.highestStage ? compactProfileText(stats.highestStage.displayValue, 12) : t("profile.noRecord"),
        ...(story ? { sub: `${story.cleared} / ${story.total}`, progress: profileProgressRatio(story.cleared, story.total) } : {}),
      },
      ...(stats.expedition ? [{ labelKey: "profile.record.expedition" as TextKey, value: stats.expedition.score.toLocaleString() }] : []),
      ...(collection ? [{
        labelKey: "profile.record.collection" as TextKey,
        value: `${collection.owned} / ${collection.total}`,
        progress: profileProgressRatio(collection.owned, collection.total),
      }] : []),
      { labelKey: "profile.arenaTier", value: stats.arenaTier?.displayName ?? t("profile.record.unranked") },
    ];
    tiles.forEach((tile, index) => {
      const x = (index % 2 === 0 ? -1 : 1) * records.columnX;
      const y = records.firstY + Math.floor(index / 2) * records.rowGap;
      const shape = chipPoints(records.width, records.height, { bevel: { topLeft: 20, topRight: 0, bottomRight: 20, bottomLeft: 0 } });
      body.add(drawLayer(this.scene, x, y, shape, { fill: 0x121a24, alpha: HOLO.glass, edge: COLOR.accent, edgeAlpha: 0.45 }));
      const left = x - records.width / 2 + 30;
      body.add(this.scene.add.text(left, y - 40, t(tile.labelKey), textStyle({ role: "body", size: 22, color: COLOR.inkDim })).setOrigin(0, 0.5));
      body.add(this.scene.add.text(left, y + 4, tile.value, textStyle({ role: "display", size: 34, color: COLOR.ink })).setOrigin(0, 0.5));
      if (tile.sub) body.add(this.scene.add.text(x + records.width / 2 - 26, y - 40, tile.sub, textStyle({ role: "emphasis", size: 22, color: COLOR.accentText })).setOrigin(1, 0.5));
      if (tile.progress !== undefined) {
        const barWidth = records.width - 60;
        new HoloBar(this.scene, x, y + 46, barWidth, 10, { color: COLOR.accent, trackAlpha: 0.8 }).addTo(body).setValue(tile.progress);
      }
    });
  }

  /** 레벨 잠금을 켰을 때만 — 다음에 무엇이 열리는지 한 줄. */
  private buildNextUnlock(body: Phaser.GameObjects.Container): void {
    const next = this.profile.nextUnlock;
    if (!next) return;
    const y = PLAYER_PROFILE_LAYOUT.nextUnlock.y;
    body.add(drawGlyph(this.scene, "lock", -300, y, 30, COLOR.accent));
    body.add(this.scene.add.text(-270, y, t("profile.nextUnlock", { level: next.level, content: t(contentNameKey(next.contentId)) }), textStyle({ role: "emphasis", size: 26, color: COLOR.ink })).setOrigin(0, 0.5));
  }
}
