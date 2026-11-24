import Phaser from "phaser";
import type { GrowthPathId } from "../core/growthPaths";
import { motionPolicy } from "../core/settings";
import { relicAppearanceManager } from "../managers/RelicAppearanceManager";
import { spawnPuppet, type PuppetCreature } from "../puppets/assets";
import { session } from "../state/session";
import { EFFECT_TEXTURE, ensureEffectTextures } from "./effectTextures";
import { drawGlyph } from "./glyphs";
import { UI_ICON } from "./icons";
import { runeTexture } from "./runeIcons";
import { RUNE_PIECE_ORIGIN_Y, runePartOfTexture, runePieceFit } from "./runePieceContent";
import { addSdFootShadow } from "./SdFootShadow";
import { loadOwnedPuppet } from "./statusPuppetLoad";

/**
 * 강해지는 길 타일 안의 **작은 장면** — 그 길에 가면 무엇을 하는지를 편성 속 SD가 직접 보여 준다.
 *
 * 편성 바꾸기는 둘이 폴짝 뛰어 자리를 바꾸고, 고고학은 곡괭이가 흙을 찍어 화석이 튀어나오며, 연구소는
 * 돋보기가 화석 위를 맴돌고, 렐릭 강화는 치즈케이크가 날아들고, 룬 세공은 룬 조각이 반짝인다.
 *
 * 무겁지 않게 짠다: SD는 이미 이 판에 읽혀 있는 편성 렐릭이라 다시 받지 않고, **세운 뒤 idle을 멈춰**
 * 관절 계산 없이 위치 트윈만 돈다. 그림은 이미 있는 재화·곡괭이·룬 아이콘과 공용 파편 한 장뿐이고,
 * 움직임 줄이기에서는 장면이 멈춘 한 장으로 선다.
 */
export const GROWTH_SCENE = {
  /** 장면의 SD 키(그림 높이). */
  sdHeight: 112,
  /** 장면 한 바퀴의 길이(ms). 길마다 박자를 조금씩 어긋나게 해 셋이 같이 뛰지 않는다. */
  loopMs: 2400,
  /** 타일마다 시작 박자를 미는 몫(ms). */
  stagger: 380,
  /** 소품(화석·치즈케이크·룬) 한 변. 재화 그림은 캔버스 여백이 있어 보이는 크기는 SD 키의 2/3쯤이라 작은 타일에서도 무엇인지 한눈에 읽힌다. */
  propSize: 92,
} as const;

/** 장면 하나가 붙잡는 것 — 판이 닫힐 때 한꺼번에 놓는다. */
export interface GrowthSceneHost {
  /** 화면 좌표의 층(팝업 몸판 바로 위). Puppet과 장면 소품이 모두 여기에 선다. */
  layer: Phaser.GameObjects.Container;
  puppets: Set<PuppetCreature>;
  isDisposed: () => boolean;
}

/** 장면의 기준점. `x`는 타일 가운데, `ground`는 SD가 발을 딛는 줄(둘 다 화면 좌표). */
interface Spot { x: number; ground: number; index: number }

interface Ctx { scene: Phaser.Scene; host: GrowthSceneHost; spot: Spot; loop: boolean; tweens: Phaser.Tweens.Tween[] }

/** 길마다 장면을 세운다. `cast`는 그 장면에 설 렐릭(앞에서부터 쓴다). 돌려주는 함수가 트윈을 멈춘다. */
export function addGrowthPathScene(
  scene: Phaser.Scene,
  host: GrowthSceneHost,
  pathId: GrowthPathId,
  spot: Spot,
  cast: readonly string[],
  tone: number,
): () => void {
  ensureEffectTextures(scene);
  const ctx: Ctx = { scene, host, spot, loop: motionPolicy(session.settings).nonEssentialRepeatFactor > 0, tweens: [] };
  // 무대 조명 — 장면 뒤에 그 길의 색으로 옅은 빛 한 장을 깐다(겹쳐 밝아지는 합성이라 옅게만).
  host.layer.add(scene.add.image(spot.x, spot.ground - GROWTH_SCENE.sdHeight * 0.45, EFFECT_TEXTURE.glow)
    .setTint(tone).setDisplaySize(250, 150).setAlpha(0.16).setBlendMode(Phaser.BlendModes.ADD));
  switch (pathId) {
    case "party": partyScene(ctx, cast); break;
    case "archaeology": archaeologyScene(ctx, cast[0]); break;
    case "lab": labScene(ctx, cast[0]); break;
    case "relicEnhance": feedScene(ctx, cast[0]); break;
    case "runeCraft": runeScene(ctx, cast[0]); break;
  }
  return () => { for (const tween of ctx.tweens) { if (!tween.isDestroyed()) tween.stop(); } ctx.tweens.length = 0; };
}

