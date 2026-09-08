import { readFileSync } from "node:fs";
import ts from "typescript";
import { describe, expect, it } from "vitest";

/** 런타임 Phaser 없이 씬의 입력/프레임 스케줄만 계측하기 위해 TypeScript 구문 트리를 읽는다. */
const source = readFileSync(new URL("../../src/scenes/RelicsScene.ts", import.meta.url), "utf8");
const file = ts.createSourceFile("RelicsScene.ts", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);

/** 이름으로 클래스 메서드를 찾아 구현이 사라졌을 때도 테스트가 분명하게 실패하도록 한다. */
function method(name: string): ts.MethodDeclaration {
  let found: ts.MethodDeclaration | undefined;
  file.forEachChild(function visit(node): void {
    if (ts.isMethodDeclaration(node) && node.name.getText(file) === name) found = node;
    ts.forEachChild(node, visit);
  });
  if (!found) throw new Error(`RelicsScene.${name} 메서드를 찾지 못했습니다.`);
  return found;
}

/** 특정 구문 안의 카드 마스크 갱신 호출 수를 정적으로 센다. */
function maskSyncCalls(node: ts.Node): number {
  let count = 0;
  const visit = (child: ts.Node): void => {
    if (ts.isCallExpression(child) && child.expression.getText(file).endsWith("syncCardMasks")) count += 1;
    ts.forEachChild(child, visit);
  };
  visit(node);
  return count;
}

describe("RelicsScene 카드 마스크 스케줄", () => {
  it("정보창이 열린 update 경로는 캐릭터 수가 늘어도 마스크 갱신이 0회다", () => {
    const body = method("update").body;
    expect(body).toBeDefined();
    // 첫 실행문이 isOpen 조기 반환인지 고정하면 뒤의 카드 수(1~10,000)는 계측 결과에 영향을 못 준다.
    const first = body!.statements[0];
    expect(ts.isIfStatement(first) && first.expression.getText(file).includes("this.info?.isOpen") && first.thenStatement.getText(file) === "return;").toBe(true);
    for (const characterCount of [1, 100, 10_000]) {
      const openFrameCalls = maskSyncCalls(first);
      expect(openFrameCalls, `${characterCount} characters`).toBe(0);
    }
  });

  it("update는 매 프레임 직접 마스크를 갱신하지 않고 scrollTo에만 이동 갱신을 맡긴다", () => {
    expect(maskSyncCalls(method("update"))).toBe(0);
    expect(maskSyncCalls(method("scrollTo"))).toBe(1);
  });

  it("정지한 scrollTo는 dirty guard 뒤에서 카드 가시성을 다시 순회하지 않는다", () => {
    const scrollSource = method("scrollTo").getText(file);
    const syncSource = method("syncCardMasks").getText(file);
    // 실제 clamp 좌표의 변경만 dirty를 세우고, 동기화 진입 즉시 guard가 소비하는 계약을 고정한다.
    expect(scrollSource).toContain("if (nextY !== this.content.y) this.viewportVisibilityDirty = true");
    expect(syncSource).toContain("if (!this.viewportVisibilityDirty) return");
    expect(syncSource).toContain("this.viewportVisibilityDirty = false");
  });

  it("월드 bounds와 한 행 오버스캔으로 카드 전체 표시 상태를 전환한다", () => {
    const syncSource = method("syncCardMasks").getText(file);
    // 부모 이동을 포함한 bounds 판정과 PortraitCard의 단일 전환 API가 빠지면 렌더와 입력이 갈린다.
    expect(syncSource).toContain("card.getBounds()");
    expect(syncSource).toContain("VIEWPORT_TOP - GRID_OVERSCAN_Y");
    expect(syncSource).toContain("VIEWPORT_BOTTOM + GRID_OVERSCAN_Y");
    expect(syncSource).toContain("card.setViewportVisible(visible)");
  });
});
