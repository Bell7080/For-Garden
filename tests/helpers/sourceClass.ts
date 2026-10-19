import { readFileSync } from "node:fs";
import ts from "typescript";
/** 제품 클래스 제어 흐름을 실행하고 표시 계층의 의존성만 주입한다. */
export function sourceClass(file: string, name: string, dependencies: Record<string, unknown>): any {
    const source = ts.createSourceFile(file, readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true);
    const node = source.statements.find((node): node is ts.ClassDeclaration => ts.isClassDeclaration(node) && node.name?.text === name)!;
    const js = ts.transpileModule(node.getText(source).replace(/^export /, ""), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
    return new Function(...Object.keys(dependencies), js + `\nreturn ${name};`)(...Object.values(dependencies));
}
