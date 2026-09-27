import Phaser from "phaser";
import { getRelic } from "../data/relics";
import { relicAppearanceManager } from "../managers/RelicAppearanceManager";
import { enableHitOnClick, spawnPuppet, type PuppetCreature } from "../puppets/assets";
import { motionPolicy, powerSavingPolicy } from "../core/settings";
import { session } from "../state/session";
import { drawGlyph } from "./glyphs";
import { pressIn, pressOut } from "./pressFeedback";
import { addSdFootShadow } from "./SdFootShadow";
import { ELEMENT_TINT } from "./skillArt";
import { textStyle } from "./theme";
import { WELCOME_CAST, WELCOME_SPARKLE, welcomeCastNameY, welcomeSparkle } from "./welcomeCastLayout";

/** 네 갈래 별 한 장 — 한 번만 굽고 색은 tint로 갈아 끼운다(매 프레임 도형을 다시 그리지 않는다). */
const SPARKLE_TEXTURE = "welcome-sparkle";
const SPARKLE_TEXTURE_SIZE = 64;

/**
 * 첫 복원 연구 원화(빈 방) 위에 서는 SSR 넷 — 크게 엇갈려 선 SD, 뒤로 비껴 따라 움직이는 복제
 * 그림자, 발밑의 속성 색 이름, 방을 채우는 반짝임.
 *
 * 원화에 인물이 그려져 있지 않아 **누가 나오는 판인지를 이 넷이 말한다.** 이름은 판 없이 속성 색
 * 글자로만 서고, 옆의 돋보기·이름·SD 어디를 눌러도 그 개체가 톡 뛰며 정보창(얻기 전이면 실루엣
 * 미리보기)이 열린다 — 픽업 배너의 「캐릭터 정보」 버튼과 같은 길이다.
 *
 * 복제 그림자는 개체를 하나 더 세우지 않고 같은 정점을 검게 다시 그린다(`setAfterimages`) — 그래서
 * 몸이 숨 쉬는 대로 그림자도 같은 자세로 따라 움직인다.
 *
 * Puppet은 비동기로 서므로, 도착했을 때 이 판이 이미 걷혔으면 그 자리에서 놓는다.
 */
export class WelcomeBannerCast {
  private readonly root: Phaser.GameObjects.Container;
  private readonly sparklesBack: Phaser.GameObjects.Container;
  private readonly sparklesFront: Phaser.GameObjects.Container;
  private readonly names: Phaser.GameObjects.Container;
  private readonly puppets = new Map<number, PuppetCreature>();
  private readonly animate: boolean;
  private alive = true;

  constructor(
    private readonly scene: Phaser.Scene,
    relicIds: readonly string[],
    private readonly onInspect: (relicId: string) => void,
  ) {
    const { depth } = WELCOME_CAST;
    this.animate = motionPolicy(session.settings).nonEssentialDistanceFactor > 0;
    this.sparklesBack = scene.add.container(0, 0).setDepth(depth - 0.5);
    this.root = scene.add.container(0, 0).setDepth(depth);
    // 이름은 모든 SD보다 위에 선다 — 뒷줄 이름이 앞줄 몸에 묻히지 않게.
    this.names = scene.add.container(0, 0).setDepth(depth + 0.3);
    this.sparklesFront = scene.add.container(0, 0).setDepth(depth + 0.4);
    this.addSparkles();
    // 뒷줄부터 세워 앞줄 SD가 그 위에 겹친다.
    const members = relicIds.slice(0, WELCOME_CAST.spots.length).map((relicId, index) => ({ relicId, index }));
    members.sort((a, b) => WELCOME_CAST.spots[a.index].groundY - WELCOME_CAST.spots[b.index].groundY);
    for (const { relicId, index } of members) this.addMember(relicId, index);
  }

  destroy(): void {
    this.alive = false;
    for (const puppet of this.puppets.values()) puppet.destroy();
    this.puppets.clear();
    for (const layer of [this.sparklesBack, this.root, this.names, this.sparklesFront]) layer.destroy(true);
  }

