import Phaser from "phaser";
import type { RelicDef } from "../core/types";
import { SQUADS } from "../data/factions";
import { portraitAssetFor, withPuppetTexture } from "../puppets/assets";
import { AffinityBadge } from "./AffinityBadge";
import { ELEMENT_ICON, ROLE_ICON } from "./affinityIcons";
import { addFactionMark } from "./FactionMark";
import { chipPoints, drawInnerVignette, drawLayer, drawShapeEdge, drawShapeOutline } from "./holo";
import { RARITY_TONE } from "./rarityMark";
import { squeezeTextToWidth } from "./textFit";
import { COLOR, textStyle } from "./theme";
import { t } from "../i18n";

/**
 * 도감 전시대의 한 칸 — 세로로 긴 스탠딩 원화 한 장.
 *
 * 얼굴만 담던 액자는 「누구인가」까지만 말했고, 칸 옆에 등급 글자 하나가 붙어 초라했다. 전시 칸은 원화를
 * 정수리부터 허벅지께까지 세로로 길게 세우고, 그 개체를 말하는 표식을 둘레에 단다 — 왼쪽 위 등급,
 * 그 아래 속성·직군, 원화 뒤로 옅게 깔린 소속 엠블럼, 밑동의 이름과 소속 이름. 레벨은 두지 않는다
 * (도감은 키운 정도가 아니라 만났는가를 적는 곳이다).
 *
 * 원화는 **칸 실루엣대로 한 번만 굽고 원본은 놓는다**(`withPuppetTexture`) — 얼굴 액자와 같은 이유로
 * 깎인 모서리를 덮지도 마스크로 자르지도 않는다. 밑동의 어둠도 함께 구워 이름이 원화 위에서 읽히게 한다.
 * 굽는 일은 칸이 처음 보일 때(`reveal`)만 하므로 창을 열어도 화면 밖 칸의 전신을 읽지 않는다.
 */
export const CODEX_STANDEE = {
  bevel: 0.15,
  /** 원화를 자르는 세로 몫 — 실루엣 높이 대비. 1이면 발끝까지, 작을수록 상반신에 다가간다. */
  cropHeight: 0.74,
  /** 머리 관절이 자르는 상자 위에서 얼마나 내려온 자리에 서는가(자르는 높이 대비). 실루엣 윗선은 원화마다 여백이 달라 머리 관절로 세운다. */
  headY: 0.15,
  /** 밑동 어둠이 시작하는 높이(칸 높이 대비)와 끝 진하기. */
  shade: { from: 0.5, alpha: 0.92 },
  rarity: 34,
  element: 46,
  role: 38,
  name: 27,
  squad: { emblem: 30, text: 18 },
  emblem: { size: 0.86, alpha: 0.2, y: -0.12 },
  unknownFill: 0x121821,
} as const;

/** 개체·칸 크기 → 구운 전시 원화 키. 캔버스는 전역 텍스처라 씬과 창을 넘어 다시 쓴다. */
const BAKED = new Map<string, string>();

export class CodexStandee extends Phaser.GameObjects.Container {
  private disposed = false;
  private requested = false;
  private readonly shape: number[];
  private readonly artLayer: Phaser.GameObjects.Container;

  constructor(scene: Phaser.Scene, x: number, y: number, private readonly def: RelicDef, private readonly recorded: boolean, private readonly size: { width: number; height: number }) {
    super(scene, x, y);
    scene.add.existing(this);
    const { width, height } = size;
    const bevel = width * CODEX_STANDEE.bevel;
    this.shape = chipPoints(width, height, { bevel: { topLeft: bevel, topRight: 0, bottomRight: bevel, bottomLeft: 0 } });
    const tone = RARITY_TONE[def.rarity];
    this.add(drawLayer(scene, 0, 0, this.shape, { fill: recorded ? 0x0b1118 : CODEX_STANDEE.unknownFill, alpha: 0.96 }));
    if (recorded) {
      // 등급색으로 물든 뒷면과 그 위에 옅게 깔린 소속 엠블럼 — 원화가 도착하기 전에도 칸이 비어 보이지 않는다.
      this.add(drawLayer(scene, 0, 0, this.shape, { fill: tone.chip, alpha: 0.26 }));
      const emblem = addFactionMark(scene, 0, height * CODEX_STANDEE.emblem.y, def.squad, { size: width * CODEX_STANDEE.emblem.size });
      if (emblem) { emblem.setAlpha(CODEX_STANDEE.emblem.alpha); this.add(emblem); }
    } else {
      this.add(scene.add.text(0, -height * 0.06, "?", textStyle({ role: "display", size: Math.round(width * 0.5), color: "#8a96a6" })).setOrigin(0.5).setAlpha(0.5));
    }
    this.once(Phaser.GameObjects.Events.DESTROY, () => { this.disposed = true; });
    this.artLayer = scene.add.container(0, 0);
    this.add(this.artLayer);
    if (recorded) {
      const cached = BAKED.get(this.cacheKey());
      if (cached && scene.textures.exists(cached)) { this.placeArt(cached); this.requested = true; }
    }
    this.paintChrome();
  }

