import Phaser from "phaser";
import { getRelic } from "../data/relics";
import { sdAssetFor, spawnPuppet, type PuppetCreature } from "../puppets/assets";
import { logError } from "../managers/ErrorReporter";
import { COUPON_TONE as TONE } from "./couponPopupLayout";
import { addSdFootShadow } from "./SdFootShadow";
import { startPuppetHop } from "./puppetHop";
import { SPARKLE_TEXTURE, ensureSparkleTexture } from "./WelcomeBannerCast";
import { textStyle } from "./theme";

/**
 * 밝은 사탕 결 안내창(쿠폰·피드백·사전예약·베타 안내)이 함께 쓰는 조각.
 *
 * 쿠폰 등록창에서 시작한 결이라 색은 `COUPON_TONE` 한 벌을 그대로 읽는다 — 창마다 다른 것은 바탕 두 색, 굵은
 * 제목 글자, 말풍선을 든 SD 한 명뿐이다. 판 밖 우하단 뒤로가기·판 밖 누르기로 닫히는 것은 `PopupLayer`가 맡는다.
 */

/** 글자 높이를 따라 색이 흐르게 칠한다. */
export function paintGradient(text: Phaser.GameObjects.Text, stops: readonly [string, string, string]): void {
  const gradient = text.context.createLinearGradient(0, 0, 0, text.height);
  gradient.addColorStop(0, stops[0]);
  gradient.addColorStop(0.55, stops[1]);
  gradient.addColorStop(1, stops[2]);
  text.setFill(gradient);
}

/** 굵은 외곽선 + 제 색 테 + 크림 면의 말랑한 판 — 돌림판 버튼과 같은 장난감 결. */
export function drawCandyPlate(scene: Phaser.Scene, x: number, y: number, width: number, height: number, radius: number, rim: number, outline: number, rimColor: number = TONE.rim): Phaser.GameObjects.Graphics {
  const g = scene.add.graphics({ x, y });
  g.fillStyle(0x000000, 0.18).fillRoundedRect(-width / 2 + 6, -height / 2 + 12, width, height, radius);
  g.fillStyle(TONE.ink, 1).fillRoundedRect(-width / 2 - outline, -height / 2 - outline, width + outline * 2, height + outline * 2, radius + outline);
  g.fillStyle(rimColor, 1).fillRoundedRect(-width / 2, -height / 2, width, height, radius);
  g.fillStyle(TONE.cream, 1).fillRoundedRect(-width / 2 + rim, -height / 2 + rim, width - rim * 2, height - rim * 2, radius - rim);
  g.fillStyle(0xffffff, 0.85).fillRoundedRect(-width / 2 + radius * 0.8, -height / 2 + rim + 8, width - radius * 1.6, 8, 4);
  return g;
}

/** 굵은 제목 글자 — 아래로 떨어지는 그림자 + 짙은 자두빛 획 + 흐르는 색. 어느 언어에서나 같은 표식이라 번역하지 않는다. */
export function addCandyWordmark(scene: Phaser.Scene, body: Phaser.GameObjects.Container, word: string, spec: { y: number; size: number; angle: number; gradient: readonly [string, string, string] }, animate: boolean): void {
  const style = textStyle({ role: "display", size: spec.size });
  const mark = scene.add.container(0, spec.y).setAngle(spec.angle);
  const shadow = scene.add.text(0, 10, word, style).setOrigin(.5).setColor(TONE.inkText).setStroke(TONE.inkText, 16).setLetterSpacing(4);
  const face = scene.add.text(0, 0, word, style).setOrigin(.5).setStroke(TONE.inkText, 16).setLetterSpacing(4);
  paintGradient(face, spec.gradient);
  mark.add([shadow, face]);
  body.add(mark);
  if (animate) scene.tweens.add({ targets: mark, scale: 1.04, duration: 1100, ease: "Sine.InOut", yoyo: true, repeat: -1 });
}

export interface CandyGuideSpec {
  relicId: string;
  sd: { x: number; groundY: number; height: number; shadowWidth: number };
  nameY: number;
  bubble: { x: number; y: number; width: number; height: number; radius: number; rim: number; tail: number };
  greeting: string;
  greetingSize?: number;
}

/**
 * 말풍선을 든 SD 한 명. SD를 누르면 톡 뛰며 반짝인다. 돌려주는 함수가 SD·그림자를 걷는다 —
 * 판이 죽을 때(`DESTROY`)와 씬이 내려갈 때 한 번만 부른다.
 */
