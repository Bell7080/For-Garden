import { storyBaseStageId } from "../core/storyDifficulty";
import type { StageDef } from "../core/types";
import { t } from "../i18n";

/**
 * 스토리 관문의 번호표 — 본편은 `1-8`, 서브(이야기·전투)는 「SUB」다.
 *
 * 서브 전투 관문의 ID(`1-8-side-battle`)는 저장 키일 뿐 플레이어가 읽는 이름이 아니다. 지도 칸·노드
 * 미리보기·편성 머리글이 저마다 ID를 잘라 적으면 한 곳만 그 키를 그대로 세운다(편성 머리글이 그랬다).
 */
export function storyStageNumberLabel(stage: StageDef): string {
  return stage.kind === "story" || stage.sub === true ? t("stageMap.sub") : storyBaseStageId(stage.id);
}
