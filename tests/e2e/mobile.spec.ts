import { test, expect } from "@playwright/test";
import { startAfterOpening } from "./openingSave";
import { canvasBox, captureGame, gamePoint, tap, tapUntil } from "./canvasInput";
import { ExpeditionManager } from "../../src/managers/ExpeditionManager";
import { expeditionNodePosition, focusExpeditionFloor } from "../../src/ui/expeditionLayout";

const BASE_WIDTH = 1080;
const BASE_HEIGHT = 1920;

/** 기준 게임 좌표를 누른다. 실제 입력은 공용 `canvasInput`이 맡는다. */
const tapGame = tap;

/** 기준 게임 좌표 두 점 사이를 드래그해 지도 추적과 마스크 이탈을 실제 포인터 흐름으로 검증한다. */
async function dragGame(page: import("@playwright/test").Page, from: { x: number; y: number }, to: { x: number; y: number }): Promise<void> {
  const box = await canvasBox(page);
  const point = ({ x, y }: { x: number; y: number }) => gamePoint(box, x, y);
  const start = point(from); const end = point(to);
  await page.mouse.move(start.x, start.y); await page.mouse.down(); await page.mouse.move(end.x, end.y, { steps: 8 }); await page.mouse.up();
}

/** 상단 SD의 장기 누름 문턱을 넘긴 뒤 이동해 슬롯 드래그 상태기를 실제 모바일 포인터로 통과한다. */
async function holdDragGame(page: import("@playwright/test").Page, from: { x: number; y: number }, to: { x: number; y: number }): Promise<void> {
  const box = await canvasBox(page);
  const point = ({ x, y }: { x: number; y: number }) => gamePoint(box, x, y);
  const start = point(from); const end = point(to);
  await page.mouse.move(start.x, start.y); await page.mouse.down();
  await page.waitForTimeout(420);
  await page.mouse.move(end.x, end.y, { steps: 10 }); await page.mouse.up();
}

/** 포인터를 든 채 공용 표현 상태를 검사한 다음 놓아, 중간 프레임이 사라진 뒤의 결과와 섞지 않는다. */
async function inspectFormationDrag(page: import("@playwright/test").Page, from: { x: number; y: number }, to: { x: number; y: number }, owner: "expedition" | "excavation"): Promise<void> {
  const box = await canvasBox(page);
  const point = ({ x, y }: { x: number; y: number }) => gamePoint(box, x, y);
  const start = point(from); const end = point(to);
  await page.mouse.move(start.x, start.y); await page.mouse.down(); await page.waitForTimeout(420); await page.mouse.move(end.x, end.y, { steps: 10 });
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.formationDragVisual)).toMatchObject({ owner, hovered: 1, replacementVisible: true });
  await page.mouse.up();
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.formationDragVisual)).toBeUndefined();
}

/** Canvas 팝업이 노출한 실제 입력 중심을 읽어 레이아웃 숫자를 테스트에 복제하지 않는다. */
async function excavationControl(page: import("@playwright/test").Page, key: "close" | "harvest" | "cancelEdit"): Promise<{ x: number; y: number }> {
  return page.evaluate((control) => {
    const point = window.__PF_DEBUG?.idleExcavationControls?.[control];
    if (!point) throw new Error(`발굴 ${control} 입력 좌표가 준비되지 않았다`);
    return point;
  }, key);
}

/** 모바일 저장 상태에서 타이틀과 지도만 통과해 편성 미리보기를 연다. */
async function enterParty(page: import("@playwright/test").Page): Promise<void> {
  await startAfterOpening(page);
  await tapGame(page, BASE_WIDTH / 2, BASE_HEIGHT / 2);
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.scene)).toBe("lobby");
  await tapGame(page, BASE_WIDTH - 290, BASE_HEIGHT - 425);
  // 출격 선택판의 스토리 항목을 거쳐 메인 작전 지도로 이동한다.
  await tapGame(page, BASE_WIDTH / 2, 550);
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.scene)).toBe("stageMap");
  await tapGame(page, BASE_WIDTH / 2, BASE_HEIGHT - 180);
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.scene)).toBe("party");
}

