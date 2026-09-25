import Phaser from "phaser";
import { parseKeywordText, type KeywordDef } from "../data/keywords";
import { t } from "../i18n";
import type { PopupLayer } from "../ui/PopupLayer";
import { drawHairline } from "../ui/holo";
import { COLOR, textStyle } from "../ui/theme";

/**
 * 용어 쪽지의 자리. 폭과 여백만 정하고 **높이는 적지 않는다** — 쌓인 글에서 거꾸로 구한다.
 *
 * 높이를 360으로 못 박아 두었을 때는 본문이 네 줄을 넘는 용어(소환수·피 냄새)가 판 밑변
 * 밖으로 흘렀다. 짧은 용어가 갑자기 작아지지 않도록 예전 높이는 하한으로만 남긴다.
 */
const KEYWORD_NOTE = {
  width: 720,
  minHeight: 360,
  /** 판 왼쪽 안쪽 여백. 글 폭은 좌우 여백을 뺀 값이다. */
  inset: 52,
  textWidth: 610,
  /** 판 윗변에서 분류 줄까지. 제목표가 윗변에 걸터앉으므로 그만큼 내려선다. */
  kindTop: 74,
  /** 분류 줄에서 본문까지. */
  descriptionGap: 48,
  size: 26,
  lineSpacing: 8,
  /** 칸 사이: 구분선 위 여백 · 구분선에서 칸 머리까지 · 칸 머리에서 본문까지. */
  sectionGap: 30,
  sectionHeadTop: 24,
  sectionBodyGap: 44,
  bottomPad: 56,
} as const;

/** 글줄을 만들 때 필요한 값. 크기와 폭만 주면 줄바꿈은 매니저가 맡는다. */
export interface KeywordTextOptions {
  width: number;
  size: number;
  lineSpacing?: number;
  color?: string;
  /** 현재 스킬의 피해 산식처럼 문맥마다 달라지는 추가 용어 정의다. */
  contextualKeywords?: readonly KeywordDef[];
  /**
   * 용어 ID별로 뜻풀이 대신 열 화면을 지정한다.
   *
   * 정적 사전에 콜백을 넣지 않기 위해 **부른 화면이** 넘긴다 — 그래야 `src/data/keywords.ts`의
   * 정적 정의가 임의 코드를 실행할 수 없고, 같은 태그가 문맥에 따라 뜻풀이로도, 전용 창으로도
   * 열릴 수 있다. 지정하지 않은 용어는 지금처럼 뜻풀이 쪽지가 뜬다.
   */
  keywordActions?: Readonly<Record<string, () => void>>;
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

    for (const segment of parseKeywordText(text, options.contextualKeywords)) {
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
          if (segment.keyword) this.decorateKeyword(container, label, segment.keyword, options.keywordActions, options.contextualKeywords);
          x += label.width;
        }
      });
    }
    // 컨테이너는 자식이 늘어도 크기를 스스로 알지 못한다. 실제로 채운 줄 수를 크기로 남겨,
    // 뒤에 다른 문단을 잇는 화면이 줄 수를 눈대중으로 세지 않게 한다.
    container.setSize(options.width, y + lineHeight);
    return container;
  }

  /** 강조된 말에 밑줄과 입력 영역을 붙인다. */
  private decorateKeyword(
    container: Phaser.GameObjects.Container,
    label: Phaser.GameObjects.Text,
    keyword: KeywordDef,
    actions?: Readonly<Record<string, () => void>>,
    contextualKeywords?: readonly KeywordDef[],
  ): void {
    const underline = this.scene.add.graphics();
    underline.lineStyle(2, COLOR.accent, 0.85);
    underline.lineBetween(label.x, label.y + label.height - 2, label.x + label.width, label.y + label.height - 2);
    container.add(underline);
    const hit = this.scene.add
      .rectangle(label.x + label.width / 2, label.y + label.height / 2, label.width + 8, Math.max(label.height, 40), 0xffffff, 0)
      .setInteractive({ useHandCursor: true });
    // 누른 자리 위에 뜻이 뜬다. 화면을 새로 채우지 않고 읽던 글 위에 한 겹 얹힌다.
    const open = actions?.[keyword.id];
    hit.on("pointerup", (pointer: Phaser.Input.Pointer) => {
      if (open) open();
      // 쪽지 안의 태그도 같은 문맥 사전을 읽는다 — 그래야 「피 냄새」 안의 「목덜미」가 전역의
      // 뭉뚱그린 문장이 아니라 이 개체의 실제 수치로 열린다.
      else this.explain(keyword, { x: pointer.worldX, y: pointer.worldY - 20 }, contextualKeywords);
    });
    container.add(hit);
  }

  /**
   * 용어 하나를 설명하는 작은 팝업. 스킬 팝업 위에 한 겹 더 쌓인다.
   *
   * 칸(`sections`)이 있으면 본문 아래에 스킬 쪽지와 같은 순서(분류 → 이름 → 효과)로 이어 세운다.
   * 글을 먼저 다 세워 높이를 재고, 그 높이로 판을 연다.
   */
  explain(keyword: KeywordDef, anchor?: { x: number; y: number }, contextualKeywords?: readonly KeywordDef[]): void {
    const note = KEYWORD_NOTE;
    const text = { width: note.textWidth, size: note.size, lineSpacing: note.lineSpacing, contextualKeywords };
    // 원점은 분류 줄의 왼쪽 위다. 판을 열기 전에 세워 두고 높이를 잰 뒤 판 안으로 옮긴다.
    const content = this.scene.add.container(0, 0);
    content.add(
      this.scene.add
        .text(0, 0, t(`skill.keywordKind.${keyword.kind}`), textStyle({ role: "emphasis", size: 22, color: COLOR.accentText }))
        .setOrigin(0, 0),
    );
    const description = this.layout(keyword.description, text);
    description.setPosition(0, note.descriptionGap);
    content.add(description);
    let bottom = description.y + description.height;
    for (const section of keyword.sections ?? []) {
      const lineY = bottom + note.sectionGap;
      // 구분선은 판 가운데를 기준으로 긋는다. 원점이 왼쪽 여백만큼 밀려 있으므로 그만큼 되돌린다.
      content.add(drawHairline(this.scene, note.width / 2 - note.inset, lineY, note.width - 96, { color: COLOR.accent, alpha: 0.28 }));
      const headY = lineY + note.sectionHeadTop;
      const label = this.scene.add
        .text(0, headY, section.label, textStyle({ role: "emphasis", size: 22, color: COLOR.inkDim }))
        .setOrigin(0, 0.5);
      content.add(label);
      content.add(
        this.scene.add
          .text(label.width + 14, headY, section.name, textStyle({ role: "display", size: 28 }))
          .setOrigin(0, 0.5),
      );
      const body = this.layout(section.text, text);
      body.setPosition(0, headY + note.sectionBodyGap - note.size / 2);
      content.add(body);
      bottom = body.y + body.height;
    }
    const height = Math.max(note.minHeight, Math.ceil(note.kindTop + bottom + note.bottomPad));
    this.popups.open({ width: note.width, height, title: keyword.term, anchor }, (body) => {
      content.setPosition(-note.width / 2 + note.inset, -height / 2 + note.kindTop);
      body.add(content);
    });
  }
}

/** 공백을 붙인 채로 낱말을 나눈다. 공백까지 함께 재야 줄 끝이 어긋나지 않는다. */
function splitWords(line: string): string[] {
  return line.split(/(?<=\s)/);
}
