import type Phaser from "phaser";
import type { Puppet } from "puppetforge/phaser";
import type { PortraitAssetId } from "../core/types";
import { ENEMY_SD_ASSET_IDS } from "./enemyAssetIds";
import {
  computeAnchoredPlacement,
  computeHeadCardFrame,
  resolveAnchors,
  type AnchorKind,
  type AnchorPoint,
  type CardFrame,
  type CardFrameOptions,
  type FocusOptions,
} from "./anchors";
import type { IndexedPuppetCreature } from "./IndexedPuppetCreature";
import { loadSharedPromise } from "./promiseCache";
import {
  DEINA_PORTRAIT_METADATA,
  DEINA_SD_METADATA,
  DIAN_PORTRAIT_METADATA,
  DIAN_SD_METADATA,
  DELOPI_PORTRAIT_METADATA,
  DELOPI_SD_METADATA,
  ELLA_PORTRAIT_METADATA,
  ELLA_SD_METADATA,
  NODONIA_PORTRAIT_METADATA,
  NODONIA_SD_METADATA,
  DODI_PORTRAIT_METADATA,
  DODI_SD_METADATA,
  LEXIA_PORTRAIT_METADATA,
  LUKA_PORTRAIT_METADATA,
  MADDY_PORTRAIT_METADATA,
  PARUA_PORTRAIT_METADATA,
  MADDY_SD_METADATA,
  PARUA_SD_METADATA,
  METTE_PORTRAIT_METADATA,
  METTE_SD_METADATA,
  PONTOS_PORTRAIT_METADATA,
  PONTOS_SD_METADATA,
  SEIRA_PORTRAIT_METADATA,
  KERIS_PORTRAIT_METADATA,
  KERIS_SD_METADATA,
  MAKI_PORTRAIT_METADATA,
  MAKI_SD_METADATA,
  MERON_PORTRAIT_METADATA,
  MERON_SD_METADATA,
  PACHI_PORTRAIT_METADATA,
  PACHI_SD_METADATA,
  STELLA_PORTRAIT_METADATA,
  TIA_PORTRAIT_METADATA,
  TIA_SD_METADATA,
  TORIKA_PORTRAIT_METADATA,
  TORIKA_SKIN_001_PORTRAIT_METADATA,
  TORIKA_SKIN_001_SD_METADATA,
  KURO_SD_METADATA,
  SHIRO_SD_METADATA,
} from "./assetMetadata";

/** 기존 호출부가 렌더러 구현을 몰라도 되도록 인게임 Puppet 타입을 한 곳에서 공개한다. */
export type PuppetCreature = IndexedPuppetCreature;

/**
 * PuppetForge로 만든 임시 아트를 불러오고, 발바닥이 바닥에 닿도록 세운다.
 *
 * 렐릭 30종과 적 개체가 각자의 묶음을 갖기 전까지는 이 둘로 돌려 쓴다.
 * 캐릭터 구분은 색 필터(tint)로만 한다.
 */

/**
 * 묶음 하나에 대한 정보.
 *
 * `content`는 이미지에서 실제로 그림이 있는 영역(알파 > 16)이다. 이미지에는 투명한 여백이
 * 붙어 있어서, 이미지 테두리를 기준으로 세우면 캐릭터가 공중에 뜨거나 바닥에 파묻힌다.
 * 그래서 발끝(`content.bottom`)을 바닥선에 맞춘다.
 */
export interface PuppetAsset {
  url: string;
  imageWidth: number;
  imageHeight: number;
  content: { left: number; top: number; right: number; bottom: number };
  /** ZIP 프로젝트에서 실측한 기준 관절. null은 제작 파일에 해당 관절이 없다는 뜻이다. */
  joints?: {
    center: readonly [number, number];
    head: readonly [number, number];
    eyes: readonly (readonly [number, number])[] | null;
    feet: readonly (readonly [number, number])[];
  };
  /**
   * 카드에서의 확대 보정. 1이 기준이다.
   *
   * 등신이 낮은(머리가 큰) 원화는 같은 배율로 넣으면 혼자만 얼굴이 커 보인다. 카드 규격을
   * 캐릭터마다 다르게 만들지 않고, 원화 쪽에 보정값을 달아 한 그리드에서 크기가 맞게 한다.
   */
  cardZoom?: number;
  /**
   * 카드가 그림의 위쪽을 어디부터 보면 되는지(텍스처 y). 없으면 실측 alpha 경계를 쓴다.
   *
   * 로비 전신은 그림 전체가 서야 하지만, 카드는 얼굴 카드라 베일 끝처럼 얼굴보다 한참 높이
   * 솟은 **가는** 장식까지 담을 이유가 없다. 둘을 한 값으로 묶으면 넓은 실루엣(얼굴이 작아짐)과
   * 높은 장식(정수리가 잘림)을 동시에 만족시킬 수 없다 — 노도니아가 그랬다.
   *
   * 값은 실측이다: 그 장식의 가로폭이 실루엣 폭의 15%를 넘기 시작하는 행.
   */
  cardTop?: number;
  /**
   * 정보창 전신 배율. 1이면 공용 높이 그대로다.
   *
   * 적 원화는 아군보다 캔버스 안의 그림 영역이 작아, 같은 높이로 세우면 화면 밖으로 넘칠 만큼
   * 확대된다. 화면이 개체마다 다른 높이를 정하지 않도록 보정값을 원화 쪽에 붙인다.
   */
  portraitZoom?: number;
  /**
   * 로비 전신 배율. 1이면 애착 렐릭 기준 높이(`LOBBY_PORTRAIT_SPOT.height`) 그대로다.
   *
   * 로비는 인물을 감상하는 화면이라 **키가 큰 개체가 크게 서야 한다.** 원화마다 캔버스에
   * 담긴 여백과 등신이 달라 상자에 맞춰 넣으면 1.08 m 토리카가 1.76 m 메테보다 크게 선다.
   * 그래서 상자가 아니라 **관찰 프로필의 키**를 기준으로 삼고, 원화 쪽에 그 보정을 적는다.
   *
   * 값을 구하는 방법은 `tests/unit/lobbyPortrait.test.ts`가 그대로 검사한다 —
   * 눈 관절에서 발끝(`content.bottom`)까지의 텍스처 거리가 화면에서 `키(m) × 912 px`가
   * 되도록 맞춘 배율이다. 기준은 메론(1.58 m)이며 그 원화만 1이다. 아트를 다시 구우면
   * 같은 방법으로 눈 관절과 alpha 경계를 다시 재서 이 값을 고친다.
   */
  lobbyZoom?: number;
  /**
   * 정보창 전신의 세로 보정(+는 아래). 0이 기준이다.
   *
   * 코어 관절을 화면의 한 점에 맞춰 세우지만, 관절을 어디에 박았는지는 원화마다 다르다.
   * 그래서 같은 점에 맞춰도 어떤 인물은 조금 내려앉아 보인다. 화면이 인물마다 다른 y를
   * 적지 않도록 그 차이를 원화 쪽에 적어 둔다.
   */
  portraitOffsetY?: number;
  /**
   * 카드 머리 홈이 한쪽으로 더 열려야 하는 정도(칩 폭 대비 비율, 0~1). 비워두면 대칭이다.
   *
   * 머리 관절은 항상 카드 가운데를 기준으로 잡지만, 모자·깃털·후드 같은 장식은 포즈에 따라
   * 한쪽으로 쏠려 그려진다. 대칭 홈만 있으면 그 쪽이 대각선 모서리 안쪽에서 잘린다(스피나의
   * 뒷머리 오른쪽, 메테의 후드 왼쪽이 그랬다). 새 캐릭터를 추가한 뒤 도감 카드에서 머리 옆이
   * 애매하게 잘려 보이면, 어느 쪽이 잘리는지 보고 그 방향만 값을 채운다 — 0.05~0.15 사이에서
   * 시작해 스크린샷으로 확인하며 늘린다.
   */
  cardHeadEscape?: { left?: number; right?: number };
}

