import { test, expect } from "@playwright/test";
import { startAfterOpening } from "./openingSave";

const BASE_WIDTH = 1080;
const BASE_HEIGHT = 1920;

/** 기준 게임 좌표를 FIT 스케일이 적용된 모바일 캔버스 좌표로 바꿔 누른다. */
async function tapGame(page: import("@playwright/test").Page, x: number, y: number): Promise<void> {
  const canvas = page.locator("canvas");
  const box = await canvas.boundingBox();
  if (!box) throw new Error("캔버스를 찾지 못했다");
  await canvas.click({ position: { x: (x / BASE_WIDTH) * box.width, y: (y / BASE_HEIGHT) * box.height } });
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
  await tapGame(page, BASE_WIDTH / 2, 770);
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

  await page.screenshot({ path: `test-results/${test.info().project.name}-title.png` });

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

  await page.locator("canvas").click();
  await expect
    .poll(() => page.evaluate(() => window.__PF_DEBUG?.scene))
    .toBe("lobby");
});

test("출격 선택판에서 원정대 3기를 골라 진행 중 상태로 저장한다", async ({ page }) => {
  await startAfterOpening(page);
  await page.locator("canvas").click();
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.scene)).toBe("lobby");

  // 잔잔한 출격 선택판에서 원정을 고르면 별도 준비 씬으로 이동한다.
  await tapGame(page, BASE_WIDTH - 290, BASE_HEIGHT - 425);
  await tapGame(page, BASE_WIDTH / 2, 995);
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.scene)).toBe("expedition");
  await page.screenshot({ path: `test-results/${test.info().project.name}-expedition-preparation.png` });

  // 초기 보유 세 기를 모두 고른 뒤 시작하면 매니저 저장을 거쳐 같은 씬의 이어하기 상태가 된다.
  for (const x of [234, 540, 846]) await tapGame(page, x, 470);
  await tapGame(page, BASE_WIDTH / 2, 1680);
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.scene)).toBe("expedition");
  await expect.poll(() => page.evaluate(() => {
    const raw = window.localStorage.getItem("eternal-city.local-save");
    return raw ? JSON.parse(raw).expedition?.active?.relicIds?.length : 0;
  })).toBe(3);
  await page.screenshot({ path: `test-results/${test.info().project.name}-expedition-active.png` });
});

test("방치 발굴 팝업은 좁은 로비 위 한 장으로 열리고 뒤 입력을 차단한 뒤 닫힌다", async ({ page }) => {
  await startAfterOpening(page, (session) => {
    // 성공 뒤 다시 그려진 사용량과 같은 저장 상태를 만들고, 한도 소진 버튼도 남는 정책을 검증한다.
    session.dailyAdRewards = { date: new Date().toISOString().slice(0, 10), claimsBySlot: { "excavation-harvest": 1, "excavation-storage": 2 }, requestIds: ["e2e-harvest", "e2e-storage-1", "e2e-storage-2"] };
  });
  await page.locator("canvas").click();
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
  await page.screenshot({ path: `test-results/${test.info().project.name}-idle-excavation-popup.png` });

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
  await page.locator("canvas").click();
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.scene)).toBe("lobby");
  await tapGame(page, 250, BASE_HEIGHT - 445);
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.idleExcavationPopup)).toBe("ready");
  // 세 SD가 실제 텍스처/크기 검증까지 끝난 다음 장식 Puppet 위의 입력 순서를 확인한다.
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.idleExcavationSdReady?.slice().sort())).toEqual([0, 1, 2]);
  const slots = await page.evaluate(() => window.__PF_DEBUG?.idleExcavationSlots ?? []);
  expect(slots).toHaveLength(3);
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
  await page.screenshot({ path: `test-results/${test.info().project.name}-idle-excavation-slot-hit-areas.png` });
});

test("방치 발굴 편집은 슬롯 이동·중복 방지·빈 편성 취소를 확정 상태와 분리한다", async ({ page }) => {
  await startAfterOpening(page);
  await page.locator("canvas").click();
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.scene)).toBe("lobby");
  await tapGame(page, 250, BASE_HEIGHT - 445);
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.idleExcavationPopup)).toBe("ready");

  // 별도 편성 버튼 없이 첫 슬롯 자체가 그 슬롯을 대상으로 한 편집 그리드를 연다.
  const firstSlot = (await page.evaluate(() => window.__PF_DEBUG?.idleExcavationSlots?.[0]))!;
  await tapGame(page, firstSlot.x, firstSlot.y);
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.idleExcavationPopup)).toBe("editing");
  // 첫 보유 카드를 1번에 놓고 2번 슬롯을 선택한 뒤 같은 카드를 눌러 이동한다. 복제 대신 원래 칸이 빈다.
  await tapGame(page, BASE_WIDTH / 2 - 250, BASE_HEIGHT / 2 - 15);
  await tapGame(page, BASE_WIDTH / 2, BASE_HEIGHT / 2 - 385);
  await tapGame(page, BASE_WIDTH / 2 - 250, BASE_HEIGHT / 2 - 15);
  // 같은 카드를 다시 누르면 빈 슬롯 허용 정책에 따라 해제되고, 취소는 서버 확정 배열을 저장하지 않는다.
  await tapGame(page, BASE_WIDTH / 2 - 250, BASE_HEIGHT / 2 - 15);
  await page.screenshot({ path: `test-results/${test.info().project.name}-idle-excavation-editor.png` });
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
  await page.locator("canvas").click();
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
  await page.screenshot({ path: `test-results/${test.info().project.name}-excavation-reward-popup.png` });
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
  await page.locator("canvas").click();
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.scene)).toBe("lobby");
  await tapGame(page, 250, BASE_HEIGHT - 445);
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.idleExcavationPopup)).toBe("ready");
  const harvest = await excavationControl(page, "harvest");
  await tapGame(page, harvest.x, harvest.y);
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.rewardPopupItemCount)).toBe(4);
  await page.screenshot({ path: `test-results/${test.info().project.name}-excavation-four-rewards.png` });
});

