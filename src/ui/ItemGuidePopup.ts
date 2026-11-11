import Phaser from "phaser";
import { attachRoll } from "./RollingValue";
import { remainingDetail } from "./itemExpiry";
import { t } from "../i18n";
import type { ItemDefinition } from "../data/items";
import { chipPoints, drawLayer, drawShapeInnerGlow, HoloBar, slantedRect } from "./holo";
import { dotPattern } from "./Button";
import { shapeClipMask } from "./popupArt";
import { settingsManager } from "../managers/SettingsManager";
import { addItemFrame, ITEM_FRAME } from "./itemFrame";
import { addItemDefinitionIcon } from "./itemDefinitionIcon";
import { PopupLayer } from "./PopupLayer";
import { COLOR, textStyle } from "./theme";
import { ITEM_GUIDE, itemGuideHeight, itemGuideSourcesTop } from "./itemGuideLayout";
import { itemSourceKeys } from "../data/itemSources";
import { shrinkTextToWidth } from "./textFit";
import { pressIn, pressOut } from "./pressFeedback";
import { clipHit, containerClip } from "./clippedHit";
import { universalFragmentRarity } from "../core/relicProgression";
import { addUniversalFragmentArt, addUniversalFragmentGlass, universalFragmentTexture } from "./universalFragmentArt";

export interface ItemGuideOptions {
  readonly definition: ItemDefinition;
  readonly quantity: number;
  /** 기한이 있는 칸 — 가장 먼저 사라질 묶음의 수와 남은 시간. 보유 수 아래 한 줄로 선다. */
  readonly expiry?: { count: number; expiresAt: string };
  /** 소비품만 온다 — 오면 창 밑동에 「사용하기」가 선다. 한 개를 쓰고 창을 닫는다. */
  readonly onUse?: () => void;
}

/**
 * 재료·소비품 안내창 — **재화 안내창과 같은 한 벌**이다(`CurrencyGuidePopup`).
 *
 * 위 판에 액자와 보유 수, 그 아래 「효과」 제목표 줄과 설명. 재료를 누르면 작은 쪽지 하나에 설명과
 * 보유를 한 문단으로 적던 때는, 같은 가방 안에서 재화를 누르면 넓은 창이 뜨고 재료를 누르면 작은
 * 쪽지가 떠 같은 손짓이 두 양식이었다. 소비품은 밑동의 「사용하기」로 곧바로 쓴다 — 확인 창을 한 번
 * 더 띄우던 때는 이 창이 이미 무엇을 쓰는지 말하고 있는데 같은 질문을 되물었다.
 */
export class ItemGuidePopup {
  constructor(private readonly scene: Phaser.Scene, private readonly popups: PopupLayer) {}

