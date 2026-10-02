import Phaser from "phaser";
import { DIARY_QUESTION_GEM_REWARD } from "../core/relicStory";
import { relicStoryFor } from "../data/relicStories";
import { t } from "../i18n";
import { relicStories } from "../managers/RelicStoryManager";
import { drawHairline, drawLayer, slantedRect } from "./holo";
import { OBSERVATION_JOURNAL_SIZE } from "./observationJournalLayout";
import { pressIn, pressOut } from "./pressFeedback";
import { COLOR, textStyle } from "./theme";

/** 질문 쪽에서 쓰는 열람 상태. 일지가 닫힐 때까지 쪽을 오가도 유지된다. */
export interface DiaryQuestionState {
  /** 답한 질문에서 지금 읽고 있는 답변(보기만). 질문 ID → 선택지 ID. */
  peeking: Record<string, string>;
  received?: { questionId: string; gems: number };
  busy: boolean;
}

export function createDiaryQuestionState(): DiaryQuestionState {
  return { peeking: {}, busy: false };
}

/** 관찰 질문 한 쪽의 지금 상태 — 일지의 쪽 점이 "답할 수 있는 질문"을 알릴 때 쓴다. */
export function diaryQuestionStatus(relicId: string, index: number): "locked" | "open" | "answered" {
  return relicStories.questionViews(relicId)[index]?.status ?? "locked";
}

/**
 * 관찰 일지의 **질문 쪽 하나**를 `page` 안에 그린다.
 *
 * 질문은 개체마다 셋이고 일지 본문 옆쪽으로 한 쪽씩 놓여, 본문과 같은 손짓(`< >`·쓸어 넘기기)으로 넘긴다 — 하단에
 * 붙여 두면 글 자리를 먹는다. 답하면 젬(질문마다 한 번)을 받고, 그 뒤로는 **다른 답변도 작은 버튼으로 열어 볼 수
 * 있다**(보기만 하고 젬·기록은 처음 고른 답 그대로다). 열리는 날 전의 질문은 며칠 뒤에 열리는지만 말한다.
 */
