import Phaser from "phaser";
import { getRelicCatalogDisclosure } from "../core/relicCatalog";
import type { RelicDef } from "../core/types";
import { SQUADS } from "../data/factions";
import { observationQuestionForRelicAndDate } from "../data/observations";
import { t } from "../i18n";
import type { KeywordManager } from "../managers/KeywordManager";
import { observations } from "../managers/ObservationManager";
import { addPopupBackgroundImage } from "./backgrounds";
import { addFactionMark, factionMarkBounds } from "./FactionMark";
import { drawGlyph } from "./glyphs";
import { chipPoints, drawHairline, drawLayer, HOLO, slantedRect } from "./holo";
import { clampObservationPage, sortedObservationHistory } from "./observationHistory";
import { OBSERVATION_INTERVIEW_LAYOUT, observationInterviewPanelState, type ObservationInterviewPanelState } from "./observationInterviewPanel";
import { calculateObservationJournalFlow, OBSERVATION_JOURNAL_SIZE, withoutRepeatedProfileDetails } from "./observationJournalLayout";
import type { PopupLayer } from "./PopupLayer";
import { COLOR, textStyle } from "./theme";
import { pressIn, pressOut } from "./pressFeedback";

/**
 * 관찰 일지 — **개체 하나를 설명하는 유일한 판이다.**
 *
 * 개체번호·프로젝트·기원·발굴지·연대와 복원 기록, 그리고 소속 스쿼드의 엠블럼이 여기 모인다.
 * 아군 정보창 안에만 있던 때는 **적에게 그 모든 것이 없는 것과 같았다** — 적 개체도 태생부터
 * 소속·관찰 기록까지 제 정의에 온전히 갖고 있는데(`RelicDef` 정체성 규칙), 그것을 여는 문이
 * 아군 창에만 있어 화면 어디에서도 읽을 수 없었다. 그래서 판을 정보창 밖으로 꺼내 **부르는
 * 쪽이 정보창이든 적 정보 팝업이든 같은 한 장**이 서게 한다.
 *
 * 세 영역의 색은 섞지 않는다 — 상단 표본 메타데이터와 중단 기록은 `COLOR.inkDim`의 회색,
 * 복원 후 관찰 기록은 `COLOR.ink`의 흰색이다.
 */

/** 팝업을 부른 자리. 닫히면 그 버튼을 눌린 크기에서 풀어 준다. */
export interface JournalSource {
  x: number;
  y: number;
  onClose: () => void;
}

export interface ObservationJournalDeps {
  scene: Phaser.Scene;
  popups: PopupLayer;
  /** 발굴 기록 안의 규칙어를 그리는 경계. 화면마다 따로 만들지 않는다. */
  keywords: KeywordManager;
}

export interface ObservationJournalOptions {
  def: RelicDef;
  /**
   * 지금 이 개체를 갖고 있는가. 상세 기록의 공개 범위를 정한다 — 다만 적 전용 개체는 애초에
   * 가챠 대상이 아니라 이 값과 무관하게 전부 공개된다(`getRelicCatalogDisclosure`).
   */
  owned: boolean;
  /**
   * 매일의 관찰 인터뷰를 이 판에 세울지.
   *
   * **적에게는 세우지 않는다.** 적은 복원해 데려온 개체가 아니라 인터뷰할 수 없고, 그러면
   * 「복원 후 관찰 기록」 영역이 구분선과 제목만 남은 빈 칸이 된다 — 준비되지 않은 자리는
   * 안내 문구로 채우지 않고 통째로 비운다.
   */
  interviews: boolean;
  from: JournalSource;
}