  private addMember(relicId: string, index: number): void {
    const { scene } = this;
    const spot = WELCOME_CAST.spots[index];
    const member = scene.add.container(0, 0);
    this.root.add(member);

    addSdFootShadow(scene, spot.x, spot.groundY, spot.height * WELCOME_CAST.shadowRatio, member);
    // SD 자리 전체가 눌린다 — 작은 돋보기만 받으면 손이 SD를 누르고도 아무 일이 없다.
    const hit = scene.add.rectangle(spot.x, spot.groundY - spot.height / 2, spot.height * 0.62, spot.height, 0xffffff, 0)
      .setInteractive({ useHandCursor: true });
    hit.on("pointerup", () => this.inspect(relicId, index));
    member.add(hit);

    // 복제 그림자는 화면 가운데에서 멀어지는 쪽으로 비낀다 — 무리가 가운데로 모여 선 것처럼 깊이가 생긴다.
    const outward = spot.x < scene.scale.width / 2 ? -1 : 1;
    const echo = WELCOME_CAST.echo.map((step) => ({ dx: step.dx * outward, dy: step.dy, alpha: step.alpha }));
    const delay = index * WELCOME_CAST.enterStagger;
    void spawnPuppet(scene, relicAppearanceManager.sdAssetFor(relicId), {
      x: spot.x, groundY: spot.groundY, height: spot.height, flipX: spot.flipX, depth: WELCOME_CAST.depth,
    }).then((puppet) => {
      if (!this.alive || !member.active) { puppet.destroy(); return; }
      puppet.setDecorativeUpdateFactor(powerSavingPolicy(session.settings).idlePuppetUpdateFactor);
      puppet.setAfterimages(echo);
      this.puppets.set(index, puppet);
      member.addAt(puppet, 1);
      enableHitOnClick(scene, puppet);
      if (!this.animate) return;
      // 차례로 톡 떨어져 선다 — 넷이 한꺼번에 서면 단체 사진처럼 굳어 보인다.
      const y = puppet.y;
      puppet.setAlpha(0).setY(y - 48);
      scene.tweens.add({ targets: puppet, y, alpha: 1, duration: 360, delay, ease: "Back.Out" });
    }).catch(() => undefined);

    const name = this.addName(relicId, index);
    if (!this.animate) return;
    name.setAlpha(0).setY(name.y + 14);
    scene.tweens.add({ targets: name, y: name.y - 14, alpha: 1, duration: 300, delay: delay + 220, ease: "Cubic.Out" });
  }

  /** 누르면 그 개체가 톡 뛰고 정보창이 열린다. 뛰는 것을 기다리지 않는다. */
  private inspect(relicId: string, index: number): void {
    const puppet = this.puppets.get(index);
    if (puppet && this.animate && !this.scene.tweens.isTweening(puppet)) {
      const { hop } = WELCOME_CAST;
      this.scene.tweens.add({ targets: puppet, y: puppet.y - hop.height, duration: hop.duration, yoyo: true, ease: "Quad.Out" });
    }
    this.onInspect(relicId);
  }

