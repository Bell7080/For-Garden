import { describe, expect, it } from "vitest";
import type { PuppetBone } from "puppetforge";
import {
  computeAnchoredPlacement,
  computeHeadCardFrame,
  findAnchorBone,
  findGroundBones,
  resolveAnchors,
  type AnchorFrame,
  type CardFrame,
} from "../../src/puppets/anchors";
import {
  DODI_PORTRAIT_METADATA,
  DODI_SD_METADATA,
  LEXIA_PORTRAIT_METADATA,
  LUKA_PORTRAIT_METADATA,
  METTE_PORTRAIT_METADATA,
  METTE_SD_METADATA,
  PONTOS_PORTRAIT_METADATA,
  PONTOS_SD_METADATA,
  SEIRA_PORTRAIT_METADATA,
  TAPEJARA_PORTRAIT_METADATA,
  TORIKA_PORTRAIT_METADATA,
} from "../../src/puppets/assetMetadata";

/** 실제 char_001.zip과 같은 구성 — 머리 태그를 눈·입이 함께 가지고 있다. */
function bone(name: string, x: number, y: number, tags: string[], parentId: string | null = "root"): PuppetBone {
  return {
    id: name, name, parentId, x, y, rotation: 0, scaleX: 1, scaleY: 1,
    tags, motionStrength: 1, deform: "soft", color: "#ffffff",
  };
}

const BONES: PuppetBone[] = [
  bone("머리카락1", 626, 351, ["hair", "secondary"]),
  bone("머리1", 609, 395, ["head"]),
  bone("눈1", 554, 416, ["eye", "head"]),
  bone("입1", 591, 483, ["mouth", "head"]),
  bone("몸통1", 576, 589, ["body", "core"]),
  bone("중심1", 603, 711, ["root", "core"], null),
];

/** 토리카 원화의 실제 이미지 크기와 내용 상자. */
const FRAME: AnchorFrame = {
  imageWidth: 1054,
  imageHeight: 1492,
  content: { left: 95, top: 69, right: 894, bottom: 1419 },
};

describe("기준 관절 찾기", () => {
  it("는 얼굴 부속이 아닌 머리1을 머리 기준으로 고른다", () => {
    expect(findAnchorBone(BONES, "head")?.name).toBe("머리1");
  });

  it("는 몸통1이 아니라 중심1을 코어 기준으로 고른다", () => {
    expect(findAnchorBone(BONES, "core")?.name).toBe("중심1");
  });

  it("는 중심 태그를 제외하고 몸통1을 몸통 기준으로 고른다", () => {
    expect(findAnchorBone(BONES, "body")?.name).toBe("몸통1");
  });

  it("는 발1·발2 태그를 바닥 접점 후보로 모두 찾는다", () => {
    const feet = [bone("발1", 4, 90, ["foot", "ground"]), bone("발2", 8, 92, ["foot", "ground"])];
    expect(findGroundBones([...BONES, ...feet]).map((item) => item.name)).toEqual(["발1", "발2"]);
  });

  it("는 태그가 없는 예전 묶음도 이름으로 찾는다", () => {
    const legacy = [bone("중심1", 10, 20, []), bone("머리1", 10, 5, [])];
    expect(findAnchorBone(legacy, "core")?.name).toBe("중심1");
    expect(findAnchorBone(legacy, "head")?.name).toBe("머리1");
  });

  it("는 이름도 태그도 없으면 코어만 루트 관절로 대신한다", () => {
    const unnamed = [bone("a", 1, 2, [], null), bone("b", 3, 4, [])];
    expect(findAnchorBone(unnamed, "core")?.name).toBe("a");
    expect(findAnchorBone(unnamed, "head")).toBeUndefined();
  });

  it("는 머리 관절이 없으면 내용 상자 위쪽을 대신 쓴다", () => {
    const anchors = resolveAnchors([bone("중심1", 603, 711, ["core"], null)], FRAME);
    expect(anchors.core).toEqual({ x: 603, y: 711 });
    expect(anchors.head.y).toBeLessThan(anchors.core.y);
  });
});

