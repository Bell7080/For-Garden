import type { Page, TestInfo } from "@playwright/test";

/** 진단 실행에서만 기존 WebGL 리스너를 기록한다. 원래 리스너와 호출은 그대로 전달한다. */
export async function installGameHandleProbe(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const audit = window as Window & { __PF_AUDIT_LISTENERS__?: Array<{ canvas: HTMLCanvasElement; listener: EventListener }> };
    audit.__PF_AUDIT_LISTENERS__ = [];
    const original = EventTarget.prototype.addEventListener;
    EventTarget.prototype.addEventListener = function(this: EventTarget, type: string, listener: EventListenerOrEventListenerObject | null, options?: boolean | AddEventListenerOptions): void {
      if (type === "webglcontextlost" && this instanceof HTMLCanvasElement && typeof listener === "function") {
        audit.__PF_AUDIT_LISTENERS__!.push({ canvas: this, listener });
      }
      original.call(this, type, listener, options);
    };
  });
}

/** CDP로 bound WebGLRenderer의 Game을 읽는다. 게임 객체/세이브를 변경하지 않는다. */
async function readGameInternals(page: Page): Promise<unknown> {
  const cdp = await page.context().newCDPSession(page);
  try {
    const handle = await cdp.send("Runtime.evaluate", { expression: "(window.__PF_AUDIT_LISTENERS__ || []).find(entry => entry.canvas === document.querySelector('canvas'))?.listener" });
    if (!handle.result.objectId) return { unavailable: "No captured WebGL listener" };
    const props = await cdp.send("Runtime.getProperties", { objectId: handle.result.objectId });
    const bound = props.internalProperties?.find((property: { name: string }) => property.name === "[[BoundThis]]")?.value?.objectId;
    if (!bound) return { unavailable: "Listener is not bound", properties: props.internalProperties?.map((property: { name: string }) => property.name) };
    const result = await cdp.send("Runtime.callFunctionOn", { objectId: bound, returnByValue: true, functionDeclaration: `function() {
      const game = this.game;
      if (!game?.scene) return { unavailable: 'Bound object has no game' };
      const lobby = game.scene.getScene('lobby');
      const lab = game.scene.getScene('lab');
      const popup = lobby?.idleExcavationPopup;
      const texts = (node, depth = 0) => !node || depth > 4 ? [] : [
        ...(typeof node.text === 'string' ? [node.text] : []),
        ...(Array.isArray(node.list) ? node.list.flatMap(child => texts(child, depth + 1)) : [])
      ];
      return {
        frame: game.loop.frame, actualFps: game.loop.actualFps, delta: game.loop.delta, gameInput: game.input.enabled,
        pointer: {
          x: game.input.activePointer.x, y: game.input.activePointer.y,
          worldX: game.input.activePointer.worldX, worldY: game.input.activePointer.worldY,
          isDown: game.input.activePointer.isDown,
          downTime: game.input.activePointer.downTime, upTime: game.input.activePointer.upTime,
        },
        canvasBounds: game.scale.canvasBounds, displayScale: game.scale.displayScale,
        domBounds: game.canvas.getBoundingClientRect().toJSON(),
        activeScenes: game.scene.getScenes(true).map(scene => scene.scene.key),
        excavation: popup ? {
          state: popup.body?.getData('state'), saving: popup.saving, rosterLabelActive: popup.rosterLabel?.active,
          gridDragging: popup.gridDragging, gridDragMoved: popup.gridDragMoved,
          draft: popup.draft, selectedSlot: popup.selectedSlot,
          confirmed: popup.confirmed?.excavation?.assignedRelicIds,
          inputEnabled: lobby.input.enabled, pendingInsertions: lobby.input._pendingInsertion?.length,
          slots: lobby.input._list.filter(object => object.name?.startsWith('idle-excavation-slot-')).map(object => ({
            name: object.name, active: object.active, visible: object.visible, inputEnabled: object.input?.enabled,
            downListeners: object.listenerCount('pointerdown'), bounds: object.getBounds(),
          })),
        } : undefined,
        lab: lab ? {
          active: lab.scene?.isActive?.(), timeNow: lab.time?.now,
          inputEnabled: lab.input.enabled, pendingInsertions: lab.input._pendingInsertion?.length,
          inputObjects: lab.input._list.filter(object => object.input?.enabled && object.active).map(object => ({
            type: object.type, name: object.name, depth: object.depth, visible: object.visible,
            downListeners: object.listenerCount('pointerdown'), upListeners: object.listenerCount('pointerup'),
            bounds: typeof object.getBounds === 'function' ? object.getBounds() : undefined,
          })).sort((a,b) => b.depth-a.depth).slice(0,20),
          pullPending: lab.pullPending, showcasing: lab.showcasing,
          boardTiles: lab.boardTiles?.length, boardRequest: lab.boardRequest,
          finishStage: typeof lab.finishStage, presentation: lab.presentation?.state,
          texts: texts(lab.children).slice(-30),
        } : undefined,
      };
    }` });
    return result.exceptionDetails ?? result.result.value;
  } finally { await cdp.detach().catch(() => undefined); }
}

/** 5초인 자동 실패 캡처가 느린 소프트웨어 GPU에서 빠진 경우에도 원인 자료를 남긴다. */
export async function captureGameFailure(page: Page, info: TestInfo): Promise<void> {
  const internals = await readGameInternals(page).catch(error => ({ diagnosticError: String(error) }));
  const debug = await page.evaluate(() => window.__PF_DEBUG).catch(() => undefined);
  await info.attach("game-failure-state", { body: JSON.stringify({ internals, debug }, null, 2), contentType: "application/json" });
  await page.screenshot({ path: info.outputPath("game-failure.png"), scale: "css", timeout: 90_000 }).catch(() => undefined);
}
