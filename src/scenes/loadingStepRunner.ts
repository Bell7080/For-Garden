import type Phaser from "phaser";
import type { PuppetAssetPreloadResult } from "../puppets/assets";

/** 타이틀 진행 칸 하나가 실행할 비동기 작업의 공용 계약이다. */
export interface LoadingStep {
  /** 디버깅과 테스트에서 단계를 가리키는 이름. 화면에는 띄우지 않는다. */
  readonly label: string;
  run(scene: Phaser.Scene): Promise<void | PuppetAssetPreloadResult>;
}

/** Puppet 단계의 구조화된 실패만 개발자 진단 채널에 남기고 플레이 진행은 막지 않는다. */
function reportPuppetFailures(label: string, result: void | PuppetAssetPreloadResult): void {
  if (!result || result.failures.length === 0) return;
  console.error(`[loading:${label}] Puppet assets failed`, {
    failures: result.failures,
    fallbackAvailable: result.fallbackAvailable,
  });
}

/** 모든 단계 결과를 기다린 뒤에만 완료 칸을 한 칸씩 증가시키는 순차 실행기다. */
export async function runLoadingSteps(
  scene: Phaser.Scene,
  onStepDone: (done: number, total: number) => void,
  steps: ReadonlyArray<LoadingStep>,
): Promise<void> {
  for (let i = 0; i < steps.length; i++) {
    try {
      const result = await steps[i].run(scene);
      // Puppet 결과는 모든 요청이 settle된 뒤에만 도착하므로 이 기록보다 먼저 완료 칸이 늘지 않는다.
      reportPuppetFailures(steps[i].label, result);
    } catch (error) {
      // 실패한 단계도 칸은 채우되 원래 오류를 진단 채널에는 보존한다.
      console.error(`[loading:${steps[i].label}] step failed`, error);
    }
    if (!scene.scene.isActive()) return;
    onStepDone(i + 1, steps.length);
  }
}
