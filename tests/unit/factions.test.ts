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

  it("동경하는 스쿼드는 자기 소속과 다른 실재 스쿼드다", () => {
    for (const relic of RELICS.filter((entry) => entry.admiredSquad)) {
      expect(SQUAD_IDS).toContain(relic.admiredSquad);
      expect(relic.admiredSquad).not.toBe(relic.squad);
    }
  });

  it("개체가 쓰는 호칭은 소속 스쿼드가 실제로 쓰는 말 중 하나다", () => {
    for (const relic of RELICS.filter((entry) => entry.researcherTitle)) {
      expect(SQUADS[relic.squad].researcherTitles).toContain(relic.researcherTitle);
    }
  });

  it("도디는 쁘띠 로그 소속이며 시그널 아이를 동경한다", () => {
    const dodo = RELICS.find((relic) => relic.id === "dodo");
    expect(dodo?.squad).toBe("rogue");
    expect(dodo?.admiredSquad).toBe("eye");
    expect(dodo?.researcherTitle).toBe("대장님");
    // 소속을 이름표로만 두지 않는다 — 그 무리에서 무엇을 하는지가 한 줄로 남아야 한다.
    expect(dodo?.squadNote).toContain("쁘띠 로그");
  });
});
