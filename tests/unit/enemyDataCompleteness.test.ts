import { describe, expect, it } from "vitest";
import { EXPEDITION_ENEMY_FORMATIONS, FINAL_FLOOR_BOSS_ID } from "../../src/data/expeditionEnemies";
import { RELICS, getRelic } from "../../src/data/relics";
import { STAGES } from "../../src/data/stages";
import { ULTIMATE_PRESENTATIONS } from "../../src/data/ultimatePresentations";
import { ENEMY_SD_ASSET_IDS } from "../../src/puppets/enemyAssetIds";

/** 두 콘텐츠 편성에서 참조하는 적 ID를 중복 없이 모아 영구 정의 목록과 비교한다. */
function referencedEnemyIds(): { stage: Set<string>; expedition: Set<string> } {
  const stage = new Set(STAGES.flatMap((definition) => definition.kind === "battle"
    ? definition.enemies.map(({ relicId }) => relicId)
    : []));
  const expedition = new Set(Object.values(EXPEDITION_ENEMY_FORMATIONS).flat());
  // 최종층 단독 보스는 일반 원정 편성표 밖에서 선택되므로 명시적으로 같은 검수 집합에 합친다.
  expedition.add(FINAL_FLOOR_BOSS_ID);
  return { stage, expedition };
}

describe("enemy static data completeness", () => {
  it("registers every permanent enemy in stages and expedition formations", () => {
    const enemyIds = RELICS.filter(({ enemyOnly }) => enemyOnly).map(({ id }) => id).sort();
    const referenced = referencedEnemyIds();
    // 누락 차집합을 그대로 출력해 새 적을 어느 콘텐츠 표에 더해야 하는지 실패 메시지에서 알 수 있게 한다.
    expect(enemyIds.filter((id) => !referenced.stage.has(id))).toEqual([]);
    expect(enemyIds.filter((id) => !referenced.expedition.has(id))).toEqual([]);
  });

  it("resolves every referenced enemy through identity, SD asset, and ultimate presentation tables", () => {
    const referenced = referencedEnemyIds();
    const ids = [...new Set([...referenced.stage, ...referenced.expedition])];
    for (const id of ids) {
      // 폴백 함수는 누락을 감추므로 정적 표의 own-property를 직접 검사한 뒤 실제 정의도 조회한다.
      expect(getRelic(id).enemyOnly, id).toBe(true);
      expect(ENEMY_SD_ASSET_IDS.includes(id as (typeof ENEMY_SD_ASSET_IDS)[number]), id).toBe(true);
      expect(Object.hasOwn(ULTIMATE_PRESENTATIONS, id), id).toBe(true);
    }
  });
});
