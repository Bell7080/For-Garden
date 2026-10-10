import Phaser from "phaser";
import type { ProductRefresh } from "../data/products";
import { chipPoints, drawFrameVignette, drawLayer, slantedRect } from "./holo";
import { COLOR, textStyle } from "./theme";
import { addShowcaseFace } from "./showcaseCardFace";

/**
 * 전시대에 놓인 상품 카드 한 장의 **겉모습** — 무역 전시장과 프리미엄이 함께 쓴다.
 *
 * **패키지는 줄이 아니라 물건이다.** 유리면 한 겹에 글자만 얹으면 어디까지가 한 건인지 줄 간격으로
 * 짐작해야 한다. 전시장의 카드는 뒤로 어둠이 두 겹 번지고, 면 위쪽이 강조색으로 물들고, 비스듬한
 * 빛줄기가 지나가고, 네 변이 안쪽으로 눌리고, 왼쪽에 두꺼운 빗금이 서고, 윗변에 꼬리표가 걸린다 —
 * 겹이 쌓여야 눌러서 살 수 있는 물건으로 읽힌다. 두 화면이 제 나름으로 그리면 같은 "사는 물건"이
 * 한쪽만 판때기로 남으므로 겹은 이 한 곳만 그린다. 안에 무엇이 서는지는 부르는 쪽의 몫이다.
 */
export const SHOWCASE_CARD = {
  /** 모서리 깎임(짧은 변 대비). 팝업 몸판과 같은 결로 왼쪽 위·오른쪽 아래만 깎는다. */
  bevel: 0.13,
  fill: 0x121a25,
  fillAlpha: 0.95,
  /** 뒤로 번지는 어둠. 같은 도형을 조금씩 키워 아래로 밀어 두 겹 깐다. */
  shadow: [{ grow: 14, offsetY: 10, alpha: 0.34 }, { grow: 30, offsetY: 20, alpha: 0.18 }],
  /** 면 위쪽만 물들이는 강조색 발광과 유리 광택. */
  glow: { strength: 0.3, height: 0.62 },
  sheen: 0.05,
  vignette: { strength: 0.58, spread: 0.24 },
  /** 왼쪽 세로 빗금. 카드를 판이 아니라 물건으로 만드는 한 겹이다. */
  rail: { width: 10, inset: 14, alpha: 0.85 },
  /** 카드 왼쪽 위에 스티커처럼 걸린 꼬리표 — 이 묶음이 얼마나 드문 기회인지를 먼저 말한다. */
  tag: { height: 46, padX: 26, overhangY: 18, size: 24 },
  /** 몸판을 비스듬히 가로지르는 빛줄기 두 가닥 — 포장된 상품의 광택이다. */
  streaks: [{ x: 0.18, width: 46, alpha: 0.06 }, { x: 0.3, width: 16, alpha: 0.05 }],
} as const;

/**
 * **갱신 주기가 카드의 색이다.** 계정당 한 번뿐인 것은 금빛, 주마다 열리는 것은 푸른빛, 매일
 * 열리는 것은 초록빛 — 한 번뿐인 것일수록 따뜻하고 귀한 색이라, 글자를 읽기 전에 어느 카드가
 * 놓치면 안 되는 것인지 보인다.
 */
export const SHOWCASE_TIER_TONE: Readonly<Record<ProductRefresh, number>> = {
  once: 0xe0a83e, weekly: 0x7fb4ec, monthly: 0xb48ce0, daily: 0x6fc47f, none: 0xd8b978,
};

export interface ShowcaseChromeOptions {
  width: number;
  height: number;
  /** 강조색 — 윗변 선·발광·빗금·꼬리표가 같은 색을 쓴다. */
  accent: number;
  /** 소진처럼 눌러 두어야 하는 카드. */
  dim?: boolean;
  /** 왼쪽 빗금이 서는 x(카드 중심 기준). 글줄 시작선에서 한 뼘 바깥이다. */
  railX: number;
  /** 윗변에 걸터앉는 꼬리표 글자. 비우면 세우지 않는다. */
  tag?: string;
  /** 꼬리표의 왼쪽 끝(카드 중심 기준). 비우면 글줄 시작선이다. */
  tagLeft?: number;
  /** 상품(액자 줄)이 놓이는 높이 — 면 무늬의 받침·빛이 이 줄을 기준으로 선다. */
  stageY?: number;
}

/** 로컬 좌표 도형을 지금의 월드 좌표로 옮긴다. 팝업·스크롤 안에서 마스크가 엉뚱한 자리에 남지 않게 한다. */
function worldPoints(matrix: Phaser.GameObjects.Components.TransformMatrix, flat: readonly number[]): Phaser.Geom.Point[] {
  const points: Phaser.Geom.Point[] = [];
  for (let index = 0; index < flat.length; index += 2) {
    const point = matrix.transformPoint(flat[index], flat[index + 1]);
    points.push(new Phaser.Geom.Point(point.x, point.y));
  }
  return points;
}

/** 카드의 깎인 실루엣. 입력면·안쪽 장식이 같은 도형을 읽는다. */
export function showcaseCardShape(width: number, height: number, grow = 0): number[] {
  const bevel = Math.min(width, height) * SHOWCASE_CARD.bevel;
  return chipPoints(width + grow, height + grow, { bevel: { topLeft: bevel, topRight: 0, bottomRight: bevel, bottomLeft: 0 } });
}