  /** 발밑 이름 — 판 없이 속성 색 글자 + 검은 획, 그 오른쪽에 작은 돋보기. */
  private addName(relicId: string, index: number): Phaser.GameObjects.Container {
    const { scene } = this;
    const relic = getRelic(relicId);
    const spot = WELCOME_CAST.spots[index];
    const { name: spec } = WELCOME_CAST;
    const color = lighten(ELEMENT_TINT[relic.element], spec.lift);
    const line = scene.add.container(spot.x, welcomeCastNameY(index));
    const label = scene.add.text(0, 0, relic.name, textStyle({ role: "display", size: spec.size, color: `#${color.toString(16).padStart(6, "0")}` }))
      .setOrigin(0.5).setStroke("#05070a", spec.stroke).setShadow(0, 4, "#000000", 6, false, true);
    const glass = scene.add.container(0, 0);
    glass.add(drawGlyph(scene, "magnifier", 0, 0, spec.magnifierSize, 0x05070a, 0.85, 8));
    glass.add(drawGlyph(scene, "magnifier", 0, 0, spec.magnifierSize, color, 1, 4));
    // 이름과 돋보기를 한 덩어리로 재서 발 가운데에 놓는다.
    const total = label.width + spec.magnifierGap + spec.magnifierSize;
    label.x = -total / 2 + label.width / 2;
    glass.x = total / 2 - spec.magnifierSize / 2;
    line.add([label, glass]);
    const hit = scene.add.rectangle(0, 0, total + spec.hit / 2, spec.hit, 0xffffff, 0).setInteractive({ useHandCursor: true });
    hit.on("pointerdown", () => pressIn(line));
    hit.on("pointerout", () => pressOut(line, "normal", { pop: false }));
    hit.on("pointerup", () => { pressOut(line); this.inspect(relicId, index); });
    line.add(hit);
    this.names.add(line);
    return line;
  }

  /** 방을 채우는 반짝임. 움직임 줄이기에서는 옅게 선 채로 남는다. */
  private addSparkles(): void {
    const { scene } = this;
    ensureSparkleTexture(scene);
    for (let index = 0; index < WELCOME_SPARKLE.count; index += 1) {
      const spot = welcomeSparkle(index);
      const star = scene.add.image(spot.x, spot.y, SPARKLE_TEXTURE)
        .setTint(spot.color)
        .setDisplaySize(spot.size, spot.size);
      (spot.front ? this.sparklesFront : this.sparklesBack).add(star);
      const scale = star.scaleX;
      if (!this.animate) { star.setAlpha(WELCOME_SPARKLE.alpha * 0.4); continue; }
      star.setAlpha(0).setScale(scale * 0.3);
      scene.tweens.add({
        targets: star, alpha: WELCOME_SPARKLE.alpha, scale, angle: 45,
        duration: spot.duration / 2, yoyo: true, ease: "Sine.InOut",
        // 꺼져 있는 틈을 켜진 시간보다 짧게 두어 방이 늘 어딘가 반짝이게 한다.
        delay: spot.delay, repeat: -1, repeatDelay: Math.round(spot.delay / 2),
      });
    }
  }
}

/** 네 갈래 별을 한 번 굽는다 — 가운데가 밝고 갈래 끝이 가늘다. 동그라미를 쓰지 않는다. */
function ensureSparkleTexture(scene: Phaser.Scene): void {
  if (scene.textures.exists(SPARKLE_TEXTURE)) return;
  const size = SPARKLE_TEXTURE_SIZE;
  const c = size / 2;
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  const star = (reach: number, waist: number, alpha: number): void => {
    g.fillStyle(0xffffff, alpha);
    g.fillPoints([
      { x: c, y: c - reach }, { x: c + waist, y: c - waist }, { x: c + reach, y: c }, { x: c + waist, y: c + waist },
      { x: c, y: c + reach }, { x: c - waist, y: c + waist }, { x: c - reach, y: c }, { x: c - waist, y: c - waist },
    ], true);
  };
  star(c, c * 0.2, 0.35);
  star(c * 0.78, c * 0.14, 0.7);
  star(c * 0.5, c * 0.1, 1);
  g.generateTexture(SPARKLE_TEXTURE, size, size);
  g.destroy();
}

/** 색을 `amount`만큼 흰빛 쪽으로 밝힌다 — 속성 색 글자가 검은 획 위에서 또렷하도록. */
function lighten(color: number, amount: number): number {
  const channel = (shift: number): number => {
    const value = (color >> shift) & 0xff;
    return Math.round(value + (255 - value) * amount);
  };
  return (channel(16) << 16) | (channel(8) << 8) | channel(0);
}
