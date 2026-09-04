import Phaser from "phaser";
import { journalsForCity, type InteractionJournal } from "../data/interactionJournals";
import type { InteractionManager } from "../managers/InteractionManager";
import { storyManager } from "../managers/StoryManager";
import { session } from "../state/session";
import { Button } from "./Button";
import { DialogueFlow, type DialogueChoice } from "../core/dialogue";
import { DialogueLayer } from "./DialogueLayer";
import { NotificationDot } from "./NotificationDot";
import type { PopupLayer } from "./PopupLayer";
import { textStyle } from "./theme";

const BLUE = 0x55b9e8;

/**
 * 도시 일지.
 *
 * 발견한 기록만 제목을 갖고, 나머지는 **원문 대신 잠금 상태로 남는다** — 목록에서 지우면 그
 * 도시에 아직 무엇이 남았는지 보이지 않는다. 분기형 본문은 화면 위에 서는 대사층이 맡으므로
 * 씬이 이 창을 소유한다.
 */
export class InteractionJournalPopup {
  private active?: { journal: InteractionJournal; flow: DialogueFlow; layer: DialogueLayer };

  constructor(private readonly scene: Phaser.Scene, private readonly popups: PopupLayer, private readonly manager: InteractionManager) {}

  /** 발견된 제목만 목록에 만들고 미발견 행은 원문 대신 잠금 상태로 남긴다. */
  open(cityId: string): void {
    const journals = journalsForCity(cityId);
    this.popups.open({ width: 900, height: 980, title: "도시 일지", dim: true, closeOnBackdrop: true }, (body) => {
      if (journals.length === 0) {
        body.add(this.scene.add.text(0, 0, "아직 이 도시의 기록이 없다", textStyle({ role: "body", size: 28, color: "#8d97a5" })).setOrigin(0.5));
        return;
      }
      journals.forEach((journal, index) => {
        const discovered = session.discoveredInteractionJournalIds.has(journal.id);
        const read = session.readInteractionJournalIds.has(journal.id);
        const button = new Button(this.scene, 0, -330 + index * 150, {
          width: 760, height: 110,
          label: discovered ? journal.title : `기록 ${journal.discoveryOrder} · 미발견`,
          sub: discovered ? (read ? "열람 완료" : "새 기록") : "본문 잠김",
          accentColor: BLUE,
          onClick: () => { if (discovered) this.openJournal(journal); },
        });
        body.add(button);
        if (discovered && !read) new NotificationDot(this.scene, button, { x: 355, y: -48 });
      });
    });
  }

  /** 일반 본문은 공용 쪽지에서, 분기형 본문은 기존 대사층과 StoryManager에서 연다. */
  private openJournal(journal: InteractionJournal): void {
    this.manager.markJournalRead(journal.id);
    if (journal.body) {
      this.popups.open({ width: 860, height: 620, title: journal.title, dim: true, closeOnBackdrop: true }, (body) => body.add(this.scene.add.text(-360, -170, journal.body!, textStyle({ role: "body", size: 30, wrap: 720, lineSpacing: 12 }))));
      return;
    }
    const story = journal.dialogueStory;
    if (!story) return;
    this.popups.closeAll();
    const flow = new DialogueFlow(story);
    const layer = new DialogueLayer(this.scene, (choice) => this.advance(choice));
    this.active = { journal, flow, layer };
    void layer.show(flow.current).finally(() => flow.unlockInput());
  }

  /** 정적 분기를 진행하고 완독은 StoryManager에 기록한다. */
  private advance(choice?: DialogueChoice): void {
    const active = this.active;
    if (!active) return;
    const result = active.flow.advance(choice?.id);
    const storyId = active.journal.dialogueStory?.id;
    if (!storyId) return;
    if (result.effect) storyManager.applyEffect(storyId, result.effect);
    if (result.completed) { storyManager.complete(storyId); this.active = undefined; return; }
    void active.layer.show(result.node!).finally(() => active.flow.unlockInput());
  }
}
