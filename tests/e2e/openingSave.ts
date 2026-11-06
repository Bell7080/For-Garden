import { createCompletedTutorialState } from "../../src/core/tutorial";
import { legalConsentKey } from "../../src/core/legalConsent";
import { LEGAL_CONSENT_POPUP, legalConsentRowY } from "../../src/ui/legalConsentLayout";
import { LOCAL_SAVE_STORAGE_KEYS } from "../../src/core/saveStorage";
import type { Page } from "@playwright/test";
import { OPENING_TRAIN } from "../../src/data/dialogues/openingTrain";
import { SaveManager } from "../../src/state/SaveManager";
import { normalizePlayerLevel, PLAYER_LEVEL_CAP } from "../../src/core/playerLevel";
import { createDefaultSession, type Session } from "../../src/state/session";

/** Node에서 헬퍼를 실행해도 브라우저의 --mode test 저장 공간을 명시적으로 고른다. */
export const E2E_SAVE_STORAGE_KEY = LOCAL_SAVE_STORAGE_KEYS.test;

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
  }, "test");
  const session = createDefaultSession();
  session.completedStoryIds.add(OPENING_TRAIN.id);
  session.cleared.add("1-1");
  session.playerCard.nickname = "테스트연구원";
  // 약관 동의는 기기 기록이라 저장에 함께 실린다. 비우면 타이틀을 누를 때마다 동의창이 먼저 떠 모든 화면 검사가 타이틀에 갇힌다.
  session.settings.game.legalConsent = legalConsentKey();
  // 첫 플레이 튜토리얼은 끝난 상태로 시작한다 — 전투 조작·로비 안내가 화면별 검사를 가리지 않게.
  session.tutorial = createCompletedTutorialState();
  // 콘텐츠가 연구원 레벨로 잠겨 있으므로 화면별 E2E는 기본으로 모두 열린 만렙에서 시작한다. 잠금을 확인하는 편만 prepare에서 되돌린다.
  session.playerResearch = normalizePlayerLevel({ level: PLAYER_LEVEL_CAP });
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
    [E2E_SAVE_STORAGE_KEY, save] as const,
  );
  await page.goto("/");
  await page.waitForFunction(() => window.__PF_DEBUG?.ready === true);
}

/**
 * 저장 없이 시작하는 편이 타이틀을 누른 뒤 뜨는 약관 동의창을 통과한다.
 *
 * 세 칸을 켜고 「동의하고 시작」을 누른다. 자리는 `legalConsentLayout` 한 표에서 읽는다 — 동의창은 화면 가운데에
 * 서므로 몸 좌표에 화면 중심만 더하면 된다. 창이 뜨지 않았으면(이미 동의) 아무것도 하지 않는다.
 */
export async function acceptLegalConsent(page: Page): Promise<void> {
  const { tap } = await import("./canvasInput");
  const opened = await page.waitForFunction(() => (window.__PF_DEBUG?.popupTitles?.length ?? 0) > 0 || window.__PF_DEBUG?.scene !== "title", undefined, { timeout: 15_000 })
    .then(() => page.evaluate(() => window.__PF_DEBUG?.scene === "title" && (window.__PF_DEBUG?.popupTitles?.length ?? 0) > 0))
    .catch(() => false);
  if (!opened) return;
  const cx = 540, cy = 960, L = LEGAL_CONSENT_POPUP;
  for (const index of [0, 1, 2]) await tap(page, cx + L.row.boxX + (index < 2 ? 250 : 320), cy + legalConsentRowY(index));
  await tap(page, cx, cy + L.submitY);
}
