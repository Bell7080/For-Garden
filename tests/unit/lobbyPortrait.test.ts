import { describe, expect, it } from "vitest";
import { RELICS } from "../../src/data/relics";
import type { PuppetAsset } from "../../src/puppets/assets";
import {
  DELOPI_PORTRAIT_METADATA,
  DODI_PORTRAIT_METADATA,
  ELLA_PORTRAIT_METADATA,
  LEXIA_PORTRAIT_METADATA,
  LUKA_PORTRAIT_METADATA,
  KERIS_PORTRAIT_METADATA,
  MAKI_PORTRAIT_METADATA,
  MERON_PORTRAIT_METADATA,
  NODONIA_PORTRAIT_METADATA,
  METTE_PORTRAIT_METADATA,
  PACHI_PORTRAIT_METADATA,
  SEIRA_PORTRAIT_METADATA,
  STELLA_PORTRAIT_METADATA,
  TIA_PORTRAIT_METADATA,
  TORIKA_PORTRAIT_METADATA,
} from "../../src/puppets/assetMetadata";
import { INFO_PORTRAIT_FOCUS, LOBBY_PORTRAIT_SPOT, lobbyPortraitPlacement } from "../../src/ui/portraitPlacement";

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

  it("는 모든 개체의 발끝을 같은 바닥선에 놓는다", () => {
    for (const relic of LOBBY_RELICS) {
      expect(lobbyPortraitPlacement({ url: "", ...PORTRAITS[relic.portraitAssetId] }).groundY).toBe(LOBBY_PORTRAIT_SPOT.floor);
    }
  });
});

/**
 * **회귀 테스트다.** "정보창에서 노도니아만 작아 보인다"를 눈대중이 아니라 수치로 고정한다.
 *
 * 정보창 전신은 그림(alpha 상자) **전체**를 공용 높이에 맞추므로, 날개·베일처럼 실루엣을
 * 키우는 장식이 있으면 그만큼 얼굴이 줄어든다. 노도니아가 그랬다 — 눈 간격이 화면에서
 * 61.5px로 중앙값(106px)의 58%였고, `portraitZoom`으로 되돌렸다. 카드에서 같은 함정을 막는
 * `puppetAnchors.test.ts`의 "카드 얼굴 크기"와 짝이며, 크기 대리 지표(두 눈 사이 거리)도 같다.
 *
 * 관절 표(`JOINTS`)를 이 파일이 갖고 있어 여기 둔다.
 */
describe("정보창 전신의 얼굴 크기", () => {
  const faceSizeOf = (assetId: string): number => {
    const asset = PORTRAITS[assetId];
    const height = INFO_PORTRAIT_FOCUS.height * (asset.portraitZoom ?? 1);
    const scale = height / (asset.content.bottom - asset.content.top);
    const [left, right] = JOINTS[assetId].eyes;
    return Math.hypot(right[0] - left[0], right[1] - left[1]) * scale;
  };

  const median = (values: number[]): number => {
    const sorted = [...values].sort((a, b) => a - b);
    const middle = sorted.length / 2;
    return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[Math.floor(middle)];
  };

  it.each(LOBBY_RELICS.map((relic) => [relic.name, relic.portraitAssetId] as const))(
    "%s의 얼굴은 다른 전신과 같은 크기대에 있다",
    (_name, assetId) => {
      const center = median(LOBBY_RELICS.map((relic) => faceSizeOf(relic.portraitAssetId)));
      const ratio = faceSizeOf(assetId) / center;
      // 아래는 노도니아가 걸렸던 0.58을 확실히 잡고, 위는 등신이 낮아 머리가 큰 도디(1.41)와
      // 메테(1.24)를 그대로 통과시킨다. 아트 방향이 더 촘촘한 정렬을 원하면 그 둘의
      // portraitZoom을 낮추면서 이 한계도 함께 좁힌다.
      expect(ratio).toBeGreaterThanOrEqual(0.7);
      expect(ratio).toBeLessThanOrEqual(1.45);
    },
  );

  it("는 노도니아의 portraitZoom을 떼면 다시 실패한다", () => {
    // 보정을 되돌리면 예전 값(중앙값의 0.58배)으로 돌아가는지 직접 확인한다. 배율 자체를
    // 여기 적지 않는 이유는, 값을 조정할 때마다 테스트가 그 숫자만 따라 고쳐지면 정작
    // "보정이 필요하다"는 사실은 아무도 검사하지 않게 되기 때문이다.
    const asset = PORTRAITS.nodonia;
    expect(asset.portraitZoom ?? 1).toBeGreaterThan(1);
    const bare = faceSizeOf("nodonia") / (asset.portraitZoom ?? 1);
    const center = median(LOBBY_RELICS.map((relic) => faceSizeOf(relic.portraitAssetId)));
    expect(bare / center).toBeLessThan(0.7);
  });

  /**
   * **화면에서 읽히는 크기는 얼굴이 아니라 판을 채우는 몸이다.**
   *
   * 얼굴만 맞추면 얼굴이 작게 그려진 원화는 배율이 계속 올라가고, 그때 함께 커지는 것은
   * 실루엣 전체다 — 노도니아가 1.45에서 폭 1748px(다른 개체 최대 1429px)이 되어 "너무
   * 확대됐다"로 보였다. 위 얼굴 하한과 이 폭 상한이 함께 서야 배율이 한쪽으로 달아나지 않는다.
   */
  it("는 어느 전신도 다른 개체보다 크게 판을 채우지 않는다", () => {
    const widthOf = (assetId: string): number => {
      const asset = PORTRAITS[assetId];
      const height = INFO_PORTRAIT_FOCUS.height * (asset.portraitZoom ?? 1);
      return (asset.content.right - asset.content.left) * height / (asset.content.bottom - asset.content.top);
    };
    for (const relic of LOBBY_RELICS) {
      const others = LOBBY_RELICS.filter((other) => other !== relic).map((other) => widthOf(other.portraitAssetId));
      // 가장 넓은 개체보다 5% 넘게 넓으면 그 원화만 판을 통째로 덮는다.
      expect(widthOf(relic.portraitAssetId) / Math.max(...others), relic.name).toBeLessThanOrEqual(1.05);
    }
  });
});