const base = import.meta.env.BASE_URL;

/** 1번 전신 일러스트: 토리카(트리케라톱스). */
export const TORIKA_ASSET: PuppetAsset = {
  url: `${base}puppets/char_001.zip`,
  ...TORIKA_PORTRAIT_METADATA,
};

/** 토리카 skin001 전신: 기본 외형과 독립 측정한 카드·로비·정보창 배치를 사용한다. */
export const TORIKA_SKIN_001_ASSET: PuppetAsset = {
  url: `${base}puppets/char_001_skin001.zip`,
  ...TORIKA_SKIN_001_PORTRAIT_METADATA,
};

/** 2번 전신 일러스트: 렉시아(티라노사우루스). */
export const LEXIA_ASSET: PuppetAsset = {
  url: `${base}puppets/char_002.zip`,
  ...LEXIA_PORTRAIT_METADATA,
};

/** 3번 전신 일러스트: 스피나(스피노사우루스). */
export const SEIRA_ASSET: PuppetAsset = {
  url: `${base}puppets/char_003.zip`,
  ...SEIRA_PORTRAIT_METADATA,
};

/** 4번 전신 일러스트: 루카(벨로키랍토르). */
export const LUKA_ASSET: PuppetAsset = {
  url: `${base}puppets/char_004.zip`,
  ...LUKA_PORTRAIT_METADATA,
};

/** 5번 전신 일러스트: 도디(도도새). */
export const DODI_ASSET: PuppetAsset = {
  url: `${base}puppets/char_005.zip`,
  ...DODI_PORTRAIT_METADATA,
};

/** 6번 전신 일러스트: 메테(메가테리움). */
export const METTE_ASSET: PuppetAsset = {
  url: `${base}puppets/char_006.zip`,
  ...METTE_PORTRAIT_METADATA,
};

/** 7번 전신 일러스트: 스테라(게오스테른베르기아). */
export const STELLA_ASSET: PuppetAsset = {
  url: `${base}puppets/char_007.zip`,
  ...STELLA_PORTRAIT_METADATA,
};

/** 9번 전신 일러스트: 메론(메갈로돈 유체). */
export const MERON_ASSET: PuppetAsset = {
  url: `${base}puppets/char_009.zip`,
  ...MERON_PORTRAIT_METADATA,
};

/** 10번 전신 일러스트: 파치(파키케팔로사우루스). */
export const PACHI_ASSET: PuppetAsset = {
  url: `${base}puppets/char_010.zip`,
  ...PACHI_PORTRAIT_METADATA,
};

/** 11번 전신 일러스트: 마키(스밀로돈). */
export const MAKI_ASSET: PuppetAsset = {
  url: `${base}puppets/char_011.zip`,
  ...MAKI_PORTRAIT_METADATA,
};

/** 12번 전신 일러스트: 케리스(메갈로케로스). */
export const KERIS_ASSET: PuppetAsset = {
  url: `${base}puppets/char_012.zip`,
  ...KERIS_PORTRAIT_METADATA,
};

/** 13번 전신 일러스트: 델로피(딜로포사우루스). */
export const DELOPI_ASSET: PuppetAsset = {
  url: `${base}puppets/char_013.zip`,
  ...DELOPI_PORTRAIT_METADATA,
};

/** 14번 전신 일러스트: 노도니아(프테라노돈). */
export const NODONIA_ASSET: PuppetAsset = {
  url: `${base}puppets/char_014.zip`,
  ...NODONIA_PORTRAIT_METADATA,
};

/** 15번 전신 일러스트: 엘라(코엘로돈타). */
export const ELLA_ASSET: PuppetAsset = {
  url: `${base}puppets/char_015.zip`,
  ...ELLA_PORTRAIT_METADATA,
};

/** 16번 전신 일러스트: 데이(데이노니쿠스). */
export const DEINA_ASSET: PuppetAsset = {
  url: `${base}puppets/char_016.zip`,
  ...DEINA_PORTRAIT_METADATA,
};

/** 17번 전신 일러스트: 매디(매머드). */
export const MADDY_ASSET: PuppetAsset = {
  url: `${base}puppets/char_017.zip`,
  ...MADDY_PORTRAIT_METADATA,
};

/** 21번 전신 일러스트: 파루아(파라사우롤로푸스). */
export const PARUA_ASSET: PuppetAsset = {
  url: `${base}puppets/char_021.zip`,
  ...PARUA_PORTRAIT_METADATA,
};

/** 20번 전신: 디안. black/white는 아래 SD 늑대의 털색이며 디안 자신의 변형명이 아니다. */
export const DIAN_ASSET: PuppetAsset = { url: `${base}puppets/char_020.zip`, ...DIAN_PORTRAIT_METADATA };

/** 8번 전신 일러스트: 티아(이크티오사우루스). */
export const TIA_ASSET: PuppetAsset = {
  url: `${base}puppets/char_008.zip`,
  ...TIA_PORTRAIT_METADATA,
};

/**
 * 1번 적 토비. 적 전용 Puppet 번호와 스테이지 고정 편성 번호를 일치시킨다.
 *
 * 적 셋은 캔버스 크기가 서로 다르다. ZIP 안 WebP의 VP8X 헤더로 원본 픽셀 크기를 확인하고,
 * 기존 알파 경계도 같은 비율로 원본 좌표계에 환산했다. 관절과 원화를 한 좌표계로 적어야
 * `중심1` 기준 배치가 별도 확대 보정 없이 맞는다.
 */
export const TOBY_ASSET: PuppetAsset = {
  url: `${base}puppets/enemy_001.zip`,
  imageWidth: 2000,
  imageHeight: 2828,
  // 기존 알파 경계를 실제 2000×2828 WebP 좌표로 환산해 투명 여백을 확대 높이에 포함하지 않는다.
  content: { left: 33, top: 105, right: 1967, bottom: 2718 },
};

/** 2번 적 아모. */
export const AMO_ASSET: PuppetAsset = {
  url: `${base}puppets/enemy_002.zip`,
  imageWidth: 1086,
  imageHeight: 1449,
  // 이전 값은 실제 WebP 크기를 정확히 2배로 적어 중심1과 원화의 좌표계를 어긋나게 했다.
  content: { left: 100, top: 22, right: 986, bottom: 1427 },
};

