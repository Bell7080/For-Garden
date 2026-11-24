import { describe, expect, it } from "vitest";
import { CONCEALED_RELIC, concealProfileRelics, duelOpponentRevealedRelics, friendProfileDisplay } from "../../src/state/playerProfile";
import { normalizeDuelState } from "../../src/core/duelState";

const STATS = { hp: 1000, atk: 100, def: 50, res: 50, mag: 50, aspd: 1, mspd: 1, critChance: 5, critDamage: 150, lifesteal: 0, energyGain: 10, ferocityGain: 12 };

function card(favorite: string, avatar: string | null) {
  return friendProfileDisplay({
    displayName: "상대", level: 30, uid: "AB12CD34", frameId: "", status: "", lastActive: "", avatarRelicId: avatar,
    equippedModifiers: [], favoriteRelic: { relicId: favorite, level: 40, breakthroughGrade: 2, stats: STATS as never }, competitiveStats: {},
  });
}

describe("결투 상대 카드 — 가린 방어 칸을 드러내지 않는다", () => {
  it("가린 칸이 없으면 가릴 것도 없다", () => {
    expect(duelOpponentRevealedRelics({ favoriteRelicId: "torika", units: [{ relicId: "torika" }, { relicId: "dodo" }, { relicId: "parua" }] })).toBeUndefined();
  });

  it("애착 렐릭이 가려진 칸이면 카드에 서지 않는다 — 서버가 대표 얼굴을 드러난 칸으로 바꿔 보낸다", () => {
    // 진짜 애착은 숨은 칸의 'parua'. 서버는 대표 얼굴을 드러난 'torika'로, 사진은 비워 보낸다.
    const revealed = duelOpponentRevealedRelics({ favoriteRelicId: "torika", avatarRelicId: null, units: [{ relicId: "torika" }, { relicId: "dodo" }, { relicId: null }] })!;
    const shown = concealProfileRelics(card("parua", "parua"), revealed);
    expect(shown.competitiveStats.favoriteRelic).toBeNull();
    expect(shown.competitiveStats.favoriteConcealed).toBe(true);
    expect(shown.representativeRelic).toBe(CONCEALED_RELIC);
    expect(shown.avatar).toBeNull();
  });

  it("애착·사진이 공개 값이면 그대로 선다", () => {
    const revealed = duelOpponentRevealedRelics({ favoriteRelicId: "parua", avatarRelicId: "dodo", units: [{ relicId: "torika" }, { relicId: null }, { relicId: null }] })!;
    const shown = concealProfileRelics(card("parua", "dodo"), revealed);
    expect(shown.competitiveStats.favoriteRelic?.relicId).toBe("parua");
    expect(shown.avatar?.relicId).toBe("dodo");
    expect(shown.competitiveStats.favoriteConcealed).toBeUndefined();
  });

  it("전적 줄은 상대 계정 id를 저장 왕복에서도 지킨다", () => {
    const entry = { at: new Date(0).toISOString(), opponentName: "상대", opponentScore: 1000, won: true, delta: 12, opponentId: "6f1b2c3d-0000-4000-8000-000000000001" };
    const state = normalizeDuelState({ history: [entry] }, []);
    expect(state.history[0]?.opponentId).toBe(entry.opponentId);
    expect(normalizeDuelState({ history: [{ ...entry, opponentId: 7 }] }, []).history[0]?.opponentId).toBeUndefined();
  });
});
