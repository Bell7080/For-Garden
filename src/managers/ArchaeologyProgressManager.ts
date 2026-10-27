import { findArchaeologySite } from "../data/archaeologySites";
import { session, type Session } from "../state/session";
import { resolveServerApi, type RecordApi } from "./serverApi";

/** 고고학의 의미 있는 UI 선택을 서버 기록으로 확정한다. */
export class ArchaeologyProgressManager {
  private readonly apiCache: { api?: RecordApi } = {};
  constructor(private readonly state: Session = session, private readonly injectedApi?: RecordApi) {}

  private get api(): RecordApi { return resolveServerApi<RecordApi>(this.state, this.injectedApi, this.apiCache); }

  /** 잠금 검증은 서버 응답을 가진 씬이 하고, 서버는 삭제된 카탈로그 ID가 저장되는 일을 막는다. */
  async selectSite(siteId: string): Promise<void> {
    // 이미 같은 선택이면 서버를 부르지 않는다 — 지도가 열릴 때마다 같은 값을 보내지 않게 한다.
    if (findArchaeologySite(siteId) === undefined || this.state.archaeology.lastSelectedSiteId === siteId) return;
    await this.api.selectArchaeologySite({ siteId });
  }

  /** 잠금 조건 변경으로 무효가 된 선택을 이미 계산된 안전한 포커스로 복구한다. */
  repairSelection(siteId: string): Promise<void> { return this.selectSite(siteId); }
}

/** 앱 런타임이 공유하는 선택 저장 진입점이다. 카메라 픽셀 좌표는 의도적으로 소유하지 않는다. */
export const archaeologyProgressManager = new ArchaeologyProgressManager();