/** 3번 적 리파. 파일명의 기존 표기(enemy003)를 실제 공개 에셋 경로대로 연결한다. */
export const RIPA_ASSET: PuppetAsset = {
  url: `${base}puppets/enemy_003.zip`,
  imageWidth: 2000,
  imageHeight: 2833,
  // ZIP 안 원화의 실제 크기에 맞춰 알파 경계도 같은 좌표계로 환산한다.
  content: { left: 30, top: 172, right: 1970, bottom: 2659 },
};

/** 20층 보스 폰토스 전신. ZIP의 WebP와 alpha > 16 경계를 원본 좌표계에서 직접 측정했다. */
export const PONTOS_ASSET: PuppetAsset = {
  url: `${base}puppets/enemy_Pontos.zip`,
  // 측정값을 순수 모듈과 공유해 브라우저 없이도 알파 경계 회귀를 검증한다.
  ...PONTOS_PORTRAIT_METADATA,
};

/**
 * 4번째 적 코마 전신. 원화 측정값은 기존 enemy_004 묶음의 알파 경계를 그대로 사용한다.
 */
export const EXPLORER_ASSET: PuppetAsset = {
  url: `${base}puppets/enemy_004.zip`,
  imageWidth: 1086,
  imageHeight: 1448,
  content: { left: 278, top: 71, right: 984, bottom: 1398 },
};

/**
 * 렐릭 데이터가 참조하는 원화 레지스트리. 새 원화는 여기에 한 번 등록한 뒤 데이터 키로 연결한다.
 */
export const PORTRAIT_ASSETS = {
  torika: TORIKA_ASSET,
  lexia: LEXIA_ASSET,
  seira: SEIRA_ASSET,
  luka: LUKA_ASSET,
  dodi: DODI_ASSET,
  mette: METTE_ASSET,
  stella: STELLA_ASSET,
  tia: TIA_ASSET,
  meron: MERON_ASSET,
  pachi: PACHI_ASSET,
  maki: MAKI_ASSET,
  keris: KERIS_ASSET,
  delopi: DELOPI_ASSET,
  nodonia: NODONIA_ASSET,
  ella: ELLA_ASSET,
  deina: DEINA_ASSET,
  maddy: MADDY_ASSET,
  // 적도 전용 전신을 가진다. 초상 레지스트리에 함께 두면 정보창이 아군·적을 가르지 않고
  // 같은 경로로 원화를 찾는다 — 화면마다 "적이면 다른 함수"를 두면 한 곳을 고칠 때 다른
  // 곳이 임시 원화로 남는다.
  toby: TOBY_ASSET,
  amo: AMO_ASSET,
  ripa: RIPA_ASSET,
  koma: EXPLORER_ASSET,
  pontos: PONTOS_ASSET,
  parua: PARUA_ASSET,
  dian: DIAN_ASSET,
} as const satisfies Record<PortraitAssetId, PuppetAsset>;

/**
 * 장착 가능한 전신 스킨 표. 첫 키는 렐릭의 전신 asset ID, 둘째 키는 저장되는 스킨 ID다.
 * 기본 외형은 이 표에 넣지 않아 "명시한 장착 스킨 → 해당 렐릭 기본 외형" 순서를 보존한다.
 */
export const PORTRAIT_SKINS: Readonly<Partial<Record<PortraitAssetId, Readonly<Record<string, PuppetAsset>>>>> = {
  torika: { "torika-skin-001": TORIKA_SKIN_001_ASSET },
};

/** 데이터 키로 전신 원화를 찾는다. 캐릭터 내부 id에 의존하지 않는다. */
export function portraitAssetFor(assetId: PortraitAssetId): PuppetAsset {
  return PORTRAIT_ASSETS[assetId];
}

/**
 * 명시적으로 장착된 스킨을 먼저 고르고, null·미장착·알 수 없는 값은 **같은 렐릭의** 기본 전신으로
 * 돌아간다. 다른 렐릭(특히 토리카)을 전역 대체물로 쓰지 않아 잘못된 외형을 조용히 표시하지 않는다.
 */
export function portraitAssetForSkin(assetId: PortraitAssetId, equippedSkinId?: string | null): PuppetAsset {
  return (equippedSkinId && PORTRAIT_SKINS[assetId]?.[equippedSkinId]) || portraitAssetFor(assetId);
}

/** 전투용 적 SD 1~3번은 정보창용 전신 원화와 파일을 섞지 않는다. */
export const ENEMY_SD_ASSETS: readonly [PuppetAsset, PuppetAsset, PuppetAsset] = ([1, 2, 3] as const).map((number) => ({
  url: `${base}puppets/enemySD_${String(number).padStart(3, "0")}.zip`,
  imageWidth: 1254,
  imageHeight: 1254,
  content: { left: 352, top: 155, right: 993, bottom: 1082 },
})) as unknown as readonly [PuppetAsset, PuppetAsset, PuppetAsset];

/** 코마 전신 원화와 짝을 이루는 4번째 적 전투 SD. */
export const EXPLORER_SD_ASSET: PuppetAsset = {
  url: `${base}puppets/enemySD_004.zip`,
  imageWidth: 1254,
  imageHeight: 1254,
  content: { left: 290, top: 88, right: 1031, bottom: 1197 },
};

/** 폰토스 전투 SD. 정사각 원본에서 alpha > 16인 실제 실루엣만 바닥 배치에 사용한다. */
export const PONTOS_SD_ASSET: PuppetAsset = {
  url: `${base}puppets/enemySD_Pontos.zip`,
  ...PONTOS_SD_METADATA,
};

/** 1번 SD: 토리카. 실제 투명 영역을 제외한 범위로 발 위치와 크기를 잡는다. */
export const TORIKA_SD_ASSET: PuppetAsset = {
  url: `${base}puppets/charSD_001.zip`,
  imageWidth: 1254,
  imageHeight: 1254,
  content: { left: 245, top: 120, right: 1010, bottom: 1135 },
};

/** 토리카 skin001 SD: 실측 발끝과 관절 좌표를 사용하는 전투용 묶음이다. */
export const TORIKA_SKIN_001_SD_ASSET: PuppetAsset = {
  url: `${base}puppets/charSD_001_skin001.zip`,
  ...TORIKA_SKIN_001_SD_METADATA,
};

/** 2번 SD: 렉시아. */
export const LEXIA_SD_ASSET: PuppetAsset = {
  url: `${base}puppets/charSD_002.zip`,
  imageWidth: 1254,
  imageHeight: 1254,
  content: { left: 185, top: 105, right: 1080, bottom: 1140 },
};

/** 3번 SD: 스피나. 알파가 있는 실제 그림 영역으로 발끝을 잡아 투명 여백만큼 뜨지 않게 한다. */
export const SEIRA_SD_ASSET: PuppetAsset = {
  url: `${base}puppets/charSD_003.zip`,
  imageWidth: 1122,
  imageHeight: 1402,
  // 원본 PNG에서 alpha > 16인 경계다. 특히 아래 74px은 투명하므로 이미지 끝을 바닥에 맞추면 발이 뜬다.
  content: { left: 218, top: 112, right: 987, bottom: 1328 },
};

/** 4번 SD: 루카. 전용 SD의 1254 정사각 캔버스와 가시 영역을 사용한다. */
export const LUKA_SD_ASSET: PuppetAsset = {
  url: `${base}puppets/charSD_004.zip`,
  imageWidth: 1254,
  imageHeight: 1254,
  // 투명 여백을 제외하고 후드 끝부터 발끝까지를 잡아 다른 SD와 같은 바닥선에 세운다.
  content: { left: 202, top: 76, right: 1098, bottom: 1197 },
};