test("세로형 화면에서 캔버스가 뜨고 첫 방문은 오프닝으로 들어간다", async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });
  page.on("pageerror", (err) => consoleErrors.push(err.message));

  await page.goto("/");

  const canvas = page.locator("canvas");
  await expect(canvas).toBeVisible();

  // 타이틀이 로딩 화면을 겸한다. ready는 다섯 칸이 다 찬 뒤에만 true가 된다.
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.scene)).toBe("title");
  await page.waitForFunction(() => window.__PF_DEBUG?.ready === true);

  await captureGame(page, `test-results/${test.info().project.name}-title.png`);

  const box = await canvas.boundingBox();
  expect(box).not.toBeNull();
  const aspect = box!.height / box!.width;
  expect(aspect).toBeGreaterThan(1); // 세로가 더 길어야 한다 (letterbox 포함)

  // 로딩이 끝나면 화면 아무 곳이나 눌러 넘어간다. 저장이 없으면 오프닝 스토리가 먼저다.
  await canvas.click();
  await expect
    .poll(() => page.evaluate(() => window.__PF_DEBUG?.scene))
    .toBe("opening");

  expect(consoleErrors, `콘솔 에러 발생: ${consoleErrors.join(", ")}`).toEqual([]);
});

test("오프닝을 이미 본 저장이면 타이틀에서 로비로 바로 간다", async ({ page }) => {
  await startAfterOpening(page);

  await tapGame(page, BASE_WIDTH / 2, BASE_HEIGHT / 2);
  await expect
    .poll(() => page.evaluate(() => window.__PF_DEBUG?.scene))
    .toBe("lobby");
});

test("출격 선택판에서 원정대 3기를 골라 진행 중 상태로 저장한다", async ({ page }) => {
  // 원정 첫 진입은 보스 전신 ZIP까지 파싱하므로 저사양 CI에서도 네 상태 캡처를 끝낼 시간을 둔다.
  test.setTimeout(360_000);
  await startAfterOpening(page);
  await tapGame(page, BASE_WIDTH / 2, BASE_HEIGHT / 2);
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.scene)).toBe("lobby");

  // 잔잔한 출격 선택판에서 원정을 고르면 별도 준비 씬으로 이동한다.
  await tapGame(page, BASE_WIDTH - 290, BASE_HEIGHT - 425);
  await tapGame(page, BASE_WIDTH / 2, 1403);
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.scene)).toBe("expedition");
  // 원정의 첫 화면은 주간 기록이다. 순위와 기록 보상을 먼저 보고 출격으로 편성을 연다.
  await page.waitForTimeout(900);
  await captureGame(page, `test-results/${test.info().project.name}-expedition-ranking.png`);
  // 기록 원경과 별개로 합성된 순위 팝업(도시 원경 + 옅은 필드)을 실제 캔버스에 남긴다.
  await tapGame(page, 363, 1610);
  await page.waitForTimeout(700);
  await captureGame(page, `test-results/${test.info().project.name}-expedition-ranking-popup.png`);
  // 닫힌 팝업의 우하단 공용 뒤로가기로 기록 화면에 복귀한다.
  await tapGame(page, 918, 1758);
  await page.waitForTimeout(500);
  await tapGame(page, 717, 1610);
  await page.waitForTimeout(700);
  await captureGame(page, `test-results/${test.info().project.name}-expedition-reward-popup.png`);
  // 주간 보상 팝업도 공용 뒤로가기로 닫아 편성 전환 입력을 가리지 않게 한다.
  await tapGame(page, 918, 1758);
  await page.waitForTimeout(500);

  // 하단 출격 버튼이 편성 단계를 연다. 씬 재시작과 SD 로딩을 기다린 뒤 카드를 누른다.
  // 기록 화면의 판들이 닫히고 나서야 출격이 드러난다 — 편성이 열릴 때까지 다시 누른다.
  await tapUntil(page, BASE_WIDTH / 2, 1800, async () => (await page.evaluate(() => window.__PF_DEBUG?.expeditionFormation)) !== undefined);
  await page.waitForTimeout(1500);
  await captureGame(page, `test-results/${test.info().project.name}-expedition-preparation.png`);

  // 복원된 세 기 중 가운데 슬롯을 직접 해제하면 카드·SD·인원수·버튼 상태가 함께 2기로 바뀐다.
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.expeditionFormation?.selectedCount)).toBe(3);
  // 공용 표현은 대상 네모칸과 자리 내주는 SD 고스트를 포인터를 든 동안 동시에 유지한다.
  const expeditionSlots = (await page.evaluate(() => window.__PF_DEBUG?.expeditionFormation?.slots))!;
  await inspectFormationDrag(page, expeditionSlots[0], expeditionSlots[1], "expedition");
  const formationSlot = (await page.evaluate(() => window.__PF_DEBUG?.expeditionFormation?.slots[1]))!;
  await tapGame(page, formationSlot.x, formationSlot.y);
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.expeditionFormation?.selectedCount)).toBe(2);
  // 빠진 렐릭의 보유 카드를 다시 눌러 세 기로 복구한 뒤 실제 시작 저장까지 이어 간다.
  await tapGame(page, 540, 850);
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.expeditionFormation?.selectedCount)).toBe(3);
  await tapGame(page, BASE_WIDTH / 2, 1680);
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.scene)).toBe("expedition");
  await expect.poll(() => page.evaluate(() => {
    // 저장에는 파생값(active)이 아니라 진행 중 런만 들어간다. 편성 3기는 run.relics가 갖는다.
    const raw = window.localStorage.getItem("eternal-city.local-save");
    return raw ? JSON.parse(raw).expedition?.run?.relics?.length : 0;
  })).toBe(3);
  await captureGame(page, `test-results/${test.info().project.name}-expedition-active.png`);
});

