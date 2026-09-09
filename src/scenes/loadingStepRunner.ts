import type Phaser from "phaser";
import type { PuppetAssetPreloadResult } from "../puppets/assets";
import { reportLoadingStepResult } from "../debug";

/** 플레이어 문구와 분리해 개발 진단에만 전달하는 단계별 정규화 결과다. */
export interface LoadingStepResult {
  readonly label: string;
  readonly status: "success" | "partial" | "failure";
  readonly failures: readonly { assetUrl?: string; error: unknown; errorKind: string }[];
}

/** 타이틀 진행 칸 하나가 실행할 비동기 작업의 공용 계약이다. */
export interface LoadingStep {
  /** 디버깅과 테스트에서 단계를 가리키는 이름. 화면에는 띄우지 않는다. */
  readonly label: string;
  run(scene: Phaser.Scene): Promise<void | PuppetAssetPreloadResult>;
}

/** Puppet 단계의 구조화된 실패만 개발자 진단 채널에 남기고 플레이 진행은 막지 않는다. */
function errorKind(error: unknown): string {
  // 오류 메시지는 사용자 화면에 전달하지 않고 안정적인 종류만 진단 DTO에 적는다.
  return error instanceof Error ? error.name : typeof error;
}

/** 모든 단계 결과를 기다린 뒤에만 완료 칸을 한 칸씩 증가시키는 순차 실행기다. */
export async function runLoadingSteps(
  scene: Phaser.Scene,
  onStepDone: (done: number, total: number) => void,
  steps: ReadonlyArray<LoadingStep>,
): Promise<readonly LoadingStepResult[]> {
  const results: LoadingStepResult[] = [];
  for (let i = 0; i < steps.length; i++) {
    try {
      const result = await steps[i].run(scene);
      // Puppet 결과는 성공 URL도 보존하며, 일반 단계의 void는 완전 성공으로 정규화한다.
      const normalized = { label: steps[i].label, status: result?.status ?? "success", failures: result?.failures.map(({ assetUrl, error }) => ({ assetUrl, error, errorKind: errorKind(error) })) ?? [] } satisfies LoadingStepResult;
      results.push(normalized); reportLoadingStepResult(normalized);
    } catch (error) {
      // 실패한 단계도 칸은 채우되 상세는 개발 진단 경계에만 보존한다.
      const normalized = { label: steps[i].label, status: "failure", failures: [{ error, errorKind: errorKind(error) }] } satisfies LoadingStepResult;
      results.push(normalized); reportLoadingStepResult(normalized);
    }
    if (!scene.scene.isActive()) return results;
    onStepDone(i + 1, steps.length);
  }
  return results;
}
