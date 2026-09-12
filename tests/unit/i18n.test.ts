import { describe, expect, it } from "vitest";
import { KO } from "../../src/i18n/ko";
import { languagesWithCatalog, t } from "../../src/i18n";
import { DEFAULT_LANGUAGE, LANGUAGE_IDS, SELECTABLE_LANGUAGE_IDS } from "../../src/core/language";

/** 화면 코드에서 한글 문자열을 찾기 위한 원본. 표 자신은 검사에서 뺀다. */
const SOURCES = import.meta.glob("../../src/**/*.ts", { query: "?raw", import: "default", eager: true }) as Record<string, string>;

/**
 * 언어 폴더를 통째로 훑는다. 새 언어를 더하면 검사 대상이 저절로 늘어난다 — 목록을 손으로 적으면
 * 번역을 넣은 사람이 그 목록을 빠뜨린다.
 */
const CATALOGS = import.meta.glob("../../src/i18n/*/index.ts", { import: "default", eager: true }) as Record<string, Record<string, string>>;

const placeholders = (text: string): string[] => [...text.matchAll(/\{(\w+)\}/g)].map((match) => match[1]).sort();

describe("문구 표", () => {
  it("은 빈 값을 두지 않는다", () => {
    for (const [key, value] of Object.entries(KO)) {
      expect(value, key).toBeTruthy();
      expect(value.trim(), key).toBe(value.trim());
    }
  });

  it("의 키는 화면 이름으로 시작한다", () => {
    // 키가 어느 화면 것인지 읽히지 않으면 표가 커질 때 같은 문구가 두 번 생긴다.
    for (const key of Object.keys(KO)) expect(key, key).toMatch(/^[a-z][A-Za-z]*\.[A-Za-z0-9.]+$/);
  });

  it("은 아무도 부르지 않는 키를 남기지 않는다", () => {
    // 쓰지 않는 키는 번역할 때마다 비용만 늘리고, 화면을 고친 흔적을 지운다.
    // 같은 한국어가 두 키에 있는 것은 막지 않는다 — 탭 이름과 섹션 제목처럼 다른 언어에서
    // 길이를 달리 잡아야 하는 자리가 있다.
    const code = Object.entries(SOURCES)
      .filter(([path]) => !path.startsWith("../../src/i18n/"))
      .map(([, text]) => text)
      .join("\n");
    const unused = Object.keys(KO).filter((key) => !code.includes(`"${key}"`));
    expect(unused).toEqual([]);
  });
});

describe("자리 표시", () => {
  it("는 채울 값을 넣으면 바뀐다", () => {
    expect(t("settings.debug.grantedRelics", { count: 3 })).toContain("3");
    expect(t("settings.debug.grantedRelics", { count: 3 })).not.toContain("{count}");
  });

  it("는 채울 값이 없으면 자리를 그대로 남긴다", () => {
    // 조용히 비우면 "새 캐릭터 명을 보유 처리했습니다"처럼 뜻이 빠진 문장이 화면에 선다.
    expect(t("settings.debug.grantedRelics")).toContain("{count}");
    expect(t("settings.debug.grantedRelics", {})).toContain("{count}");
  });

  it("가 없는 문구는 그대로 돌려준다", () => {
    expect(t("settings.title")).toBe(KO["settings.title"]);
  });
});

describe("번역 표", () => {
  it("은 한국어에 없는 키를 만들지 않는다", () => {
    // 한국어 표가 원본이라, 여기 없는 키는 화면이 부르지 않으므로 영영 보이지 않는다.
    for (const [path, catalog] of Object.entries(CATALOGS)) {
      const unknown = Object.keys(catalog).filter((key) => !(key in KO));
      expect(unknown, path).toEqual([]);
    }
  });

  it("은 한국어와 같은 자리 표시를 쓴다", () => {
    // 번역이 자리를 새로 만들면 그 값은 영영 채워지지 않고, 자리를 빠뜨리면 수치가 사라진다.
    for (const [path, catalog] of Object.entries(CATALOGS)) {
      for (const [key, value] of Object.entries(catalog)) {
        const expected = placeholders(KO[key as keyof typeof KO]);
        expect(placeholders(value), `${path} ${key}`).toEqual(expected);
      }
    }
  });
});

describe("언어와 표의 계약", () => {
  it("은 고를 수 있는 언어가 모두 표를 갖는다", () => {
    // 표 없는 언어를 고르면 화면이 통째로 한국어로 남는다.
    for (const id of SELECTABLE_LANGUAGE_IDS) expect(languagesWithCatalog()).toContain(id);
  });

  it("은 표를 가진 언어가 저장이 받아들이는 목록 안에 있다", () => {
    for (const id of languagesWithCatalog()) expect(LANGUAGE_IDS).toContain(id);
  });

  it("의 기본 언어는 언제나 표를 갖는다", () => {
    // 기본 언어의 표가 대체본이라, 이것이 없으면 빠진 키를 메울 자리가 없다.
    expect(languagesWithCatalog()).toContain(DEFAULT_LANGUAGE);
  });
});