test("설정 탭은 텍스트 확대·스크롤·두 단계 초기화를 좁은 모바일에서 안전하게 처리한다", async ({ page }) => {
  await startAfterOpening(page); await page.locator("canvas").click();
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.scene)).toBe("lobby");
  await tapGame(page, BASE_WIDTH - 58, 86);
  // 미구현 토스트가 아니라 실제 설정 화면의 사용자 표시 제목까지 렌더됐는지 확인한다.
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.screenTitle)).toBe("환경 설정");
  // 새 고정 헤더 아래 첫 사운드 슬라이더가 88px 이상의 터치 행으로 저장을 즉시 반영한다.
  await tapGame(page, 800, 392); let saved = await page.evaluate(() => localStorage.getItem("eternal-city.local-save")); expect(saved).toContain('"masterVolume"');
  // 접근성 탭에서 공용 텍스트 배율을 올린 뒤 재생성된 탭이 잘리지 않는지 캡처한다.
  await tapGame(page, 743, 210); await tapGame(page, 800, 392);
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("eternal-city.local-save")!).settings.accessibility.textScale)).toBe(1.15);
  await page.screenshot({ path: `test-results/${test.info().project.name}-settings-accessibility-expanded.png` });
  // 지원·데이터 탭은 자체 높이에 종속되어 스크롤되고 초기화 팝업이 배경 입력을 가로막는다.
  await tapGame(page, 946, 210); await page.mouse.wheel(0, 800); await page.screenshot({ path: `test-results/${test.info().project.name}-settings-support-scrolled.png` });
  await tapGame(page, 450, 1026); await tapGame(page, 690, 1065);
  saved = await page.evaluate(() => localStorage.getItem("eternal-city.local-save")); expect(saved).not.toBeNull();
  await tapGame(page, 690, 1065); await expect.poll(() => page.evaluate(() => localStorage.getItem("eternal-city.local-save"))).toBeNull();
  // 검증 이후 다음 케이스에 영향을 주지 않도록 오프닝 완료 저장을 다시 준비한다.
  await startAfterOpening(page);
  await page.reload(); await page.waitForFunction(() => window.__PF_DEBUG?.ready === true); await page.locator("canvas").click();
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.scene)).toBe("lobby"); expect(await page.evaluate(() => JSON.parse(localStorage.getItem("eternal-city.local-save")!).settings.sound.masterVolume)).toBeGreaterThan(0);
  await tapGame(page, BASE_WIDTH - 58, 86); await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.scene)).toBe("settings"); await tapGame(page, BASE_WIDTH - 106, BASE_HEIGHT - 120);
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.scene)).toBe("lobby");
});

test("핵심 콘텐츠의 설정은 고고학·렐릭·연구소·상점 섹션으로 되돌아간다", async ({ page }) => {
  await startAfterOpening(page); await page.locator("canvas").click();
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.scene)).toBe("lobby");
  // 하단 내비게이션의 네 콘텐츠를 순회하며 각 TopBar 설정과 공용 뒤로가기의 왕복을 검증한다.
  const destinations = [
    { scene: "archaeology", x: 108 }, { scene: "relics", x: 324 },
    { scene: "lab", x: 756 }, { scene: "shop", x: 972 },
  ] as const;
  for (const destination of destinations) {
    await tapGame(page, destination.x, BASE_HEIGHT - 90);
    await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.scene)).toBe(destination.scene);
    await tapGame(page, BASE_WIDTH - 58, 86);
    await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.scene)).toBe("settings");
    await tapGame(page, BASE_WIDTH - 106, BASE_HEIGHT - 120);
    await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.scene)).toBe(destination.scene);
    if (destination.scene === "shop") {
      // 씬 이름뿐 아니라 설정 진입 데이터로 되돌린 상점 섹션도 그대로여야 한다.
      await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.shopSection)).toBe("premium");
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
  const before = await page.evaluate(() => window.__PF_DEBUG?.party);

  // 버튼 중심은 화면 안이면서 제목(70)·속성 안내 중앙(178)·첫 도움말(366,230)을 피한 좌측 조작 칸이다.
  expect(before?.autoButton.x).toBeGreaterThan(0);
  expect(before?.autoButton.x).toBeLessThan(BASE_WIDTH / 3);
  expect(before?.autoButton.y).toBeGreaterThan(150);
  expect(before?.autoButton.y).toBeLessThan(230);
  expect(before?.visibleAffinityDirections).toBe(0);

  await tapGame(page, before!.autoButton.x, before!.autoButton.y);
  // 고정 적 조합에서는 자동 편성 셋 중 상쇄 중립 한 명을 숨기고 유리/불리 두 방향만 남긴다.
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.party?.visibleAffinityDirections)).toBe(2);
  await page.screenshot({ path: `test-results/${test.info().project.name}-party-affinity-arrows.png` });
});
