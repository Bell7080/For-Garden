import Phaser from "phaser";
import type { KeywordDef, KeywordKind } from "../data/keywords";
import type { KeywordManager } from "../managers/KeywordManager";
import { pressIn, pressOut } from "./pressFeedback";
import { isTap } from "./tapGuard";

/**
 * 확률표의 칸 하나를 누르면 뜻 쪽지가 뜨게 한다 — 규칙어 태그와 **같은 용어 쪽지**(`KeywordManager.explain`)다.
 *
 * 표는 숫자만 늘어놓으므로 「같은 등급」이 무엇의 확률인지, 「확정까지 20회」가 무엇을 세는지를 칸이 말하지
 * 못한다. 칸마다 제 이름과 풀이를 가진 **고유 태그**를 그 자리에서 지어 넘긴다 — 정적 사전(`keywords.ts`)에
 * 넣지 않는 이유는 쪽지 글이 그 칸의 수치(넣은 등급·확률·골드)를 품기 때문이다.
 */
export interface OddsTip {
  term: string;
  description: string;
  /** 쪽지 머리의 분류. 확률 칸은 `odds`, 특성 이름은 `runeTrait`. */
  kind?: KeywordKind;
}

/** 표 칸의 뜻 쪽지를 짓는다. ID는 칸마다 같은 값이어도 된다 — 쪽지는 넘긴 정의를 그대로 그린다. */
export function oddsTipKeyword(tip: OddsTip): KeywordDef {
  return { id: "odds-tip", term: tip.term, kind: tip.kind ?? "odds", description: tip.description };
}

/**
 * `holder`(칸을 담은 컨테이너, 원점이 칸 가운데)에 눌리는 면을 깐다. 누르면 칸이 눌렸다 튀고 쪽지가 뜬다.
 * 끌다 놓은 손에는 열지 않는다.
 */
export function addOddsTip(
  scene: Phaser.Scene,
  holder: Phaser.GameObjects.Container,
  width: number,
  height: number,
  keywords: KeywordManager,
  tip: OddsTip,
): void {
  const hit = scene.add.rectangle(0, 0, width, height, 0xffffff, 0).setInteractive({ useHandCursor: true });
  hit.on("pointerdown", () => pressIn(holder));
  hit.on("pointerout", () => pressOut(holder, "normal", { pop: false }));
  hit.on("pointerup", (pointer: Phaser.Input.Pointer) => {
    pressOut(holder);
    if (!isTap(pointer)) return;
    keywords.explain(oddsTipKeyword(tip), { x: pointer.worldX, y: pointer.worldY - 20 });
  });
  holder.add(hit);
}

/**
 * 누를 수 있는 머리글 밑에 긋는 점선. 규칙어 태그의 밑줄과 같은 뜻 — 「눌러서 뜻을 볼 수 있다」.
 * `x`·`y`는 글자 왼쪽 아래, `width`는 글자 폭이다.
 */
export function drawTipUnderline(scene: Phaser.Scene, x: number, y: number, width: number, color: number, alpha = 0.6): Phaser.GameObjects.Graphics {
  const line = scene.add.graphics();
  line.fillStyle(color, alpha);
  for (let dx = 0; dx < width; dx += 9) line.fillRect(x + dx, y, Math.min(5, width - dx), 2);
  return line;
}