/** 장면 한 바퀴의 시작 지연 — 타일마다 어긋난다. */
function phase(ctx: Ctx): number { return ctx.spot.index * GROWTH_SCENE.stagger; }

function tween(ctx: Ctx, config: Phaser.Types.Tweens.TweenBuilderConfig): void {
  if (!ctx.loop) return;
  ctx.tweens.push(ctx.scene.tweens.add(config));
}

/** 한 대상의 걸음을 이어 끝없이 되풀이한다. 걸음마다 대상을 다시 적지 않게 여기서 채운다. */
function chain(ctx: Ctx, target: object, delay: number, steps: ReadonlyArray<Omit<Phaser.Types.Tweens.TweenBuilderConfig, "targets">>): void {
  if (!ctx.loop) return;
  ctx.tweens.push(ctx.scene.tweens.chain({ targets: target, delay, loop: -1, tweens: steps.map((step) => ({ ...step, targets: target })) }) as unknown as Phaser.Tweens.Tween);
}

/**
 * SD 한 명을 발끝 기준으로 세운다. 세운 뒤 idle을 멈춰 관절을 계산하지 않고, 도착하면 `ready`로
 * 움직임을 건다 — 늦게 도착해도 장면의 다른 소품은 먼저 서 있다.
 */
function standSd(ctx: Ctx, relicId: string | undefined, x: number, ready?: (sd: PuppetCreature) => void, flip = false): void {
  const { scene, host, spot } = ctx;
  host.layer.add(addSdFootShadow(scene, x, spot.ground + 4, GROWTH_SCENE.sdHeight * 0.62));
  if (!relicId) return;
  void loadOwnedPuppet({
    spawn: () => spawnPuppet(scene, relicAppearanceManager.sdAssetFor(relicId), { x, groundY: spot.ground, height: GROWTH_SCENE.sdHeight }),
    isCurrent: () => !host.isDisposed(),
    isDisplayable: (puppet) => Boolean(puppet.active),
    adopt: (puppet) => {
      puppet.disableInteractive();
      puppet.setAnimationFrozen(true);
      if (flip) puppet.setFlipX(true);
      host.layer.add(puppet);
      host.puppets.add(puppet);
      ready?.(puppet);
    },
  });
}

/** 공용 파편 한 조각(마름모). 반짝임·흙 부스러기가 같은 한 장을 색만 바꿔 쓴다. */
function shard(ctx: Ctx, x: number, y: number, color: number, scale: number): Phaser.GameObjects.Image {
  const image = ctx.scene.add.image(x, y, EFFECT_TEXTURE.shard).setTint(color).setScale(scale).setAlpha(0);
  ctx.host.layer.add(image);
  return image;
}

/**
 * 소품 한 장 — 같은 그림을 검게 한 겹 비껴 깔아 밝은 판 위에서도 실루엣이 떠오르게 한다(재화 액자와 같은 결).
 * 룬 조각은 캔버스가 아니라 보이는 그림을 가운데에 맞춘다(`runePieceFit`). 트윈은 이 컨테이너에 건다.
 */
function prop(ctx: Ctx, x: number, y: number, key: string, size: number): Phaser.GameObjects.Container {
  const { scene } = ctx;
  const holder = scene.add.container(x, y);
  const part = runePartOfTexture(key);
  const place = (image: Phaser.GameObjects.Image): Phaser.GameObjects.Image => {
    if (part === undefined) return image.setDisplaySize(size, size);
    const fit = runePieceFit(part, size, 1);
    return image.setOrigin(0.5, RUNE_PIECE_ORIGIN_Y).setDisplaySize(fit.size, fit.size).setPosition(fit.x + image.x, fit.y + image.y);
  };
  const offset = size * 0.05;
  holder.add(place(scene.add.image(offset, offset * 1.3, key)).setTint(0x05070a).setAlpha(0.5));
  holder.add(place(scene.add.image(0, 0, key)));
  ctx.host.layer.add(holder);
  return holder;
}

