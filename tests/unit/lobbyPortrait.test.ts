import { describe, expect, it } from "vitest";
import { RELICS } from "../../src/data/relics";
import type { PuppetAsset } from "../../src/puppets/assets";
import {
  DEINA_PORTRAIT_METADATA,
  DELOPI_PORTRAIT_METADATA,
  DODI_PORTRAIT_METADATA,
  ELLA_PORTRAIT_METADATA,
  LEXIA_PORTRAIT_METADATA,
  LUKA_PORTRAIT_METADATA,
  KERIS_PORTRAIT_METADATA,
  MADDY_PORTRAIT_METADATA,
  PARUA_PORTRAIT_METADATA,
  SHUTE_PORTRAIT_METADATA,
  MORPHE_PORTRAIT_METADATA,
  KENTO_PORTRAIT_METADATA,
  MOSANA_PORTRAIT_METADATA,
  ANKA_PORTRAIT_METADATA,
  IRNA_PORTRAIT_METADATA,
  ARK_PORTRAIT_METADATA,
  TERISA_PORTRAIT_METADATA,
  MAKI_PORTRAIT_METADATA,
  MERON_PORTRAIT_METADATA,
  NODONIA_PORTRAIT_METADATA,
  METTE_PORTRAIT_METADATA,
  PACHI_PORTRAIT_METADATA,
  SEIRA_PORTRAIT_METADATA,
  STELLA_PORTRAIT_METADATA,
  TIA_PORTRAIT_METADATA,
  TORIKA_PORTRAIT_METADATA,
  TORIKA_SKIN_001_PORTRAIT_METADATA,
} from "../../src/puppets/assetMetadata";
import { FACE_STANDARD, INFO_PORTRAIT_FOCUS, infoPortraitPlacement, LOBBY_PORTRAIT_SPOT, lobbyPortraitPlacement } from "../../src/ui/portraitPlacement";

/**
 * 로비에 선 애착 렐릭의 세로 비율 계약.
 *
 * 예전에는 상자 하나에 원화를 맞춰 넣었더니, 캔버스 여백과 등신이 원화마다 달라 1.08 m
 * 토리카가 1.76 m 메테보다 크게 섰다. 지금은 **관찰 프로필의 키**가 크기를 정한다.
 *
 * **발끝은 관절이 아니라 실측 alpha 경계(`content.bottom`)다.** 관절은 원화 밖에 박혀 있는
 * 것도 있어(발 관절이 그림보다 아래에 잡힌 묶음이 있었다) 바닥선의 기준으로 삼을 수 없다.
 * 배율을 재는 눈 관절은 그림 안에 있어야만 뜻이 서므로, 아래 "관절" 검사가 그것을 지킨다.
 *
 * 값은 눈대중이 아니라 실제 ZIP에서 잰다 — `눈1`·`눈2`·`중심1` 관절의 텍스처 좌표다.
 * 아트를 다시 구우면 같은 방법으로 다시 재서 이 표와 `lobbyZoom`을 함께 고친다.
 */
const JOINTS: Readonly<Record<string, { eyes: readonly [readonly [number, number], readonly [number, number]]; core: readonly [number, number] }>> = {
  torika: { eyes: [[554, 416], [638, 446]], core: [603, 711] },
  lexia: { eyes: [[582, 265], [643, 236]], core: [629, 396] },
  seira: { eyes: [[544, 239], [597, 208]], core: [495, 557] },
  luka: { eyes: [[832, 425], [960, 368]], core: [843, 639] },
  dodi: { eyes: [[528, 367], [632, 355]], core: [618, 489] },
  mette: { eyes: [[472, 277], [568, 242]], core: [514, 432] },
  stella: { eyes: [[510, 386], [591, 357]], core: [581, 475] },
  tia: { eyes: [[480, 317], [548, 265]], core: [548, 415] },
  meron: { eyes: [[439, 268], [507, 242]], core: [470, 369] },
  pachi: { eyes: [[420, 206], [480, 172]], core: [459, 292] },
  maki: { eyes: [[528, 327], [620, 306]], core: [599, 457] },
  keris: { eyes: [[490, 330], [569, 361]], core: [537, 454] },
  delopi: { eyes: [[496, 319], [556, 294]], core: [537, 394] },
  ella: { eyes: [[529, 280], [603, 262]], core: [589, 377] },
  nodonia: { eyes: [[467, 344], [515, 327]], core: [520, 420] },
  deina: { eyes: [[383, 254], [430, 216]], core: [441, 344] },
  maddy: { eyes: [[448, 244], [509, 218]], core: [507, 324] },
  parua: { eyes: [[536, 331], [615, 361]], core: [561, 468] },
  shute: { eyes: [[637, 315], [714, 269]], core: [728, 410] },
  terisa: { eyes: [[468, 172], [536, 145]], core: [509, 274] },
  morphe: { eyes: [[678, 388], [753, 369]], core: [732, 473] },
  kento: { eyes: [[543, 350], [630, 378]], core: [550, 466] },
  mosana: { eyes: [[381, 218], [423, 177]], core: [440, 298] },
  anka: { eyes: [[374, 220], [456, 201]], core: [426, 324] },
  irna: { eyes: [[567, 230], [623, 265]], core: [549, 332] },
  ark: { eyes: [[558, 306], [620, 339]], core: [577, 437] },
};