/** 5번 SD: 도디. */
export const DODI_SD_ASSET: PuppetAsset = {
  url: `${base}puppets/charSD_005.zip`,
  ...DODI_SD_METADATA,
};

/** 6번 SD: 메테. */
export const METTE_SD_ASSET: PuppetAsset = {
  url: `${base}puppets/charSD_006.zip`,
  ...METTE_SD_METADATA,
};

/** 7번 SD: 스테라. */
export const STELLA_SD_ASSET: PuppetAsset = {
  url: `${base}puppets/charSD_007.zip`,
  imageWidth: 1254,
  imageHeight: 1254,
  content: { left: 49, top: 83, right: 1175, bottom: 1179 },
};

/** 10번 SD: 파치. */
export const PACHI_SD_ASSET: PuppetAsset = {
  url: `${base}puppets/charSD_010.zip`,
  ...PACHI_SD_METADATA,
};

/** 11번 SD: 마키. */
export const MAKI_SD_ASSET: PuppetAsset = {
  url: `${base}puppets/charSD_011.zip`,
  ...MAKI_SD_METADATA,
};

/** 12번 SD: 케리스. */
export const KERIS_SD_ASSET: PuppetAsset = {
  url: `${base}puppets/charSD_012.zip`,
  ...KERIS_SD_METADATA,
};

/** 13번 SD: 델로피. */
export const DELOPI_SD_ASSET: PuppetAsset = {
  url: `${base}puppets/charSD_013.zip`,
  ...DELOPI_SD_METADATA,
};

/** 14번 SD: 노도니아. */
export const NODONIA_SD_ASSET: PuppetAsset = {
  url: `${base}puppets/charSD_014.zip`,
  ...NODONIA_SD_METADATA,
};

/** 15번 SD: 엘라. */
export const ELLA_SD_ASSET: PuppetAsset = {
  url: `${base}puppets/charSD_015.zip`,
  ...ELLA_SD_METADATA,
};

/** 9번 SD: 메론. */
export const MERON_SD_ASSET: PuppetAsset = {
  url: `${base}puppets/charSD_009.zip`,
  ...MERON_SD_METADATA,
};

/** 16번 SD: 데이. */
export const DEINA_SD_ASSET: PuppetAsset = {
  url: `${base}puppets/charSD_016.zip`,
  ...DEINA_SD_METADATA,
};

/** 21번 SD: 파루아. */
export const PARUA_SD_ASSET: PuppetAsset = {
  url: `${base}puppets/charSD_021.zip`,
  ...PARUA_SD_METADATA,
};

/** 17번 SD: 매디. */
export const MADDY_SD_ASSET: PuppetAsset = {
  url: `${base}puppets/charSD_017.zip`,
  ...MADDY_SD_METADATA,
};

/** 8번 SD: 티아. */
export const TIA_SD_ASSET: PuppetAsset = {
  url: `${base}puppets/charSD_008.zip`,
  ...TIA_SD_METADATA,
};

/** 20번 기본 SD는 디안, `_black`은 쿠로, `_white`는 시로라는 이름 대응을 보존한다. */
export const DIAN_SD_ASSET: PuppetAsset = { url: `${base}puppets/charSD_020.zip`, ...DIAN_SD_METADATA };
export const KURO_SD_ASSET: PuppetAsset = { url: `${base}puppets/charSD_020_black.zip`, ...KURO_SD_METADATA };
export const SHIRO_SD_ASSET: PuppetAsset = { url: `${base}puppets/charSD_020_white.zip`, ...SHIRO_SD_METADATA };

/** 소환 정의의 정적 키를 실제 SD에 연결하며 수집 가능한 렐릭 표에는 섞지 않는다. */
export const SUMMON_SD_ASSETS: Readonly<Record<string, PuppetAsset>> = {
  charSD_020_black: KURO_SD_ASSET,
  charSD_020_white: SHIRO_SD_ASSET,
};

/**
 * 아군 SD의 유일한 표.
 *
 * 전투와 비전투(원정·편성·결과 MVP)가 **같은 표 하나**를 읽는다. 예전에는 두 함수가 저마다
 * `if` 사슬을 갖고 있어, 새 개체를 한쪽에만 적으면 그 화면에서만 조용히 토리카 SD로 되돌아갔다
 * — 메론이 v0.52.3까지 원정과 승리 MVP에서 그랬다. 표가 하나면 빠뜨릴 자리가 없다.
 */
export const ALLY_SD_ASSETS: Readonly<Record<string, PuppetAsset>> = {
  anky: TORIKA_SD_ASSET,
  rex: LEXIA_SD_ASSET,
  spino: SEIRA_SD_ASSET,
  luka: LUKA_SD_ASSET,
  dodo: DODI_SD_ASSET,
  mette: METTE_SD_ASSET,
  tia: TIA_SD_ASSET,
  stella: STELLA_SD_ASSET,
  meron: MERON_SD_ASSET,
  pachi: PACHI_SD_ASSET,
  maki: MAKI_SD_ASSET,
  keris: KERIS_SD_ASSET,
  delopi: DELOPI_SD_ASSET,
  nodonia: NODONIA_SD_ASSET,
  ella: ELLA_SD_ASSET,
  deina: DEINA_SD_ASSET,
  maddy: MADDY_SD_ASSET,
  parua: PARUA_SD_ASSET,
  dian: DIAN_SD_ASSET,
};

/**
 * 적 SD는 아군과 번호 묶음이 달라 따로 두고, 최종층 보스만 전용 묶음을 쓴다.
 * 캐릭터 영구 ID는 이름 기준으로 바꾸되 이 값은 기존 enemySD zip의 로더 위치를 가리키므로
 * 에셋 배열 순서와 실제 파일 경로는 바꾸지 않는다.
 */
export const ENEMY_SD_ASSETS_BY_ID: Readonly<Record<string, PuppetAsset>> = {
  [ENEMY_SD_ASSET_IDS[0]]: PONTOS_SD_ASSET,
  [ENEMY_SD_ASSET_IDS[1]]: ENEMY_SD_ASSETS[0],
  [ENEMY_SD_ASSET_IDS[2]]: ENEMY_SD_ASSETS[1],
  [ENEMY_SD_ASSET_IDS[3]]: ENEMY_SD_ASSETS[2],
  [ENEMY_SD_ASSET_IDS[4]]: EXPLORER_SD_ASSET,
};

/** SD 스킨도 렐릭 ID 아래에만 등록해 다른 렐릭으로 폴백할 수 없게 한다. */
export const ALLY_SD_SKINS: Readonly<Record<string, Readonly<Record<string, PuppetAsset>>>> = {
  anky: { "torika-skin-001": TORIKA_SKIN_001_SD_ASSET },
};

/** 비전투 화면의 아군 SD 선택. 적 ID는 받지 않는다. */
export function sdAssetFor(relicId: string): PuppetAsset {
  // 캐릭터 ID만 받는 기존 계약은 유지한다. 미등록 구형 렐릭의 역사적 토리카 폴백도 바꾸지 않는다.
  return ALLY_SD_ASSETS[relicId] ?? TORIKA_SD_ASSET;
}

