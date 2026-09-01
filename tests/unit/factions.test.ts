import { describe, expect, it } from "vitest";
import { SQUADS, SQUAD_EMBLEM_ASSETS, squadEmblemKey } from "../../src/data/factions";
import { RELICS } from "../../src/data/relics";
import type { SquadId } from "../../src/core/types";

const SQUAD_IDS = Object.keys(SQUADS) as SquadId[];

describe("자치 스쿼드 표", () => {
  it("모든 스쿼드가 이름·라틴 표기·역할·호칭을 갖춘다", () => {
    for (const id of SQUAD_IDS) {
      const squad = SQUADS[id];
      expect(squad.id).toBe(id);
      expect(squad.name.length).toBeGreaterThan(0);
      expect(squad.latin.length).toBeGreaterThan(0);
      expect(squad.duty.length).toBeGreaterThan(0);
      // 호칭은 스쿼드마다 다르다 — 비면 캐릭터가 주인공을 뭐라 부를지 화면이 지어내게 된다.
      expect(squad.researcherTitles.length).toBeGreaterThan(0);
    }
  });

  it("스쿼드마다 이름과 호칭이 서로 겹치지 않는다", () => {
    expect(new Set(SQUAD_IDS.map((id) => SQUADS[id].name)).size).toBe(SQUAD_IDS.length);
    const titles = SQUAD_IDS.flatMap((id) => SQUADS[id].researcherTitles.map((title) => `${id}:${title}`));
    expect(new Set(titles).size).toBe(titles.length);
  });

  it("엠블럼 목록이 스쿼드 수와 같고 키가 id에서 나온다", () => {
    expect(SQUAD_EMBLEM_ASSETS).toHaveLength(SQUAD_IDS.length);
    for (const [key, path] of SQUAD_EMBLEM_ASSETS) {
      const id = SQUAD_IDS.find((squad) => squadEmblemKey(squad) === key);
      expect(id).toBeDefined();
      expect(path).toBe(`/sprites/factions/${id}.webp`);
    }
  });
});

describe("렐릭 소속", () => {
  it("모든 렐릭이 실재하는 스쿼드에 배정돼 있다", () => {
    // 소속은 코드가 강제하지 않는 서사 값이라, 빠뜨리면 아무도 대신 채워 주지 않는다.
    for (const relic of RELICS) {
      expect(SQUAD_IDS).toContain(relic.squad);
    }
  });

  it("개체가 쓰는 호칭은 소속 스쿼드가 실제로 쓰는 말 중 하나다", () => {
    for (const relic of RELICS.filter((entry) => entry.researcherTitle)) {
      expect(SQUADS[relic.squad].researcherTitles).toContain(relic.researcherTitle);
    }
  });

  it("도디의 소속·팬 설정과 시그널 아이를 흉내 내는 관찰 기록을 분리한다", () => {
    const dodo = RELICS.find((relic) => relic.id === "dodo");
    expect(dodo?.squad).toBe("rogue");
    expect(dodo?.researcherTitle).toBe("대장님");
    // 소속 메모는 역할과 주인공 팬 설정만 담고, 동경은 복원 후 관찰된 행동으로 검증한다.
    expect(dodo?.squadNote).toContain("쁘띠 로그");
    expect(dodo?.squadNote).toContain("1호 팬");
    expect(dodo?.squadNote).not.toContain("시그널 아이");
    expect(dodo?.unlockRecord.status).toBe("recorded");
    if (dodo?.unlockRecord.status === "recorded") {
      expect(dodo.unlockRecord.text).toContain("시그널 아이");
      expect(dodo.unlockRecord.text).toContain("살피고 판단");
      expect(dodo.unlockRecord.text).toContain("먼저 갈 길을 정하려 했다");
    }
  });
});
