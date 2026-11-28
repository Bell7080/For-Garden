/**
 * 귀여운 안내 판 — 튜토리얼·첫 방문 안내가 한 벌로 쓰는 판(자리·색은 `cuteGuideLayout.ts`).
 *
 * 그림 한 장과 가운데 맞춤 글만 서던 쪽지는 「시스템 안내문」으로 읽혀 지나치기 쉬웠다(응태 2026-11-28). 레벨 초기화·
 * MAX 급여 창의 문법을 그대로 빌려, 위 무대에서 안내하는 아이(기본은 로비에 세운 애착 렐릭)의 SD가 통통 뛰고 하얀
 * 말풍선이 큰 제목과 본문을 싣는다. 쪽마다 그 콘텐츠의 그림이 말풍선 모서리에 스티커로 붙는다.
 *
 * 닫는 길은 팝업 규칙 그대로다 — 오른쪽 위 X는 없고, 판 밖 우하단의 공용 뒤로가기와 판 밖 누르기가 닫는다. 반드시
 * 지나가야 하는 안내(`required`)만 둘을 끄고 버튼 하나로 넘어간다.
 */
import Phaser from "phaser";
import { t } from "../i18n";
import { motionPolicy } from "../core/settings";
import { getRelic } from "../data/relics";
import { audioManager } from "../managers/AudioManager";
import { logError } from "../managers/ErrorReporter";
import { relicCollection } from "../managers/RelicCollectionManager";
import { sdAssetFor, spawnPuppet } from "../puppets/assets";
import { session } from "../state/session";
import { Button } from "./Button";
import { CUTE_GUIDE, CUTE_GUIDE_TONES, cuteGuideSpots, type CuteGuideTone, type CuteGuideToneId } from "./cuteGuideLayout";
import { chipPoints, drawLayer } from "./holo";
import { addFramedIcon } from "./itemFrame";
import type { PopupLayer } from "./PopupLayer";
import { popupArtShape, shapeClipMask } from "./popupArt";
import { POPUP_BODY_BEVEL_RATIO } from "./popupGeometry";
import { startPuppetHop } from "./puppetHop";
import { addSdFootShadow } from "./SdFootShadow";
import { fitTextToBox, shrinkTextToWidth } from "./textFit";
import { COLOR, textStyle } from "./theme";

export interface CuteGuidePage {
  heading: string;
  body: string;
  /** 말풍선 모서리에 붙는 그림(재화·아이템·직군 텍스처 키). 비우면 스티커를 세우지 않는다. */
  icon?: string;
}

export interface CuteGuideOptions {
  title: string;
  pages: readonly CuteGuidePage[];
  /** 안내하는 아이(렐릭 ID). 비우면 로비에 세운 애착 렐릭이다. */
  guide?: string;
  tone?: CuteGuideToneId;
  /** 무대 아래 덤 칸 — 높이와 그리는 함수(컨테이너 가운데가 칸 가운데). */
  extra?: { height: number; paint: (scene: Phaser.Scene, slot: Phaser.GameObjects.Container, width: number, tone: CuteGuideTone) => void };
  /** 마지막 쪽 버튼 글자. 비우면 「알겠어요」. */
  confirmLabel?: string;
  /** 반드시 지나가야 하는 안내 — 판 밖 누르기·뒤로가기를 끄고 버튼만 남긴다. */
  required?: boolean;
  /** 마지막 쪽 버튼을 눌렀을 때. */
  onConfirm?: () => void;
  onClose?: () => void;
}

const BUBBLE_INK = "#20242b";
const BUBBLE_FILL = 0xfdfbf7;

/** 안내하는 아이 — 넘긴 값, 없으면 애착 렐릭, 그것도 없으면 첫 보유 렐릭. */
export function cuteGuideRelic(guide?: string): string {
  if (guide) return guide;
  if (session.favorite && relicCollection.owns(session.favorite)) return session.favorite;
  return session.favorite || "torika";
}