/** 눈 관절 두 개의 중간 높이. 배율은 이 점에서 발끝까지의 거리로 잰다. */
function eyeY(assetId: string): number {
  const [left, right] = JOINTS[assetId].eyes;
  return (left[1] + right[1]) / 2;
}

/** assets.ts는 Phaser를 들여오므로 node 환경에서는 메타데이터만 직접 묶어 읽는다. */
const PORTRAITS: Readonly<Record<string, Omit<PuppetAsset, "url">>> = {
  torika: TORIKA_PORTRAIT_METADATA,
  lexia: LEXIA_PORTRAIT_METADATA,
  seira: SEIRA_PORTRAIT_METADATA,
  luka: LUKA_PORTRAIT_METADATA,
  dodi: DODI_PORTRAIT_METADATA,
  mette: METTE_PORTRAIT_METADATA,
  stella: STELLA_PORTRAIT_METADATA,
  tia: TIA_PORTRAIT_METADATA,
  meron: MERON_PORTRAIT_METADATA,
  pachi: PACHI_PORTRAIT_METADATA,
  maki: MAKI_PORTRAIT_METADATA,
  keris: KERIS_PORTRAIT_METADATA,
  delopi: DELOPI_PORTRAIT_METADATA,
  ella: ELLA_PORTRAIT_METADATA,
  nodonia: NODONIA_PORTRAIT_METADATA,
  deina: DEINA_PORTRAIT_METADATA,
  maddy: MADDY_PORTRAIT_METADATA,
  parua: PARUA_PORTRAIT_METADATA,
  shute: SHUTE_PORTRAIT_METADATA,
  terisa: TERISA_PORTRAIT_METADATA,
  morphe: MORPHE_PORTRAIT_METADATA,
  kento: KENTO_PORTRAIT_METADATA,
  mosana: MOSANA_PORTRAIT_METADATA,
  anka: ANKA_PORTRAIT_METADATA,
  irna: IRNA_PORTRAIT_METADATA,
  ark: ARK_PORTRAIT_METADATA,
};

/** 로비에 설 수 있는 개체 = 플레이어가 애착으로 고를 수 있는 렐릭이다. */
const LOBBY_RELICS = RELICS.filter((relic) => relic.portraitAssetId in PORTRAITS && relic.observationProfile);

/** 메론(1.58 m)이 1740px로 서는 지금 크기에서 나온 값이다. 기준을 바꾸면 이 수만 고친다. */
const PIXELS_PER_METRE = 912;

function eyeToFootOnScreen(assetId: string): number {
  const asset = { url: "", ...PORTRAITS[assetId] } as PuppetAsset;
  const { height } = lobbyPortraitPlacement(asset);
  const scale = height / (asset.content.bottom - asset.content.top);
  return (asset.content.bottom - eyeY(assetId)) * scale;
}

