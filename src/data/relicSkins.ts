import type { RelicSkinId } from "../core/types";
import type { WalletItemKey } from "./items";
import { registerDataText } from "../i18n";
import { RELICS } from "./relics";

/** 렐릭의 전투 정의와 분리된 플레이어 표시용 외형 한 벌이다. */
export interface RelicSkinDef {
  /** 소유·선택 상태에 저장하는 파일명 비의존 영구 ID다. */
  id: RelicSkinId;
  /** 신규·기존 계정 모두 별도 획득 절차 없이 소유해야 하는 외형인지 명시한다. */
  defaultUnlocked: boolean;
  /** 이 외형을 입을 수 있는 유일한 렐릭의 영구 ID다. */
  relicId: string;
  /** 상점·보상·외형 선택 화면에서 플레이어에게 보여 줄 이름이다. */
  name: string;
  /**
   * 비전투 전신 Puppet 레지스트리가 해석할 논리 에셋 키다.
   *
   * **아직 열리지 않은 외형(`comingSoon`)만 비운다.** 원화가 구워지지 않은 외형에 논리 키를
   * 미리 적어 두면 그 키를 찾는 화면이 조용히 기본 외형을 세우고, 배포 파일이 실제로 있는지
   * 검사하는 회귀 테스트도 없는 파일을 요구하게 된다.
   */
  portraitAssetId?: string;
  /** 전투·축약 화면의 SD Puppet 레지스트리가 해석할 논리 에셋 키다. 위와 같은 규칙이다. */
  sdAssetId?: string;
  /**
   * 아직 열리지 않은 외형.
   *
   * 이름만 걸어 두고 **얻는 길은 말하지 않는다** — 값도 조건도 정해지지 않았는데 둘 중 하나를
   * 적으면 플레이어가 찾을 곳을 만들어 낸다. 원화도 아직 없으므로 전시관은 그 칸을 **실루엣**
   * 으로 세운다.
   */
  comingSoon?: boolean;
  /**
   * 아직 없을 때 드는 값.
   *
   * 비우면 "값으로 사는 외형이 아니다"라는 뜻이다 — 보상·이벤트로만 오는 외형이 그렇다.
   * 값이 있으면 외형 전시관이 그 줄을 `addPriceBar`로 그대로 세운다.
   */
  price?: { currency: WalletItemKey; amount: number };
}

/**
 * 선택 가능한 추가 외형을 등록하는 정적 표다. 무료 기본 해금 정책도 이 표만이 소유한다.
 *
 * 기본 외형은 렐릭 정의 자체가 소유하며 별도 보유 스킨으로 중복 저장하지 않는다. 저장 상태의
 * 선택값 `null`은 기본 외형을 뜻하고, 이 표의 ID는 기본 해금 또는 획득한 추가 외형을 선택할 때 쓴다.
 */
export const RELIC_SKINS: readonly RelicSkinDef[] = [
  {
    // 안정적인 콘텐츠 ID와 Puppet 파일명을 분리해, 에셋 교체가 저장 데이터를 깨뜨리지 않게 한다.
    id: "torika-skin-001",
    // 공개 시점부터 모든 계정에 제공하므로 세션과 마이그레이션이 이 ID를 따로 알지 않게 한다.
    defaultUnlocked: true,
    relicId: "anky",
    name: "여름방학 토리카",
    portraitAssetId: "torika-skin-001-portrait",
    sdAssetId: "torika-skin-001-sd",
  },
  // 아래 넷은 **이름만 걸어 둔 자리**다. 원화가 아직 없어 에셋 키도 값도 조건도 적지 않으며,
  // 전시관은 이 넷을 실루엣으로 세우고 얻는 길을 말하지 않는다. 방학·행사처럼 같은 계절 한 벌로
  // 묶어 두어야 나중에 한 장씩 열릴 때 목록이 흩어지지 않는다.
  { id: "torika-skin-002", defaultUnlocked: false, relicId: "anky", name: "겨울방학 토리카", comingSoon: true },
  { id: "torika-skin-003", defaultUnlocked: false, relicId: "anky", name: "체육대회 토리카", comingSoon: true },
  { id: "torika-skin-004", defaultUnlocked: false, relicId: "anky", name: "야간자습 토리카", comingSoon: true },
  { id: "torika-skin-005", defaultUnlocked: false, relicId: "anky", name: "교복 토리카", comingSoon: true },
];

/** 중복 ID, 없는 대상 렐릭, 한쪽만 적힌 에셋 조합을 콘텐츠 로드 전에 함께 검사한다. */
export function validateRelicSkins(
  skins: readonly RelicSkinDef[],
  relicIds: ReadonlySet<string> = new Set(RELICS.map(({ id }) => id)),
): void {
  const seen = new Set<RelicSkinId>();
  for (const skin of skins) {
    if (seen.has(skin.id)) throw new Error(`중복 렐릭 스킨 id: ${skin.id}`);
    if (typeof skin.defaultUnlocked !== "boolean") throw new Error(`스킨 기본 해금 정책이 누락되었습니다: ${skin.id}`);
    if (!relicIds.has(skin.relicId)) throw new Error(`스킨 대상 렐릭을 찾을 수 없습니다: ${skin.id} -> ${skin.relicId}`);
    // 두 표현은 한 벌이므로 빈 문자열까지 누락으로 취급해 어느 화면만 기본 외형으로 돌아가는 일을 막는다.
    // 아직 열리지 않은 외형만 둘 다 비울 수 있고, 그때도 **한쪽만** 적는 것은 막는다 — 반쪽짜리
    // 조합은 원화가 준비된 것처럼 보이면서 실제로는 한 화면만 기본 외형으로 돌아간다.
    const drawn = [skin.portraitAssetId, skin.sdAssetId].filter((assetId) => assetId?.trim()).length;
    if (skin.comingSoon ? drawn !== 0 : drawn !== 2) throw new Error(`스킨 전신·SD 에셋 조합이 누락되었습니다: ${skin.id}`);
    seen.add(skin.id);
  }
}

// 정적 표가 잘못되면 조용한 폴백 대신 모듈 로드 시 즉시 실패시킨다.
validateRelicSkins(RELIC_SKINS);

/** 정적 외형 정의에서 모든 계정의 기본 소유 ID를 계산해 신규 생성과 저장 이관이 공유한다. */
export function defaultUnlockedRelicSkinIds(): RelicSkinId[] {
  return RELIC_SKINS.filter(({ defaultUnlocked }) => defaultUnlocked).map(({ id }) => id);
}

/** 검증이 끝난 표에서 ID를 정확히 찾으며, 알 수 없는 ID는 다른 외형 대신 undefined를 반환한다. */
export function getRelicSkin(id: string): RelicSkinDef | undefined {
  return RELIC_SKINS.find((skin) => skin.id === id);
}

/** 렐릭 하나에 명시적으로 연결된 추가 외형만 새 배열로 반환하며 기본 외형은 포함하지 않는다. */
export function skinsForRelic(relicId: string): RelicSkinDef[] {
  return RELIC_SKINS.filter((skin) => skin.relicId === relicId);
}

/** 추가 외형의 이름을 언어별로 덮어쓸 수 있게 등록한다. */
for (const skin of RELIC_SKINS) {
  registerDataText(skin, "name", `skin.${skin.id}.name`);
}