  /** 칸이 처음 보일 때 부른다 — 그때서야 원화를 읽어 굽는다. 두 번 불러도 한 번만 굽는다. */
  reveal(): void {
    if (this.requested || !this.recorded) return;
    this.requested = true;
    void this.bake();
  }

  private cacheKey(): string { return `${this.def.portraitAssetId}:${Math.round(this.size.width)}x${Math.round(this.size.height)}`; }

  private async bake(): Promise<void> {
    const asset = portraitAssetFor(this.def.portraitAssetId);
    const key = await withPuppetTexture(this.scene, asset, ({ key: source, anchors }) => {
      if (this.disposed) return undefined;
      return bakeStandeeTexture(this.scene, source, this.cacheKey(), this.size, this.shape, standeeCrop(asset, anchors.head, this.size));
    }).catch(() => undefined);
    if (!key) return;
    BAKED.set(this.cacheKey(), key);
    if (!this.disposed) this.placeArt(key);
  }

  private placeArt(key: string): void {
    // 뒷면·엠블럼 위, 장식 아래의 제 층에 선다 — 언제 도착하든 장식이 늘 원화 위에 남는다.
    this.artLayer.add(this.scene.add.image(0, 0, key).setDisplaySize(this.size.width, this.size.height));
  }

  private paintChrome(): void {
    const scene = this.scene;
    const { width, height } = this.size;
    const def = this.def;
    const tone = RARITY_TONE[def.rarity];
    this.add(drawInnerVignette(scene, 0, 0, this.shape, { strength: 0.35, depth: 0.12 }));
    this.add(drawShapeOutline(scene, 0, 0, this.shape, { color: this.recorded ? tone.chip : COLOR.inkDimHex, alpha: this.recorded ? 0.95 : 0.55, width: 3 }));
    if (this.recorded) this.add(drawShapeEdge(scene, 0, 0, this.shape, "top", { color: Phaser.Display.Color.HexStringToColor(tone.halo).color, alpha: 0.85, width: 4 }));
    const left = -width / 2 + 14;
    const top = -height / 2;
    const rarity = scene.add.text(left + width * CODEX_STANDEE.bevel * 0.55, top + 8, def.rarity, textStyle({ role: "display", size: CODEX_STANDEE.rarity, color: this.recorded ? tone.ink : COLOR.inkDim }))
      .setOrigin(0, 0).setStroke("#05070a", 7);
    if (this.recorded) rarity.setShadow(0, 0, tone.halo, 10, true, true);
    this.add(rarity);
    const name = scene.add.text(0, height / 2 - 66, this.recorded ? def.name : t("codex.unknown"), textStyle({ role: "display", size: CODEX_STANDEE.name, color: this.recorded ? COLOR.ink : COLOR.inkDim }))
      .setOrigin(0.5).setStroke("#05070a", 6);
    squeezeTextToWidth(name, width - 28);
    this.add(name);
    if (!this.recorded) return;
    // 속성(크게)과 직군(조금 작게)이 등급 아래 왼쪽 기둥에 선다 — 정보창의 뱃지와 같은 한 장이다.
    const badgeX = left + CODEX_STANDEE.element / 2 - 2;
    const elementY = top + 8 + CODEX_STANDEE.rarity + 30;
    this.add(new AffinityBadge(scene, badgeX, elementY, ELEMENT_ICON[def.element], CODEX_STANDEE.element, 0.75));
    this.add(new AffinityBadge(scene, badgeX, elementY + CODEX_STANDEE.element / 2 + CODEX_STANDEE.role / 2 + 8, ROLE_ICON[def.role], CODEX_STANDEE.role, 0.75));
    // 소속 — 이름 아래 작은 엠블럼과 스쿼드 이름 한 줄.
    const squadY = height / 2 - 30;
    const squadName = scene.add.text(0, squadY, SQUADS[def.squad].name, textStyle({ role: "emphasis", size: CODEX_STANDEE.squad.text, color: COLOR.inkDim })).setOrigin(0, 0.5);
    squeezeTextToWidth(squadName, width - 40 - CODEX_STANDEE.squad.emblem - 6);
    const rowWidth = CODEX_STANDEE.squad.emblem + 6 + squadName.displayWidth;
    const mark = addFactionMark(scene, -rowWidth / 2 + CODEX_STANDEE.squad.emblem / 2, squadY, def.squad, { size: CODEX_STANDEE.squad.emblem });
    squadName.setX(-rowWidth / 2 + CODEX_STANDEE.squad.emblem + 6);
    if (mark) this.add(mark); else squadName.setX(-squadName.displayWidth / 2);
    this.add(squadName);
  }
}

