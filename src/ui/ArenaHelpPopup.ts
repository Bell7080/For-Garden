import type Phaser from "phaser";
import { t, type TextKey } from "../i18n";
import { chipPoints, drawLayer } from "./holo";
import { drawGlyph, type GlyphName } from "./glyphs";
import type { PopupLayer } from "./PopupLayer";
import { textStyle, COLOR } from "./theme";
import { ARENA_TONE } from "./arenaTheme";

/**
 * 아레나 입구의 「도움말」이 여는 규칙 쪽지. 매칭 버튼 위에 작은 글자 두 줄로 서던 규칙을 옮겨 왔다 —
 * 늘 떠 있으면 매칭을 누를 때마다 읽지 않는 글이 버튼과 무게를 다툰다.
 * 닫기는 공용 규칙대로 판 밖 우하단 뒤로가기와 판 밖 누르기다(X는 두지 않는다).
 */
const SECTIONS: readonly { title: TextKey; body: TextKey; glyph: GlyphName }[] = [
  { title: "arena.help.ban.title", body: "arena.help.ban.body", glyph: "remove" },
  { title: "arena.help.pick.title", body: "arena.help.pick.body", glyph: "friends" },
  { title: "arena.help.battle.title", body: "arena.help.battle.body", glyph: "contrib-attack" },
  { title: "arena.help.score.title", body: "arena.help.score.body", glyph: "trophy" },
];

/**
 * 갈래마다 **차례 카드** 한 장 — 왼쪽 기둥에 순서 번호와 그 단계의 그림, 오른쪽에 제목과 풀이가 선다.
 * 밴 → 배치 → 전투 → 점수는 한 판이 흐르는 순서라, 글 네 덩어리를 구분선으로 가르던 때보다 차례가 먼저 읽힌다.
 */
export const ARENA_HELP_POPUP = {
  width: 900,
  /** 판 위·아래 안쪽 여백(위는 판 윗변에 걸터앉는 제목표 몫까지). */
  padTop: 86,
  padBottom: 60,
  card: { width: 820, padY: 24, gap: 18, rail: 132 },
  /** 글이 서는 폭 — 카드 폭에서 기둥과 오른쪽 여백을 뺀 값. */
  textWidth: 640,
  titleSize: 32,
  bodySize: 27,
  numberSize: 50,
  glyphSize: 38,
  titleGap: 10,
} as const;

export function openArenaHelpPopup(scene: Phaser.Scene, popups: PopupLayer): void {
  const L = ARENA_HELP_POPUP;
  const C = L.card;
  // 높이는 손으로 적지 않고 실제 글의 높이를 먼저 재서 구한다 — 언어마다 줄 수가 다르다.
  const blocks = SECTIONS.map(({ title, body, glyph }) => {
    const titleText = scene.add.text(0, 0, t(title), textStyle({ role: "display", size: L.titleSize, color: ARENA_TONE.accentText })).setOrigin(0, 0);
    const bodyText = scene.add.text(0, 0, t(body), textStyle({ role: "body", size: L.bodySize, color: COLOR.ink, wrap: L.textWidth, lineSpacing: 4 })).setOrigin(0, 0);
    const height = Math.max(150, C.padY * 2 + titleText.height + L.titleGap + bodyText.height);
    return { title: titleText, body: bodyText, glyph, height };
  });
  const content = blocks.reduce((sum, b, i) => sum + b.height + (i ? C.gap : 0), 0);
  const height = Math.round(L.padTop + content + L.padBottom);
  popups.open({ width: L.width, height, title: t("arena.help.title"), dim: true, closeOnBackdrop: true }, (body) => {
    let y = -height / 2 + L.padTop;
    blocks.forEach((b, i) => {
      const cy = y + b.height / 2;
      body.add(drawLayer(scene, 0, cy, chipPoints(C.width, b.height, { bevel: { topLeft: 22, bottomRight: 22 } }), { fill: 0x0f141b, alpha: 0.78, shadow: false, edge: ARENA_TONE.accent, edgeAlpha: 0.5 }));
      // 기둥 — 아레나 색으로 옅게 물든 띠 위에 번호(크게)와 그 단계의 그림.
      const railX = -C.width / 2 + C.rail / 2;
      body.add(drawLayer(scene, railX + 6, cy, chipPoints(C.rail - 20, b.height - 24, { bevel: { topLeft: 16, bottomRight: 16 } }), { fill: ARENA_TONE.accent, alpha: 0.16, shadow: false }));
      body.add(scene.add.text(railX + 6, cy - 22, String(i + 1), textStyle({ role: "display", size: L.numberSize, color: ARENA_TONE.accentText })).setOrigin(0.5).setStroke("#0a0e14", 6));
      body.add(drawGlyph(scene, b.glyph, railX + 6, cy + 36, L.glyphSize, ARENA_TONE.accent));
      const left = -C.width / 2 + C.rail + 24;
      const textTop = cy - (b.title.height + L.titleGap + b.body.height) / 2;
      b.title.setPosition(left, textTop);
      b.body.setPosition(left, textTop + b.title.height + L.titleGap);
      body.add([b.title, b.body]);
      y += b.height + C.gap;
    });
  });
}
