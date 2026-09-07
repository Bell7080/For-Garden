import type { Session } from "../../src/state/session";

/** 승인 전 토리카 추가 외형을 검증하는 테스트만 소유권을 명시적으로 주입한다. */
export function ownTorikaTestSkin(session: Session): Session {
  session.ownedRelicSkinIds.add("torika-skin-001");
  return session;
}