/**
 * 장착 SD 스킨을 먼저 고르고, 없거나 알 수 없으면 그 렐릭의 기본 SD만 고른다.
 * 스킨 resolver에서는 전역 토리카 폴백을 금지하므로 알 수 없는 렐릭 ID는 `undefined`다.
 */
export function sdAssetForSkin(relicId: string, equippedSkinId?: string | null): PuppetAsset | undefined {
  return (equippedSkinId && ALLY_SD_SKINS[relicId]?.[equippedSkinId]) || ALLY_SD_ASSETS[relicId];
}

/** 전투는 아군 표에 적 묶음을 얹어 같은 경로로 찾는다. */
export function battleAssetFor(relicId: string): PuppetAsset {
  return ENEMY_SD_ASSETS_BY_ID[relicId] ?? sdAssetFor(relicId);
}

/**
 * 전장에서 쓰는 동작. 묶음마다 가진 동작이 달라서 쓸 이름을 순서대로 적어 둔다 —
 * 앞에서부터 있는 것을 쓰고, 하나도 없으면 그냥 넘어간다.
 */
/** 동작 하나의 재생 규칙. 우선순위가 높을수록 다른 동작에 끊기지 않는다. */
export interface MotionConfig {
  names: readonly string[];
  returnsToIdle?: boolean;
  priority: number;
  /** 내보낸 속도를 덮어쓴다. 크면 빨리 지나간다. */
  speed?: number;
  /** 움직임 크기 배율. 작으면 얕게 꺾인다. */
  strength?: number;
}

export const MOTION = {
  idle: { names: ["idle"], priority: 0 },
  /**
   * 피격. 얕고 빠르게 지나간다.
   *
   * 우선순위가 공격보다 낮아서 휘두르는 중에는 끼어들지 않는다. 맞을 때마다 크게 꺾이면
   * 주고받는 동안 캐릭터가 계속 튀어 보이고, 무엇보다 자기 공격 모션이 매번 잘린다.
   */
  hit: { names: ["hit", "idle"], returnsToIdle: true, priority: 1, speed: 2.2, strength: 0.4 },
  /**
   * 기절 유지 자세. 최신 전투 SD는 `stun`을 사용하고, 아직 동작이 없는 구형 아군 SD는 피격
   * 자세에 멈춰 행동 불능을 표현한다. 상태 종료는 BattleScene이 `idle`을 명시해 해제한다.
   */
  stun: { names: ["stun", "hit", "idle"], priority: 4 },
  /** 포효. 지금은 궁극기가 쓰지 않지만 동작 자체는 묶음에 남아 있어 연출용으로 부를 수 있다. */
  roar: { names: ["roar", "shout", "attack", "idle"], returnsToIdle: true, priority: 3 },
  /** 공격 동작이 따로 없어 포효로 대신한다. 재생 중에는 어떤 동작도 이걸 끊지 못한다. */
  attack: { names: ["attack", "slam", "roar", "idle"], returnsToIdle: true, priority: 2 },
  /** 이동 클립이 없는 SD는 idle을 사용하되 이동 상태도 공용 모션 API로 전환한다. */
  run: { names: ["run", "idle"], priority: 1 },
  /** 회수 직전에는 down, 구형 묶음에서는 stun/hit 순으로 쓰러진 자세를 고른다. */
  down: { names: ["down", "stun", "hit", "idle"], priority: 5 },
} as const satisfies Record<string, MotionConfig>;

export type MotionName = keyof typeof MOTION;

/** 개체별 최신 동작 번호. 오래된 복귀 타이머가 새 동작을 idle로 끊지 못하게 한다. */
const motionGeneration = new WeakMap<PuppetCreature, number>();
/** 지금 재생 중인 일회성 동작의 우선순위와 끝나는 시각. 낮은 동작이 끼어들지 못하게 막는다. */
const motionHold = new WeakMap<PuppetCreature, { priority: number; until: number }>();
/** 이전 일회성 동작의 idle 복귀 예약. 새 동작이 오면 즉시 해제한다. */
const motionTimers = new WeakMap<PuppetCreature, Phaser.Time.TimerEvent>();
/** 강제 종료도 대기자를 풀어 씬의 비동기 연출이 고아 Promise로 남지 않게 한다. */
const motionCompletions = new WeakMap<PuppetCreature, () => void>();

/** 묶음의 정적 프로젝트와 텍스처는 파일당 한 번만 읽어 재사용한다. */
const loaded = new Map<string, Promise<Puppet>>();

async function loadPuppet(asset: PuppetAsset): Promise<Puppet> {
  return loadSharedPromise(loaded, asset.url, () => {
    // ZIP의 원본 격자와 모든 deform 가중치를 그대로 캐시한다. 인게임용 재샘플링은 하지 않는다.
    // 렌더러 모듈은 실제 Puppet 로딩 시점에만 평가해 순수 resolver 단위 테스트가 DOM을 요구하지 않게 한다.
    // 일시적인 네트워크·ZIP 파싱 실패는 헬퍼가 동일 Promise인지 확인해 제거하므로 다음 호출이 재시도한다.
    return import("puppetforge/phaser").then(({ Puppet }) => Puppet.load(asset.url));
  });
}

/** 사전 로딩 한 건이 실패했을 때 호출자에게 URL과 원래 오류를 함께 전달하는 진단 정보다. */
export interface PuppetAssetPreloadFailure {
  readonly assetUrl: string;
  readonly error: unknown;
  /** 실패한 캐시는 제거되므로 이후 화면은 필요할 때 다시 읽는 폴백을 시도할 수 있다. */
  readonly fallbackAvailable: boolean;
}

/** 모든 등록 요청이 settle된 뒤 반환되는 Puppet 사전 로딩 결과다. */
export interface PuppetAssetPreloadResult {
  readonly failures: readonly PuppetAssetPreloadFailure[];
  /** 일부 원화가 없어도 호출자가 게임 진입을 계속할 수 있는지 명시한다. */
  readonly fallbackAvailable: boolean;
}

/** 테스트 주입과 네트워크 정책 조정을 위한 제한된 사전 로딩 옵션이다. */
export interface PuppetAssetPreloadOptions {
  readonly maxRetries?: number;
  readonly attemptTimeoutMs?: number;
  readonly loader?: (asset: PuppetAsset) => Promise<unknown>;
}

/** 네트워크 계층에서 흔히 일시적으로 발생하는 오류만 재시도 대상으로 분류한다. */
function isTransientLoadError(error: unknown): boolean {
  if (error instanceof TypeError) return true;
  const status = typeof error === "object" && error !== null && "status" in error
    ? Number((error as { status?: unknown }).status)
    : Number.NaN;
  return status === 408 || status === 429 || status >= 500;
}

/** 응답하지 않는 한 요청이 전체 타이틀 로딩을 영원히 붙들지 않도록 시한을 둔다. */
function withTimeout<T>(pending: Promise<T>, timeoutMs: number, assetUrl: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = globalThis.setTimeout(
      () => reject(new TypeError(`Puppet asset load timed out after ${timeoutMs}ms: ${assetUrl}`)),
      timeoutMs,
    );
    void pending.then(
      (value) => {
        globalThis.clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        globalThis.clearTimeout(timer);
        reject(error);
      },
    );
  });
}