export function openCuteGuide(scene: Phaser.Scene, popups: PopupLayer, options: CuteGuideOptions): void {
  if (options.pages.length === 0) return;
  const L = CUTE_GUIDE;
  const tone = CUTE_GUIDE_TONES[options.tone ?? "pink"];
  const spots = cuteGuideSpots({ extraHeight: options.extra?.height, pages: options.pages.length });
  const loops = motionPolicy(session.settings).nonEssentialRepeatFactor > 0;
  const guideId = cuteGuideRelic(options.guide);

  popups.open({
    width: L.width, height: spots.height, title: options.title, dim: true, dimAlpha: L.dimAlpha,
    fill: tone.panel, accent: tone.accent,
    ...(options.required ? { hideCloseButton: true, closeOnBackdrop: false } : {}),
    onClose: options.onClose,
  }, (body, close) => {
    const S = L.stage;
    paintCuteBackdrop(scene, body, {
      width: L.width, height: spots.height, stageTop: spots.stageTop, stageBottom: spots.stageBottom,
      rayOrigin: { x: S.sd.x, y: spots.stageTop + S.sd.ground - S.sd.height * 0.55 }, buttonY: spots.buttonY, tone, loops,
    });
    const stage = scene.add.container(0, spots.stageTop);
    body.add(stage);

    // SD — 발밑 그림자 위에서 통통 뛴다. 늦게 와도 말풍선 아래 층에 서도록 먼저 자리를 잡아 둔다.
    const figure = scene.add.container(0, 0);
    stage.add(figure);
    stage.add(addSdFootShadow(scene, S.sd.x, S.sd.ground, S.sd.shadow));
    void spawnPuppet(scene, sdAssetFor(guideId), { x: S.sd.x, groundY: S.sd.ground, height: S.sd.height, depth: 0 })
      .then((puppet) => {
        if (!figure.active) { puppet.destroy(); return; }
        puppet.disableInteractive();
        puppet.setName(`cute-guide-${guideId}`);
        figure.add(puppet);
        const hop = startPuppetHop(scene, puppet, 0, loops ? {} : { once: true });
        puppet.once(Phaser.GameObjects.Events.DESTROY, () => hop.remove());
      })
      .catch((error) => logError("puppet.display", "안내 판 SD 표시 실패", error, { relic: guideId }));
    // 이름표 — SD 발밑에 그 아이의 이름.
    stage.add(scene.add.text(S.sd.x, S.sd.ground + 22, getRelic(guideId).name, textStyle({ role: "display", size: 26, color: COLOR.ink })).setOrigin(0.5).setStroke("#05070a", 6));

    const B = S.bubble;
    const bubble = addCuteBubble(scene, stage, B.x, B.y, B.width, B.height, { tail: B.tail, tailSide: "left" });
    const content = scene.add.container(0, 0);
    bubble.add(content);
    const sticker = scene.add.container(S.sticker.x, S.sticker.y).setAngle(S.sticker.angle);
    stage.add(sticker);
    if (loops) {
      bubble.setScale(0.6).setAlpha(0);
      scene.tweens.add({ targets: bubble, scale: 1, alpha: 1, duration: 320, delay: 140, ease: "Back.Out" });
      const bob = scene.tweens.add({ targets: sticker, y: S.sticker.y - 10, angle: S.sticker.angle + 4, duration: 1100, yoyo: true, repeat: -1, ease: "Sine.InOut" });
      sticker.once(Phaser.GameObjects.Events.DESTROY, () => bob.remove());
    }

    if (options.extra && spots.extraY !== undefined) {
      const slot = scene.add.container(0, spots.extraY);
      body.add(slot);
      options.extra.paint(scene, slot, L.width - 88, tone);
    }

    const dots = scene.add.container(0, spots.dotsY ?? 0);
    body.add(dots);
    // 첫 쪽은 넓은 버튼 하나, 둘째 쪽부터는 같은 폭의 버튼 둘 — 배율로 늘이면 글자까지 찌그러지므로 두 벌을 세워 갈마든다.
    const pairX = (L.button.width + L.button.gap) / 2;
    const prev = new Button(scene, -pairX, spots.buttonY, { width: L.button.width, height: L.button.height, fontSize: L.button.fontSize, label: t("intro.prev"), onClick: () => go(-1) });
    const nextStyle = { height: L.button.height, fontSize: L.button.fontSize, label: t("intro.next"), variant: "primary" as const, fill: tone.button, decorDots: true, onClick: () => go(1) };
    const nextWide = new Button(scene, 0, spots.buttonY, { ...nextStyle, width: L.button.single });
    const nextHalf = new Button(scene, pairX, spots.buttonY, { ...nextStyle, width: L.button.width });
    body.add([prev, nextWide, nextHalf]);

    let page = 0;
    const paint = (): void => {
      const spec = options.pages[page];
      content.removeAll(true);
      const heading = scene.add.text(0, B.headingY, spec.heading, textStyle({ role: "display", size: B.headingSize, color: tone.heading })).setOrigin(0.5);
      shrinkTextToWidth(heading, B.body.wrap);
      // 제목 밑 점선 — 공책에 밑줄 긋듯 짧은 마름모 셋.
      const underline = scene.add.graphics();
      underline.fillStyle(tone.accent, 0.9);
      for (const dx of [-26, 0, 26]) underline.fillPoints(diamond(dx === 0 ? 7 : 5, dx, B.headingY + 40), true);
      // 본문은 남은 칸의 세로 가운데에 앉는다 — 짧은 글이 위에 붙으면 말풍선 아래가 통째로 빈다.
      const text = scene.add.text(0, B.body.top + B.body.height / 2, spec.body, textStyle({ role: "emphasis", size: B.body.size, color: BUBBLE_INK, align: "center", lineSpacing: 10 })).setOrigin(0.5);
      fitTextToBox(text, { width: B.body.wrap, height: B.body.height });
      content.add([heading, underline, text]);
      if (loops) {
        content.setAlpha(0).setY(10);
        scene.tweens.add({ targets: content, alpha: 1, y: 0, duration: 220, ease: "Quad.Out" });
      }

      sticker.removeAll(true);
      if (spec.icon) {
        addFramedIcon(scene, sticker, 0, 0, S.sticker.size, spec.icon, { plain: true });
        if (loops) {
          sticker.setScale(0.4);
          scene.tweens.add({ targets: sticker, scale: 1, duration: 360, ease: "Back.Out" });
        }
      }

      dots.removeAll(true);
      const total = options.pages.length;
      if (total > 1) {
        for (let index = 0; index < total; index += 1) {
          const on = index === page;
          const size = on ? L.dots.size * 1.35 : L.dots.size;
          dots.add(drawLayer(scene, (index - (total - 1) / 2) * L.dots.gap, 0, chipPoints(size, size, { bevel: { topLeft: size * 0.3, bottomRight: size * 0.3 } }), {
            fill: on ? tone.accent : 0xffffff, alpha: on ? 1 : 0.3, shadow: false,
          }));
        }
      }

      const last = page === total - 1;
      const label = last ? options.confirmLabel ?? t("intro.confirm") : t("intro.next");
      nextWide.setLabel(label).setVisible(page === 0);
      nextHalf.setLabel(label).setVisible(page > 0);
      prev.setVisible(page > 0);
    };

    const go = (step: -1 | 1): void => {
      const target = page + step;
      if (target >= options.pages.length) {
        audioManager?.playUi("ui.confirm");
        close();
        options.onConfirm?.();
        return;
      }
      if (target < 0) return;
      page = target;
      paint();
    };

    paint();
  });
}