/** 일지를 여는 두루마리 버튼. 정보창과 적 정보 팝업이 같은 한 장을 쓴다. */
export function addObservationJournalButton(
  deps: Pick<ObservationJournalDeps, "scene" | "popups">,
  parent: Phaser.GameObjects.Container,
  x: number,
  y: number,
  open: (from: JournalSource) => void,
  /** 칩 한 변. 기본은 아군 정보창의 뱃지 줄과 같은 76이다. */
  size = 76,
): Phaser.GameObjects.Container {
  const { scene, popups } = deps;
  const container = scene.add.container(x, y);
  container.add(drawLayer(scene, 0, 0, chipPoints(size, size, {
    bevel: { topLeft: size * 0.3, topRight: 0, bottomRight: size * 0.3, bottomLeft: 0 },
  }), { fill: 0x121820, alpha: HOLO.glass }));
  container.add(drawGlyph(scene, "scroll", 0, 0, size * 0.54, 0xd8c7a0));
  const hit = scene.add.rectangle(0, 0, size + 12, size + 12, 0xffffff, 0).setInteractive({ useHandCursor: true });
  hit.on("pointerdown", () => pressIn(container));
  hit.on("pointerout", () => { if (!popups.isOpen) pressOut(container, "normal", { pop: false }); });
  hit.on("pointerup", () => {
    pressIn(container);
    open({ x, y: y + size / 2, onClose: () => pressOut(container) });
  });
  container.add(hit);
  parent.add(container);
  return container;
}

/**
 * 일지는 누른 자리에 얹지 않고 **화면 가운데**에 선다.
 *
 * 판 폭이 960이라 누른 칩 위·아래 어디에 얹어도 화면을 거의 다 덮고, 칩이 판 위쪽에 있는 적
 * 정보창에서는 "칩 아래"로 밀려난 판이 화면 위로 잘려 제목표가 윗변 밖에 걸렸다. 부른 칩은
 * 여전히 판이 떠 있는 동안 눌린 크기를 유지하고 닫히면 돌아온다(`onClose`).
 */
function sourceOf(from: JournalSource): { onClose: () => void } {
  return { onClose: from.onClose };
}

/** 기존 관찰 일지 엠블럼 대비 30% 확대. 배율을 분리해 기준 크기와 의도를 함께 보존한다. */
const JOURNAL_SQUAD_MARK_SCALE = 1.3;
const JOURNAL_SQUAD_MARK = {
  size: 104 * JOURNAL_SQUAD_MARK_SCALE,
  // 가장 넓은 정사각 엠블럼의 복제 그림자도 본문 오른쪽 안전선 안에 남기는 중심 좌표다.
  x: 320,
  nameGap: 12,
  metadataGap: 24,
} as const;

// 일지 원화는 정보보다 먼저 읽히지 않을 만큼 낮추고, 어두운 페이드는 본문 대비를 보존한다.
const JOURNAL_ART_ALPHA = 0.18;
const JOURNAL_TEXT_FADE_ALPHA = 0.42;

/**
 * 상단 식별 정보 한 줄씩을 라벨(회색)·값(흰색) 두 텍스트로 그린다.
 *
 * 값이 길어 줄바꿈되는 경우까지 감안해 각 줄의 실제 렌더 높이를 재고 누적한다 — 눈대중
 * 상수는 "성장 단계" 줄처럼 긴 값이 두 줄로 접히는 순간 다음 구분선과 겹친다.
 */
function buildJournalIdentity(
  scene: Phaser.Scene,
  lines: readonly { label: string; value: string }[],
  width: number,
  fontSize: number,
  lineSpacing: number,
): { container: Phaser.GameObjects.Container; height: number } {
  const container = scene.add.container(0, 0);
  const labelWidth = 150;
  let cursor = 0;
  lines.forEach((line, index) => {
    if (index > 0) cursor += lineSpacing;
    const label = scene.add.text(0, cursor, line.label, textStyle({ role: "body", size: fontSize, color: COLOR.inkDim })).setOrigin(0, 0);
    const value = scene.add.text(labelWidth, cursor, line.value, textStyle({ role: "body", size: fontSize, color: COLOR.ink, wrap: width - labelWidth })).setOrigin(0, 0);
    container.add([label, value]);
    cursor += Math.max(label.height, value.height);
  });
  return { container, height: cursor };
}

