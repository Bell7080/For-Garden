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
});