/** 네 갈래 반짝임 — 마름모 둘을 십자로 겹친다. 한 바퀴에 한 번 톡 켜졌다 꺼진다. */
function twinkle(ctx: Ctx, x: number, y: number, color: number, delay: number, size = 0.42): void {
  const a = shard(ctx, x, y, color, size);
  const b = shard(ctx, x, y, color, size).setAngle(90);
  if (!ctx.loop) { a.setAlpha(0.9); b.setAlpha(0.9); return; }
  tween(ctx, {
    targets: [a, b], alpha: { from: 0, to: 1 }, scale: { from: size * 0.4, to: size }, duration: 260, yoyo: true, hold: 120,
    ease: "Sine.Out", delay: phase(ctx) + delay, repeat: -1, repeatDelay: GROWTH_SCENE.loopMs - 640,
  });
}

/** 편성 바꾸기 — 두 SD가 폴짝 뛰어 서로의 자리로 건너갔다가, 잠깐 쉬고 다시 돌아온다. */
function partyScene(ctx: Ctx, cast: readonly string[]): void {
  const { scene, spot } = ctx;
  const left = spot.x - 58;
  const right = spot.x + 58;
  // 자리를 바꾼다는 것은 두 SD 사이의 엇갈린 화살표 둘이 말한다.
  const arrows = scene.add.container(spot.x, spot.ground - GROWTH_SCENE.sdHeight - 2);
  arrows.add(drawGlyph(scene, "exchange", 0, 0, 34, 0xffd36a));
  ctx.host.layer.add(arrows);
  tween(ctx, { targets: arrows, angle: { from: -8, to: 8 }, duration: GROWTH_SCENE.loopMs / 4, yoyo: true, repeat: -1, ease: "Sine.InOut" });
  const hop = (sd: PuppetCreature, from: number, to: number, lift: number) => {
    const baseY = sd.y;
    const half = GROWTH_SCENE.loopMs / 2;
    // 가로는 곧게, 세로는 포물선으로 — 한쪽은 높이 넘고 한쪽은 낮게 넘어 둘이 부딪히지 않는다.
    chain(ctx, sd, phase(ctx), [
        { x: to, duration: 520, ease: "Sine.InOut", onUpdate: (tw: Phaser.Tweens.Tween) => { sd.y = baseY - Math.sin(tw.progress * Math.PI) * lift; } },
        { x: to, duration: half - 520 },
        { x: from, duration: 520, ease: "Sine.InOut", onUpdate: (tw: Phaser.Tweens.Tween) => { sd.y = baseY - Math.sin(tw.progress * Math.PI) * lift; } },
        { x: from, duration: half - 520 },
    ]);
  };
  standSd(ctx, cast[0], left, (sd) => hop(sd, left, right, 46));
  standSd(ctx, cast[1] ?? cast[0], right, (sd) => hop(sd, right, left, 16), true);
}

