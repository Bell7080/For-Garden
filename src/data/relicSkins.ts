import type { RelicSkinId } from "../core/types";
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
  /** 비전투 전신 Puppet 레지스트리가 해석할 논리 에셋 키다. */
  portraitAssetId: string;
  /** 전투·축약 화면의 SD Puppet 레지스트리가 해석할 논리 에셋 키다. */
  sdAssetId: string;
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
    name: "토리카의 특별 외형",
    portraitAssetId: "torika-skin-001-portrait",
    sdAssetId: "torika-skin-001-sd",
  },
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
    if (!skin.portraitAssetId.trim() || !skin.sdAssetId.trim()) throw new Error(`스킨 전신·SD 에셋 조합이 누락되었습니다: ${skin.id}`);
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
