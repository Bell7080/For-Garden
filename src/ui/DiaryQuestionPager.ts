import Phaser from "phaser";
import { DIARY_QUESTION_GEM_REWARD } from "../core/relicStory";
import { relicStoryFor } from "../data/relicStories";
import { t } from "../i18n";
import { relicStories } from "../managers/RelicStoryManager";
import { drawGlyph } from "./glyphs";
import { drawLayer, slantedRect } from "./holo";
import { OBSERVATION_JOURNAL_SIZE } from "./observationJournalLayout";
import { pressIn, pressOut } from "./pressFeedback";
import { COLOR, textStyle } from "./theme";

/**
 * 관찰 일지 맨 아래의 **관찰 질문 쪽지**.
 *
 * 질문은 개체마다 셋이고 `< >`로 넘긴다 — 넘기는 것은 이 칸뿐이라 일지 위쪽은 움직이지 않는다. 질문 하나에
 * 답하면 젬(질문마다 한 번)을 받고, 그 뒤로는 **다른 답변도 작은 버튼으로 열어 볼 수 있다**(보기만 하고
 * 젬·기록은 처음 고른 답 그대로다). 열리는 날 전의 질문은 며칠 뒤에 열리는지만 말한다.
 */
export function addDiaryQuestionPager(
  scene: Phaser.Scene,
  parent: Phaser.GameObjects.Container,
  left: number,
  top: number,
  relicId: string,
): void {
  const story = relicStoryFor(relicId);
  if (!story) return;
  const size = OBSERVATION_JOURNAL_SIZE;
  const block = size.questionBlock;
  const width = size.body.width;
  const total = story.questions.length;
  const section = scene.add.container(left, top);
  parent.add(section);

  const views = (): ReturnType<typeof relicStories.questionViews> => relicStories.questionViews(relicId);
  // 처음에는 지금 답할 수 있는 첫 질문을 연다 — 없으면 첫 쪽이다.
  let page = Math.max(0, views().findIndex((view) => view.status === "open"));
  /** 답한 질문에서 지금 읽고 있는 답변(보기만). 질문 ID → 선택지 ID. */
  const peeking: Record<string, string> = {};
  let received: { questionId: string; gems: number } | undefined;
  let busy = false;

  const clear = (): void => { section.removeAll(true); };

  const render = (): void => {
    clear();
    const view = views()[page];
    const question = story.questions[page];
    // 머리 줄 — 이전 · 쪽 · 다음. 끝에서는 흐리게 닫는다.
    const headerY = block.headerHeight / 2;
    const hasPrev = page > 0;
    const hasNext = page < total - 1;
    section.add(drawGlyph(scene, "page-prev", 30, headerY, 40, hasPrev ? COLOR.inkHex : COLOR.inkDimHex, hasPrev ? 1 : 0.35));
    section.add(drawGlyph(scene, "page-next", width - 30, headerY, 40, hasNext ? COLOR.inkHex : COLOR.inkDimHex, hasNext ? 1 : 0.35));
    section.add(scene.add.text(width / 2, headerY, t("info.diary.title", { index: page + 1, total }), textStyle({ role: "emphasis", size: size.font.regular, color: COLOR.ink })).setOrigin(0.5));
    const go = (next: number): void => { page = next; render(); };
    if (hasPrev) section.add(scene.add.rectangle(30, headerY, 96, 96, 0xffffff, 0).setInteractive({ useHandCursor: true }).on("pointerup", () => go(page - 1)));
    if (hasNext) section.add(scene.add.rectangle(width - 30, headerY, 96, 96, 0xffffff, 0).setInteractive({ useHandCursor: true }).on("pointerup", () => go(page + 1)));

    const prompt = scene.add.text(0, block.headerHeight + 16, question.prompt, textStyle({ role: "emphasis", size: size.font.question, color: COLOR.accentText, wrap: width })).setOrigin(0, 0);
    section.add(prompt);
    let y = prompt.y + prompt.height + 22;

    if (view.status === "locked") {
      section.add(scene.add.text(0, y, t("info.diary.locked", { days: relicStories.daysUntil(view.unlocksAt) }), textStyle({ role: "body", size: size.font.small, color: COLOR.inkDim, wrap: width })).setOrigin(0, 0));
      return;
    }

    if (view.status === "open") {
      question.choices.forEach((choice, index) => {
        const button = scene.add.container(width / 2, y + size.choice.height / 2 + index * (size.choice.height + size.spacing.choiceGap));
        button.add(drawLayer(scene, 0, 0, slantedRect(size.choice.width, size.choice.height, size.choice.bevel), { fill: 0x141a22, alpha: 0.94, edge: COLOR.accent, edgeAlpha: 0.42 }));
        button.add(scene.add.text(0, 0, choice.label, textStyle({ role: "emphasis", size: size.font.small, wrap: size.choice.width - 40, align: "center" })).setOrigin(0.5));
        const hit = scene.add.rectangle(0, 0, size.choice.width, size.choice.height, 0xffffff, 0).setInteractive({ useHandCursor: true });
        hit.on("pointerdown", () => pressIn(button));
        hit.on("pointerout", () => pressOut(button, "normal", { pop: false }));
        hit.on("pointerup", () => {
          pressOut(button);
          if (busy) return;
          busy = true;
          void relicStories.answer(relicId, question.id, choice.id)
            .then((gems) => { received = { questionId: question.id, gems }; })
            .catch(() => undefined)
            .finally(() => { busy = false; if (section.scene) render(); });
        });
        button.add(hit);
        section.add(button);
      });
      const hintY = y + question.choices.length * (size.choice.height + size.spacing.choiceGap);
      section.add(scene.add.text(width / 2, hintY, t("info.diary.reward", { gems: DIARY_QUESTION_GEM_REWARD }), textStyle({ role: "body", size: size.font.small, color: COLOR.inkDim, align: "center" })).setOrigin(0.5, 0));
      return;
    }

    // 답한 질문 — 지금 읽는 답변(처음엔 내가 고른 것)의 대답과 일지 기록, 그리고 다른 답변을 여는 작은 버튼들.
    const reading = peeking[question.id] ?? view.answeredChoiceId ?? question.choices[0].id;
    const shown = question.choices.find(({ id }) => id === reading) ?? question.choices[0];
    const chip = block.chip;
    const rowWidth = question.choices.length * chip.width + (question.choices.length - 1) * chip.gap;
    question.choices.forEach((choice, index) => {
      const mine = choice.id === view.answeredChoiceId;
      const selected = choice.id === shown.id;
      const chipButton = scene.add.container(width / 2 - rowWidth / 2 + chip.width / 2 + index * (chip.width + chip.gap), y + chip.height / 2);
      chipButton.add(drawLayer(scene, 0, 0, slantedRect(chip.width, chip.height, chip.bevel), { fill: selected ? 0x1d2a38 : 0x10141a, alpha: selected ? 0.96 : 0.62, edge: COLOR.accent, edgeAlpha: selected ? 0.6 : 0.2 }));
      chipButton.add(scene.add.text(0, 0, t(mine ? "info.diary.answerChipMine" : "info.diary.answerChip", { n: index + 1 }), textStyle({ role: "emphasis", size: size.font.small - 4, color: selected ? COLOR.accentText : COLOR.inkDim })).setOrigin(0.5));
      const hit = scene.add.rectangle(0, 0, chip.width, chip.height, 0xffffff, 0).setInteractive({ useHandCursor: true });
      hit.on("pointerdown", () => pressIn(chipButton));
      hit.on("pointerout", () => pressOut(chipButton, "normal", { pop: false }));
      hit.on("pointerup", () => { pressOut(chipButton); peeking[question.id] = choice.id; render(); });
      chipButton.add(hit);
      section.add(chipButton);
    });
    y += chip.height + 22;
    const label = scene.add.text(0, y, shown.label, textStyle({ role: "body", size: size.font.small, color: COLOR.inkDim, wrap: width })).setOrigin(0, 0);
    section.add(label);
    y += label.height + size.spacing.compactLine;
    const reply = scene.add.text(0, y, shown.reply, textStyle({ role: "body", size: size.font.regular, color: COLOR.ink, lineSpacing: size.spacing.compactLine, wrap: width })).setOrigin(0, 0);
    section.add(reply);
    y += reply.height + size.spacing.compactLine;
    section.add(scene.add.text(0, y, shown.note, textStyle({ role: "body", size: size.font.small, color: COLOR.inkDim, lineSpacing: size.spacing.compactLine, wrap: width })).setOrigin(0, 0));
    if (received?.questionId === question.id && received.gems > 0) {
      section.add(scene.add.text(width, headerY + block.headerHeight - 18, t("info.diary.received", { gems: received.gems }), textStyle({ role: "emphasis", size: size.font.small - 4, color: COLOR.accentText })).setOrigin(1, 0));
    }
  };

  render();
}
