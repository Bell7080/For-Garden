import Phaser from "phaser";
import { BASE_HEIGHT, BASE_WIDTH } from "../config/gameConfig";
import { findLobbyEvent } from "../data/lobbyEvents";
import { setDebugScene } from "../debug";
import { t } from "../i18n";
import { addSceneBackground, BACKGROUND } from "../ui/backgrounds";
import { addBackButton } from "../ui/IconButton";
import { drawLayer, HOLO, slantedRect } from "../ui/holo";
import { lobbyEventRemaining } from "../ui/lobbyEventModel";
import { playSceneEntrance, startScene } from "../ui/screenTransition";
import { shrinkTextToWidth } from "../ui/textFit";
import { COLOR, textStyle } from "../ui/theme";
import { TopBar } from "../ui/TopBar";
import { LOBBY_RETURN } from "./lobbyEntry";

/** 로비 이벤트 판이 넘기는 유일한 입력. */
export interface EventSceneData { eventId: string }

/** 화면 자리. 값은 이 표에만 있다. */
const EVENT_STAGE = {
  titleY: 230,
  subtitleY: 300,
  remainingY: 360,
  panel: { y: 1050, width: 940, height: 1100 },
} as const;

/**
 * 이벤트 한 건의 화면 — **지금은 연결선만 있는 빈 무대다.**
 *
 * 로비 이벤트 판에서 카드를 누르면 여기로 들어온다. 이름·부제·남은 기간과 내용이 들어설 빈 판만
 * 세우고, 이벤트가 제 종류(출석·교환·전용 스테이지)를 갖게 되면 그 판 안을 갈아 끼운다. 준비
 * 상태를 말하는 문장은 세우지 않는다(개발 설명을 화면에 쓰지 않는다).
 *
 * 나가는 길은 로비의 이벤트 판이다 — 목록에서 들어왔으므로 목록으로 돌아가야 다음 이벤트를 고른다.
 */
export class EventScene extends Phaser.Scene {
  constructor() {
    super("event");
  }

  create(data?: EventSceneData): void {
    const event = findLobbyEvent(data?.eventId);
    // 모르는 이벤트(직접 진입·끝난 이벤트)는 빈 화면을 세우지 않고 이벤트 판으로 돌려보낸다.
    if (!event) { startScene(this, "lobby", LOBBY_RETURN.event); return; }
    setDebugScene("event", event.id);
    addSceneBackground(this, BACKGROUND.lobby);
    this.add.rectangle(BASE_WIDTH / 2, BASE_HEIGHT / 2, BASE_WIDTH, BASE_HEIGHT, COLOR.void, 0.6).setDepth(-20);
    new TopBar(this, 40, { currencies: "none", profile: false });

    const title = this.add.text(60, EVENT_STAGE.titleY, t(event.titleKey), textStyle({ role: "display", size: 58, color: COLOR.eventText })).setOrigin(0, 0.5);
    shrinkTextToWidth(title, BASE_WIDTH - 120);
    const subtitle = this.add.text(60, EVENT_STAGE.subtitleY, t(event.subtitleKey), textStyle({ role: "body", size: 30, color: COLOR.inkDim })).setOrigin(0, 0.5);
    shrinkTextToWidth(subtitle, BASE_WIDTH - 120);
    const remaining = lobbyEventRemaining(event.endsAt, Date.now());
    this.add.text(60, EVENT_STAGE.remainingY, t(`event.remaining.${remaining.unit}`, { value: remaining.value }), textStyle({ role: "emphasis", size: 26, color: COLOR.eventText })).setOrigin(0, 0.5);

    // 이벤트 내용이 들어설 자리. 윗변 한 줄만 노랗게 긋고 테두리는 두르지 않는다.
    drawLayer(this, BASE_WIDTH / 2, EVENT_STAGE.panel.y, slantedRect(EVENT_STAGE.panel.width, EVENT_STAGE.panel.height), {
      fill: 0x101821, alpha: HOLO.glass, edge: COLOR.event, edgeAlpha: 0.72,
    });

    addBackButton(this, () => startScene(this, "lobby", LOBBY_RETURN.event));
    playSceneEntrance(this);
  }
}
