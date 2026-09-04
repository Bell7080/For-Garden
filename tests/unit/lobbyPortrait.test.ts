import { describe, expect, it } from "vitest";
import { RELICS } from "../../src/data/relics";
import type { PuppetAsset } from "../../src/puppets/assets";
import {
  DELOPI_PORTRAIT_METADATA,
  DODI_PORTRAIT_METADATA,
  LEXIA_PORTRAIT_METADATA,
  LUKA_PORTRAIT_METADATA,
  KERIS_PORTRAIT_METADATA,
  MAKI_PORTRAIT_METADATA,
  MERON_PORTRAIT_METADATA,
  METTE_PORTRAIT_METADATA,
  PACHI_PORTRAIT_METADATA,
  SEIRA_PORTRAIT_METADATA,
  STELLA_PORTRAIT_METADATA,
  TIA_PORTRAIT_METADATA,
  TORIKA_PORTRAIT_METADATA,
} from "../../src/puppets/assetMetadata";
import { LOBBY_PORTRAIT_SPOT, lobbyPortraitPlacement } from "../../src/ui/portraitPlacement";

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