/** 하얀 말풍선 — 깎인 판에 짙은 그림자, 꼬리가 말하는 아이 쪽을 가리킨다. 돌려주는 컨테이너가 말풍선 가운데다. */
export function addCuteBubble(
  scene: Phaser.Scene, parent: Phaser.GameObjects.Container, x: number, y: number, width: number, height: number,
  options: { tail: number; tailSide: "left" | "bottomLeft" },
): Phaser.GameObjects.Container {
  const bubble = scene.add.container(x, y);
  const bevel = Math.min(width, height) * 0.16;
  bubble.add(drawLayer(scene, 0, 0, chipPoints(width, height, { bevel: { topLeft: bevel, bottomRight: bevel } }), { fill: BUBBLE_FILL, alpha: 0.98, shadow: { x: 8, y: 12 } }));
  const tail = scene.add.graphics().fillStyle(BUBBLE_FILL, 0.98);
  const T = options.tail;
  if (options.tailSide === "left") {
    // 왼쪽 변 아래쪽에서 바깥으로 — SD 머리 높이를 가리킨다.
    const ty = height * 0.12;
    tail.fillPoints([new Phaser.Math.Vector2(-width / 2 + 2, ty - T * 0.7), new Phaser.Math.Vector2(-width / 2 + 2, ty + T * 0.7), new Phaser.Math.Vector2(-width / 2 - T * 1.2, ty + T * 1.1)], true);
  } else {
    tail.fillPoints([
      new Phaser.Math.Vector2(-width / 2 + bevel + 6, height / 2 - 2),
      new Phaser.Math.Vector2(-width / 2 + bevel + 6 + T * 1.3, height / 2 - 2),
      new Phaser.Math.Vector2(-width / 2 - T * 0.4, height / 2 + T),
    ], true);
  }
  bubble.add(tail);
  parent.add(bubble);
  return bubble;
}

