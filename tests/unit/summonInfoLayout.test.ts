import { describe, expect, it } from "vitest";
import { insideEnemyInfoBody } from "../../src/ui/enemyInfoLayout";
import { SUMMON_INFO } from "../../src/ui/summonInfoLayout";
import { KURO_SD_METADATA, SHIRO_SD_METADATA } from "../../src/puppets/assetMetadata";

/** 액자 한 변(스킬·뱃지)과 칸 제목표가 윗변 위로 솟는 높이. */
const BADGE = 96;
const TITLE_RISE = 40;

describe("소환수 정보창 배치", () => {
  const { column, growthPanel, statPanel, resummonPanel, ownerFace, figure, journalButton, skills, ferocityBadgeOffsetY } = SUMMON_INFO;

  it("은 성장 기준·능력치·재소환 세 칸을 한 기둥에 겹치지 않게 쌓고 판 안에서 끝낸다", () => {
    const panels = [growthPanel, statPanel, resummonPanel];
    for (const panel of panels) {
      expect(insideEnemyInfoBody({ x: column.x, y: panel.top + panel.height / 2, width: column.width, height: panel.height })).toBe(true);
    }
    // 다음 칸의 제목표가 윗 칸 밑변을 파고들지 않는다.
    for (let index = 1; index < panels.length; index += 1) {
      expect(panels[index].top - TITLE_RISE).toBeGreaterThanOrEqual(panels[index - 1].top + panels[index - 1].height);
    }
  });

  it("은 지휘자 얼굴을 이름 줄 오른쪽 판 안에 세우고 성장 기준 칸 제목과 겹치지 않는다", () => {
    expect(insideEnemyInfoBody({ x: ownerFace.x, y: ownerFace.y, width: ownerFace.size, height: ownerFace.size })).toBe(true);
    expect(ownerFace.x - ownerFace.size / 2).toBeGreaterThan(SUMMON_INFO.nameRight);
    expect(ownerFace.y + ownerFace.size / 2).toBeLessThan(growthPanel.top - TITLE_RISE);
  });

  it("은 SD를 왼쪽 기둥에 크게 세우되 칸·관찰 일지·폭주 뱃지를 덮지 않는다", () => {
    for (const { content } of [KURO_SD_METADATA, SHIRO_SD_METADATA]) {
      const scale = figure.height / (content.bottom - content.top);
      const halfWidth = (content.right - content.left) * scale / 2;
      // 가로가 넓은 늑대가 오른쪽 기둥의 왼쪽 변 앞에서 멈추고 판 왼쪽 밖으로 나가지 않는다.
      expect(figure.x + halfWidth).toBeLessThan(column.x - column.width / 2);
      expect(figure.x - halfWidth).toBeGreaterThan(-SUMMON_INFO.width / 2);
      // 머리는 관찰 일지 칩 아래, 받침 글자(발밑 +32~+50)는 폭주 뱃지 윗변 위에서 끝난다.
      expect(figure.groundY - figure.height).toBeGreaterThan(journalButton.y + journalButton.size / 2);
      expect(figure.groundY + 50).toBeLessThan(skills.y + ferocityBadgeOffsetY - BADGE / 2);
    }
  });

  it("은 스킬 액자 줄이 재소환 칸 왼쪽에서 끝난다", () => {
    // 일반 공격·궁극기 둘만 선다(패시브는 성장 기준 칸과 같은 말이라 뺐다).
    const lastRight = skills.x + skills.step + skills.size / 2;
    expect(lastRight).toBeLessThan(column.x - column.width / 2);
  });
});
