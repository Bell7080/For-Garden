import { hasRemoteState } from "../api/resultState";
import type { AttendanceStatusResponse, ClaimAttendanceResponse, GameApi } from "../api/contracts";
import { gameApi } from "../api/FakeServer";
import { ATTENDANCE_AD_SLOT_ID } from "../data/attendance";
import { completedAdToken } from "../data/adRewards";
import { presentRewardedAd, releaseAdWait } from "../platform/rewardedAds";
import type { AttendanceTrackId } from "../core/attendance";
import { session, type Session } from "../state/session";
import { managerEvents, type ManagerEvents } from "./ManagerEvents";
import { notificationManager } from "./NotificationManager";
import { InventoryManager } from "./InventoryManager";

/**
 * 출석의 서버 경계와 지급 결과의 로컬 반영을 한곳에서 소유한다(우편의 `MailManager`와 같은 규칙).
 *
 * 화면은 칸을 눌렀다는 것만 넘기고 지갑·가방을 직접 더하지 않는다 — 서버가 확정한 스냅샷만 세션에 옮기고
 * 로비 입구의 빨간 점은 받은 뒤 곧바로 다시 읽는다.
 */
export class AttendanceManager {
  constructor(private readonly api: GameApi, private readonly state: Session, private readonly events: ManagerEvents = managerEvents) {}

  status(): Promise<AttendanceStatusResponse> { return this.api.getAttendance(); }

  /** 로비가 오늘 저절로 열었다는 것을 서버에 남긴다. 실패해도 판은 이미 열렸으므로 삼킨다. */
  markAutoShown(): Promise<void> { return this.api.markAttendanceAutoShown().catch(() => undefined); }

  async claim(trackId: AttendanceTrackId, requestId: string = crypto.randomUUID()): Promise<ClaimAttendanceResponse> {
    return this.apply(await this.api.claimAttendance({ trackId, requestId }));
  }

  /**
   * 정규 출석의 광고 덤(`day` 없으면 서버가 오늘 칸, 없으면 가장 오래된 못 받은 덤을 고른다) — 광고를 보이고, 끝까지 봤을 때만 서버에 받으러 간다.
   * 취소·SDK 미준비는 성공을 흉내 내지 않고 `undefined`를 돌려준다.
   */
  async claimAd(present: (slotId: string) => ReturnType<typeof presentRewardedAd> = presentRewardedAd, requestId: string = crypto.randomUUID(), day?: number): Promise<ClaimAttendanceResponse | undefined> {
    const verificationToken = completedAdToken(await present(ATTENDANCE_AD_SLOT_ID));
    if (!verificationToken) return undefined;
    try {
      return this.apply(await this.api.claimAttendanceAd({ verificationToken, requestId, ...(day !== undefined ? { day } : {}) }));
    } finally {
      releaseAdWait();
    }
  }

  private apply(result: ClaimAttendanceResponse): ClaimAttendanceResponse {
    if (!hasRemoteState(result)) new InventoryManager(this.state, this.events).applySnapshot(result.items, result.wallet);
    else { this.events.publish("wallet", { wallet: this.state.wallet }); this.events.publishInventory(); }
    void notificationManager.refresh().catch(() => undefined);
    return result;
  }
}

export const attendanceManager = new AttendanceManager(gameApi, session);