test("저장된 전투 전 증강 후보는 지도보다 먼저 복원된다", async ({ page }) => {
  await startAfterOpening(page, (session) => {
    // 실제 매니저 경계로 런과 후보를 만들어 저장 스키마나 RNG 결과를 E2E가 복제하지 않는다.
    const manager = new ExpeditionManager(session, { save: () => undefined }, () => new Date());
    manager.start([...session.owned].slice(0, 3));
    const node = session.expedition.run!.nodes.find(({ floor, type }) => floor === 1 && ["normal", "elite", "horde"].includes(type))!;
    manager.beginAugmentReward(node.id, node.type);
  });
  await tapGame(page, BASE_WIDTH / 2, BASE_HEIGHT / 2);
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.scene)).toBe("lobby");
  await tapGame(page, BASE_WIDTH - 290, BASE_HEIGHT - 425);
  await tapGame(page, BASE_WIDTH / 2, 1403);
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.scene)).toBe("expedition");
  // 닫기 없는 선택 작업판과 세 후보가 복원된 상태를 시각 회귀 자료로 남긴다.
  await captureGame(page, `test-results/${test.info().project.name}-expedition-augment-popup.png`);
});

test("원정 전투 노드는 지도 안 공용 편성판을 붙이고 적 상세 정보창으로 진입한다", async ({ page }) => {
  let reachableX = BASE_WIDTH / 2;
  let reachableY = (316 + 1138) / 2;
  await startAfterOpening(page, (session) => {
    // 실제 매니저가 만든 1층 전투 노드를 사용해 저장 구조와 지도 열 배치를 테스트가 위조하지 않는다.
    const manager = new ExpeditionManager(session, { save: () => undefined }, () => new Date());
    manager.start([...session.owned].slice(0, 3));
    const node = session.expedition.run!.nodes.find(({ floor, type }) => floor === 1 && ["normal", "elite", "horde"].includes(type))!;
    const point = expeditionNodePosition(node.floor, node.column);
    reachableX = point.x; reachableY = 316 + point.y + focusExpeditionFloor(1, 1138 - 316);
  });
  await tapGame(page, BASE_WIDTH / 2, BASE_HEIGHT / 2);
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.scene)).toBe("lobby");
  // 로비 입장 애니메이션이 입력을 넘겨받은 뒤 출격 버튼을 눌러 저속 모바일 실행을 안정화한다.
  await page.waitForTimeout(700);
  await tapGame(page, BASE_WIDTH - 290, BASE_HEIGHT - 425);
  // 출격 선택판은 로비 위 PopupLayer이므로 씬 이름은 유지된다. 판의 입력 생성만 잠시 기다린다.
  await page.waitForTimeout(400);
  await tapGame(page, BASE_WIDTH / 2, 1403);
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.scene)).toBe("expedition");
  // 실제 지도 포커스 계산이 반영된 첫 도달 노드의 화면 좌표를 선택한다.
  await tapGame(page, reachableX, reachableY);
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.enemyPreview)).not.toBeUndefined();
  const geometry = await page.evaluate(() => window.__PF_DEBUG!.enemyPreview!);
  expect(geometry.panelTop).toBeGreaterThanOrEqual(geometry.top); expect(geometry.panelBottom).toBeLessThanOrEqual(geometry.bottom);
  expect([1, 3, 5]).toContain(geometry.enemyTargets.length);
  await captureGame(page, `test-results/${test.info().project.name}-expedition-node-enemy-preview.png`);
  await tapGame(page, geometry.enemyTargets[0].x, geometry.enemyTargets[0].y);
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.infoOpen)).toBe(true);
  // 상세창을 닫은 뒤 빈 지도 탭은 선택과 편성판을 취소하고 같은 노드는 다시 새 판을 연다.
  await tapGame(page, BASE_WIDTH - 106, BASE_HEIGHT - 120);
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.infoOpen)).toBe(false);
  await tapGame(page, 100, 400);
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.enemyPreview)).toBeUndefined();
  await tapGame(page, reachableX, reachableY);
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.enemyPreview)).not.toBeUndefined();
  // 1층에서 위쪽 월드를 내려 보면 선택 노드가 마스크 하단을 벗어나 판과 SD도 함께 사라진다.
  await dragGame(page, { x: 900, y: 700 }, { x: 900, y: 1070 });
  await dragGame(page, { x: 900, y: 700 }, { x: 900, y: 1070 });
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.enemyPreview)).toBeUndefined();
});