/** 한 에셋을 유한 횟수만 재시도하고 마지막 오류를 allSettled 결과에 보존한다. */
async function loadPuppetWithRetry(asset: PuppetAsset, options: PuppetAssetPreloadOptions): Promise<void> {
  const maxRetries = Math.max(0, options.maxRetries ?? 1);
  const timeoutMs = Math.max(1, options.attemptTimeoutMs ?? 30_000);
  const loader = options.loader ?? loadPuppet;
  for (let attempt = 0; ; attempt++) {
    try {
      await withTimeout(Promise.resolve(loader(asset)), timeoutMs, asset.url);
      return;
    } catch (error) {
      if (attempt >= maxRetries || !isTransientLoadError(error)) throw error;
    }
  }
}

/** 중첩된 스킨 표를 등록된 Puppet 목록으로 펼친다. */
function skinAssets(
  skins: Readonly<Record<string, Readonly<Record<string, PuppetAsset>> | undefined>>,
): PuppetAsset[] {
  return Object.values(skins).flatMap((assets) => Object.values(assets ?? {}));
}

/** URL이 같은 등록 항목은 최초 항목만 남겨 다운로드와 ZIP 파싱을 한 번으로 제한한다. */
function uniqueAssets(assets: readonly PuppetAsset[], seen = new Set<string>()): PuppetAsset[] {
  return assets.filter((asset) => {
    if (seen.has(asset.url)) return false;
    seen.add(asset.url);
    return true;
  });
}

/**
 * 타이틀 로딩이 진행 칸을 나눠 보여줄 수 있도록 전체 등록 표를 전신과 SD 두 무리로 나눈다.
 * 정보창은 큰 관절 원화를 세우는 동시에 능력치/편성 영역에서 SD 미리보기를 사용하므로 두 무리가
 * 모두 필요하다. 새 캐릭터와 스킨은 resolver 표에 등록하는 즉시 이 목록에도 자동 반영되어야 첫
 * 정보창이나 전투 프레임에서 ZIP 다운로드·파싱이 뒤늦게 발생하지 않는다.
 */
const preloadUrls = new Set<string>();
export const PUPPET_PRELOAD_GROUPS: ReadonlyArray<readonly PuppetAsset[]> = [
  // 기본 전신과 장착 스킨을 모두 포함하며, 궁극기 컷인도 이 전신 캐시를 함께 재사용한다.
  uniqueAssets([...Object.values(PORTRAIT_ASSETS), ...skinAssets(PORTRAIT_SKINS)], preloadUrls),
  // 아군·적 SD와 SD 스킨을 모두 포함하고 앞 그룹과 URL이 같아도 다시 넣지 않는다.
  uniqueAssets([...Object.values(ALLY_SD_ASSETS), ...Object.values(SUMMON_SD_ASSETS), ...Object.values(ENEMY_SD_ASSETS_BY_ID), ...skinAssets(ALLY_SD_SKINS)], preloadUrls),
];

/**
 * 게임 플레이 전에 공용 묶음을 한 번 해석해 둔다.
 * ZIP 다운로드와 파싱이 첫 idle 프레임 도중 일어나면 재생 문제처럼 보이는 긴 프레임이 생기므로
 * 타이틀 로딩 화면에서 비용을 지불하고, 전투와 팝업에서는 캐시된 Puppet만 복제한다.
 *
 * 무리를 주면 그 무리만 읽는다. 이미 읽은 묶음은 캐시라 두 번 내려받지 않는다.
 */
export async function preloadPuppetAssets(
  group: readonly PuppetAsset[] = PUPPET_PRELOAD_GROUPS.flat(),
  options: PuppetAssetPreloadOptions = {},
): Promise<PuppetAssetPreloadResult> {
  // allSettled가 빠른 실패 뒤에도 나머지 ZIP 다운로드·파싱이 끝날 때까지 단계 반환을 막는다.
  const settled = await Promise.allSettled(group.map((asset) => loadPuppetWithRetry(asset, options)));
  const failures = settled.flatMap<PuppetAssetPreloadFailure>((result, index) =>
    result.status === "rejected"
      ? [{ assetUrl: group[index].url, error: result.reason, fallbackAvailable: true }]
      : [],
  );
  return { failures, fallbackAvailable: failures.every((failure) => failure.fallbackAvailable) };
}

/**
 * 등록된 SD를 실제 Phaser texture cache까지 올려 전투 진입 프레임의 GPU 업로드를 미리 끝낸다.
 *
 * `preloadPuppetAssets`의 소유권은 네트워크 다운로드와 ZIP/프로젝트 파싱까지다. 반대로 texture는
 * Phaser renderer와 Scene이 있어야 만들 수 있으므로, 전투 진입을 조율하는 Scene이 선택적으로
 * 이 함수를 호출한다. 두 단계를 합치지 않아 타이틀의 Phaser 비의존 프리로드 계약을 보존한다.
 */
export async function warmPuppetTextures(
  scene: Phaser.Scene,
  group: readonly PuppetAsset[] = PUPPET_PRELOAD_GROUPS[1],
): Promise<void> {
  // 같은 URL은 하나만 준비해 스킨 표의 별칭이 texture 업로드를 중복 요청하지 않게 한다.
  const assets = uniqueAssets(group);
  const { ensureTexture } = await import("./IndexedPuppetCreature");
  await Promise.all(assets.map(async (asset) => ensureTexture(scene, await loadPuppet(asset))));
}

export interface SpawnOptions {
  /** 발끝을 놓을 바닥 지점. `focus`를 주면 쓰이지 않는다. */
  x?: number;
  groundY?: number;
  /**
   * 코어(`중심1`)나 머리(`머리1`) 관절을 화면의 한 점에 맞추는 배치.
   * 화면 밖으로 잘려도 되는 큰 연출은 발끝 대신 이쪽을 쓴다.
   */
  focus?: { anchor: AnchorKind; x: number; y: number };
  /** 바닥 높이는 유지하면서 지정 관절의 가로 위치만 맞춘다. 로비 전신처럼 발을 세운 화면에 쓴다. */
  focusX?: { anchor: AnchorKind; x: number };
  /** 그림(투명 여백 제외)의 화면상 높이. 이 값에 맞춰 배율이 정해진다. */
  height: number;
  tint?: number;
  depth?: number;
  flipX?: boolean;
}

export interface Placement {
  /** Mesh에 그대로 넣을 좌표. 이미지 한가운데 기준이다. */
  x: number;
  y: number;
  scale: number;
}

/**
 * 발끝이 `groundY`에, 그림의 가로 중앙이 `x`에 오는 Mesh 좌표를 구한다.
 *
 * PuppetCreature는 Phaser Mesh라 원점이 **이미지 한가운데**다. 원하는 위치를 그대로
 * 넣으면 안 되고, 그림이 이미지 안에서 치우친 만큼 되돌려 놓아야 한다.
 */