/**
 * 카드 컨테이너에 겉모습 겹을 깐다. 부르는 쪽은 그 위에 이름·액자·값을 얹는다.
 *
 * 비네트는 카드의 월드 도형으로 매 프레임 마스킹한다 — 줄여 가며 두르는 옛 비네트는 가로로 긴
 * 카드에서 검은 잔상을 남긴다(`drawFrameVignette`). 마스크는 카드가 사는 동안만 산다.
 */
export function paintShowcaseCard(scene: Phaser.Scene, card: Phaser.GameObjects.Container, options: ShowcaseChromeOptions): void {
  const { width, height, accent } = options;
  const dim = options.dim ?? false;
  const shape = showcaseCardShape(width, height);

  // ① 뒤로 번지는 어둠 두 겹. 도형으로 그림자를 그리면 카드와 무관한 네모가 남으므로 같은
  // 그림을 조금씩 키워 검게 깐다.
  for (const { grow, offsetY, alpha } of SHOWCASE_CARD.shadow) {
    card.add(drawLayer(scene, 0, offsetY, showcaseCardShape(width, height, grow), { fill: 0x000000, alpha, shadow: false }));
  }
  // ② 몸판. 윗변 한 줄만 긋고 사방 테두리는 두르지 않는다.
  card.add(drawLayer(scene, 0, 0, shape, {
    fill: SHOWCASE_CARD.fill, alpha: SHOWCASE_CARD.fillAlpha, sheen: SHOWCASE_CARD.sheen,
    glow: { color: accent, strength: dim ? 0.16 : SHOWCASE_CARD.glow.strength, height: SHOWCASE_CARD.glow.height },
    edge: accent, edgeAlpha: dim ? 0.35 : 0.9, edgeWidth: 3,
  }));
  // 면 무늬(◆ 격자 + 광휘). 몸판 바로 위·광택 아래에 깔고 카드 도형대로 구워 모서리 밖으로 새지 않는다.
  addShowcaseFace(scene, card, 0, 0, { width, height, shape, accent, stageY: options.stageY, dim });
  // 비스듬한 빛줄기. 몸판 도형 안에서만 보이도록 아래 비네트와 같은 마스크를 쓴다.
  const streaks = scene.add.graphics();
  for (const streak of SHOWCASE_CARD.streaks) {
    const x = -width / 2 + width * streak.x;
    streaks.fillStyle(0xffffff, dim ? streak.alpha / 2 : streak.alpha);
    streaks.fillPoints([
      new Phaser.Geom.Point(x + height * 0.5, -height / 2), new Phaser.Geom.Point(x + height * 0.5 + streak.width, -height / 2),
      new Phaser.Geom.Point(x - height * 0.5 + streak.width, height / 2), new Phaser.Geom.Point(x - height * 0.5, height / 2),
    ], true);
  }
  card.add(streaks);
  // ③ 네 변 비네팅 — 칩 밖으로 새지 않도록 카드의 월드 도형으로 마스킹한다.
  const maskGraphics = scene.make.graphics({});
  const syncMask = (): void => {
    if (!card.active || !maskGraphics.active) return;
    maskGraphics.clear().fillStyle(0xffffff, 1).fillPoints(worldPoints(card.getWorldTransformMatrix(), shape), true);
  };
  scene.events.on(Phaser.Scenes.Events.PRE_RENDER, syncMask);
  syncMask();
  card.once(Phaser.GameObjects.Events.DESTROY, () => {
    scene.events.off(Phaser.Scenes.Events.PRE_RENDER, syncMask);
    maskGraphics.destroy();
  });
  const cardMask = maskGraphics.createGeometryMask();
  streaks.setMask(cardMask);
  card.add(drawFrameVignette(scene, 0, 0, width, height, SHOWCASE_CARD.vignette).setMask(cardMask));
  // ④ 왼쪽 빗금 한 줄. 제목표의 빗금과 같은 결로 카드를 세로로 잡아 준다.
  card.add(drawLayer(scene, options.railX - SHOWCASE_CARD.rail.inset, 0, slantedRect(SHOWCASE_CARD.rail.width, height * 0.62), {
    fill: accent, alpha: SHOWCASE_CARD.rail.alpha, shadow: false,
  }));
  // ⑤ 꼬리표 — 카드 윗변에 걸터앉은 스티커. 윗변 밖으로 한 뼘 올라가 판에 붙인 것처럼 읽힌다.
  if (options.tag) {
    const { tag } = SHOWCASE_CARD;
    const label = scene.add.text(0, 0, options.tag, textStyle({ role: "display", size: tag.size, color: dim ? COLOR.inkDim : "#101418" })).setOrigin(0.5);
    const tagWidth = label.width + tag.padX * 2;
    const tagX = (options.tagLeft ?? options.railX) + tagWidth / 2 + 10;
    const tagY = -height / 2 - tag.overhangY;
    card.add(drawLayer(scene, tagX, tagY, slantedRect(tagWidth, tag.height, 14), { fill: accent, alpha: dim ? 0.45 : 1 }));
    card.add(label.setPosition(tagX, tagY + 1));
  }
}
