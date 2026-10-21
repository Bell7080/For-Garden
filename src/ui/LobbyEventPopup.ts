import { gameApi } from "../api/FakeServer";
import { ROULETTE, type RouletteStatus } from "../core/roulette";
import { motionPolicy } from "../core/settings";
import { session } from "../state/session";
import { lobbyEventEntryId, prioritizeLobbyEvents } from "./lobbyEventModel";
import Phaser from "phaser";
import { t } from "../i18n";
import type { AttendanceTrackDto } from "../api/contracts";
import { LOBBY_EVENTS, type LobbyEventDef } from "../data/lobbyEvents";
import { ATTENDANCE_TRACK_IDS } from "../core/attendance";
import { attendanceManager } from "../managers/AttendanceManager";
import { POPUP_TITLE_SIZE, PopupLayer } from "./PopupLayer";
import { LobbyEventCard } from "./LobbyEventCard";
import { openAttendancePopup } from "./AttendancePopup";
import { lobbyEventEntries, lobbyEventListLayout } from "./lobbyEventModel";

export interface LobbyEventPopupOptions {
  onSelect: (event: LobbyEventDef, onChanged: () => void) => void;
  onClosed?: () => void;
  /** 이벤트 화면에서 돌아와 다시 열 때는 제 등장 연출 없이 완성된 채로 선다. */
  instant?: boolean;
}

/**
 * 로비 이벤트 목록 — 무역과 같은 레이어 판에 출석과 이벤트가 한 장씩 쌓인다.
 *
 * 로비를 떠나지 않는 판이라 상단 재화 줄이 그대로 보이고, 나가는 길은 판 밖 우하단의 공용
 * 뒤로가기다. 창 높이는 **설 수 있는 카드 수**(출석 둘 + 정의된 이벤트)로 한 번 정하고, 그중 지금 열린
 * 것만 가운데로 모아 세운다(무역 전시장과 같은 규칙). 출석 카드를 누르면 판 위에 출석 판이 겹쳐 열리고,
 * 받으면 그 카드의 빨간 점·진행 마름모가 그 자리에서 바뀐다.
 */
export class LobbyEventPopup {
  private closeAction?: () => void;
  private opening = false;

  constructor(private readonly scene: Phaser.Scene, private readonly popups: PopupLayer, private readonly options: LobbyEventPopupOptions) {}

  open(): void {
    if (this.closeAction || this.opening) return;
    this.opening = true;
    // 출석은 서버가 오늘에 맞춰 넘긴 줄만 선다. 조회가 실패하면 기간 이벤트만 세운다.
    void Promise.all([attendanceManager.status().then(({ tracks }) => tracks, () => [] as AttendanceTrackDto[]), gameApi.getRouletteStatus().catch(() => undefined)]).then(([tracks, roulette]) => {
      this.opening = false;
      if (!this.scene.sys.isActive()) return;
      this.build(tracks, roulette);
    });
  }

  private build(tracks: readonly AttendanceTrackDto[], roulette?: RouletteStatus): void {
    const now = Date.now();
    let entries = lobbyEventEntries(tracks, now);
    let actionable = new Set(tracks.filter(track => track.claimableToday).map(track => `attendance:${track.id}`));
    if (roulette?.active && (roulette.remaining > 0 || roulette.bonusAvailable)) actionable.add(ROULETTE.id);
    entries = prioritizeLobbyEvents(entries, actionable);
    const layout = lobbyEventListLayout(entries.length, ATTENDANCE_TRACK_IDS.length + LOBBY_EVENTS.length);
    this.popups.open({
      width: layout.width, height: layout.height, title: t("event.title"), titleSize: POPUP_TITLE_SIZE.workboard,
      dim: true, closeOnBackdrop: true, hideCloseButton: true, instant: this.options.instant,
      onClose: () => { this.closeAction = undefined; this.options.onClosed?.(); },
    }, (body, close) => {
      this.closeAction = close;
      const cards = new Map<string, LobbyEventCard>();
      let refreshing = false;
      const refresh = async (): Promise<void> => {
        if (refreshing || !body.active) return;
        refreshing = true;
        try {
          const [attendance, roulette] = await Promise.all([attendanceManager.status(), gameApi.getRouletteStatus()]);
          if (!body.active) return;
          const ready = new Set(attendance.tracks.filter(track => track.claimableToday).map(track => `attendance:${track.id}`));
          if (roulette.active && (roulette.remaining > 0 || roulette.bonusAvailable)) ready.add(ROULETTE.id);
          const completed = [...actionable].some(id => !ready.has(id));
          actionable = ready;
          const sorted = prioritizeLobbyEvents(entries, ready);
          sorted.forEach((entry, index) => {
            const card = cards.get(lobbyEventEntryId(entry)); if (!card?.active) return;
            card.setActionRequired(ready.has(lobbyEventEntryId(entry)));
            // 완료 전환 때만 이동한다. 다시 열 때는 이미 정렬된 상태라 연출을 되풀이하지 않는다.
            this.scene.tweens.killTweensOf(card);
            if (completed && motionPolicy(session.settings).nonEssentialDistanceFactor > 0) this.scene.tweens.add({ targets: card, y: layout.centers[index], duration: 520, ease: "Cubic.Out" });
            else card.y = layout.centers[index];
          });
        } catch { /* 조회 실패 때는 기존 카드와 점을 유지한다. */ }
        finally { refreshing = false; }
      };
      entries.forEach((entry, index) => {
        // 받은 뒤 다시 열면 바뀐 줄로 열어야 한다 — 카드가 처음 받은 값을 붙잡고 있지 않게 한다.
        let track = entry.kind === "attendance" ? entry.track : undefined;
        const card: LobbyEventCard = new LobbyEventCard(this.scene, 0, layout.centers[index], {
          width: layout.cardWidth,
          height: layout.cardHeight,
          entry,
          now,
          onClick: () => {
            if (entry.kind === "event") { this.options.onSelect(entry.event, () => void refresh()); return; }
            if (!track) return;
            openAttendancePopup(this.scene, this.popups, track, {
              onClaimed: (result) => {
                const next = result.tracks.find(({ id }) => id === result.trackId);
                if (!next) return;
                track = next;
                if (card.active) card.setAttendance(next);
                const afterClose = (): void => { if (!body.active) return; if (!this.popups.isTop(body)) { this.scene.time.delayedCall(200, afterClose); return; } void refresh(); };
                this.scene.time.delayedCall(200, afterClose);
              },
            });
          },
        });
        body.add(card);
        cards.set(lobbyEventEntryId(entry), card);
        card.setActionRequired(actionable.has(lobbyEventEntryId(entry)));
      });
    });
  }

  /** 로비 공용 뒤로가기가 부르는 단일 종료점이다. */
  close(): void { this.closeAction?.(); }
}