describe("코어 기준 배치", () => {
  const anchors = resolveAnchors(BONES, FRAME);

  it("는 코어 관절을 요청한 화면 지점에 정확히 올린다", () => {
    const placement = computeAnchoredPlacement(FRAME, anchors.core, { x: 540, y: 1000, height: 2280 });
    // Mesh 원점(이미지 중앙)에서 코어까지의 거리를 배율만큼 되돌리면 다시 요청 지점이 된다.
    const screenX = placement.x + (anchors.core.x - FRAME.imageWidth / 2) * placement.scale;
    const screenY = placement.y + (anchors.core.y - FRAME.imageHeight / 2) * placement.scale;
    expect(screenX).toBeCloseTo(540);
    expect(screenY).toBeCloseTo(1000);
  });

  it("는 요청한 높이만큼 그림을 키운다", () => {
    const placement = computeAnchoredPlacement(FRAME, anchors.core, { x: 0, y: 0, height: 2700 });
    expect((FRAME.content.bottom - FRAME.content.top) * placement.scale).toBeCloseTo(2700);
  });

  it("는 좌우 반전이면 가로 어긋남의 부호를 뒤집는다", () => {
    const normal = computeAnchoredPlacement(FRAME, anchors.core, { x: 540, y: 1000, height: 2280 });
    const flipped = computeAnchoredPlacement(FRAME, anchors.core, { x: 540, y: 1000, height: 2280, flipX: true });
    expect(flipped.x - 540).toBeCloseTo(540 - normal.x);
    expect(flipped.y).toBeCloseTo(normal.y);
  });
});

describe("머리 카드 잘라내기", () => {
  const anchors = resolveAnchors(BONES, FRAME);

  it("는 카드를 꽉 채우도록 원화를 확대한다", () => {
    const card = computeHeadCardFrame(FRAME, anchors.head, { width: 240, height: 316 });
    // 캐릭터 폭이 카드보다 넓어야 좌우가 잘리며 인물이 꽉 찬다.
    expect((FRAME.content.right - FRAME.content.left) * card.scale).toBeGreaterThan(240);
    expect(card.cropWidth * card.scale).toBeCloseTo(240);
    expect(card.cropHeight * card.scale).toBeCloseTo(316);
  });

  it("는 머리 관절이 카드 상단에 오도록 자른다", () => {
    const card = computeHeadCardFrame(FRAME, anchors.head, { width: 240, height: 316 });
    const headFromTop = (anchors.head.y - card.cropY) * card.scale;
    expect(headFromTop).toBeGreaterThan(0);
    expect(headFromTop).toBeLessThan(316 / 2);
  });

  it("는 잘라내기 상자를 이미지 밖으로 내보내지 않는다", () => {
    const card = computeHeadCardFrame(FRAME, { x: 20, y: 10 }, { width: 240, height: 316 });
    expect(card.cropX).toBeGreaterThanOrEqual(0);
    expect(card.cropY).toBeGreaterThanOrEqual(0);
    expect(card.cropX + card.cropWidth).toBeLessThanOrEqual(FRAME.imageWidth);
    expect(card.cropY + card.cropHeight).toBeLessThanOrEqual(FRAME.imageHeight);
  });

  /**
   * 들어 올린 손·망토처럼 머리보다 높이 솟은 부위가 내용 상자 맨 위를 차지하는 포즈(루카).
   * `headroom: 0`(카드가 실제로 쓰는 값)은 원래 내용 상자 맨 위에서 그대로 자르기 시작해,
   * 머리 관절이 카드 훨씬 아래로 밀려나거나 잘려 나갔다.
   */
  const raisedHandFrame: AnchorFrame = {
    imageWidth: 1728,
    imageHeight: 2446,
    // 내용 상자 맨 위(44)는 들어 올린 손이고, 머리는 그보다 한참 아래에 있다.
    content: { left: 52, top: 44, right: 1683, bottom: 2404 },
  };
  const cardOptions = { width: 300, height: 464, headroom: 0, fillRatio: 0.56 } as const;

  it("는 머리보다 높이 솟은 부위가 있어도 머리를 카드 상단 범위 안에 둔다", () => {
    const head = { x: 860, y: 900 };
    const card = computeHeadCardFrame(raisedHandFrame, head, cardOptions);
    const headFromTop = (head.y - card.cropY) * card.scale;
    // 카드 높이의 상단 46%(공식이 허용하는 한계) 언저리 안에 머리가 들어와야 얼굴이 보인다.
    expect(headFromTop).toBeGreaterThan(0);
    expect(headFromTop).toBeLessThanOrEqual(cardOptions.height * 0.46 + 1e-6);
    // 자연스러운 계산(내용 상자 맨 위)보다 시작점이 늦춰졌는지로 안전장치가 실제로 작동했는지 확인한다.
    expect(card.cropY).toBeGreaterThan(raisedHandFrame.content.top);
  });

  it("는 머리가 이미 내용 상자 맨 위에 가까우면 공통 여백만큼만 시작점을 앞당긴다", () => {
    // 내용 상자 맨 위를 충분히 크게 잡아, 여백을 앞당긴 결과가 0에서 잘리지 않게 한다.
    const tallFrame: AnchorFrame = { ...raisedHandFrame, content: { ...raisedHandFrame.content, top: 400 } };
    const head = { x: 860, y: 420 };
    const card = computeHeadCardFrame(tallFrame, head, cardOptions);
    // 뭉툭한 장식이 자르기 상단에 딱 붙어 수평으로 잘리지 않도록, 내용 상자 맨 위보다 카드
    // 높이의 3.5%만큼 앞당겨 여백을 둔다(anchors.ts의 HEAD_TIP_MARGIN_RATIO).
    expect(card.cropY).toBeLessThan(tallFrame.content.top);
    expect(tallFrame.content.top - card.cropY).toBeCloseTo(card.cropHeight * 0.035, 5);
  });
});

