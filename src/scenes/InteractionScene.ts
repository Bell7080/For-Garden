import Phaser from "phaser";
import { BASE_HEIGHT, BASE_WIDTH } from "../config/gameConfig";
import { INTERACTION_CITIES } from "../data/interactionCities";
import { RELICS } from "../data/relics";
import { SQUADS } from "../data/factions";
import { currencyGuide } from "../data/currencyGuide";
import { ELEMENT_LABEL } from "../ui/info";
import { interactionManager } from "../managers/InteractionManager";
import { session } from "../state/session";
import { Button } from "../ui/Button";
import { addBackButton } from "../ui/IconButton";
import { addSceneBackground, BACKGROUND } from "../ui/backgrounds";
import { drawLayer, HOLO, slantedRect } from "../ui/holo";
import { COLOR, textStyle } from "../ui/theme";
import { TopBar } from "../ui/TopBar";
import { setDebugScene } from "../debug";
import { PopupLayer } from "../ui/PopupLayer";
import { InteractionExchangePopup } from "../ui/InteractionExchangePopup";
import { journalsForCity, type InteractionJournal } from "../data/interactionJournals";
import { NotificationDot } from "../ui/NotificationDot";
import { DialogueFlow, type DialogueChoice } from "../core/dialogue";
import { DialogueLayer } from "../ui/DialogueLayer";
import { storyManager } from "../managers/StoryManager";

const BLUE = 0x55b9e8;
/** 교류 화면은 표시와 입력만 맡고 상태 변경은 InteractionManager로 보낸다. */
export class InteractionScene extends Phaser.Scene {
  private cityId = INTERACTION_CITIES[0].id; private party: string[] = []; private body?: Phaser.GameObjects.Container; private serverNow = Date.now();
  private readonly popups = new PopupLayer(this, 2600);
  private journalDialogue?: { journal: InteractionJournal; flow: DialogueFlow; layer: DialogueLayer };
  constructor() { super("interaction"); }
  create(): void {
    setDebugScene("interaction", "교류");
    // TODO(art): 전용 원화 전까지 loadingSteps가 이미 읽는 로비 배경을 임시 사용한다.
    addSceneBackground(this, BACKGROUND.lobby); this.add.rectangle(BASE_WIDTH / 2, BASE_HEIGHT / 2, BASE_WIDTH, BASE_HEIGHT, COLOR.void, 0.74);
    new TopBar(this, 40, { currencies: "none", onSettings: () => this.scene.start("settings", { returnScene: "interaction" }) });
    this.add.text(52, 150, "교류", textStyle({ role: "display", size: 50, color: "#a8ddf5" })); addBackButton(this, () => this.scene.start("lobby"));
    // 파견 목록이 다시 그려져도 파괴되지 않는 씬 고정 진입점이라 항상 교환소를 찾을 수 있다.
    this.add.existing(new Button(this, 875, 185, { width: 300, height: 86, label: "교환소", accentColor: BLUE, onClick: () => new InteractionExchangePopup(this, this.popups, interactionManager).open() }));
    void Promise.all([interactionManager.cities(), interactionManager.refresh()]).then(([cities, dispatch]) => { this.serverNow = Date.parse(dispatch.serverTime); this.draw(cities.cities); });
    this.time.addEvent({ delay: 1000, loop: true, callback: () => { this.serverNow += 1000; this.draw(); } });
  }
  /** 한 화면 안에서 도시·편성·예상 시간·진행 슬롯을 함께 다시 그린다. */
  private draw(rows = INTERACTION_CITIES.map(city => ({ ...city, unlocked: city.unlock.researchLevel <= session.playerResearch.level }))): void {
    this.body?.destroy(true); this.body = this.add.container(); const add = <T extends Phaser.GameObjects.GameObject>(o: T): T => { this.body!.add(o); return o; }; const city = INTERACTION_CITIES.find(c => c.id === this.cityId)!;
    add(drawLayer(this, 540, 490, slantedRect(980, 500, 18), { fill: COLOR.panel, alpha: HOLO.glass, edge: BLUE, edgeAlpha: .8 }));
    rows.forEach((c, i) => add(new Button(this, 205 + i * 335, 300, { width: 300, height: 94, label: c.displayName, sub: c.unlocked ? `${c.baseDurationHours}시간` : `연구 Lv.${c.unlock.researchLevel}`, accentColor: BLUE, onClick: () => { if (c.unlocked) { this.cityId = c.id; this.draw(rows); } } })));
    add(this.add.text(78, 395, city.displayName, textStyle({ role: "emphasis", size: 34, color: "#a8ddf5" }))); add(this.add.text(78, 450, city.description, textStyle({ role: "body", size: 24 })).setWordWrapWidth(900));
    // 도시별 기록 버튼은 잠긴 원문 대신 발견 수와 읽지 않은 수만 보여 준다.
    const journals = journalsForCity(city.id); const found = journals.filter(({ id }) => session.discoveredInteractionJournalIds.has(id)); const unread = found.filter(({ id }) => !session.readInteractionJournalIds.has(id));
    const journalButton = add(new Button(this, 850, 505, { width: 330, height: 82, label: "도시 일지", sub: `${found.length}/${journals.length} 발견 · 새 기록 ${unread.length}`, accentColor: BLUE, onClick: () => this.openJournals(city.id) }));
    if (unread.length) new NotificationDot(this, journalButton, { x: 150, y: -38 });
    add(this.add.text(78, 555, `추천 ${city.recommended.elements.map(element => ELEMENT_LABEL[element]).join(" · ")} / ${city.recommended.squads.map(squad => SQUADS[squad].name).join(" · ")}`, textStyle({ role: "body", size: 22, color: COLOR.inkDim }))); add(this.add.text(78, 610, `보상 성향  ${city.rewards.map(r => `${currencyGuide(r.currency).name} ${r.amount}`).join(" · ")}`, textStyle({ role: "body", size: 23 })));
    add(drawLayer(this, 540, 900, slantedRect(980, 250, 18), { fill: COLOR.panel, alpha: HOLO.glass, edge: BLUE, edgeAlpha: .6 })); const dispatch = session.interaction.slots[0];
    if (dispatch && !dispatch.claimed) { const left = Math.max(0, Date.parse(dispatch.completesAt) - this.serverNow); add(this.add.text(78, 830, left ? `파견 중 · ${Math.ceil(left / 3_600_000)}시간 남음` : "교류 완료 · 수령 대기", textStyle({ role: "emphasis", size: 32, color: "#a8ddf5" }))); add(this.add.text(78, 900, dispatch.party.map(id => RELICS.find(r => r.id === id)?.name).join(" · "), textStyle({ role: "body", size: 25 }))); if (!left) add(new Button(this, 820, 980, { width: 280, height: 88, label: "완료 수령", accentColor: BLUE, onClick: () => void interactionManager.claim(dispatch.dispatchId, crypto.randomUUID()).then(() => this.draw(rows)) })); return; }
    add(this.add.text(78, 825, `파견 슬롯 1/1 · 선택 ${this.party.length}/3`, textStyle({ role: "emphasis", size: 30, color: "#a8ddf5" }))); RELICS.filter(r => session.owned.has(r.id)).slice(0, 9).forEach((r, i) => add(new Button(this, 180 + i % 3 * 360, 1090 + Math.floor(i / 3) * 120, { width: 320, height: 88, label: r.name, sub: this.party.includes(r.id) ? "편성됨" : `${ELEMENT_LABEL[r.element]} · ${SQUADS[r.squad].name}`, accentColor: BLUE, onClick: () => { this.party = this.party.includes(r.id) ? this.party.filter(id => id !== r.id) : this.party.length < 3 ? [...this.party, r.id] : this.party; this.draw(rows); } })));
    add(new Button(this, 780, 1580, { width: 410, height: 110, label: "교류 파견", sub: `${city.baseDurationHours}시간 이내`, variant: "primary", accentColor: BLUE, accentTextColor: "#d9f3ff", onClick: () => { if (this.party.length) void interactionManager.start(city.id, this.party).then(r => { this.serverNow = Date.parse(r.serverTime); this.draw(rows); }); } }));
  }