describe("로비 전신의 세로 비율", () => {
  it("는 모든 개체가 관찰 프로필의 키에 비례해 선다", () => {
    for (const relic of LOBBY_RELICS) {
      // 왼쪽 끝을 끝까지 보여야 하는 원화(모르페의 드론)는 키 비례를 포기한다 — 아래 별도 검사.
      if (PORTRAITS[relic.portraitAssetId].lobbyFraming !== undefined) continue;
      const metres = Number.parseFloat(relic.observationProfile!.height);
      const expected = metres * PIXELS_PER_METRE;
      const actual = eyeToFootOnScreen(relic.portraitAssetId);
      // 배율은 소수 셋째 자리까지만 적으므로 0.5% 안쪽에서 맞으면 같은 값으로 본다.
      expect(Math.abs(actual - expected) / expected, `${relic.name} ${metres}m`).toBeLessThan(0.005);
    }
  });

  it("는 메론을 기준으로 삼아 보정 없이 세운다", () => {
    expect(MERON_PORTRAIT_METADATA.lobbyZoom).toBeUndefined();
    expect(lobbyPortraitPlacement({ url: "", ...MERON_PORTRAIT_METADATA }).height).toBe(LOBBY_PORTRAIT_SPOT.height);
  });

  it("는 가장 큰 개체도 화면 위로 넘기지 않는다", () => {
    // 그림 높이는 키만이 아니라 눈 위의 머리·장식 몫까지 더한 값이라, 가장 큰 개체가 바닥선
    // 위로 화면을 넘지 않는지 따로 확인한다. 넘으면 정수리가 상단 줄 밖에서 잘린다.
    for (const relic of LOBBY_RELICS) {
      const { height, groundY } = lobbyPortraitPlacement({ url: "", ...PORTRAITS[relic.portraitAssetId] });
      expect(groundY - height, relic.name).toBeGreaterThanOrEqual(0);
    }
  });

  it("는 그림 안에 있는 관절로만 자리와 배율을 잰다", () => {
    // 관절은 원화 바깥에 박혀 있을 수 있다. 밖에 있는 관절로 배율을 재면 그 개체만 조용히
    // 크거나 작아지고, 원인은 값이 아니라 관절에 있어 `lobbyZoom`을 고쳐도 다시 어긋난다.
    for (const relic of LOBBY_RELICS) {
      const { content } = PORTRAITS[relic.portraitAssetId];
      const joints = JOINTS[relic.portraitAssetId];
      for (const [x, y] of [...joints.eyes, joints.core]) {
        expect(x, `${relic.name} 관절 x`).toBeGreaterThanOrEqual(content.left);
        expect(x, `${relic.name} 관절 x`).toBeLessThanOrEqual(content.right);
        expect(y, `${relic.name} 관절 y`).toBeGreaterThanOrEqual(content.top);
        expect(y, `${relic.name} 관절 y`).toBeLessThanOrEqual(content.bottom);
      }
    }
  });

  it("는 키 비례를 포기한 원화(모르페)도 몸이 화면 오른쪽 밖으로 나가지 않는다", () => {
    const framed = LOBBY_RELICS.filter((relic) => PORTRAITS[relic.portraitAssetId].lobbyFraming !== undefined);
    expect(framed.length).toBeGreaterThan(0);
    for (const relic of framed) {
      const asset = { url: "", ...PORTRAITS[relic.portraitAssetId] } as PuppetAsset;
      const { focusX, height } = lobbyPortraitPlacement(asset);
      const scale = height / (asset.content.bottom - asset.content.top);
      const core = JOINTS[relic.portraitAssetId].core;
      expect(focusX.x + (asset.content.right - core[0]) * scale, `${relic.name} 오른쪽`).toBeLessThanOrEqual(1080);
    }
  });

  it("는 모든 개체의 발끝을 같은 바닥선에 놓는다", () => {
    for (const relic of LOBBY_RELICS) {
      expect(lobbyPortraitPlacement({ url: "", ...PORTRAITS[relic.portraitAssetId] }).groundY).toBe(LOBBY_PORTRAIT_SPOT.floor);
    }
  });
});

/**
 * **회귀 테스트다.** 정보창·새 캐릭터 획득창의 얼굴선을 눈대중이 아니라 수치로 고정한다.
 *
 * 예전에는 가슴께의 코어(`중심1`) 관절을 한 점에 맞추고 그림 전체 키로 크기를 정해, 눈높이가
 * 원화의 등신비를 그대로 따라갔다(스피나 506 · 테리사 800 · 델로피 836). 노도니아처럼 날개·베일이
 * 실루엣을 키우는 원화는 얼굴이 중앙값의 58%까지 줄었다. 지금은 공용 얼굴 규격이 두 눈 관절로
 * **눈높이 한 줄**과 **얼굴 크기 띠**를 함께 정한다(`FACE_STANDARD.info`).
 */