export function renderDiaryQuestionPage(
  scene: Phaser.Scene,
  page: Phaser.GameObjects.Container,
  left: number,
  top: number,
  relicId: string,
  index: number,
  state: DiaryQuestionState,
  onAnswered: () => void,
): void {
  const story = relicStoryFor(relicId);
  const question = story?.questions[index];
  if (!story || !question) return;
  const size = OBSERVATION_JOURNAL_SIZE;
  const block = size.questionBlock;
  const width = size.body.width;
  const total = story.questions.length;
  const view = relicStories.questionViews(relicId)[index];

  page.removeAll(true);
  const title = scene.add.text(left, top, t("info.diary.title", { index: index + 1, total }), textStyle({ role: "emphasis", size: size.font.regular, color: COLOR.ink })).setOrigin(0, 0);
  page.add(title);
  page.add(drawHairline(scene, 0, top + title.height + 14, width, { color: COLOR.accent, alpha: 0.35 }));
  const prompt = scene.add.text(left, top + title.height + 40, question.prompt, textStyle({ role: "emphasis", size: size.font.question, color: COLOR.accentText, wrap: width })).setOrigin(0, 0);
  page.add(prompt);
  let y = prompt.y + prompt.height + 28;

  if (view.status === "locked") {
    page.add(scene.add.text(left, y, t("info.diary.locked", { days: relicStories.daysUntil(view.unlocksAt) }), textStyle({ role: "body", size: size.font.small, color: COLOR.inkDim, wrap: width })).setOrigin(0, 0));
    return;
  }

  if (view.status === "open") {
    question.choices.forEach((choice, order) => {
      const button = scene.add.container(0, y + size.choice.height / 2 + order * (size.choice.height + size.spacing.choiceGap));
      button.add(drawLayer(scene, 0, 0, slantedRect(size.choice.width, size.choice.height, size.choice.bevel), { fill: 0x141a22, alpha: 0.94, edge: COLOR.accent, edgeAlpha: 0.42 }));
      button.add(scene.add.text(0, 0, choice.label, textStyle({ role: "emphasis", size: size.font.small, wrap: size.choice.width - 40, align: "center" })).setOrigin(0.5));
      const hit = scene.add.rectangle(0, 0, size.choice.width, size.choice.height, 0xffffff, 0).setInteractive({ useHandCursor: true });
      hit.on("pointerdown", () => pressIn(button));
      hit.on("pointerout", () => pressOut(button, "normal", { pop: false }));
      hit.on("pointerup", () => {
        pressOut(button);
        if (state.busy) return;
        state.busy = true;
        void relicStories.answer(relicId, question.id, choice.id)
          .then((gems) => { state.received = { questionId: question.id, gems }; })
          .catch(() => undefined)
          .finally(() => { state.busy = false; if (page.scene) onAnswered(); });
      });
      button.add(hit);
      page.add(button);
    });
    const hintY = y + question.choices.length * (size.choice.height + size.spacing.choiceGap) + 8;
    page.add(scene.add.text(0, hintY, t("info.diary.reward", { gems: DIARY_QUESTION_GEM_REWARD }), textStyle({ role: "body", size: size.font.small, color: COLOR.inkDim, align: "center" })).setOrigin(0.5, 0));
    return;
  }

  // 답한 질문 — 지금 읽는 답변(처음엔 내가 고른 것)의 대답과 일지 기록, 그리고 다른 답변을 여는 작은 버튼들.
  const reading = state.peeking[question.id] ?? view.answeredChoiceId ?? question.choices[0].id;
  const shown = question.choices.find(({ id }) => id === reading) ?? question.choices[0];
  const chip = block.chip;
  const rowWidth = question.choices.length * chip.width + (question.choices.length - 1) * chip.gap;
  question.choices.forEach((choice, order) => {
    const mine = choice.id === view.answeredChoiceId;
    const selected = choice.id === shown.id;
    const chipButton = scene.add.container(-rowWidth / 2 + chip.width / 2 + order * (chip.width + chip.gap), y + chip.height / 2);
    chipButton.add(drawLayer(scene, 0, 0, slantedRect(chip.width, chip.height, chip.bevel), { fill: selected ? 0x1d2a38 : 0x10141a, alpha: selected ? 0.96 : 0.62, edge: COLOR.accent, edgeAlpha: selected ? 0.6 : 0.2 }));
    chipButton.add(scene.add.text(0, 0, t(mine ? "info.diary.answerChipMine" : "info.diary.answerChip", { n: order + 1 }), textStyle({ role: "emphasis", size: size.font.small - 4, color: selected ? COLOR.accentText : COLOR.inkDim })).setOrigin(0.5));
    const hit = scene.add.rectangle(0, 0, chip.width, chip.height, 0xffffff, 0).setInteractive({ useHandCursor: true });
    hit.on("pointerdown", () => pressIn(chipButton));
    hit.on("pointerout", () => pressOut(chipButton, "normal", { pop: false }));
    hit.on("pointerup", () => { pressOut(chipButton); state.peeking[question.id] = choice.id; renderDiaryQuestionPage(scene, page, left, top, relicId, index, state, onAnswered); });
    chipButton.add(hit);
    page.add(chipButton);
  });
  y += chip.height + 28;
  const label = scene.add.text(left, y, shown.label, textStyle({ role: "body", size: size.font.small, color: COLOR.inkDim, wrap: width })).setOrigin(0, 0);
  page.add(label);
  y += label.height + size.spacing.compactLine + 8;
  const reply = scene.add.text(left, y, shown.reply, textStyle({ role: "body", size: size.font.regular, color: COLOR.ink, lineSpacing: size.spacing.compactLine, wrap: width })).setOrigin(0, 0);
  page.add(reply);
  y += reply.height + size.spacing.paragraph;
  page.add(scene.add.text(left, y, shown.note, textStyle({ role: "body", size: size.font.small, color: COLOR.inkDim, lineSpacing: size.spacing.compactLine, wrap: width })).setOrigin(0, 0));
  if (state.received?.questionId === question.id && state.received.gems > 0) {
    page.add(scene.add.text(left + width, top + 4, t("info.diary.received", { gems: state.received.gems }), textStyle({ role: "emphasis", size: size.font.small - 4, color: COLOR.accentText })).setOrigin(1, 0));
  }
}