/**
 * 관찰 기록 레이어.
 *
 * 관찰 일지 쪽지에는 가장 최근 한 건만 두고, 쌓인 전체 이력은 이 팝업이 한 건씩 넘겨
 * 보여 준다 — 매일 쌓이는 기록을 전부 한 판에 밀어 넣으면 캐릭터 소개보다 인터뷰 로그가
 * 더 길어진다. 페이지를 넘길 때마다 팝업을 닫고 다시 여는 건 룬 세공 갱신과 같은 경계다.
 */
export function openObservationHistory(deps: ObservationJournalDeps, def: RelicDef, from: JournalSource, page = 0): void {
  const { scene, popups } = deps;
  const history = sortedObservationHistory(observations.recordFor(def.id));
  const index = clampObservationPage(page, history.length);
  const entry = history[index];
  // 이 레이어는 눌린 자리 위에 얹히는 쪽지가 아니라 따로 읽는 기록판이다. 관찰 일지와
  // 같은 자리에 겹쳐 열면 두 판의 닫기 X가 거의 포개져 헷갈린다 — 화면 가운데 그대로 둔다.
  popups.open({ width: 820, height: 720, title: t("info.journal.history") }, (body, close) => {
    if (!entry) {
      body.add(scene.add.text(0, 0, t("info.journal.noInterview"), textStyle({ role: "body", size: 28, color: COLOR.inkDim })).setOrigin(0.5));
      return;
    }
    const goTo = (next: number): void => { close(); openObservationHistory(deps, def, from, next); };
    // 날짜·성향 태그는 부가 정보라 옅게, 실제 문답·발견 습성은 잘 보여야 하는 관찰 내용이라
    // 희다 — 관찰 일지 본문과 같은 색 규칙을 그대로 잇는다.
    body.add(scene.add
      .text(0, -296, `${entry.date}  ·  #${entry.personalityTag}`, textStyle({ role: "body", size: 26, color: COLOR.inkDim, align: "center" }))
      .setOrigin(0.5, 0));
    const copy = t("info.journal.historyEntry", { question: entry.question, answer: entry.answer, habit: entry.discoveredHabit });
    body.add(scene.add
      .text(0, -246, copy, textStyle({ role: "body", size: 31, color: COLOR.ink, lineSpacing: 12, align: "center", wrap: 720 }))
      .setOrigin(0.5, 0));
    addHistoryPager(scene, body, history.length, index, goTo);
  });
}

/** 기록판의 페이지 넘김. 왼쪽이 더 최근, 오른쪽이 더 과거다. */
function addHistoryPager(
  scene: Phaser.Scene,
  body: Phaser.GameObjects.Container,
  total: number,
  index: number,
  goTo: (next: number) => void,
): void {
  // 목록은 최신(1)에서 과거로 갈수록 페이지가 커진다. 화살표는 그 순서를 그대로 따라간다.
  const pagerY = 290;
  const hasNewer = index > 0;
  const hasOlder = index < total - 1;
  body.add(drawGlyph(scene, "page-prev", -300, pagerY, 40, hasNewer ? COLOR.inkHex : COLOR.inkDimHex, hasNewer ? 1 : 0.35));
  if (hasNewer) {
    const hit = scene.add.rectangle(-300, pagerY, 90, 90, 0xffffff, 0).setInteractive({ useHandCursor: true });
    hit.on("pointerup", () => goTo(index - 1));
    body.add(hit);
  }
  body.add(scene.add.text(0, pagerY, `${index + 1} / ${total}`, textStyle({ role: "emphasis", size: 28, color: COLOR.ink })).setOrigin(0.5));
  body.add(drawGlyph(scene, "page-next", 300, pagerY, 40, hasOlder ? COLOR.inkHex : COLOR.inkDimHex, hasOlder ? 1 : 0.35));
  if (hasOlder) {
    const hit = scene.add.rectangle(300, pagerY, 90, 90, 0xffffff, 0).setInteractive({ useHandCursor: true });
    hit.on("pointerup", () => goTo(index + 1));
    body.add(hit);
  }
}