export function computePlacement(
  asset: PuppetAsset,
  options: SpawnOptions & { x: number; groundY: number },
): Placement {
  const contentHeight = asset.content.bottom - asset.content.top;
  const scale = options.height / contentHeight;

  const contentCenterX = (asset.content.left + asset.content.right) / 2;
  // 이미지 중앙에서 그림 중앙까지의 어긋남과, 중앙에서 발끝까지의 거리를 배율만큼 되돌린다.
  // 좌우를 뒤집으면 가로 어긋남의 방향도 함께 뒤집힌다.
  const offsetX = (contentCenterX - asset.imageWidth / 2) * scale * (options.flipX ? -1 : 1);
  const offsetY = (asset.content.bottom - asset.imageHeight / 2) * scale;

  return { x: options.x - offsetX, y: options.groundY - offsetY, scale };
}

/** 묶음의 관절에서 해석한 코어·머리 기준점. 같은 파일은 한 번만 계산한다. */
const anchorCache = new Map<string, Record<AnchorKind, AnchorPoint>>();

/**
 * 묶음의 `중심1`·`머리1` 위치를 텍스처 좌표로 돌려준다.
 * ZIP은 이미 캐시되어 있으므로 두 번째 호출부터는 파싱 비용이 없다.
 */
export async function loadPuppetAnchors(asset: PuppetAsset): Promise<Record<AnchorKind, AnchorPoint>> {
  const cached = anchorCache.get(asset.url);
  if (cached) return cached;
  const template = await loadPuppet(asset);
  // 에셋 메타데이터와 관절은 모두 원본 WebP 픽셀 좌표계이므로 별도 개체별 배율 없이 해석한다.
  const anchors = resolveAnchors(template.project.bones, asset);
  anchorCache.set(asset.url, anchors);
  return anchors;
}

/** 카드 섬네일이 쓰는 정지 이미지. Mesh를 만들지 않고 원본 텍스처만 Phaser에 올린다. */
export interface PortraitTexture {
  key: string;
  anchors: Record<AnchorKind, AnchorPoint>;
}

/**
 * 섬네일용 텍스처 키와 기준점을 준비한다.
 *
 * 도감·편성 그리드처럼 여러 장이 동시에 필요한 곳에서 Mesh를 30개 만들면 GPU draw call이
 * 그만큼 늘어난다. 카드에는 같은 텍스처를 공유하는 정지 이미지만 쓴다.
 */
export async function loadPortraitTexture(scene: Phaser.Scene, asset: PuppetAsset): Promise<PortraitTexture> {
  const template = await loadPuppet(asset);
  // Phaser 구현은 실제 생성 시점에만 읽어 resolver/프리로드 표의 정적 테스트가 DOM을 요구하지 않게 한다.
  const { ensureTexture } = await import("./IndexedPuppetCreature");
  const [key, anchors] = await Promise.all([ensureTexture(scene, template), loadPuppetAnchors(asset)]);
  return { key, anchors };
}

/** 카드 한 장의 잘라내기 상자를 묶음 기준점으로 계산한다. */
export function headCardFrame(asset: PuppetAsset, anchors: Record<AnchorKind, AnchorPoint>, options: CardFrameOptions): CardFrame {
  return computeHeadCardFrame(asset, anchors.head, options);
}

/** indexed renderer는 단일 GPU uniform으로 색 필터를 적용한다. */
export function tintPuppet(creature: PuppetCreature, color: number): void {
  creature.setTint(color);
}

/**
 * UI 수명주기에서 PuppetForge 계산을 명시적으로 멈춘다.
 * Phaser의 `visible=false`는 그리기만 생략하고 Scene UPDATE listener는 그대로 호출하기 때문에
 * 가려진 정보창의 전신과 SD에는 이 API도 함께 적용해야 한다.
 */
export function pauseMotion(creature: PuppetCreature | undefined): void {
  creature?.pauseMotion();
}

/**
 * 건너뛴 시간을 보충하지 않고 현재 프레임부터 다시 적분하며, 마지막 일회성 자세가 남지 않도록
 * idle을 처음부터 명시적으로 재생한다. PuppetForge의 `update(delta)` 계약은 전달받은 delta만
 * 진행하므로 pause 중 delta는 runtime 내부에 누적되지 않는다.
 */
export function resumeMotion(creature: PuppetCreature | undefined): void {
  if (!creature?.active) return;
  creature.play("idle");
  creature.resumeMotion();
}

/**
 * 요청한 방식(발끝 · 기준 관절)에 맞는 최종 좌표를 고른다.
 *
 * 관절 해석은 실제로 필요할 때만 한다. 실시간 전투는 매 프레임 여섯 명을 다시 놓기 때문에
 * 발끝 배치에서까지 관절 목록을 훑으면 그만큼이 그대로 프레임 비용이 된다.
 */
function resolvePlacement(
  asset: PuppetAsset,
  anchorsOf: () => Record<AnchorKind, AnchorPoint>,
  options: SpawnOptions,
): Placement {
  if (options.focus) {
    const focus: FocusOptions = {
      x: options.focus.x,
      y: options.focus.y,
      height: options.height,
      flipX: options.flipX,
    };
    return computeAnchoredPlacement(asset, anchorsOf()[options.focus.anchor], focus);
  }
  const grounded = computePlacement(asset, {
    ...options,
    x: options.x ?? 0,
    groundY: options.groundY ?? 0,
  });
  if (!options.focusX) return grounded;

  // 발끝의 세로 배치는 그대로 두고, 꼬리·날개 면적과 무관하게 중심 관절만 목표 x에 맞춘다.
  const anchor = anchorsOf()[options.focusX.anchor];
  const signedOffsetX = (anchor.x - asset.imageWidth / 2) * grounded.scale * (options.flipX ? -1 : 1);
  return { ...grounded, x: options.focusX.x - signedOffsetX };
}

/**
 * 묶음을 씬에 세운다. 기본은 발끝과 그림 중앙을 맞추고, `focusX`는 발을 둔 채 관절만 가로 정렬한다.
 * `focus`를 주면 그 대신 지정한 관절이 화면의 한 점에 오도록 놓는다.
 */
export async function spawnPuppet(
  scene: Phaser.Scene,
  asset: PuppetAsset,
  options: SpawnOptions,
): Promise<PuppetCreature> {
  const template = await loadPuppet(asset);
  // Puppet은 재생 시각·속도·강도를 내부에 보관한다. 같은 인스턴스를 여러 Mesh가 공유하면 한
  // 캐릭터의 play가 다른 캐릭터를 덮으므로, 정적 프로젝트만 공유하고 재생기는 개체마다 만든다.
  const { Puppet } = await import("puppetforge/phaser");
  const puppet = Puppet.fromProject(template.project, template.texture);
  // 렌더러 클래스도 실제 Puppet 생성 직전에만 평가해 에셋 레지스트리는 Node에서도 읽을 수 있게 한다.
  const { IndexedPuppetCreature } = await import("./IndexedPuppetCreature");
  const creature = await IndexedPuppetCreature.fromPuppet(scene, puppet);

  placePuppet(creature, asset, options);
  if (options.tint !== undefined) tintPuppet(creature, options.tint);
  if (options.depth !== undefined) creature.setDepth(options.depth);
  if (options.flipX) creature.setFlipX(true);
  creature.play("idle");
  return creature;
}