describe("정보창 전신의 얼굴 규격", () => {
  const placementOf = (assetId: string) => infoPortraitPlacement({ url: "", ...PORTRAITS[assetId] } as PuppetAsset, INFO_PORTRAIT_FOCUS);
  const scaleOf = (assetId: string): number => {
    const asset = PORTRAITS[assetId];
    return placementOf(assetId).height / (asset.content.bottom - asset.content.top);
  };
  const faceSizeOf = (assetId: string): number => {
    const [left, right] = PORTRAITS[assetId].joints!.eyes!;
    return Math.hypot(right[0] - left[0], right[1] - left[1]) * scaleOf(assetId);
  };
  const target = FACE_STANDARD.info.span * INFO_PORTRAIT_FOCUS.height;

  it.each(LOBBY_RELICS.map((relic) => [relic.name, relic.portraitAssetId] as const))(
    "%s는 눈높이 한 줄에 선다",
    (_name, assetId) => {
      const placement = placementOf(assetId);
      expect(placement.focus.anchor).toBe("eyeLine");
      // `infoFraming.raise`를 적은 원화만 그만큼 더 올라간다 — 눈높이 한 줄이 기본이고 예외는 그 필드 하나다.
      const raise = PORTRAITS[assetId].infoFraming?.raise ?? 0;
      expect(placement.focus.y).toBeCloseTo(INFO_PORTRAIT_FOCUS.y - FACE_STANDARD.info.eyeRise * INFO_PORTRAIT_FOCUS.height - raise, 6);
    },
  );

  it.each(LOBBY_RELICS.map((relic) => [relic.name, relic.portraitAssetId] as const))(
    "%s의 얼굴은 다른 전신과 같은 크기대에 있다",
    (_name, assetId) => {
      const ratio = faceSizeOf(assetId) / target;
      // 위는 띠 끝 그대로다. 아래는 실루엣 폭 상한에 먼저 걸리는 노도니아(0.74)를 위해 조금 더
      // 열어 둔다 — 예전 0.58은 확실히 잡는다.
      expect(ratio).toBeGreaterThanOrEqual(0.72);
      expect(ratio).toBeLessThanOrEqual(1 + FACE_STANDARD.info.band + 0.005);
    },
  );

  it("는 테리사의 눈높이를 후드가 솟은 만큼만 올려 정수리가 메론보다 낮게 서지 않게 한다", () => {
    const top = (assetId: string): number => {
      const asset = PORTRAITS[assetId];
      const placement = placementOf(assetId);
      const eyeY = (asset.joints!.eyes![0][1] + asset.joints!.eyes![1][1]) / 2;
      return placement.focus.y - (eyeY - asset.content.top) * scaleOf(assetId);
    };
    // 조정 전에는 약 108px 낮았다. 같은 자리에서 40px 안이면 나란히 선 것으로 읽힌다.
    expect(Math.abs(top("terisa") - top("meron"))).toBeLessThan(40);
  });

  it("는 노도니아를 얼굴 띠가 아니라 폭 상한에서 멈춘다", () => {
    const asset = PORTRAITS.nodonia;
    const width = (asset.content.right - asset.content.left) * scaleOf("nodonia");
    expect(width).toBeCloseTo(FACE_STANDARD.info.maxWidth * INFO_PORTRAIT_FOCUS.height, 3);
    expect(faceSizeOf("nodonia") / target).toBeLessThan(1 - FACE_STANDARD.info.band);
  });

  /**
   * **화면에서 읽히는 크기는 얼굴이 아니라 판을 채우는 몸이다.**
   *
   * 얼굴만 맞추면 얼굴이 작게 그려진 원화는 배율이 계속 올라가고, 그때 함께 커지는 것은
   * 실루엣 전체다 — 노도니아가 폭 1748px이 되어 "너무 확대됐다"로 보인 적이 있다.
   */
  it("는 어느 전신도 폭 상한을 넘겨 판을 채우지 않는다", () => {
    for (const relic of LOBBY_RELICS) {
      const asset = PORTRAITS[relic.portraitAssetId];
      const width = (asset.content.right - asset.content.left) * scaleOf(relic.portraitAssetId);
      expect(width, relic.name).toBeLessThanOrEqual(FACE_STANDARD.info.maxWidth * INFO_PORTRAIT_FOCUS.height + 0.5);
    }
  });
});


describe("토리카 skin001 화면 비율", () => {
  const skinEyes = [[472, 312], [558, 344]] as const;
  const baseEyes = JOINTS.torika.eyes;

  it("는 기본 토리카와 같은 키 비율로 로비 바닥에 선다", () => {
    // 같은 1.08 m 외형이므로 눈 중간점부터 alpha 발끝까지의 화면 길이를 직접 비교한다.
    const eyeToFoot = (asset: Omit<PuppetAsset, "url">, eyes: readonly [readonly [number, number], readonly [number, number]]): number => {
      const height = lobbyPortraitPlacement({ url: "", ...asset }).height;
      const eye = (eyes[0][1] + eyes[1][1]) / 2;
      return (asset.content.bottom - eye) * height / (asset.content.bottom - asset.content.top);
    };
    expect(eyeToFoot(TORIKA_SKIN_001_PORTRAIT_METADATA, skinEyes) / eyeToFoot(TORIKA_PORTRAIT_METADATA, baseEyes)).toBeCloseTo(1, 3);
  });

  it("는 로비 보정이 기본 토리카 복사가 아니고, 관절은 제 원화에서 잰 값이다", () => {
    // 새 눈 간격·실루엣·중심1로 다시 잰 값이어야 하므로 기본 메타데이터와 달라야 한다.
    expect(TORIKA_SKIN_001_PORTRAIT_METADATA.lobbyZoom).not.toBe(TORIKA_PORTRAIT_METADATA.lobbyZoom);
    expect(TORIKA_SKIN_001_PORTRAIT_METADATA.joints?.eyes).toEqual(skinEyes);
    expect(TORIKA_SKIN_001_PORTRAIT_METADATA.joints?.center).toEqual([467, 454]);
  });
});
