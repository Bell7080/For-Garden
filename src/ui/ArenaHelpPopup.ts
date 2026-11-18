import type Phaser from "phaser";
import { t, type TextKey } from "../i18n";
import { drawHairline } from "./holo";
import type { PopupLayer } from "./PopupLayer";
import { textStyle, COLOR } from "./theme";
import { ARENA_TONE } from "./arenaTheme";

/**
 * 아레나 입구의 「도움말」이 여는 규칙 쪽지. 매칭 버튼 위에 작은 글자 두 줄로 서던 규칙을 옮겨 왔다 —
 * 늘 떠 있으면 매칭을 누를 때마다 읽지 않는 글이 버튼과 무게를 다툰다.
 * 닫기는 공용 규칙대로 판 밖 우하단 뒤로가기와 판 밖 누르기다(X는 두지 않는다).
 */
const SECTIONS: readonly { title: TextKey; body: TextKey }[] = [
  { title: "arena.help.ban.title", body: "arena.help.ban.body" },
  { title: "arena.help.pick.title", body: "arena.help.pick.body" },
  { title: "arena.help.battle.title", body: "arena.help.battle.body" },
  { title: "arena.help.score.title", body: "arena.help.score.body" },
];

export const ARENA_HELP_POPUP = {
  width: 900,
  /** 판 위·아래 안쪽 여백(위는 판 윗변에 걸터앉는 제목표 몫까지). */
  padTop: 78,
  padBottom: 64,
  /** 글이 서는 폭 — 판 좌우에서 70씩 들인다. */
  textWidth: 760,
  titleSize: 32,
  bodySize: 28,
  /** 제목과 본문 사이, 그리고 갈래 사이(구분선이 그 가운데 선다). */
  titleGap: 14,
  sectionGap: 48,
} as const;

export function openArenaHelpPopup(scene: Phaser.Scene, popups: PopupLayer): void {
  const L = ARENA_HELP_POPUP;
  // 높이는 손으로 적지 않고 실제 글의 높이를 먼저 재서 구한다 — 언어마다 줄 수가 다르다.
  const blocks = SECTIONS.map(({ title, body }) => ({
    title: scene.add.text(0, 0, t(title), textStyle({ role: "emphasis", size: L.titleSize, color: ARENA_TONE.accentText })).setOrigin(0, 0),
    body: scene.add.text(0, 0, t(body), textStyle({ role: "body", size: L.bodySize, color: COLOR.ink, wrap: L.textWidth })).setOrigin(0, 0),
  }));
  const content = blocks.reduce((sum, b, i) => sum + b.title.height + L.titleGap + b.body.height + (i ? L.sectionGap : 0), 0);
  const height = Math.round(L.padTop + content + L.padBottom);
  popups.open({ width: L.width, height, title: t("arena.help.title"), dim: true, closeOnBackdrop: true }, (body) => {
    const left = -L.textWidth / 2;
    let y = -height / 2 + L.padTop;
    blocks.forEach((b, i) => {
      if (i) {
        body.add(drawHairline(scene, 0, y + L.sectionGap / 2, L.textWidth, { color: ARENA_TONE.accent, alpha: 0.28 }));
        y += L.sectionGap;
      }
      b.title.setPosition(left, y);
      y += b.title.height + L.titleGap;
      b.body.setPosition(left, y);
      y += b.body.height;
      body.add([b.title, b.body]);
    });
  });
}
