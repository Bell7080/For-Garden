import { readFileSync } from "node:fs";
import ts from "typescript";
/** UI 의존성만 주입하고 제품의 실제 문장·문맥 조립 함수를 실행한다. */
export function sourceFunction(file: string, name: string, dependencies: Record<string, unknown>): any {
  const source = ts.createSourceFile(file, readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true);
  const node = source.statements.find((node): node is ts.FunctionDeclaration => ts.isFunctionDeclaration(node) && node.name?.text === name);
  if (!node) throw new Error(`Missing function: ${name}`);
  const js = ts.transpileModule(node.getText(source).replace(/^export /, ""), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
  return new Function(...Object.keys(dependencies), js + `\nreturn ${name};`)(...Object.values(dependencies));
}
