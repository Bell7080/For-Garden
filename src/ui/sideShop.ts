import Phaser from "phaser";
import { drawGlyph } from "./glyphs";
import { RailButton } from "./RailButton";
import { COLOR, textStyle } from "./theme";

/**
 * 화면 곁에 붙는 **상점 아이콘**과 **확률 정보 링크** — 연구소·고고학·출격판이 같은 한 벌을 쓴다.
 *
 * 상점은 로비 레일의 상점과 **같은 아이콘 칩**(`RailButton`)이고 황금빛이다. 각 화면이 저마다
 * 둥근 알약·라벨 버튼·가방 아이콘으로 세우던 때는 같은 "사러 간다"가 화면마다 다른 조작으로
 * 읽혔다. 확률 정보는 누르면 열리는 정보일 뿐 고르는 조작이 아니라, 버튼이 아니라 **작고 흐린
 * 글줄**로 왼쪽 위에 비켜 선다 — 버튼으로 세우면 연구 버튼과 같은 무게로 눈을 끈다.
 */
export const SIDE_SHOP = {
  /** 연구소·고고학 — 화면 왼쪽 중상단. 두 화면이 같은 자리에 세운다. */
  screen: { x: 84, y: 430, size: 104 },
  /** 출격판 — 스토리 칸 오른쪽 위에 걸친 꼬리표(판 기준 좌표). */
  sortie: { x: 446, y: -472, size: 92 },
} as const;

export function addSideShopButton(scene: Phaser.Scene, x: number, y: number, size: number, label: string, onClick: () => void): RailButton {
  return new RailButton(scene, x, y, { icon: "shop", label, size, accent: true, onClick });
}

/** 확률 정보 — 돋보기 하나와 흐린 글 한 줄. 누르면 커지는 규칙은 다른 조작과 같다. */
export function addRatesLink(scene: Phaser.Scene, x: number, y: number, label: string, onClick: () => void): Phaser.GameObjects.Container {
  const link = scene.add.container(x, y);
  link.add(drawGlyph(scene, "magnifier", 12, 0, 22, 0x9aa3ad, 0.85));
  const text = scene.add.text(30, 0, label, textStyle({ role: "emphasis", size: 21, color: COLOR.inkDim })).setOrigin(0, 0.5).setAlpha(0.9);
  link.add(text);
  const width = 30 + text.width + 8;
  const hit = scene.add.rectangle(width / 2, 0, width + 16, 48, 0xffffff, 0).setInteractive({ useHandCursor: true });
  hit.on("pointerdown", () => link.setScale(1.08));
  hit.on("pointerout", () => link.setScale(1));
  hit.on("pointerup", () => { link.setScale(1); onClick(); });
  link.add(hit);
  return link;
}