test("방치 발굴 팝업은 좁은 로비 위 한 장으로 열리고 뒤 입력을 차단한 뒤 닫힌다", async ({ page }) => {
  await startAfterOpening(page, (session) => {
    // 성공 뒤 다시 그려진 사용량과 같은 저장 상태를 만들고, 한도 소진 버튼도 남는 정책을 검증한다.
    session.dailyAdRewards = { date: new Date().toISOString().slice(0, 10), claimsBySlot: { "excavation-harvest": 1, "excavation-storage": 2 }, requestIds: ["e2e-harvest", "e2e-storage-1", "e2e-storage-2"] };
  });
  await tapGame(page, BASE_WIDTH / 2, BASE_HEIGHT / 2);
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.scene)).toBe("lobby");

  // 왼쪽 하단 발굴 입구를 연타해도 조회 상태를 공유하는 팝업 한 장만 유지한다.
  await tapGame(page, 250, BASE_HEIGHT - 445);
  await tapGame(page, 250, BASE_HEIGHT - 445);
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.idleExcavationPopup)).toBe("ready");
  // 성공 상태는 사용/한도로 다시 그려지고, 소진된 보관 버튼은 2/2인 채 비활성으로 남는다.
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.excavationAdOffers)).toEqual([
    { slotId: "excavation-harvest", label: "생산량 ×1.5", usage: "1/3", enabled: true },
    { slotId: "excavation-storage", label: "보관량 ×2", usage: "2/2", enabled: false },
  ]);
  // 광고 버튼도 팝업이 제공한 새 중심 좌표를 가지며 좌우 순서가 슬롯 계약과 일치한다.
  const adControls = await page.evaluate(() => window.__PF_DEBUG?.idleExcavationControls?.ads ?? []);
  expect(adControls.map(({ slotId }) => slotId)).toEqual(["excavation-harvest", "excavation-storage"]);
  expect(adControls[0].x).toBeLessThan(adControls[1].x);
  // 디버그 계약은 화면의 "발굴 진행 중" 문구가 아니라 기존 자동화용 상태명 ready를 계속 쓴다.
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.scene)).toBe("lobby");
  await captureGame(page, `test-results/${test.info().project.name}-idle-excavation-popup.png`);

  // 어두운 backdrop이 출격 좌표의 입력을 먹으므로 로비와 애착 캐릭터가 그대로 남는다.
  await tapGame(page, BASE_WIDTH - 290, BASE_HEIGHT - 425);
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.scene)).toBe("lobby");
  // 팝업 X 대신 다른 화면과 같은 아이콘 양식의 발굴 전용 좌하단 돌아가기를 사용한다.
  const close = await excavationControl(page, "close");
  await tapGame(page, close.x, close.y);
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.idleExcavationPopup)).toBeUndefined();
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.scene)).toBe("lobby");
});