/**
 * 문구 이관을 마친 파일. 여기 오른 파일에 한글이 다시 박히면 그 자리만 언어를 따라오지 않는다.
 *
 * **옮기는 대로 이 목록에 더한다.** 목록에 없으면 검사가 돌지 않아, 옮겼다고 생각한 화면이
 * 조용히 되돌아가도 아무도 모른다.
 */
const MIGRATED = [
  "../../src/scenes/SettingsScene.ts",
  "../../src/scenes/LobbyScene.ts",
  "../../src/scenes/LabScene.ts",
  "../../src/ui/unitStatusModel.ts",
  "../../src/scenes/ExpeditionScene.ts",
  "../../src/scenes/BattleScene.ts",
  "../../src/scenes/FriendsScene.ts",
  "../../src/scenes/PartyScene.ts",
  "../../src/ui/IdleExcavationPopup.ts",
  "../../src/ui/expeditionAugmentBadges.ts",
  "../../src/ui/RunePopup.ts",
  "../../src/ui/ExpeditionRewardPopup.ts",
  "../../src/ui/SaveConflictPopup.ts",
  "../../src/scenes/InteractionScene.ts",
  "../../src/scenes/PremiumScene.ts",
  "../../src/ui/InteractionCityPopup.ts",
  "../../src/ui/InteractionExchangePopup.ts",
  "../../src/ui/PurchasePopup.ts",
  "../../src/ui/MissionsPopup.ts",
  "../../src/scenes/ArchaeologyScene.ts",
  "../../src/scenes/BootScene.ts",
  "../../src/scenes/RelicsScene.ts",
  "../../src/scenes/ShopScene.ts",
  "../../src/scenes/SortiePreviewScene.ts",
  "../../src/scenes/StageMapScene.ts",
  "../../src/scenes/TitleScene.ts",
  "../../src/scenes/partyEntryError.ts",
  "../../src/ui/AppearanceCard.ts",
  "../../src/ui/BattleBuffPopup.ts",
  "../../src/ui/BattleContributionPopup.ts",
  "../../src/ui/BattleProfile.ts",
  "../../src/ui/BottomNav.ts",
  "../../src/ui/CurrencyGuidePopup.ts",
  "../../src/ui/ExpeditionAugmentPopup.ts",
  "../../src/ui/ExpeditionEntryButton.ts",
  "../../src/ui/ExpeditionRankingPopup.ts",
  "../../src/ui/ExpeditionScoreDetailPopup.ts",
  "../../src/ui/InteractionJournalPopup.ts",
  "../../src/ui/InventoryPopup.ts",
  "../../src/ui/MailPopup.ts",
  "../../src/ui/MileagePopup.ts",
  "../../src/ui/NodeEnemyPreview.ts",
  "../../src/ui/PlayerProfilePopup.ts",
  "../../src/ui/PopupLayer.ts",
  "../../src/ui/RewardPopup.ts",
  "../../src/ui/SkillIconFrame.ts",
  "../../src/ui/SkillPopup.ts",
  "../../src/ui/StageCompletePopup.ts",
  "../../src/ui/StaminaPopup.ts",
  "../../src/ui/TradePopup.ts",
  "../../src/ui/UnitStatusPopup.ts",
  "../../src/ui/battleContributionRenderModel.ts",
  "../../src/ui/damageNumbers.ts",
  "../../src/ui/excavationAdOfferModel.ts",
  "../../src/ui/formationSlotChrome.ts",
  "../../src/ui/interactionLayerModel.ts",
  "../../src/ui/lobbyUtilityRail.ts",
  "../../src/ui/runeIcons.ts",
  "../../src/ui/staminaDisplay.ts",
  "../../src/ui/statTones.ts",
  "../../src/ui/tradePopupModel.ts",
];

/**
 * 사람이 읽지 않는 줄은 검사에서 뺀다.
 *
 * `console.*`는 개발자만 보는 기록이고, `setDebug*`가 넘기는 화면 이름은 화면에 그리지 않고
 * E2E가 어느 화면인지 확인하는 데만 쓴다 — 언어를 따라 바뀌면 그 확인이 언어마다 갈린다.
 */
const isDeveloperLine = (line: string): boolean => /console\.|setDebug|throw new Error/.test(line);

describe("화면 문구", () => {
  it("은 이관을 마친 화면에 한글을 남기지 않는다", () => {
    const offenders: string[] = [];
    for (const path of MIGRATED) {
      const code = SOURCES[path];
      expect(code, path).toBeTruthy();
      const withoutComments = code.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
      for (const [index, line] of withoutComments.split("\n").entries()) {
        if (isDeveloperLine(line)) continue;
        for (const match of line.matchAll(/"([^"\\\n]*(?:\\.[^"\\\n]*)*)"|'([^'\\\n]*(?:\\.[^'\\\n]*)*)'|`([^`\\]*(?:\\.[^`\\]*)*)`/g)) {
          const text = match[1] ?? match[2] ?? match[3];
          if (/[가-힣]/.test(text)) offenders.push(`${path}:${index + 1} ${text}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});
