import { describe, expect, it, vi } from "vitest";
import { ArchaeologyProgressManager } from "../../src/managers/ArchaeologyProgressManager";
import { createDefaultSession } from "../../src/state/session";

describe("ArchaeologyProgressManager", () => {
  it("persists catalog selections but rejects removed site ids", () => {
    const state = createDefaultSession();
    const save = vi.fn();
    const manager = new ArchaeologyProgressManager(state, { save });

    manager.selectSite("sunken-archive");
    expect(state.archaeology.lastSelectedSiteId).toBe("sunken-archive");
    expect(save).toHaveBeenCalledOnce();

    // 삭제된 운영 카탈로그 ID는 기존의 안전한 선택도 덮어쓰지 않는다.
    manager.selectSite("removed-site");
    expect(state.archaeology.lastSelectedSiteId).toBe("sunken-archive");
    expect(save).toHaveBeenCalledOnce();
  });
});
