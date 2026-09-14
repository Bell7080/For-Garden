import { execFileSync } from "node:child_process";

/** 빌드와 검증이 같은 Git checkout을 가리키는지 비교할 안정적인 식별자를 돌려준다. */
export function currentBuildCommit(): string {
  // 셸 보간 없이 Git을 직접 실행해 브랜치명이나 작업 경로가 명령으로 해석될 여지를 없앤다.
  return execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
}