test("SD 완료 뒤 세 슬롯의 공용 입력면이 각각 올바른 편집 슬롯으로 진입한다", async ({ page }) => {
  await startAfterOpening(page, (session) => {
    // 기본 저장의 편성은 비어 있으므로 SD가 실제로 서는 세 자리를 명시적으로 채운다.
    session.idleExcavation.assignedRelicIds = ["anky", "rex", "spino"];
    // 작은 모바일과 1.15 텍스트 확대 조합에서도 슬롯 입력면의 고정 안전 영역을 검증한다.
    session.settings.accessibility.textScale = 1.15;
  });
  await tapGame(page, BASE_WIDTH / 2, BASE_HEIGHT / 2);
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.scene)).toBe("lobby");
  await tapGame(page, 250, BASE_HEIGHT - 445);
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.idleExcavationPopup)).toBe("ready");
  // 세 SD가 실제 텍스처/크기 검증까지 끝난 다음 장식 Puppet 위의 입력 순서를 확인한다.
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.idleExcavationSdReady?.slice().sort())).toEqual([0, 1, 2]);
  const slots = await page.evaluate(() => window.__PF_DEBUG?.idleExcavationSlots ?? []);
  expect(slots).toHaveLength(3);
  // 현황 탭으로 편집을 연 뒤 화면 좌표 Puppet에서도 같은 대상 칸·교체 미리보기를 검증한다.
  await tapGame(page, slots[0].x, slots[0].y);
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.idleExcavationPopup)).toBe("editing");
  await inspectFormationDrag(page, slots[0], slots[1], "excavation");
  const initialCancel = await excavationControl(page, "cancelEdit"); await tapGame(page, initialCancel.x, initialCancel.y);
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.idleExcavationPopup)).toBe("ready");
  for (const slot of slots) {
    expect(slot.width).toBeGreaterThanOrEqual(210); expect(slot.height).toBeGreaterThanOrEqual(245);
    // 슬롯 하단은 다음 현황 행(게임 y=990) 위, 좌하단 돌아가기(중심 106,1800)와도 멀리 떨어진다.
    expect(slot.y + slot.height / 2).toBeLessThan(990);
    await tapGame(page, slot.x, slot.y);
    await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.idleExcavationPopup)).toBe("editing");
    await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.idleExcavationSelectedSlot)).toBe(slot.index);
    // 편집의 취소로 현황에 돌아가 다음 슬롯도 동일한 입력면으로 다시 검증한다.
    const cancel = await excavationControl(page, "cancelEdit");
    await tapGame(page, cancel.x, cancel.y);
    await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.idleExcavationPopup)).toBe("ready");
  }
  await captureGame(page, `test-results/${test.info().project.name}-idle-excavation-slot-hit-areas.png`);
});