describe("폰토스 에셋 앵커 메타데이터", () => {
  it("는 ZIP 원본 크기와 alpha > 16 경계를 전신·SD에 그대로 고정한다", () => {
    // 투명 캔버스 끝을 content로 되돌리는 실수는 카드 배율과 전투 바닥선을 동시에 어긋나게 한다.
    expect(PONTOS_PORTRAIT_METADATA).toMatchObject({
      imageWidth: 1024,
      imageHeight: 1536,
      content: { left: 1, top: 3, right: 1024, bottom: 1481 },
      portraitZoom: 0.88,
      portraitOffsetY: 0,
    });
    expect(PONTOS_SD_METADATA).toMatchObject({
      imageWidth: 1254,
      imageHeight: 1254,
      content: { left: 32, top: 25, right: 1218, bottom: 1238 },
    });
  });

});

describe("도디·메테 전용 에셋 앵커 메타데이터", () => {
  it("는 5번 도디 전신·SD의 실루엣 경계를 고정한다", () => {
    expect(DODI_PORTRAIT_METADATA).toMatchObject({ imageWidth: 1086, imageHeight: 1448, content: { left: 100, top: 76, right: 986, bottom: 1352 } });
    expect(DODI_SD_METADATA).toMatchObject({ imageWidth: 1254, imageHeight: 1254, content: { left: 121, top: 72, right: 1088, bottom: 1207 } });
  });

  it("는 6번 메테 전신·SD의 실루엣 경계를 고정한다", () => {
    expect(METTE_PORTRAIT_METADATA).toMatchObject({ imageWidth: 1054, imageHeight: 1492, content: { left: 67, top: 43, right: 1003, bottom: 1463 } });
    expect(METTE_SD_METADATA).toMatchObject({ imageWidth: 1254, imageHeight: 1254, content: { left: 106, top: 80, right: 1099, bottom: 1207 } });
  });
});

/**
 * **회귀 테스트다.** 여기까지의 카드 테스트는 전부 손으로 지어낸 프레임을 썼고, 그래서 실제
 * 원화가 정수리를 잘리는 문제를 여러 번 고치는 동안에도 한 번도 실패하지 않았다.
 *
 * 원인은 `MAX_HEAD_DROP_RATIO`였다. 그 한계가 걸리면 자르기 시작점이 `content.top`보다 아래로
 * 내려가 원화의 맨 윗부분이 통째로 사라진다. 등신이 낮아 머리가 큰 토리카·도디는 머리 위
 * 여백이 자르기 높이의 38%여서 예전 한계(0.34)에 걸렸고, 정수리가 수평으로 잘려 나갔다.
 * 카드 쪽 보정(`cardHeadDropY`)은 이미 잘린 그림을 아래로 옮길 뿐이라 잘린 단면을 되돌리지
 * 못했다 — 같은 자리를 두 번 고치지 않기 위한 기록이다.
 *
 * 그래서 **지어낸 값이 아니라 실제 에셋 메타데이터와 ZIP의 `머리1` 관절**로 검사한다.
 */