/** 고고학 — SD가 곡괭이를 들어 흙더미를 내려찍고, 부스러기와 함께 화석이 톡 튀어나온다. */
function archaeologyScene(ctx: Ctx, relicId: string | undefined): void {
  const { scene, spot } = ctx;
  const sdX = spot.x - 50;
  const moundX = spot.x + 52;
  // 흙더미는 납작한 마름모 둘 — 동그라미를 쓰지 않는다.
  const mound = scene.add.graphics();
  mound.fillStyle(0x4a3524, 1).fillPoints([
    new Phaser.Geom.Point(moundX - 50, spot.ground + 6), new Phaser.Geom.Point(moundX - 6, spot.ground - 20),
    new Phaser.Geom.Point(moundX + 50, spot.ground + 6), new Phaser.Geom.Point(moundX, spot.ground + 14),
  ], true);
  mound.fillStyle(0x6b4c32, 1).fillPoints([
    new Phaser.Geom.Point(moundX - 32, spot.ground + 2), new Phaser.Geom.Point(moundX - 4, spot.ground - 14),
    new Phaser.Geom.Point(moundX + 30, spot.ground + 2), new Phaser.Geom.Point(moundX, spot.ground + 6),
  ], true);
  ctx.host.layer.add(mound);
  const fossilRest = spot.ground - 8;
  const fossilUp = spot.ground - 62;
  const fossil = prop(ctx, moundX + 6, ctx.loop ? fossilRest : fossilUp, "currency-fossil", GROWTH_SCENE.propSize).setAlpha(ctx.loop ? 0 : 1);
  // 내려찍을 때마다 SD가 한 뼘 숙였다 튄다 — 곡괭이를 든 몸이 함께 움직여야 「찍는다」로 읽힌다.
  standSd(ctx, relicId, sdX, (sd) => {
    const baseY = sd.y;
    tween(ctx, { targets: sd, y: baseY + 5, duration: 120, yoyo: true, ease: "Quad.In", delay: phase(ctx) + 360, repeat: -1, repeatDelay: GROWTH_SCENE.loopMs - 240 });
  });
  // 곡괭이는 손잡이 끝(SD의 손 자리)을 축으로 돈다 — 머리 위로 들었다가 날이 흙더미 꼭대기를 친다.
  const pick = scene.add.image(sdX + 32, spot.ground - 48, UI_ICON.pickaxe).setOrigin(0.18, 0.82).setDisplaySize(76, 76).setAngle(ctx.loop ? -40 : 62);
  ctx.host.layer.add(pick);
  chain(ctx, pick, phase(ctx), [
    { angle: -58, duration: 360, ease: "Sine.Out" },
    { angle: 66, duration: 120, ease: "Quad.In" },
    { angle: 62, duration: 220, ease: "Sine.Out" },
    { angle: -40, duration: GROWTH_SCENE.loopMs - 700, ease: "Sine.InOut" },
  ]);
  // 찍는 순간: 부스러기가 위로 튀고 화석이 솟는다.
  const chips = [-1, 0, 1].map((side) => ({ image: shard(ctx, moundX, spot.ground - 16, side === 0 ? 0xc89a62 : 0x8a6440, 0.3), side }));
  for (const { image, side } of chips) {
    tween(ctx, {
      targets: image, x: moundX + side * 30, y: spot.ground - 40 - (side === 0 ? 16 : 0), alpha: { from: 1, to: 0 }, angle: side * 60,
      duration: 460, ease: "Quad.Out", delay: phase(ctx) + 480, repeat: -1, repeatDelay: GROWTH_SCENE.loopMs - 460,
    });
  }
  const hold = 1000;
  tween(ctx, {
    targets: fossil, y: { from: fossilRest, to: fossilUp }, alpha: { from: 0, to: 1 }, angle: { from: -20, to: 8 },
    duration: 380, ease: "Back.Out", hold, yoyo: true, delay: phase(ctx) + 500, repeat: -1, repeatDelay: GROWTH_SCENE.loopMs - hold - 760,
  });
  twinkle(ctx, moundX + 40, spot.ground - 96, 0xffe7a3, 860);
}

/** 연구소 — 받침 위 화석을 돋보기가 맴돌며 살피고, 다 보면 화석이 반짝인다. */
function labScene(ctx: Ctx, relicId: string | undefined): void {
  const { scene, spot } = ctx;
  const sdX = spot.x - 54;
  const benchX = spot.x + 52;
  const bench = scene.add.graphics();
  // 받침은 기울인 납작한 판 — 연구소의 크림빛 알약과 같은 결.
  bench.fillStyle(0x2f3c52, 1).fillPoints([
    new Phaser.Geom.Point(benchX - 42, spot.ground + 2), new Phaser.Geom.Point(benchX - 34, spot.ground - 14),
    new Phaser.Geom.Point(benchX + 42, spot.ground - 14), new Phaser.Geom.Point(benchX + 34, spot.ground + 2),
  ], true);
  bench.fillStyle(0x9fd8ff, 0.55).fillRect(benchX - 34, spot.ground - 14, 76, 3);
  ctx.host.layer.add(bench);
  const glow = scene.add.image(benchX, spot.ground - 46, EFFECT_TEXTURE.glow).setTint(0xffc65a).setDisplaySize(130, 100).setAlpha(0.18).setBlendMode(Phaser.BlendModes.ADD);
  ctx.host.layer.add(glow);
  const fossil = prop(ctx, benchX, spot.ground - 50, "currency-fossil", GROWTH_SCENE.propSize);
  standSd(ctx, relicId, sdX);
  tween(ctx, { targets: fossil, y: spot.ground - 58, angle: { from: -4, to: 4 }, duration: GROWTH_SCENE.loopMs / 2, yoyo: true, repeat: -1, ease: "Sine.InOut", delay: phase(ctx) });
  tween(ctx, { targets: glow, alpha: { from: 0.12, to: 0.38 }, duration: GROWTH_SCENE.loopMs / 2, yoyo: true, repeat: -1, ease: "Sine.InOut", delay: phase(ctx) });
  // 돋보기는 화석 둘레를 작은 마름모 길로 돈다.
  const lens = drawGlyph(scene, "magnifier", benchX + 30, spot.ground - 82, 40, 0xdff4ff);
  ctx.host.layer.add(lens);
  const ox = benchX + 30;
  const oy = spot.ground - 82;
  chain(ctx, lens, phase(ctx), [
      { x: ox - 30, y: oy + 8, duration: GROWTH_SCENE.loopMs / 4, ease: "Sine.InOut" },
      { x: ox - 18, y: oy + 22, duration: GROWTH_SCENE.loopMs / 4, ease: "Sine.InOut" },
      { x: ox + 6, y: oy + 14, duration: GROWTH_SCENE.loopMs / 4, ease: "Sine.InOut" },
      { x: ox, y: oy, duration: GROWTH_SCENE.loopMs / 4, ease: "Sine.InOut" },
      ]);
  twinkle(ctx, benchX - 36, spot.ground - 86, 0xffe7a3, 900);
  twinkle(ctx, benchX + 40, spot.ground - 30, 0xbfe9ff, 1500, 0.3);
}

