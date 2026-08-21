import type { Page } from "@playwright/test";
import { OPENING_TRAIN } from "../../src/data/dialogues/openingTrain";
import { SAVE_STORAGE_KEY, SaveManager } from "../../src/state/SaveManager";
import { createDefaultSession } from "../../src/state/session";

/**
 * 오프닝을 이미 본 상태의 저장 데이터를 만든다.
 *
 * 저장 모양을 테스트가 손으로 적으면 `SaveManager`가 바뀔 때마다 같이 썩는다. 그래서 실제
 * 저장 경로를 그대로 통과시키고 나온 JSON만 가져온다.
 */
function completedOpeningSave(): string {
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
  manager.save(session);
  return stored;
}

/**
 * 첫 방문이 아닌 상태로 게임을 연다.
 *
 * 저장이 없으면 타이틀에서 누를 때 오프닝 스토리로 들어간다. 로비 이후를 확인하는 테스트가
 * 매번 대사를 눌러 넘기면 느리고 대사 편집에 흔들리므로, 오프닝만 미리 본 것으로 둔다.
 */
export async function startAfterOpening(page: Page): Promise<void> {
  const save = completedOpeningSave();
  await page.addInitScript(
    ([key, value]) => window.localStorage.setItem(key, value),
    [SAVE_STORAGE_KEY, save] as const,
  );
  await page.goto("/");
  await page.waitForFunction(() => window.__PF_DEBUG?.ready === true);
}
