import Phaser from "phaser";
import { t } from "../i18n";
import { LOBBY_EVENTS, type LobbyEventDef } from "../data/lobbyEvents";
import { POPUP_TITLE_SIZE, PopupLayer } from "./PopupLayer";
import { LobbyEventCard } from "./LobbyEventCard";
import { activeLobbyEvents, lobbyEventListLayout, lobbyEventRemaining } from "./lobbyEventModel";

export interface LobbyEventPopupOptions {
  onSelect: (event: LobbyEventDef) => void;
  onClosed?: () => void;
  /** 이벤트 화면에서 돌아와 다시 열 때는 제 등장 연출 없이 완성된 채로 선다. */
  instant?: boolean;
}

/**
 * 로비 이벤트 목록 — 무역과 같은 레이어 판에 이벤트가 한 장씩 쌓인다.
 *
 * 로비를 떠나지 않는 판이라 상단 재화 줄이 그대로 보이고, 나가는 길은 판 밖 우하단의 공용
 * 뒤로가기다. 창 높이는 **정의된 이벤트 수**로 한 번 정하고, 그중 지금 열린 것만 가운데로 모아
 * 세운다(무역 전시장과 같은 규칙).
 */
export class LobbyEventPopup {
  private closeAction?: () => void;

  constructor(private readonly scene: Phaser.Scene, private readonly popups: PopupLayer, private readonly options: LobbyEventPopupOptions) {}

  open(): void {
    if (this.closeAction) return;
    const now = Date.now();
    const events = activeLobbyEvents(now);
    const layout = lobbyEventListLayout(events.length, LOBBY_EVENTS.length);
    this.popups.open({
      width: layout.width, height: layout.height, title: t("event.title"), titleSize: POPUP_TITLE_SIZE.workboard,
      dim: true, closeOnBackdrop: true, hideCloseButton: true, instant: this.options.instant,
      onClose: () => { this.closeAction = undefined; this.options.onClosed?.(); },
    }, (body, close) => {
      this.closeAction = close;
      events.forEach((event, index) => {
        body.add(new LobbyEventCard(this.scene, 0, layout.centers[index], {
          width: layout.cardWidth,
          height: layout.cardHeight,
          event,
          remaining: lobbyEventRemaining(event.endsAt, now),
          onClick: () => this.options.onSelect(event),
        }));
      });
    });
  }

  /** 로비 공용 뒤로가기가 부르는 단일 종료점이다. */
  close(): void { this.closeAction?.(); }
}