/** 렐릭 강화 — 치즈케이크가 포물선으로 날아들 때마다 SD가 통 뛰고 위로 화살표가 솟는다. */
function feedScene(ctx: Ctx, relicId: string | undefined): void {
  const { scene, spot } = ctx;
  const sdX = spot.x + 20;
  const fromX = spot.x - 82;
  standSd(ctx, relicId, sdX, (sd) => {
    const baseY = sd.y;
    tween(ctx, { targets: sd, y: baseY - 14, duration: 150, yoyo: true, ease: "Quad.Out", delay: phase(ctx) + 560, repeat: -1, repeatDelay: GROWTH_SCENE.loopMs - 300 });
  });
  const cake = prop(ctx, fromX, spot.ground - 30, "currency-cheesecake", GROWTH_SCENE.propSize).setAlpha(ctx.loop ? 0 : 1);
  const targetY = spot.ground - GROWTH_SCENE.sdHeight * 0.55;
  tween(ctx, {
    targets: cake, x: { from: fromX, to: sdX - 6 }, alpha: { from: 1, to: 0.2 }, scale: { from: cake.scale, to: cake.scale * 0.55 },
    duration: 560, ease: "Sine.In", delay: phase(ctx), repeat: -1, repeatDelay: GROWTH_SCENE.loopMs - 560,
    onUpdate: (tw) => { cake.y = (spot.ground - 30) + (targetY - (spot.ground - 30)) * tw.progress - Math.sin(tw.progress * Math.PI) * 44; },
  });
  const up = drawGlyph(scene, "speed", sdX + 40, spot.ground - GROWTH_SCENE.sdHeight + 6, 26, 0x9cf27a).setAngle(-90).setAlpha(ctx.loop ? 0 : 1);
  ctx.host.layer.add(up);
  tween(ctx, {
    targets: up, y: { from: spot.ground - GROWTH_SCENE.sdHeight + 10, to: spot.ground - GROWTH_SCENE.sdHeight - 16 }, alpha: { from: 1, to: 0 },
    duration: 620, ease: "Quad.Out", delay: phase(ctx) + 600, repeat: -1, repeatDelay: GROWTH_SCENE.loopMs - 620,
  });
}

/** 룬 세공 — SD 곁에 룬 조각이 떠서 천천히 돌고, 세공의 반짝임이 차례로 켜진다. */
function runeScene(ctx: Ctx, relicId: string | undefined): void {
  const { scene, spot } = ctx;
  const sdX = spot.x - 48;
  const runeX = spot.x + 58;
  const runeY = spot.ground - 56;
  standSd(ctx, relicId, sdX);
  const glow = scene.add.image(runeX, runeY, EFFECT_TEXTURE.glow).setTint(0xff7fd0).setDisplaySize(130, 130).setAlpha(0.2).setBlendMode(Phaser.BlendModes.ADD);
  ctx.host.layer.add(glow);
  const rune = prop(ctx, runeX, runeY, runeTexture("epic", 0), GROWTH_SCENE.propSize - 12);
  tween(ctx, { targets: rune, y: runeY - 8, duration: GROWTH_SCENE.loopMs / 2, yoyo: true, repeat: -1, ease: "Sine.InOut", delay: phase(ctx) });
  tween(ctx, { targets: glow, alpha: { from: 0.12, to: 0.36 }, duration: GROWTH_SCENE.loopMs / 2, yoyo: true, repeat: -1, ease: "Sine.InOut", delay: phase(ctx) });
  twinkle(ctx, runeX - 42, runeY - 34, 0xffe7a3, 300, 0.34);
  twinkle(ctx, runeX + 42, runeY - 8, 0xbfe9ff, 900, 0.3);
  twinkle(ctx, runeX - 4, runeY + 40, 0xffd0f0, 1500, 0.28);
}