export function addCandyGuide(scene: Phaser.Scene, body: Phaser.GameObjects.Container, spec: CandyGuideSpec, animate: boolean): () => void {
  let disposed = false;
  let figure: PuppetCreature | undefined;
  let hop: Phaser.Tweens.Tween | undefined;
  let shadow: Phaser.GameObjects.Container | undefined;
  const cleanup = (): void => {
    if (disposed) return;
    disposed = true;
    hop?.stop(); figure?.destroy(); shadow?.destroy();
    scene.events.off(Phaser.Scenes.Events.SHUTDOWN, cleanup);
  };
  body.once(Phaser.GameObjects.Events.DESTROY, cleanup);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, cleanup);
  ensureSparkleTexture(scene);
  const depth = (body.parentContainer?.depth ?? 0) + 1;
  const { bubble, sd } = spec;

  // 말풍선: 흰 면 + 분홍 테 + 자두빛 외곽선, 꼬리는 SD 쪽.
  const box = scene.add.container(bubble.x, bubble.y);
  const tail = scene.add.graphics();
  const tx = -bubble.width / 2;
  tail.fillStyle(TONE.ink, 1).fillTriangle(tx + 12, -14, tx - bubble.tail - 9, 18, tx + 12, 40);
  tail.fillStyle(TONE.rim, 1).fillTriangle(tx + 12, -6, tx - bubble.tail, 18, tx + 12, 32);
  box.add([tail, drawCandyPlate(scene, 0, 0, bubble.width, bubble.height, bubble.radius, bubble.rim, 5)]);
  box.add(scene.add.text(0, 2, spec.greeting,
    textStyle({ role: "display", size: spec.greetingSize ?? 28, color: TONE.inkText, align: "center", wrap: bubble.width - 56, lineSpacing: 8 })).setOrigin(.5));
  body.add(box);
  if (animate) scene.tweens.add({ targets: box, y: bubble.y - 6, duration: 1500, ease: "Sine.InOut", yoyo: true, repeat: -1 });

  body.add(scene.add.text(sd.x, spec.nameY, getRelic(spec.relicId).name, textStyle({ role: "display", size: 26, color: "#ffffff" })).setOrigin(.5).setStroke(TONE.inkText, 7));
  const hit = scene.add.rectangle(sd.x, sd.groundY - sd.height / 2, sd.height * 0.7, sd.height, 0xffffff, 0).setInteractive({ useHandCursor: true });
  hit.on("pointerup", () => {
    if (!figure || disposed) return;
    hop?.stop();
    hop = startPuppetHop(scene, figure, 0, { once: true });
    for (let index = 0; index < 3; index += 1) {
      const burst = scene.add.image(sd.x + (index - 1) * 70, sd.groundY - sd.height * 0.8 - (index % 2) * 30, SPARKLE_TEXTURE)
        .setTint(index === 1 ? 0xfff3a6 : 0xffffff).setDisplaySize(40, 40).setAlpha(0);
      body.add(burst);
      scene.tweens.add({ targets: burst, alpha: 1, y: burst.y - 30, angle: 90, duration: 260, yoyo: true, delay: index * 70, onComplete: () => burst.destroy() });
    }
  });
  body.add(hit);
  void spawnPuppet(scene, sdAssetFor(spec.relicId), { x: body.x + sd.x, groundY: body.y + sd.groundY, height: sd.height, depth }).then((spawned) => {
    if (disposed) { spawned.destroy(); return; }
    figure = spawned;
    figure.disableInteractive();
    shadow = addSdFootShadow(scene, body.x + sd.x, body.y + sd.groundY, sd.shadowWidth).setDepth(depth - .1);
    hop = startPuppetHop(scene, figure, 0, { once: true });
  }).catch((error) => logError("puppet.display", "안내창 SD 표시 실패", error));
  return cleanup;
}

/** 반짝임 몇 개를 판 위에 톡톡 켠다. */
export function addCandySparkles(scene: Phaser.Scene, body: Phaser.GameObjects.Container, spots: readonly { x: number; y: number; size: number; color: number; delay: number }[], animate: boolean): void {
  ensureSparkleTexture(scene);
  for (const spot of spots) {
    const star = scene.add.image(spot.x, spot.y, SPARKLE_TEXTURE).setTint(spot.color).setDisplaySize(spot.size, spot.size);
    body.add(star);
    const scale = star.scaleX;
    if (!animate) { star.setAlpha(0.7); continue; }
    star.setAlpha(0).setScale(scale * 0.3);
    scene.tweens.add({ targets: star, alpha: 1, scale, angle: 45, duration: 700, yoyo: true, ease: "Sine.InOut", delay: spot.delay, repeat: -1, repeatDelay: 500 });
  }
}