/** 이미 세운 개체의 자리와 크기를 다시 잡는다. */
export function placePuppet(
  creature: PuppetCreature,
  asset: PuppetAsset,
  options: SpawnOptions,
): void {
  const { x, y, scale } = resolvePlacement(asset, () => resolveAnchors(creature.core.project.bones, asset), options);
  creature.setScale(scale);
  creature.setPosition(x, y);
  // 매 프레임 다시 놓는 전투에서는 여기가 방향 전환도 함께 맡는다. 요청이 없으면 지금 방향을 지킨다.
  creature.setFlipX(options.flipX ?? creature.flipX);
}

/**
 * 있는 동작 중 첫 번째를 재생한다. 한 번만 재생하는 동작은 끝날 즈음 idle로 돌려놓는다
 * (그냥 두면 마지막 자세로 굳는다).
 */
/** 실제로 선택된 원본 이름과 재생 시간을 노출해 씬이 추측 타이머 없이 다음 연출을 이을 수 있다. */
export interface MotionPlayback {
  readonly playedName: string | null;
  readonly durationMs: number;
  /** idle 복귀까지 기다린다. 씬 종료로 타이머가 폐기된 경우에도 즉시 풀린다. */
  readonly completed: Promise<void>;
}

export function playMotion(
  scene: Phaser.Scene,
  creature: PuppetCreature,
  motion: MotionName,
  speedMultiplier = 1,
): MotionPlayback {
  const config: MotionConfig = MOTION[motion];
  // 더 중요한 동작이 아직 재생 중이면 그대로 둔다. 공격은 끝까지 휘두르고, 피격이 자른다.
  const held = motionHold.get(creature);
  if (held && held.until > scene.time.now && held.priority >= config.priority) {
    return { playedName: null, durationMs: 0, completed: Promise.resolve() };
  }

  // 궁극기처럼 후속 진행을 재촉해야 하는 호출만 원본 동작 속도를 높이고 일반 공격은 그대로 둔다.
  const configuredSpeed = config.speed ?? 1;
  const options = { speed: configuredSpeed * Math.max(speedMultiplier, 0.01), strength: config.strength };
  const playedName = config.names.find((name) => creature.play(name, options));
  if (!playedName) return { playedName: null, durationMs: 0, completed: Promise.resolve() };

  const generation = (motionGeneration.get(creature) ?? 0) + 1;
  motionGeneration.set(creature, generation);
  motionTimers.get(creature)?.remove(false);
  motionCompletions.get(creature)?.();
  motionCompletions.delete(creature);
  motionTimers.delete(creature);
  motionHold.delete(creature);

  if (!config.returnsToIdle || playedName === "idle") {
    return { playedName, durationMs: 0, completed: Promise.resolve() };
  }

  // PuppetForge의 내보내기 speed/strength/secondary는 play()가 그대로 적용한다. 복귀 시각도
  // 고정 숫자가 아니라 내보낸 duration과 실제 재생 속도로 계산해 동작이 중간에 잘리지 않게 한다.
  const exportedMotion = creature.core.project.animations[playedName];
  // 완료 Promise도 실제 전달한 배율을 반영해야 빠른 궁극기 동작 뒤 시퀀스가 바로 풀린다.
  const speed = Math.max(((config.speed ?? exportedMotion.speed) ?? 1) * Math.max(speedMultiplier, 0.01), 0.01);
  const holdMs = (exportedMotion.duration / speed) * 1000;
  motionHold.set(creature, { priority: config.priority, until: scene.time.now + holdMs });
  let resolveCompletion!: () => void;
  const completed = new Promise<void>((resolve) => { resolveCompletion = resolve; });
  const finish = () => {
    // 공격 직후 피격처럼 동작이 겹쳐도 가장 최근 동작의 유지 시간은 온전히 보장한다.
    if (motionGeneration.get(creature) !== generation) { resolveCompletion(); return; }
    motionTimers.delete(creature);
    motionCompletions.delete(creature);
    motionHold.delete(creature);
    if (creature.active) creature.play("idle");
    resolveCompletion();
  };
  const timer = scene.time.delayedCall(holdMs, finish);
  motionTimers.set(creature, timer);
  motionCompletions.set(creature, resolveCompletion);
  // shutdown은 Phaser 타이머를 조용히 폐기하므로 Promise도 함께 해제해 비동기 시퀀스를 남기지 않는다.
  scene.events.once("shutdown", resolveCompletion);
  completed.finally(() => scene.events.off("shutdown", resolveCompletion));
  return { playedName, durationMs: holdMs, completed };
}

/** 종료 UI가 공격 자세를 기다리지 않도록 현재 일회성 동작만 idle로 정리한다. */
export function cancelMotion(creature: PuppetCreature): void {
  motionTimers.get(creature)?.remove(false);
  motionTimers.delete(creature);
  motionHold.delete(creature);
  motionGeneration.set(creature, (motionGeneration.get(creature) ?? 0) + 1);
  motionCompletions.get(creature)?.();
  motionCompletions.delete(creature);
  if (creature.active) creature.play("idle");
}

/** 맞은 순간 붉게 물드는 시간(ms)과 색. 동작을 크게 흔들지 않아도 피격이 눈에 띄게 한다. */
const HIT_FLASH_MS = 120;
/**
 * 피격 섬광.
 *
 * 붉게 물들이되 **아주 옅게** 한다. 진하게 칠하면 난전에서 여섯이 번갈아 빨개져 화면이
 * 계속 깜빡이고, 정작 봐야 할 체력 바와 피해 숫자가 그 뒤로 밀린다.
 */
const HIT_FLASH_TINT = 0xffc9c0;
const flashTimers = new WeakMap<PuppetCreature, Phaser.Time.TimerEvent>();

/**
 * 피격 표시. 잠깐 붉게 덮었다가 원래 색으로 돌아온다.
 *
 * 연달아 맞아도 마지막 한 번만 색을 되돌리도록 이전 예약을 지운다. 그러지 않으면 먼저 걸린
 * 타이머가 아직 붉어야 할 캐릭터의 색을 지운다.
 */
export function flashHit(scene: Phaser.Scene, creature: PuppetCreature, baseTint = 0xffffff): void {
  flashTimers.get(creature)?.remove(false);
  tintPuppet(creature, HIT_FLASH_TINT);
  flashTimers.set(
    creature,
    scene.time.delayedCall(HIT_FLASH_MS, () => {
      flashTimers.delete(creature);
      if (creature.active) tintPuppet(creature, baseTint);
    }),
  );
}

/**
 * 지금 피격 섬광이 켜져 있는지.
 *
 * 폭주처럼 몸 색을 계속 바꾸는 표현이 섬광을 덮어쓰지 않도록 확인하는 경계다. 섬광이 도는
 * 동안 다른 색을 칠하면 맞은 티가 그 프레임에 사라진다.
 */
export function isHitFlashing(creature: PuppetCreature): boolean {
  return flashTimers.has(creature);
}

/** 전신 일러스트를 누르면 현재 동작을 새 hit 동작으로 교체한다. */
export function enableHitOnClick(scene: Phaser.Scene, creature: PuppetCreature): void {
  creature.setInteractive({ useHandCursor: true });
  creature.on("pointerup", () => playMotion(scene, creature, "hit"));
}