describe("실제 원화의 카드 잘라내기", () => {
  // 도감·발굴·편성 그리드가 실제로 쓰는 카드 규격이다(카드 300×400 + 돌출 64).
  const CARD = { width: 300, height: 464, headroom: 0 } as const;

  /**
   * `머리1` 관절의 텍스처 좌표. 각 ZIP의 `puppet.json`에서 읽은 값이라 원화를 교체하면 함께
   * 다시 적는다(`tags: ["head"]`인 관절의 x·y).
   */
  const REAL_PORTRAITS = [
    { name: "토리카", metadata: TORIKA_PORTRAIT_METADATA, head: { x: 609, y: 395 } },
    { name: "렉시아", metadata: LEXIA_PORTRAIT_METADATA, head: { x: 613, y: 265 } },
    { name: "스피나", metadata: SEIRA_PORTRAIT_METADATA, head: { x: 572, y: 250 } },
    { name: "루카", metadata: LUKA_PORTRAIT_METADATA, head: { x: 882, y: 419 } },
    { name: "도디", metadata: DODI_PORTRAIT_METADATA, head: { x: 585, y: 370 } },
    { name: "메테", metadata: METTE_PORTRAIT_METADATA, head: { x: 520, y: 255 } },
    { name: "타페자라", metadata: TAPEJARA_PORTRAIT_METADATA, head: { x: 549, y: 375 } },
  ] as const;

  // PortraitCard가 넘기는 것과 같은 배율 보정이다.
  const cardFrameOf = (portrait: (typeof REAL_PORTRAITS)[number]): CardFrame =>
    computeHeadCardFrame(portrait.metadata, portrait.head, {
      ...CARD,
      fillRatio: 0.56 / ((portrait.metadata.cardZoom ?? 1) * (portrait.metadata.portraitZoom ?? 1)),
    });

  it.each(REAL_PORTRAITS.map((portrait) => [portrait.name, portrait] as const))(
    "%s는 정수리를 자르지 않는다",
    (_name, portrait) => {
      expect(cardFrameOf(portrait).clipsContentTop).toBe(false);
    },
  );

  it.each(REAL_PORTRAITS.map((portrait) => [portrait.name, portrait] as const))(
    "%s는 정수리 위에 숨 쉴 틈을 남긴다",
    (_name, portrait) => {
      const card = cardFrameOf(portrait);
      // 뭉툭한 뿔·깃털이 홈 윗변에 딱 붙어 수평으로 잘린 것처럼 보이지 않을 만큼은 띄운다.
      const margin = (portrait.metadata.content.top - card.cropY) * card.scale;
      expect(margin).toBeGreaterThan(0);
      expect(margin).toBeLessThan(CARD.height - CARD.width / 2);
    },
  );

  it.each(REAL_PORTRAITS.map((portrait) => [portrait.name, portrait] as const))(
    "%s는 얼굴을 카드 위쪽 절반 안에 세운다",
    (_name, portrait) => {
      const card = cardFrameOf(portrait);
      const headFromTop = (portrait.head.y - card.cropY) * card.scale;
      expect(headFromTop).toBeGreaterThan(0);
      expect(headFromTop).toBeLessThan(CARD.height / 2);
    },
  );

  it("는 한계가 실제 원화의 여백보다 확실히 위에 있다", () => {
    // 가장 머리가 큰 원화도 한계에 여유를 두고 못 미쳐야 다음 캐릭터가 다시 걸리지 않는다.
    const worst = Math.max(...REAL_PORTRAITS.map((portrait) => {
      const card = cardFrameOf(portrait);
      return (portrait.head.y - portrait.metadata.content.top) / card.cropHeight;
    }));
    expect(worst).toBeLessThan(0.42);
  });
});