test("방치 발굴 편집은 슬롯 이동·중복 방지·빈 편성 취소를 확정 상태와 분리한다", async ({ page }) => {
  await startAfterOpening(page);
  await tapGame(page, BASE_WIDTH / 2, BASE_HEIGHT / 2);
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.scene)).toBe("lobby");
  await tapGame(page, 250, BASE_HEIGHT - 445);
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.idleExcavationPopup)).toBe("ready");

  // 별도 편성 버튼 없이 첫 슬롯 자체가 그 슬롯을 대상으로 한 편집 그리드를 연다.
  const firstSlot = (await page.evaluate(() => window.__PF_DEBUG?.idleExcavationSlots?.[0]))!;
  await tapGame(page, firstSlot.x, firstSlot.y);
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.idleExcavationPopup)).toBe("editing");
  // 첫 보유 카드를 1번에 놓으면 선택이 저절로 2번 칸으로 넘어가 다음 배치가 이어진다.
  await tapGame(page, BASE_WIDTH / 2 - 250, BASE_HEIGHT / 2 + 115);
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.idleExcavationSelectedSlot)).toBe(1);
  // 같은 카드를 다시 누르면 2번으로 이동한다. 복제 대신 원래 칸이 비고 선택은 3번으로 이어진다.
  await tapGame(page, BASE_WIDTH / 2 - 250, BASE_HEIGHT / 2 + 115);
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.idleExcavationSelectedSlot)).toBe(2);
  // **편집 중 해제는 칸이 맡는다** — 카드가 든 칸을 누르면 그 자리가 비고 그 칸이 골라진다.
  // 칸을 고르는 것과 카드를 누르는 것은 서로 다른 조작이라 사이를 확인해야, 빗나갔을 때 어느
  // 쪽인지 실패가 말해 준다. 칸 탭은 비우고 고르는 일이라 다시 눌러도 결과가 같으므로, 직전
  // 그리드 손짓의 스크롤 판정이 남아 삼켜지면 한 번 더 누른다.
  const secondSlot = (await page.evaluate(() => window.__PF_DEBUG?.idleExcavationSlots?.[1]))!;
  await tapUntil(page, secondSlot.x, secondSlot.y, async () => (await page.evaluate(() => window.__PF_DEBUG?.idleExcavationSelectedSlot)) === 1);
  // 비워진 그 칸에 같은 카드를 다시 놓으면 선택은 다음 빈 칸으로 이어진다.
  await tapGame(page, BASE_WIDTH / 2 - 250, BASE_HEIGHT / 2 + 115);
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.idleExcavationSelectedSlot)).toBe(2);
  await captureGame(page, `test-results/${test.info().project.name}-idle-excavation-editor.png`);
  const cancel = await excavationControl(page, "cancelEdit");
  await tapGame(page, cancel.x, cancel.y);
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.idleExcavationPopup)).toBe("ready");
});

test("발굴 수확 보상은 0 지급 자원을 제외하고 뒤 입력을 막은 뒤 현황 입력을 복구한다", async ({ page }) => {
  await startAfterOpening(page, (session) => {
    // 서버가 다시 정산해도 보존되는 확정 누적분을 넣어 수확 성공 UI만 안정적으로 검증한다.
    session.idleExcavation.unclaimed = { gold: 1234, cheesecake: 56, fossil: 0, gems: 0 };
    session.idleExcavation.lastSettledAt = new Date().toISOString();
  });
  await tapGame(page, BASE_WIDTH / 2, BASE_HEIGHT / 2);
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.scene)).toBe("lobby");
  await tapGame(page, 250, BASE_HEIGHT - 445);
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.idleExcavationPopup)).toBe("ready");

  // 수확 성공 뒤 별도 확인 팝업이 열리고, 본문 아무 곳이나 누르면 발굴 현황으로 즉시 돌아온다.
  // 현황 재배치에서 주요 수확 버튼이 하단 중앙으로 합쳐졌으므로 실제 입력 좌표도 같이 고정한다.
  const harvest = await excavationControl(page, "harvest");
  await tapGame(page, harvest.x, harvest.y);
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.rewardPopup)).toBe(true);
  // 화석·다이아의 0 지급 칸은 만들지 않아 실제 한 줄에는 두 자원만 남는다.
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.rewardPopupItemCount)).toBe(2);
  await captureGame(page, `test-results/${test.info().project.name}-excavation-reward-popup.png`);
  // 영수증이므로 팝업 밖(로비 출격 좌표)을 눌러도 닫히되, 그 누름이 뒤 화면으로 새지는 않는다.
  await tapGame(page, BASE_WIDTH - 290, BASE_HEIGHT - 425);
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.rewardPopup)).toBeUndefined();
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.idleExcavationPopup)).toBe("ready");
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.scene)).toBe("lobby");
  // 확인 뒤 현황의 슬롯 입력이 다시 편집으로 전환되어 입력 계층 복구까지 증명한다.
  const slot = (await page.evaluate(() => window.__PF_DEBUG?.idleExcavationSlots?.[0]))!;
  await tapGame(page, slot.x, slot.y);
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.idleExcavationPopup)).toBe("editing");
});

