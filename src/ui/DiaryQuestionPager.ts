import Phaser from "phaser";
import { DIARY_QUESTION_GEM_REWARD } from "../core/relicStory";
import { relicStoryFor } from "../data/relicStories";
import { t } from "../i18n";
import { relicStories } from "../managers/RelicStoryManager";
import { motionPolicy } from "../core/settings";
import { session } from "../state/session";
import { drawHairline, drawLayer, slantedRect } from "./holo";
import type { PopupLayer } from "./PopupLayer";
import { RewardFrame } from "./RewardFrame";
import { currencyRecordToRewardItems, openRewardPopup } from "./RewardPopup";
import { OBSERVATION_JOURNAL_SIZE } from "./observationJournalLayout";
import { pressIn, pressOut } from "./pressFeedback";
import { COLOR, textStyle } from "./theme";

/** 질문 쪽에서 쓰는 열람 상태. 일지가 닫힐 때까지 쪽을 오가도 유지된다. */
export interface DiaryQuestionState {
  /** 답한 질문에서 지금 읽고 있는 답변(보기만, 화면 안에서만 기억한다). 질문 ID → 선택지 ID. */
  peeking: Record<string, string>;
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
 * 붙여 두면 글 자리를 먹는다. 답하면 **어느 답을 골랐는지는 남지 않고**(영구 선택을 만들지 않는다) 모든 답변을 작은 버튼으로
 * 똑같이 열어 볼 수 있으며, 쪽 맨 아래 가운데에 **보상 아이콘**(임무와 같은 숨 쉬는 액자)이 서서 누르면 젬을 받는다.
 * 열리는 날 전의 질문은 며칠 뒤에 열리는지만 말한다.
 */
export function renderDiaryQuestionPage(
  scene: Phaser.Scene,
  page: Phaser.GameObjects.Container,
  left: number,
  top: number,
  relicId: string,
  index: number,
  state: DiaryQuestionState,
  popups: PopupLayer,
  /** 쪽 안에서 보상 아이콘이 앉을 가운데 높이(쪽 좌표). */
  rewardY: number,
  onChanged: () => void,
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
          .then(() => { state.peeking[question.id] = choice.id; })
          .catch(() => undefined)
          .finally(() => { state.busy = false; if (page.scene) onChanged(); });
      });
      button.add(hit);
      page.add(button);
    });
    const hintY = y + question.choices.length * (size.choice.height + size.spacing.choiceGap) + 8;
    page.add(scene.add.text(0, hintY, t("info.diary.reward", { gems: DIARY_QUESTION_GEM_REWARD }), textStyle({ role: "body", size: size.font.small, color: COLOR.inkDim, align: "center" })).setOrigin(0.5, 0));
    return;
  }

  // 답한 질문 — 지금 읽는 답변(처음엔 내가 고른 것)의 대답과 일지 기록, 그리고 다른 답변을 여는 작은 버튼들.
  const reading = state.peeking[question.id] ?? question.choices[0].id;
  const shown = question.choices.find(({ id }) => id === reading) ?? question.choices[0];
  const chip = block.chip;
  const rowWidth = question.choices.length * chip.width + (question.choices.length - 1) * chip.gap;
  question.choices.forEach((choice, order) => {
    const selected = choice.id === shown.id;
    const chipButton = scene.add.container(-rowWidth / 2 + chip.width / 2 + order * (chip.width + chip.gap), y + chip.height / 2);
    chipButton.add(drawLayer(scene, 0, 0, slantedRect(chip.width, chip.height, chip.bevel), { fill: selected ? 0x1d2a38 : 0x10141a, alpha: selected ? 0.96 : 0.62, edge: COLOR.accent, edgeAlpha: selected ? 0.6 : 0.2 }));
    chipButton.add(scene.add.text(0, 0, t("info.diary.answerChip", { n: order + 1 }), textStyle({ role: "emphasis", size: size.font.small - 4, color: selected ? COLOR.accentText : COLOR.inkDim })).setOrigin(0.5));
    const hit = scene.add.rectangle(0, 0, chip.width, chip.height, 0xffffff, 0).setInteractive({ useHandCursor: true });
    hit.on("pointerdown", () => pressIn(chipButton));
    hit.on("pointerout", () => pressOut(chipButton, "normal", { pop: false }));
    hit.on("pointerup", () => { pressOut(chipButton); state.peeking[question.id] = choice.id; renderDiaryQuestionPage(scene, page, left, top, relicId, index, state, popups, rewardY, onChanged); });
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
  if (!view.rewardClaimed) addQuestionRewardFrame(scene, page, relicId, question.id, popups, rewardY, state, onChanged);
}

/**
 * 답한 질문의 **보상 아이콘** — 판 위 층(유리 한 장) 가운데에 임무의 받을 수 있는 보상처럼 숨 쉬며 서고, 누르면 보상 영수증과
 * 함께 젬이 들어온다. 받은 질문에는 서지 않는다.
 */
function addQuestionRewardFrame(
  scene: Phaser.Scene,
  page: Phaser.GameObjects.Container,
  relicId: string,
  questionId: string,
  popups: PopupLayer,
  y: number,
  state: DiaryQuestionState,
  onChanged: () => void,
): void {
  const holder = scene.add.container(0, y);
  holder.add(drawLayer(scene, 0, 0, slantedRect(420, 190, 30), { fill: 0x2e2412, alpha: 0.82, edge: COLOR.missionClaim, edgeAlpha: 0.9 }));
  const frame = new RewardFrame(scene, 0, 0, {
    icon: "currency-gems", amount: DIARY_QUESTION_GEM_REWARD, size: 128, state: "claimable",
    onClick: () => {
      if (state.busy) return;
      state.busy = true;
      void relicStories.claimQuestionReward(relicId, questionId)
        .then((gems) => { openRewardPopup(scene, popups, { items: currencyRecordToRewardItems({ gems }) }); })
        .catch(() => undefined)
        .finally(() => { state.busy = false; if (page.scene) onChanged(); });
    },
  });
  holder.add(frame);
  page.add(holder);
  if (motionPolicy(session.settings).nonEssentialDistanceFactor > 0) {
    const tween = scene.tweens.add({ targets: holder, scale: { from: 1, to: 1.06 }, duration: 620, yoyo: true, repeat: -1, ease: "Sine.InOut" });
    holder.once(Phaser.GameObjects.Events.DESTROY, () => tween.remove());
  }
}
