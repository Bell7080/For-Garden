import Phaser from "phaser";
import { t } from "../i18n";
import { isGuildBadge, type GuildBadge } from "../core/guildBadge";
import { addGuildBadge } from "./GuildBadge";
import { chipPoints, drawLayer, drawShapeOutline } from "./holo";
import type { PopupLayer } from "./PopupLayer";
import { pressIn, pressOut } from "./pressFeedback";
import { COLOR, textStyle } from "./theme";

/** 같은 크기의 실제 배지로 비교한다. 색·문양을 바꿔도 다른 세 값은 유지한다. */
export function openGuildBadgePicker<K extends keyof GuildBadge>(scene: Phaser.Scene, popups: PopupLayer, options: {
  title: string;
  badge: Readonly<GuildBadge>;
  field: K;
  choices: readonly GuildBadge[K][];
  onPick: (value: GuildBadge[K]) => void;
}): void {
  const columns = 4;
  const rows = Math.ceil(options.choices.length / columns);
  const gap = 190;
  const height = rows * 210 + 160;
  popups.open({ width: 900, height, title: options.title, dim: true, dimAlpha: 0.45, closeOnBackdrop: true }, (body, close) => {
    options.choices.forEach((choice, index) => {
      const node = scene.add.container((index % columns - 1.5) * gap, -height / 2 + 160 + Math.floor(index / columns) * 210);
      const selected = choice === options.badge[options.field];
      const candidate = { ...options.badge, [options.field]: choice };
      const allowed = isGuildBadge(candidate);
      const shape = chipPoints(172, 190, { bevel: { topLeft: 22, bottomRight: 22 } });
      node.add(drawLayer(scene, 0, 0, shape, { fill: selected ? 0x27313b : 0x0c1118, alpha: 0.98 }));
      node.add(drawShapeOutline(scene, 0, 0, shape, { color: selected ? COLOR.accent : 0x536170, alpha: selected ? 1 : 0.45, width: selected ? 4 : 2 }));
      addGuildBadge(scene, node, 0, -18, candidate, 112);
      node.add(scene.add.text(0, 66, t("guild.badge.index", { index: index + 1, count: options.choices.length }), textStyle({ role: "emphasis", size: 30, color: selected ? COLOR.accentText : COLOR.ink })).setOrigin(0.5));
      node.setAlpha(allowed ? 1 : 0.35);
      const hit = scene.add.rectangle(0, 0, 172, 190, 0xffffff, 0);
      if (allowed) hit.setInteractive({ useHandCursor: true });
      hit.on("pointerdown", () => pressIn(node));
      hit.on("pointerout", () => pressOut(node, "normal", { pop: false }));
      hit.on("pointerup", () => { pressOut(node); close(); options.onPick(choice); });
      node.add(hit);
      body.add(node);
    });
  });
}