/** 원화에서 잘라 낼 세로 상자 — 머리 관절을 위쪽 `headY` 자리에 두고 실루엣의 `cropHeight`만큼, 칸 비율 그대로. */
export function standeeCrop(
  frame: { imageWidth: number; imageHeight: number; content: { left: number; right: number; top: number; bottom: number } },
  head: { x: number; y: number },
  size: { width: number; height: number },
): { x: number; y: number; width: number; height: number } {
  const aspect = size.width / size.height;
  let height = (frame.content.bottom - frame.content.top) * CODEX_STANDEE.cropHeight;
  let width = height * aspect;
  const shrink = Math.min(1, frame.imageWidth / width, frame.imageHeight / height);
  width *= shrink; height *= shrink;
  const clamp = (value: number, max: number) => Math.min(Math.max(value, 0), Math.max(max, 0));
  return {
    x: clamp(head.x - width / 2, frame.imageWidth - width),
    y: clamp(head.y - height * CODEX_STANDEE.headY, frame.imageHeight - height),
    width, height,
  };
}

function bakeStandeeTexture(scene: Phaser.Scene, sourceKey: string, cacheKey: string, size: { width: number; height: number }, shape: number[], crop: { x: number; y: number; width: number; height: number }): string {
  const key = `codex-standee:${cacheKey}`;
  if (scene.textures.exists(key)) return key;
  const width = Math.round(size.width); const height = Math.round(size.height);
  const canvas = scene.textures.createCanvas(key, width, height);
  if (!canvas) return sourceKey;
  const ctx = canvas.getContext();
  ctx.clearRect(0, 0, width, height);
  const source = scene.textures.get(sourceKey).getSourceImage() as CanvasImageSource;
  ctx.drawImage(source, crop.x, crop.y, crop.width, crop.height, 0, 0, width, height);
  // 밑동의 어둠 — 이름과 소속 줄이 원화 위에서도 읽힌다.
  const gradient = ctx.createLinearGradient(0, height * CODEX_STANDEE.shade.from, 0, height);
  gradient.addColorStop(0, "rgba(3,6,10,0)");
  gradient.addColorStop(1, `rgba(3,6,10,${CODEX_STANDEE.shade.alpha})`);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, height * CODEX_STANDEE.shade.from, width, height * (1 - CODEX_STANDEE.shade.from));
  // 칸 밖으로 나간 두 모서리는 덮지 않고 지운다. 채우는 색은 반드시 불투명하게 되돌린다 — 밑동 어둠의
  // 그라데이션이 남아 있으면 `destination-in`이 그 알파를 그대로 곱해 원화 위쪽이 통째로 지워진다.
  ctx.globalCompositeOperation = "destination-in";
  ctx.fillStyle = "#000000";
  ctx.beginPath();
  for (let index = 0; index < shape.length; index += 2) {
    const x = shape[index] + width / 2; const y = shape[index + 1] + height / 2;
    if (index === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.closePath(); ctx.fill();
  ctx.globalCompositeOperation = "source-over";
  canvas.refresh();
  return key;
}
