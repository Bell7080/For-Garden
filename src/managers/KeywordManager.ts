import Phaser from "phaser";
import { parseKeywordText, type KeywordDef } from "../data/keywords";
import type { PopupLayer } from "../ui/PopupLayer";
import { COLOR, textStyle } from "../ui/theme";

/** 글줄을 만들 때 필요한 값. 크기와 폭만 주면 줄바꿈은 매니저가 맡는다. */
export interface KeywordTextOptions {
  width: number;
  size: number;
  lineSpacing?: number;
  color?: string;
}

/**
 * 설명문 안의 용어를 강조하고, 눌렀을 때 뜻을 다시 띄우는 단일 경계.
 *
 * Phaser Text는 한 덩어리에 한 가지 모양만 쓸 수 있어서, 강조된 말만 다르게 그리려면 글을
 * 조각내 직접 배치해야 한다. 그 배치와 팝업 여는 규칙을 화면마다 새로 짜면 강조색·밑줄·
 * 팝업 크기가 저마다 달라지므로 여기 한 곳에만 둔다.
 */
export class KeywordManager {
  constructor(private readonly scene: Phaser.Scene, private readonly popups: PopupLayer) {}

  /**
   * 설명문을 컨테이너로 만든다. 원점은 첫 줄의 왼쪽 위다.
   *
   * 낱말 단위로 재어 폭을 넘기면 다음 줄로 내린다. 강조된 말은 강조색·밑줄로 그리고 눌리는
   * 영역을 따로 깔아, 글자 크기가 작아도 손가락이 닿게 한다.
   */
  layout(text: string, options: KeywordTextOptions): Phaser.GameObjects.Container {
    const container = this.scene.add.container(0, 0);
    const lineHeight = options.size * 1.35 + (options.lineSpacing ?? 0);
    let x = 0;
    let y = 0;

    for (const segment of parseKeywordText(text)) {
      // 줄바꿈 문자는 조각 안에도 들어 있다. 낱말로 자르기 전에 먼저 가른다.
      const lines = segment.text.split("\n");
      lines.forEach((line, lineIndex) => {
        if (lineIndex > 0) {
          x = 0;
          y += lineHeight;
        }
        for (const word of splitWords(line)) {
          if (word === "") continue;
          // 강조된 말은 굵기와 색이 함께 달라진다. 역할을 먼저 고르고 한 번에 만든다.
          const style = segment.keyword
            ? textStyle({ role: "emphasis", size: options.size, color: COLOR.accentText })
            : textStyle({ role: "body", size: options.size, color: options.color ?? COLOR.ink });
          const label = this.scene.add.text(x, y, word, style).setOrigin(0, 0);
          if (x > 0 && x + label.width > options.width) {
            x = 0;
            y += lineHeight;
            label.setPosition(x, y);
          }
          container.add(label);
          if (segment.keyword) this.decorateKeyword(container, label, segment.keyword);
          x += label.width;
        }
      });
    }
    return container;
  }

  /** 강조된 말에 밑줄과 입력 영역을 붙인다. */
  private decorateKeyword(container: Phaser.GameObjects.Container, label: Phaser.GameObjects.Text, keyword: KeywordDef): void {
    const underline = this.scene.add.graphics();
    underline.lineStyle(2, COLOR.accent, 0.85);
    underline.lineBetween(label.x, label.y + label.height - 2, label.x + label.width, label.y + label.height - 2);
    container.add(underline);
    const hit = this.scene.add
      .rectangle(label.x + label.width / 2, label.y + label.height / 2, label.width + 8, Math.max(label.height, 40), 0xffffff, 0)
      .setInteractive({ useHandCursor: true });
    // 누른 자리 위에 뜻이 뜬다. 화면을 새로 채우지 않고 읽던 글 위에 한 겹 얹힌다.
    hit.on("pointerup", (pointer: Phaser.Input.Pointer) => this.explain(keyword, { x: pointer.worldX, y: pointer.worldY - 20 }));
    container.add(hit);
  }

  /** 용어 하나를 설명하는 작은 팝업. 스킬 팝업 위에 한 겹 더 쌓인다. */
  explain(keyword: KeywordDef, anchor?: { x: number; y: number }): void {
    this.popups.open({ width: 720, height: 360, title: keyword.term, anchor }, (body) => {
      body.add(
        this.scene.add
          .text(-720 / 2 + 52, -360 / 2 + 74, keyword.kind, textStyle({ role: "emphasis", size: 22, color: COLOR.accentText }))
          .setOrigin(0, 0),
      );
      const description = this.layout(keyword.description, { width: 610, size: 26, lineSpacing: 8 });
      description.setPosition(-720 / 2 + 52, -360 / 2 + 122);
      body.add(description);
    });
  }
}

/** 공백을 붙인 채로 낱말을 나눈다. 공백까지 함께 재야 줄 끝이 어긋나지 않는다. */
function splitWords(line: string): string[] {
  return line.split(/(?<=\s)/);
}
