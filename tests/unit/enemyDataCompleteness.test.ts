import { describe, expect, it } from "vitest";
import { CAKE_OPERATION_ENEMY_ID } from "../../src/data/cakeOperation";
import { EXPEDITION_ENEMY_FORMATIONS, FINAL_FLOOR_BOSS_ID } from "../../src/data/expeditionEnemies";
import { RELICS, getRelic } from "../../src/data/relics";
import { STAGES } from "../../src/data/stages";
import { ULTIMATE_PRESENTATIONS } from "../../src/data/ultimatePresentations";
import { ENEMY_SD_ASSET_IDS } from "../../src/puppets/enemyAssetIds";

/** 콘텐츠 편성에서 참조하는 적 ID를 중복 없이 모아 영구 정의 목록과 비교한다. */
function referencedEnemyIds(): { stage: Set<string>; expedition: Set<string>; dungeon: Set<string> } {
  const stage = new Set(STAGES.flatMap((definition) => definition.kind === "battle"
    ? definition.enemies.map(({ relicId }) => relicId)
    : []));
  const expedition = new Set(Object.values(EXPEDITION_ENEMY_FORMATIONS).flat());
  // 최종층 단독 보스는 일반 원정 편성표 밖에서 선택되므로 명시적으로 같은 검수 집합에 합친다.
  expedition.add(FINAL_FLOOR_BOSS_ID);
  // 전용 던전에만 서는 개체도 같은 검수 집합에 넣는다.
  const dungeon = new Set([CAKE_OPERATION_ENEMY_ID]);
  return { stage, expedition, dungeon };
}

/**
 * 스토리와 원정에 **함께** 서야 하는 개체.
 *
 * 두 콘텐츠를 오가는 공용 악당은 한쪽 표에서 빠지면 그 콘텐츠만 옛 편성으로 남으므로 둘 다
 * 확인한다. 전용 던전에만 서는 개체(치즈케이크 대작전의 레이티아)는 여기 오르지 않는다 —
 * 그 개체를 스토리·원정 표에 억지로 넣으면 편성이 콘텐츠의 성격과 갈린다.
 */
const SHARED_ENEMY_IDS = ["toby", "amo", "ripa", "koma", "pontos"] as const;

describe("enemy static data completeness", () => {
  it("registers every permanent enemy in some content formation", () => {
    const enemyIds = RELICS.filter(({ enemyOnly }) => enemyOnly).map(({ id }) => id).sort();
    const referenced = referencedEnemyIds();
    const anywhere = new Set([...referenced.stage, ...referenced.expedition, ...referenced.dungeon]);
    // 누락 차집합을 그대로 출력해 새 적을 어느 콘텐츠 표에 더해야 하는지 실패 메시지에서 알 수 있게 한다.
    expect(enemyIds.filter((id) => !anywhere.has(id))).toEqual([]);
  });

  it("keeps the shared story/expedition villains in both formation tables", () => {
    const referenced = referencedEnemyIds();
    expect(SHARED_ENEMY_IDS.filter((id) => !referenced.stage.has(id))).toEqual([]);
    expect(SHARED_ENEMY_IDS.filter((id) => !referenced.expedition.has(id))).toEqual([]);
  });

  it("resolves every referenced enemy through identity, SD asset, and ultimate presentation tables", () => {
    const referenced = referencedEnemyIds();
    const ids = [...new Set([...referenced.stage, ...referenced.expedition, ...referenced.dungeon])];
    for (const id of ids) {
      // 폴백 함수는 누락을 감추므로 정적 표의 own-property를 직접 검사한 뒤 실제 정의도 조회한다.
      expect(getRelic(id).enemyOnly, id).toBe(true);
      expect(ENEMY_SD_ASSET_IDS.includes(id as (typeof ENEMY_SD_ASSET_IDS)[number]), id).toBe(true);
      expect(Object.hasOwn(ULTIMATE_PRESENTATIONS, id), id).toBe(true);
    }
  });
});
