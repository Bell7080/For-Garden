import { findArchaeologySite } from "../data/archaeologySites";
import { saveManager, type SaveManager } from "../state/SaveManager";
import { session, type Session } from "../state/session";

/** 고고학의 의미 있는 UI 선택을 검증하고 진행 저장과 같은 경계에서 확정한다. */
export class ArchaeologyProgressManager {
  constructor(private readonly state: Session = session, private readonly saves: Pick<SaveManager, "save"> = saveManager) {}

  /** 잠금 검증은 서버 응답을 가진 씬이 하고, 이 경계는 삭제된 카탈로그 ID가 저장되는 일을 막는다. */
  selectSite(siteId: string): void {
    if (findArchaeologySite(siteId) === undefined || this.state.archaeology.lastSelectedSiteId === siteId) return;
    this.state.archaeology.lastSelectedSiteId = siteId;
    this.saves.save(this.state);
  }

  /** 잠금 조건 변경으로 무효가 된 선택을 이미 계산된 안전한 포커스로 원자적으로 복구한다. */
  repairSelection(siteId: string): void { this.selectSite(siteId); }
}

/** 앱 런타임이 공유하는 선택 저장 진입점이다. 카메라 픽셀 좌표는 의도적으로 소유하지 않는다. */
export const archaeologyProgressManager = new ArchaeologyProgressManager();