  open(options: ItemGuideOptions): void {
    const { definition, quantity, onUse, expiry } = options;
    const sources = itemSourceKeys(definition.id);
    const height = itemGuideHeight(onUse !== undefined, sources.length);
    const top = -height / 2;
    this.popups.open({ width: ITEM_GUIDE.width, height, title: definition.name, dim: true, dimAlpha: 0.34 }, (body, close) => {
      const { hero } = ITEM_GUIDE;
      const heroY = top + hero.top + hero.height / 2;
      body.add(drawLayer(this.scene, 0, heroY, slantedRect(hero.width, hero.height, 22), { fill: 0x101720, alpha: 0.9, edge: COLOR.accent, edgeAlpha: 0.35 }));
      const iconX = -hero.width / 2 + 48 + hero.frameSize / 2;
      body.add(addItemFrame(this.scene, iconX, heroY, hero.frameSize));
      const iconSize = hero.frameSize * ITEM_FRAME.icon;
      const fragmentRarity = universalFragmentRarity(definition.id);
      // 만능 파편은 액자를 넘치게 키워 구운 그림이 선다(`addUniversalFragmentArt`).
      const fragmentArt = fragmentRarity ? addUniversalFragmentArt(this.scene, hero.frameSize, universalFragmentTexture(fragmentRarity)) : undefined;
      if (fragmentArt) {
        body.add(fragmentArt.setPosition(iconX, heroY));
      } else {
        body.add(addItemDefinitionIcon(this.scene, definition.icon, iconX + ITEM_FRAME.shadow.offsetX, heroY + ITEM_FRAME.shadow.offsetY, iconSize, { shadow: true }));
        body.add(addItemDefinitionIcon(this.scene, definition.icon, iconX, heroY, iconSize));
      }
      if (fragmentRarity) body.add(addUniversalFragmentGlass(this.scene, hero.frameSize, fragmentRarity).setPosition(iconX, heroY));
      body.add(this.scene.add.text(hero.width / 2 - 40, heroY - 28, t("inventory.guide.held"), textStyle({ role: "emphasis", size: 22, color: COLOR.inkDim })).setOrigin(1, 0.5));
      body.add(attachRoll(this.scene.add.text(hero.width / 2 - 40, heroY + 18, quantity.toLocaleString(), textStyle({ role: "display", size: 52, color: "#ffe9a3" }))
        .setOrigin(1, 0.5).setShadow(2, 6, "#05070a", 7, false, true), { memoryKey: `item-guide:${definition.id}` }));
      if (expiry) {
        // 가방 칸의 표식(`7D`)이 줄여 적은 것을 여기서는 자세히 — 가장 먼저 사라질 묶음의 수와 남은
        // 일·시간(하루 안이면 시·분, 한 시간 안이면 분·초)을 초마다 다시 적는다.
        const line = this.scene.add.text(hero.width / 2 - 40, heroY + 62, "", textStyle({ role: "emphasis", size: 20, color: COLOR.dangerText })).setOrigin(1, 0.5);
        const paint = (): void => { line.setText(t("inventory.guide.expiry", { count: expiry.count, time: remainingDetail(expiry.expiresAt) })); };
        paint();
        const timer = this.scene.time.addEvent({ delay: 1000, loop: true, callback: paint });
        line.once(Phaser.GameObjects.Events.DESTROY, () => timer.remove(false));
        body.add(line);
      }

      const { section } = ITEM_GUIDE;
      const sectionY = top + section.top;
      body.add(this.scene.add.text(-section.width / 2, sectionY, t("inventory.guide.effect"), textStyle({ role: "display", size: 27, color: COLOR.accentText })).setOrigin(0, 0.5));
      new HoloBar(this.scene, 0, sectionY + 32, section.width, 5, { color: COLOR.accent, trackAlpha: 0.5 }).addTo(body).setValue(1);
      body.add(this.scene.add.text(-section.width / 2 + 15, sectionY + 60, definition.description, textStyle({ role: "body", size: 24, color: COLOR.ink, wrap: section.width - 30 })).setOrigin(0, 0));
      if (sources.length > 0) {
        // 효과와 같은 제목줄 양식으로 「얻는 방법」을 세우고, 수급처는 줄마다 짧은 빗금 표식과 함께 선다.
        const sourcesY = top + itemGuideSourcesTop();
        body.add(this.scene.add.text(-section.width / 2, sourcesY, t("inventory.guide.sources"), textStyle({ role: "display", size: 27, color: COLOR.accentText })).setOrigin(0, 0.5));
        new HoloBar(this.scene, 0, sourcesY + 32, section.width, 5, { color: COLOR.accent, trackAlpha: 0.5 }).addTo(body).setValue(1);
        sources.forEach((key, index) => {
          const lineY = sourcesY + ITEM_GUIDE.sources.header + index * ITEM_GUIDE.sources.line + ITEM_GUIDE.sources.line / 2 - 8;
          body.add(drawLayer(this.scene, -section.width / 2 + 22, lineY, slantedRect(8, 22, 4), { fill: COLOR.accent, alpha: 0.8, shadow: false }));
          const line = this.scene.add.text(-section.width / 2 + 42, lineY, t(key), textStyle({ role: "body", size: 23, color: COLOR.ink })).setOrigin(0, 0.5);
          shrinkTextToWidth(line, section.width - 50);
          body.add(line);
        });
      }

      if (!onUse) return;
      const { use } = ITEM_GUIDE;
      const enabled = quantity > 0;
      const button = addUseButton(this.scene, 0, height / 2 - use.bottom - use.height / 2, use.width, use.height, enabled);
      body.add(button);
      if (!enabled) return;
      const hit = this.scene.add.rectangle(0, 0, use.width, use.height, 0xffffff, 0);
      clipHit(hit, containerClip(body, -ITEM_GUIDE.width / 2, -height / 2, ITEM_GUIDE.width / 2, height / 2));
      hit.on("pointerdown", () => pressIn(button));
      hit.on("pointerout", () => pressOut(button, "normal", { pop: false }));
      hit.on("pointerup", () => { pressOut(button); close(); onUse(); });
      button.add(hit);
    });
  }
}

/**
 * 「사용하기」 — 안내창 밑동의 단 하나의 조작이라 맨 판이 아니라 **불이 들어온 스위치**로 선다.
 *
 * 호박빛 몸통(어두운 판 위에 강조색 한 겹) + 양 끝으로 흩어지는 점 무늬 + 안쪽에서 번지는 빛 + 아래 두께선,
 * 글자 양옆의 빗금 장식, 그리고 몇 초마다 판을 비스듬히 훑는 빛줄기와 숨 쉬는 바깥 빛. 쓸 수 없으면
 * 빛과 움직임을 모두 끄고 판만 흐리게 남긴다. 움직임 줄이기에서는 훑는 빛·숨쉬기가 서지 않는다.
 */