  /** 발견된 제목만 목록에 만들고 미발견 행은 원문 대신 잠금 상태로 남긴다. */
  private openJournals(cityId: string): void {
    const journals = journalsForCity(cityId);
    this.popups.open({ width: 900, height: 980, title: "도시 일지", dim: true, closeOnBackdrop: true }, (body) => {
      journals.forEach((journal, index) => {
        const discovered = session.discoveredInteractionJournalIds.has(journal.id);
        const read = session.readInteractionJournalIds.has(journal.id);
        const button = new Button(this, 0, -330 + index * 150, { width: 760, height: 110, label: discovered ? journal.title : `기록 ${journal.discoveryOrder} · 미발견`, sub: discovered ? (read ? "열람 완료" : "새 기록") : "본문 잠김", accentColor: BLUE, onClick: () => { if (discovered) this.openJournal(journal); } });
        body.add(button);
        if (discovered && !read) new NotificationDot(this, button, { x: 355, y: -48 });
      });
    });
  }

  /** 일반 본문은 공용 쪽지에서, 분기형 본문은 기존 DialogueLayer와 StoryManager에서 연다. */
  private openJournal(journal: InteractionJournal): void {
    interactionManager.markJournalRead(journal.id);
    if (journal.body) {
      this.popups.open({ width: 860, height: 620, title: journal.title, dim: true, closeOnBackdrop: true }, (body) => body.add(this.add.text(-360, -170, journal.body, textStyle({ role: "body", size: 30, wrap: 720, lineSpacing: 12 }))));
      return;
    }
    const story = journal.dialogueStory;
    if (!story) return;
    const flow = new DialogueFlow(story);
    const layer = new DialogueLayer(this, (choice) => this.advanceJournalDialogue(choice));
    this.journalDialogue = { journal, flow, layer };
    void layer.show(flow.current).finally(() => flow.unlockInput());
  }

  /** 정적 분기를 진행하고 완독은 StoryManager에 기록한 뒤 씬 재시작으로 Puppet까지 정리한다. */
  private advanceJournalDialogue(choice?: DialogueChoice): void {
    const active = this.journalDialogue; if (!active) return;
    const result = active.flow.advance(choice?.id);
    const storyId = active.journal.dialogueStory?.id;
    if (!storyId) return;
    if (result.effect) storyManager.applyEffect(storyId, result.effect);
    if (result.completed) { storyManager.complete(storyId); this.scene.restart(); return; }
    void active.layer.show(result.node!).finally(() => active.flow.unlockInput());
  }
}
