import type { Page } from "@playwright/test";
import { OPENING_TRAIN } from "../../src/data/dialogues/openingTrain";
import { SAVE_STORAGE_KEY, SaveManager } from "../../src/state/SaveManager";
import { createDefaultSession, type Session } from "../../src/state/session";

/**
 * 오프닝을 이미 본 상태의 저장 데이터를 만든다.
 *
 * 저장 모양을 테스트가 손으로 적으면 `SaveManager`가 바뀔 때마다 같이 썩는다. 그래서 실제
 * 저장 경로를 그대로 통과시키고 나온 JSON만 가져온다.
 */
function completedOpeningSave(prepare?: (session: Session) => void): string {
  let stored = "";
  const manager = new SaveManager({
    getItem: () => null,
    setItem: (_key, value) => {
      stored = value;
    },
    removeItem: () => undefined,
  });
  const session = createDefaultSession();
  session.completedStoryIds.add(OPENING_TRAIN.id);
  // 화면별 E2E는 저장 JSON을 직접 만들지 않고 타입이 보장된 세션만 필요한 상태로 조정한다.
  prepare?.(session);
  manager.save(session);
  return stored;
}

/**
 * 첫 방문이 아닌 상태로 게임을 연다.
 *
 * 저장이 없으면 타이틀에서 누를 때 오프닝 스토리로 들어간다. 로비 이후를 확인하는 테스트가
 * 매번 대사를 눌러 넘기면 느리고 대사 편집에 흔들리므로, 오프닝만 미리 본 것으로 둔다.
 */
export async function startAfterOpening(page: Page, prepare?: (session: Session) => void): Promise<void> {
  const save = completedOpeningSave(prepare);
  // **이미 저장이 있으면 덮지 않는다.** `addInitScript`는 새로 고침마다 다시 도는데, 그때마다
  // 준비한 저장을 다시 써 버리면 방금 게임이 남긴 저장이 사라진다 — 재접속 복원을 확인하는 편은
  // 그래서 제 저장을 잃고 `interaction`이 비어 있는 상태로 이어갔다. 씨앗은 처음 한 번만 심는다.
  await page.addInitScript(
    ([key, value]) => { if (!window.localStorage.getItem(key)) window.localStorage.setItem(key, value); },
    [SAVE_STORAGE_KEY, save] as const,
  );
  await page.goto("/");
  await page.waitForFunction(() => window.__PF_DEBUG?.ready === true);
}