function addUseButton(scene: Phaser.Scene, x: number, y: number, width: number, height: number, enabled: boolean): Phaser.GameObjects.Container {
  const button = scene.add.container(x, y);
  const cut = height * 0.46;
  const shape = chipPoints(width, height, { bevel: { topLeft: cut, topRight: 0, bottomRight: cut, bottomLeft: 0 } });
  const reduceMotion = settingsManager.get().accessibility.reduceMotion;
  if (enabled) {
    // 바깥 빛 — 판보다 한 뼘 큰 같은 실루엣. 숨 쉬듯 진해졌다 옅어진다.
    const haloShape = chipPoints(width + 26, height + 22, { bevel: { topLeft: cut + 10, topRight: 0, bottomRight: cut + 10, bottomLeft: 0 } });
    const halo = drawLayer(scene, 0, 0, haloShape, { fill: COLOR.accent, alpha: 0.22, shadow: false }).setBlendMode(Phaser.BlendModes.ADD);
    button.add(halo);
    if (!reduceMotion) scene.tweens.add({ targets: halo, alpha: { from: 0.1, to: 0.34 }, duration: 1100, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
  }
  button.add(drawLayer(scene, 0, 0, shape, { fill: enabled ? 0x2b1c08 : 0x1f2630, alpha: 0.97, edge: enabled ? 0xffe6a8 : COLOR.accent, edgeAlpha: enabled ? 0.95 : 0.4 }));
  if (enabled) {
    // 몸통의 호박빛 — 위가 밝고 아래로 가라앉는 두 겹. 광택 그라데이션이 아니라 단색 면 두 장이다.
    const inner = chipPoints(width - 14, height - 14, { bevel: { topLeft: cut - 6, topRight: 0, bottomRight: cut - 6, bottomLeft: 0 } });
    button.add(drawLayer(scene, 0, 0, inner, { fill: COLOR.accent, alpha: 0.3, shadow: false }));
    const upper = chipPoints(width - 14, (height - 14) / 2, { bevel: { topLeft: cut - 6, topRight: 0, bottomRight: 0, bottomLeft: 0 } });
    button.add(drawLayer(scene, 0, -(height - 14) / 4, upper, { fill: 0xffe2a0, alpha: 0.12, shadow: false }));
    button.add(dotPattern(scene, shape, 0xffe6a8, { reach: 0.22, alpha: 0.35 }));
    button.add(drawShapeInnerGlow(scene, 0, 0, shape, { color: COLOR.accent, strength: 0.42 }));
    const underline = scene.add.graphics();
    underline.lineStyle(3, 0xffe6a8, 0.7);
    underline.lineBetween(-width / 2 + cut, height / 2 - 6, width / 2 - cut, height / 2 - 6);
    button.add(underline);
  }
  const label = scene.add.text(0, 0, t("inventory.useButton"), textStyle({ role: "display", size: 32, color: enabled ? "#fff4d6" : COLOR.inkDim }))
    .setOrigin(0.5).setStroke(enabled ? "#3a2406" : "#05070a", 6).setShadow(0, 3, "#05070a", 4, true, true);
  button.add(label);
  // 글자 양옆의 빗금 셋 — 제목표의 빗금(`/`)과 같은 문법을 장식으로 겹쳐 쓴다.
  const tickColor = enabled ? 0xffe6a8 : 0x6f7681;
  for (const side of [-1, 1] as const) {
    for (let index = 0; index < 3; index += 1) {
      const tickX = side * (label.width / 2 + 22 + index * 13);
      button.add(drawLayer(scene, tickX, 0, slantedRect(6, 26 - index * 6, 5), { fill: tickColor, alpha: 0.9 - index * 0.25, shadow: false }));
    }
  }
  if (enabled && !reduceMotion) {
    // 판을 비스듬히 훑는 빛줄기 — 판 실루엣 안에서만 보인다.
    const shine = scene.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
    shine.fillStyle(0xffffff, 0.26);
    shine.fillPoints([new Phaser.Geom.Point(-18, -height), new Phaser.Geom.Point(26, -height), new Phaser.Geom.Point(4, height), new Phaser.Geom.Point(-40, height)], true);
    shine.fillStyle(0xffffff, 0.12);
    shine.fillPoints([new Phaser.Geom.Point(34, -height), new Phaser.Geom.Point(46, -height), new Phaser.Geom.Point(24, height), new Phaser.Geom.Point(12, height)], true);
    shine.setMask(shapeClipMask(scene, button, shape));
    shine.x = -width / 2 - 80;
    button.add(shine);
    scene.tweens.add({ targets: shine, x: width / 2 + 80, duration: 900, delay: 400, repeatDelay: 1800, repeat: -1, ease: "Sine.easeInOut" });
  }
  return button;
}