/** 메타데이터·발굴 기록·복원 후 관찰 기록을 높이 기반으로 잇는 관찰 일지. */
export function openObservationJournal(deps: ObservationJournalDeps, options: ObservationJournalOptions): void {
  const { scene, popups, keywords } = deps;
  const { def, owned, interviews, from } = options;
  const disclosure = getRelicCatalogDisclosure(def, owned);
  const journal = OBSERVATION_JOURNAL_SIZE;
  const bodyLeft = -journal.body.width / 2;
  // 상단 식별 정보는 라벨(회색)과 값(흰색)을 갈라 무엇이 이름표고 무엇이 실제 값인지
  // 색으로 먼저 읽히게 한다 — 이름표와 같은 무게로 묻히면 "지금 보고 있는 개체가 정확히
  // 무엇인지"가 느리게 읽힌다.
  const identityLines: { label: string; value: string }[] = disclosure.access === "full"
    ? [
        { label: t("info.journal.id"), value: "NO." + disclosure.specimenNumber },
        { label: t("info.journal.project"), value: disclosure.projectName },
        { label: t("info.journal.origin"), value: disclosure.origin },
        { label: t("info.journal.site"), value: disclosure.excavationSite },
        ...(def.observationProfile ? [
          { label: t("info.journal.era"), value: def.observationProfile.originYear },
          // 복원 연도는 저장된 경과 시간이 아니라 정적 도감의 세계관 나잇대만 단독으로 표시한다.
          { label: t("info.journal.restoredYear"), value: def.observationProfile.restorationYear },
          { label: t("info.journal.lifeStage"), value: t("info.journal.lifeStageValue", { stage: def.observationProfile.lifeStage, height: def.observationProfile.height, weight: def.observationProfile.weight }) },
        ] : []),
      ]
    : [
        { label: t("info.journal.id"), value: "NO." + disclosure.specimenNumber },
        { label: t("info.journal.project"), value: t("info.journal.noRecord") },
        { label: t("info.journal.origin"), value: t("info.journal.unknown") },
        { label: t("info.journal.site"), value: t("info.journal.unknown") },
      ];

  // 텍스트를 먼저 만들어 실제 height를 얻는다. 이후 배치는 줄 수나 개체별 문단 길이를 추측하지 않는다.
  const markBounds = factionMarkBounds(JOURNAL_SQUAD_MARK.size);
  // 상단 정보는 확대된 표식의 실제 왼쪽 외곽(복제 그림자 포함) 전까지만 사용한다.
  const metadataWidth = JOURNAL_SQUAD_MARK.x + markBounds.left - JOURNAL_SQUAD_MARK.metadataGap - bodyLeft;
  const identity = buildJournalIdentity(scene, identityLines, metadataWidth, journal.font.regular, journal.spacing.line);
  const rawRecord = disclosure.access === "full" ? disclosure.record : def.catalogSummary + t("info.journal.lockedNotice");
  const excavationRecord = withoutRepeatedProfileDetails(rawRecord, def.observationProfile?.height, def.observationProfile?.weight);
  const excavation = keywords.layout(excavationRecord, { width: journal.body.width, size: journal.font.large, color: COLOR.inkDim, lineSpacing: journal.spacing.line });
  // 다른 스쿼드를 향한 동경은 unlockRecord의 관찰 문장이 담당하므로, 여기서는 소속 메모만 그린다.
  const squad = disclosure.access === "full" && def.squadNote
    ? scene.add.text(0, 0, def.squadNote, textStyle({ role: "body", size: journal.font.small, color: COLOR.inkDim, lineSpacing: journal.spacing.compactLine, wrap: journal.body.width })).setOrigin(0, 0)
    : undefined;

  /*
   * 매일의 관찰 인터뷰는 **부른 쪽이 그 영역을 원할 때만** 만든다.
   *
   * 적은 복원해 데려온 개체가 아니라 인터뷰가 없고, 그대로 두면 구분선과 제목만 남은 빈
   * 칸이 판 절반을 차지한다 — 준비되지 않은 자리는 안내 문구로 채우지 않고 통째로 비운다.
   */
  const allEntries = interviews ? observations.recordFor(def.id) : [];
  const entries = allEntries.slice(-1).reverse();
  const observationHeading = interviews
    ? scene.add.text(0, 0, t("info.journal.afterRestoration"), textStyle({ role: "emphasis", size: journal.font.regular, color: COLOR.ink })).setOrigin(0, 0)
    : undefined;
  // 이 판에는 가장 최근 관찰 기록 한 건만 둔다. 쌓인 전체 이력은 별도 레이어(관찰 기록)가
  // 한 건씩 넘겨 보여 준다.
  const observationCopy = entries.length
    ? entries.map((entry) => t("info.journal.entry", { date: entry.date, tag: entry.personalityTag, question: entry.question, answer: entry.answer, habit: entry.discoveredHabit })).join("\n\n")
    : t("info.journal.noObservation");
  const observation = interviews
    ? scene.add.text(0, 0, observationCopy, textStyle({ role: "body", size: entries.length ? journal.font.regular : journal.font.small, color: COLOR.ink, lineSpacing: journal.spacing.compactLine, wrap: journal.body.width })).setOrigin(0, 0)
    : undefined;
  // 링크 한 줄만큼 흐름 계산에 미리 더해 둔다 — 그러지 않으면 바로 아래 인터뷰 조작과 겹친다.
  const historyLinkHeight = allEntries.length > 1 ? journal.spacing.compactLine + journal.font.small + 16 : 0;
  const actionHeight = interviews && owned ? OBSERVATION_INTERVIEW_LAYOUT.trigger.height : 0;
  const flow = calculateObservationJournalFlow({
    metadata: identity.height, excavation: excavation.height, squad: squad?.height ?? 0,
    observationHeading: observationHeading?.height ?? 0, observation: (observation?.height ?? 0) + historyLinkHeight, action: actionHeight,
  });

  popups.open({ width: journal.popup.width, height: flow.popupHeight, title: t("info.journal.title"), titleSize: journal.font.title, tilt: journal.popup.tilt, ...sourceOf(from) }, (body, close) => {
    const artWidth = journal.popup.width - journal.art.inset * 2;
    const artHeight = flow.popupHeight - journal.art.inset * 2;
    if (scene.textures.exists("content-observation-journal")) {
      const journalMask = chipPoints(artWidth, artHeight, { bevel: { topLeft: artWidth * 0.14, topRight: 0, bottomRight: artWidth * 0.14, bottomLeft: 0 } });
      const journalArt = addPopupBackgroundImage(scene, body, "content-observation-journal", { x: 0, y: 0, width: artWidth, height: artHeight, maskShape: journalMask, fit: "native-center" });
      journalArt.image.setAlpha(JOURNAL_ART_ALPHA); journalArt.fade.setAlpha(JOURNAL_TEXT_FADE_ALPHA); journalArt.syncMask();
    }

    // 흐르는 본문만 별도 컨테이너에 담아, 화면 안전 높이를 넘을 때 판과 배경은 고정한 채 스크롤한다.
    const content = scene.add.container(0, -flow.popupHeight / 2);
    identity.container.setPosition(bodyLeft, flow.metadataY); content.add(identity.container);
    content.add(drawHairline(scene, 0, flow.excavationDividerY, journal.body.width, { color: COLOR.accent, alpha: 0.35 }));
    excavation.setPosition(bodyLeft, flow.excavationY); content.add(excavation);
    if (squad && flow.squadY !== undefined) { squad.setPosition(bodyLeft, flow.squadY); content.add(squad); }
    if (observationHeading && observation && flow.observationDividerY !== undefined && flow.observationHeadingY !== undefined && flow.observationY !== undefined) {
      content.add(drawHairline(scene, 0, flow.observationDividerY, journal.body.width, { color: COLOR.accent, alpha: 0.35 }));
      observationHeading.setPosition(bodyLeft, flow.observationHeadingY); content.add(observationHeading);
      observation.setPosition(bodyLeft, flow.observationY); content.add(observation);
      if (allEntries.length > 1) {
        // 이 개체의 다른 날짜 기록은 여기 밀어 넣지 않고 전용 레이어에서 한 건씩 넘겨 본다.
        const linkY = flow.observationY + observation.height + journal.spacing.compactLine;
        const link = scene.add.text(bodyLeft, linkY, t("info.journal.viewAll", { count: allEntries.length }), textStyle({ role: "emphasis", size: journal.font.small, color: COLOR.accentText })).setOrigin(0, 0);
        content.add(link);
        // 글자 자체보다 넉넉한 손끝 크기의 히트 영역을 따로 둔다 — 작은 글자 그대로 입력을
        // 받으면 모바일에서 자주 빗나간다.
        const linkHit = scene.add.rectangle(bodyLeft + link.width / 2, linkY + link.height / 2, link.width + 80, 96, 0xffffff, 0)
          .setOrigin(0.5)
          .setInteractive({ useHandCursor: true });
        linkHit.on("pointerup", () => openObservationHistory(deps, def, from));
        content.add(linkHit);
      }
    }

    // 소속 표식은 메타데이터 영역 안에만 앉혀 세 영역의 읽기 순서를 흐리지 않는다.
    // 그림자의 위쪽 실제 외곽을 메타데이터 상단에 맞춰 제목 영역으로 번지지 않게 한다.
    const markY = flow.metadataY - markBounds.top;
    const squadMark = addFactionMark(scene, JOURNAL_SQUAD_MARK.x, markY, def.squad, { size: JOURNAL_SQUAD_MARK.size });
    if (squadMark) content.add(squadMark);
    if (disclosure.access === "full") content.add(scene.add.text(JOURNAL_SQUAD_MARK.x, markY + markBounds.bottom + JOURNAL_SQUAD_MARK.nameGap, SQUADS[def.squad].name, textStyle({ role: "display", size: journal.font.regular, color: COLOR.accentText, align: "center" })).setOrigin(0.5, 0));

    if (interviews && owned && flow.actionY !== undefined) {
      addInterviewTrigger(deps, def, from, content, close, flow.actionY, actionHeight);
    }
    body.add(content);

    if (flow.scrollable) {
      // 휠과 손가락 드래그가 같은 clamp를 써 콘텐츠가 위아래 안전 여백 밖으로 빠지지 않는다.
      const viewportTop = -flow.popupHeight / 2 + journal.body.top;
      const viewport = scene.add.rectangle(0, viewportTop + flow.viewportHeight / 2, journal.body.width, flow.viewportHeight, 0xffffff, 0.001).setInteractive({ useHandCursor: true });
      const minY = flow.popupHeight / 2 - flow.contentHeight;
      const maxY = -flow.popupHeight / 2;
      const move = (delta: number): void => { content.setY(Phaser.Math.Clamp(content.y + delta, minY, maxY)); };
      // GeometryMask는 화면 좌표를 쓰므로 팝업 중심을 더한다. 본문만 잘리고 고정 배경·제목은 남는다.
      const maskGraphics = scene.make.graphics({ x: body.x, y: body.y });
      maskGraphics.fillStyle(0xffffff).fillRect(-journal.body.width / 2, viewportTop, journal.body.width, flow.viewportHeight);
      content.setMask(maskGraphics.createGeometryMask());
      body.once(Phaser.GameObjects.Events.DESTROY, () => maskGraphics.destroy());
      viewport.on("wheel", (_pointer: Phaser.Input.Pointer, _dx: number, dy: number) => move(-dy));
      let lastY = 0;
      viewport.on("pointerdown", (pointer: Phaser.Input.Pointer) => { lastY = pointer.y; });
      viewport.on("pointermove", (pointer: Phaser.Input.Pointer) => { if (pointer.isDown) { move(pointer.y - lastY); lastY = pointer.y; } });
      body.add(viewport);
    }
  });
}