test("발굴 보상 팝업은 최대 네 생산 자원을 한 줄에 표시한다", async ({ page }) => {
  await startAfterOpening(page, (session) => {
    // 네 생산 재화가 모두 양수인 서버 확정분으로 팝업의 최대 한 줄 계약을 검증한다.
    session.idleExcavation.unclaimed = { gold: 1, cheesecake: 2, fossil: 3, gems: 4 };
    session.idleExcavation.lastSettledAt = new Date().toISOString();
  });
  await tapGame(page, BASE_WIDTH / 2, BASE_HEIGHT / 2);
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.scene)).toBe("lobby");
  await tapGame(page, 250, BASE_HEIGHT - 445);
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.idleExcavationPopup)).toBe("ready");
  const harvest = await excavationControl(page, "harvest");
  await tapGame(page, harvest.x, harvest.y);
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.rewardPopupItemCount)).toBe(4);
  await captureGame(page, `test-results/${test.info().project.name}-excavation-four-rewards.png`);
});

test("설정 탭은 텍스트 확대·스크롤·두 단계 초기화를 좁은 모바일에서 안전하게 처리한다", async ({ page }) => {
  await startAfterOpening(page); await tapGame(page, BASE_WIDTH / 2, BASE_HEIGHT / 2);
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.scene)).toBe("lobby");
  await tapGame(page, BASE_WIDTH - 58, 86);
  // 미구현 토스트가 아니라 실제 설정 화면의 사용자 표시 제목까지 렌더됐는지 확인한다.
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.screenTitle)).toBe("환경 설정");
  // 새 고정 헤더 아래 첫 사운드 슬라이더가 88px 이상의 터치 행으로 저장을 즉시 반영한다.
  await tapGame(page, 800, 392); let saved = await page.evaluate(() => localStorage.getItem("eternal-city.local-save")); expect(saved).toContain('"masterVolume"');
  // 게임 탭은 기존 선택 행 양식을 유지하며 전투 UI 움직임을 기본→감소로 즉시 저장한다.
  await tapGame(page, 540, 210); await tapGame(page, 800, 768);
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("eternal-city.local-save")!).settings.presentation.battleUiMotion)).toBe("reduced");
  await captureGame(page, `test-results/${test.info().project.name}-settings-battle-ui-motion.png`);
  // 접근성 탭에서 공용 텍스트 배율을 올린 뒤 재생성된 탭이 잘리지 않는지 캡처한다.
  await tapGame(page, 743, 210); await tapGame(page, 800, 392);
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("eternal-city.local-save")!).settings.accessibility.textScale)).toBe(1.15);
  await captureGame(page, `test-results/${test.info().project.name}-settings-accessibility-expanded.png`);
  // 지원·데이터 탭은 자체 높이에 종속되어 스크롤되고 초기화 팝업이 배경 입력을 가로막는다.
  await tapGame(page, 946, 210); await page.mouse.wheel(0, 800); await captureGame(page, `test-results/${test.info().project.name}-settings-support-scrolled.png`);
  await tapGame(page, 450, 1026); await tapGame(page, 690, 1065);
  saved = await page.evaluate(() => localStorage.getItem("eternal-city.local-save")); expect(saved).not.toBeNull();
  await tapGame(page, 690, 1065); await expect.poll(() => page.evaluate(() => localStorage.getItem("eternal-city.local-save"))).toBeNull();
  // 검증 이후 다음 케이스에 영향을 주지 않도록 오프닝 완료 저장을 다시 준비한다.
  await startAfterOpening(page);
  await page.reload(); await page.waitForFunction(() => window.__PF_DEBUG?.ready === true); await tapGame(page, BASE_WIDTH / 2, BASE_HEIGHT / 2);
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.scene)).toBe("lobby"); expect(await page.evaluate(() => JSON.parse(localStorage.getItem("eternal-city.local-save")!).settings.sound.masterVolume)).toBeGreaterThan(0);
  await tapGame(page, BASE_WIDTH - 58, 86); await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.scene)).toBe("settings"); await tapGame(page, BASE_WIDTH - 106, BASE_HEIGHT - 120);
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.scene)).toBe("lobby");
});