export interface CuteBackdropSpec {
  width: number;
  height: number;
  stageTop: number;
  stageBottom: number;
  rayOrigin: { x: number; y: number };
  buttonY: number;
  tone: CuteGuideTone;
  loops: boolean;
}

/**
 * 판 뒷배경 — 위는 판의 색으로 물들고 아래로 그 색의 짙은 결에 가라앉는다. 무대에는 SD 뒤에서 도는 빛살과 후광,
 * 마름모 점 무늬, 떠오르는 반짝임이, 아래에는 버튼 뒤 후광이 얹힌다. 모두 몸판 실루엣으로 잘라 깎인 모서리 밖으로
 * 새지 않는다(레벨 초기화 창과 같은 결).
 */
export function paintCuteBackdrop(scene: Phaser.Scene, body: Phaser.GameObjects.Container, spec: CuteBackdropSpec): void {
  const D = CUTE_GUIDE.backdrop;
  const { width, height, tone, loops } = spec;
  const top = -height / 2;
  const mask = shapeClipMask(scene, body, popupArtShape(width, height));
  const stageHeight = spec.stageBottom - top;
  const unit = Math.min(width, height) * POPUP_BODY_BEVEL_RATIO;
  const stageMask = shapeClipMask(scene, body, chipPoints(width, stageHeight, { bevel: { topLeft: unit } }), { x: 0, y: top + stageHeight / 2 });

  const wash = scene.add.graphics();
  const lowTop = spec.stageBottom + 40;
  wash.fillGradientStyle(tone.wash, tone.wash, tone.deep, tone.deep, D.washAlpha, D.washAlpha, D.washAlpha * 0.9, D.washAlpha * 0.9);
  wash.fillRect(-width / 2, top, width, lowTop - top);
  wash.fillGradientStyle(tone.deep, tone.deep, tone.wash, tone.wash, D.washAlpha * 0.9, D.washAlpha * 0.9, D.washAlpha * 0.7, D.washAlpha * 0.7);
  wash.fillRect(-width / 2, lowTop, width, height / 2 - lowTop);
  wash.setMask(mask);
  body.add(wash);

  const { x: cx, y: cy } = spec.rayOrigin;
  const rays = scene.add.graphics({ x: cx, y: cy });
  rays.setBlendMode(Phaser.BlendModes.ADD);
  const reach = width * 1.2;
  const step = (Math.PI * 2) / D.rays;
  for (let i = 0; i < D.rays; i += 1) {
    const a = i * step;
    rays.fillStyle(tone.ray, D.rayAlpha * (i % 2 === 0 ? 1 : 0.55));
    rays.fillTriangle(0, 0, Math.cos(a - step * 0.22) * reach, Math.sin(a - step * 0.22) * reach, Math.cos(a + step * 0.22) * reach, Math.sin(a + step * 0.22) * reach);
  }
  rays.setMask(stageMask);
  body.add(rays);
  if (loops) {
    const spin = scene.tweens.add({ targets: rays, angle: 360, duration: D.spinMs, repeat: -1 });
    rays.once(Phaser.GameObjects.Events.DESTROY, () => spin.remove());
  }

  const halo = scene.add.graphics({ x: cx, y: cy });
  halo.setBlendMode(Phaser.BlendModes.ADD);
  for (let i = 0; i < 6; i += 1) {
    const r = 70 + i * 34;
    halo.fillStyle(tone.ray, 0.045);
    halo.fillPoints(diamond(r, 0, 0, 1.15), true);
  }
  halo.setMask(stageMask);
  body.add(halo);

  const dots = scene.add.graphics();
  const gap = D.dotStep;
  for (let row = 0, y = top + gap / 2; y < spec.stageBottom; row += 1, y += gap) {
    const fade = 1 - (y - top) / (spec.stageBottom - top);
    dots.fillStyle(tone.dot, D.dotAlpha * fade);
    for (let x = -width / 2 + (row % 2 === 0 ? gap / 2 : gap); x < width / 2; x += gap) dots.fillPoints(diamond(3.5, x, y), true);
  }
  dots.setMask(mask);
  body.add(dots);

  const floor = scene.add.graphics();
  floor.fillGradientStyle(tone.ray, tone.ray, tone.ray, tone.ray, 0, 0.3, 0, 0.3);
  floor.fillRect(-width / 2, spec.stageBottom - 6, width / 2, 2);
  floor.fillGradientStyle(tone.ray, tone.ray, tone.ray, tone.ray, 0.3, 0, 0.3, 0);
  floor.fillRect(0, spec.stageBottom - 6, width / 2, 2);
  floor.setMask(mask);
  body.add(floor);

  const glow = scene.add.graphics({ x: 0, y: spec.buttonY });
  glow.setBlendMode(Phaser.BlendModes.ADD);
  for (let i = 0; i < 5; i += 1) {
    const r = 150 + i * 46;
    glow.fillStyle(tone.ray, 0.035);
    glow.fillPoints([new Phaser.Math.Vector2(0, -r * 0.42), new Phaser.Math.Vector2(r * 1.5, 0), new Phaser.Math.Vector2(0, r * 0.42), new Phaser.Math.Vector2(-r * 1.5, 0)], true);
  }
  glow.setMask(mask);
  body.add(glow);

  // 반짝임 — 난수 없이 번호에서 자리·박자를 정한다.
  for (let i = 0; i < D.sparks; i += 1) {
    const x = -width / 2 + 60 + ((i * 263) % (width - 120));
    const y = spec.stageTop + 30 + ((i * 131) % Math.max(1, spec.stageBottom - spec.stageTop - 60));
    const size = 5 + (i % 3) * 2.5;
    const spark = scene.add.graphics({ x, y });
    spark.setBlendMode(Phaser.BlendModes.ADD);
    spark.fillStyle(tone.spark, 0.75);
    spark.fillPoints(star(size), true);
    spark.setMask(mask);
    body.add(spark);
    if (!loops) { spark.setAlpha(0.5); continue; }
    spark.setAlpha(0).setScale(0.4);
    const twinkle = scene.tweens.add({
      targets: spark, alpha: { from: 0, to: 0.75 }, scale: { from: 0.4, to: 1 }, y: { from: y, to: y - 26 },
      duration: 1600 + (i % 4) * 300, yoyo: true, repeat: -1, delay: (i * 370) % 1800, ease: "Sine.InOut",
    });
    spark.once(Phaser.GameObjects.Events.DESTROY, () => twinkle.remove());
  }
}

function diamond(r: number, dx: number, dy: number, stretch = 1): Phaser.Math.Vector2[] {
  return [new Phaser.Math.Vector2(dx, dy - r), new Phaser.Math.Vector2(dx + r * stretch, dy), new Phaser.Math.Vector2(dx, dy + r), new Phaser.Math.Vector2(dx - r * stretch, dy)];
}

function star(size: number): Phaser.Math.Vector2[] {
  const s = size;
  return [
    new Phaser.Math.Vector2(0, -s * 1.6), new Phaser.Math.Vector2(s * 0.4, -s * 0.4), new Phaser.Math.Vector2(s * 1.6, 0), new Phaser.Math.Vector2(s * 0.4, s * 0.4),
    new Phaser.Math.Vector2(0, s * 1.6), new Phaser.Math.Vector2(-s * 0.4, s * 0.4), new Phaser.Math.Vector2(-s * 1.6, 0), new Phaser.Math.Vector2(-s * 0.4, -s * 0.4),
  ];
}