/** 오늘의 인터뷰를 여는 판 아래 버튼과 그 문답 팝업. 보유한 개체에만 선다. */
function addInterviewTrigger(
  deps: ObservationJournalDeps,
  def: RelicDef,
  from: JournalSource,
  content: Phaser.GameObjects.Container,
  close: () => void,
  actionY: number,
  actionHeight: number,
): void {
  const { scene, popups } = deps;
  const journal = OBSERVATION_JOURNAL_SIZE;
  const utcDate = new Date().toISOString().slice(0, 10);
  const interview = OBSERVATION_INTERVIEW_LAYOUT;
  const canStart = observations.canStart(def.id, utcDate);
  const trigger = scene.add.container(0, actionY + actionHeight / 2);
  trigger.add(drawLayer(scene, 0, 0, slantedRect(interview.trigger.width, interview.trigger.height, interview.trigger.bevel), { fill: canStart ? 0x141a22 : 0x10141a, alpha: canStart ? 0.92 : 0.58, edge: COLOR.accent, edgeAlpha: canStart ? 0.4 : 0.16 }));
  trigger.add(scene.add.text(0, 0, canStart ? t("info.interview.open") : t("info.interview.doneToday"), textStyle({ role: "emphasis", size: journal.font.large, color: canStart ? COLOR.accentText : COLOR.inkDim })).setOrigin(0.5));
  let interviewState: ObservationInterviewPanelState = { open: false, completedToday: !canStart };
  if (canStart) {
    const hit = scene.add.rectangle(0, 0, interview.trigger.width, interview.trigger.height, 0xffffff, 0).setInteractive({ useHandCursor: true });
    hit.on("pointerdown", () => pressIn(trigger)); hit.on("pointerout", () => { if (!interviewState.open) pressOut(trigger, "normal", { pop: false }); });
    hit.on("pointerup", () => {
      pressOut(trigger); if (interviewState.open) { popups.closeTop(); return; }
      interviewState = observationInterviewPanelState(interviewState, "toggle");
      const question = observationQuestionForRelicAndDate(def.id, utcDate);
      popups.open({ ...interview.popup, title: t("info.interview.title"), closeOnBackdrop: false, dim: true, dimAlpha: 0.25, onClose: () => { interviewState = observationInterviewPanelState(interviewState, "close"); pressOut(trigger); } }, (panel, closeInterview) => {
        panel.add(scene.add.text(interview.question.x, interview.question.y, question.prompt, textStyle({ role: "emphasis", size: journal.font.question, color: COLOR.accentText, wrap: interview.question.width })).setOrigin(0, 0));
        question.choices.forEach((choice, index) => {
          const choiceButton = scene.add.container(0, interview.choice.firstY + index * interview.choice.step);
          choiceButton.add(drawLayer(scene, 0, 0, slantedRect(interview.choice.width, interview.choice.height, interview.choice.bevel), { fill: 0x141a22, alpha: 0.94, edge: COLOR.accent, edgeAlpha: 0.42 }));
          choiceButton.add(scene.add.text(0, 0, choice.label, textStyle({ role: "emphasis", size: journal.font.large })).setOrigin(0.5));
          const choiceHit = scene.add.rectangle(0, 0, interview.choice.width, interview.choice.height, 0xffffff, 0).setInteractive({ useHandCursor: true });
          choiceHit.on("pointerdown", () => pressIn(choiceButton)); choiceHit.on("pointerout", () => pressOut(choiceButton, "normal", { pop: false }));
          // 답을 고르면 그 기록이 실린 일지를 곧바로 다시 연다 — 닫고 찾아 들어오게 하지 않는다.
          choiceHit.on("pointerup", () => { observations.complete(def.id, utcDate, choice.id); interviewState = observationInterviewPanelState(interviewState, "complete"); closeInterview(); close(); openObservationJournal(deps, { def, owned: true, interviews: true, from }); });
          choiceButton.add(choiceHit); panel.add(choiceButton);
        });
      });
    });
    trigger.add(hit);
  }
  content.add(trigger);
}