test("핵심 콘텐츠의 설정은 고고학·렐릭·연구소·프리미엄 섹션으로 되돌아간다", async ({ page }) => {
  await startAfterOpening(page); await tapGame(page, BASE_WIDTH / 2, BASE_HEIGHT / 2);
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.scene)).toBe("lobby");
  // 하단 내비게이션의 네 콘텐츠를 순회하며 각 TopBar 설정과 공용 뒤로가기의 왕복을 검증한다.
  const destinations = [
    { scene: "archaeology", x: 108 }, { scene: "relics", x: 324 },
    { scene: "lab", x: 756 }, { scene: "premium", x: 972 },
  ] as const;
  for (const destination of destinations) {
    await tapGame(page, destination.x, BASE_HEIGHT - 90);
    await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.scene)).toBe(destination.scene);
    await tapGame(page, BASE_WIDTH - 58, 86);
    await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.scene)).toBe("settings");
    await tapGame(page, BASE_WIDTH - 106, BASE_HEIGHT - 120);
    await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.scene)).toBe(destination.scene);
    if (destination.scene === "premium") {
      // 씬 이름뿐 아니라 설정 진입 데이터로 되돌린 프리미엄 섹션도 그대로여야 한다.
      await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.premiumSection)).toBe("premium");
    }
  }
});

test("가로로 눕히면 세로로 돌려달라는 안내가 뜬다", async ({ page }) => {
  const viewport = page.viewportSize();
  if (viewport) {
    await page.setViewportSize({ width: viewport.height, height: viewport.width });
  }

  await page.goto("/");
  await expect(page.locator("#rotate-overlay")).toBeVisible();
});

test("모바일 편성 상단의 자동 배치 버튼과 자리별 상성 화살표가 표시된다", async ({ page }) => {
  await enterParty(page);
  // 준비 화면은 빈 상태로 열리지 않는다 — 직전 편성을 복원하거나 자동 편성으로 채운다. 자동
  // 배치가 화살표를 세우는 것을 보려면 먼저 비워야 한다. 자리를 누르면 그 한 명만 빠진다.
  for (let remaining = 3; remaining > 0; remaining -= 1) {
    const slot = (await page.evaluate(() => window.__PF_DEBUG?.party?.slots?.[0]))!;
    await tapGame(page, slot.x, slot.y);
    await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.party?.selectedCount)).toBe(remaining - 1);
  }
  const before = await page.evaluate(() => window.__PF_DEBUG?.party);

  // 버튼 중심은 그리드 위 우측 — 그리드 오른쪽 경계에 붙고, 그리드 윗변 바로 위에 뜬다.
  expect(before?.autoButton.x).toBeGreaterThan((BASE_WIDTH * 2) / 3);
  expect(before?.autoButton.x).toBeLessThan(BASE_WIDTH);
  expect(before?.autoButton.y).toBeGreaterThan(800);
  expect(before?.autoButton.y).toBeLessThan(1080 - 113); // 그리드 카드 윗변(1080 - 카드 높이/2) 위쪽
  expect(before?.visibleAffinityDirections).toBe(0);

  await tapGame(page, before!.autoButton.x, before!.autoButton.y);
  // 고정 시작 보유·1-1 적 조합에서는 자동 편성 셋 모두 유리하거나 불리해 중립이 없다.
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.party?.visibleAffinityDirections)).toBe(3);
  // SD 로딩과 무관한 슬롯 입력면을 누르면 그 화면 자리 하나만 즉시 빠진다.
  const secondSlot = (await page.evaluate(() => window.__PF_DEBUG?.party?.slots?.[1]))!;
  await tapGame(page, secondSlot.x, secondSlot.y);
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.party?.selectedCount)).toBe(2);
  await captureGame(page, `test-results/${test.info().project.name}-party-affinity-arrows.png`);
});

test("모바일에서 1번 SD를 길게 눌러 3번으로 옮기면 실제 전투 아군 순서가 바뀐다", async ({ page }) => {
  await enterParty(page);
  const slots = (await page.evaluate(() => window.__PF_DEBUG?.party?.slots))!;
  expect(slots).toHaveLength(3);

  // 기본 [토리카, 렉시아, 스피나]의 첫째와 셋째를 슬롯 고스트로 교환한다.
  await holdDragGame(page, slots[0], slots[2]);
  await tapGame(page, BASE_WIDTH / 2, 1700);
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.scene)).toBe("battle");
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.battle?.playerOrder)).toEqual(["스피나", "렉시아", "토리카"]);
});
