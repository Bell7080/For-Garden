import Phaser from "phaser";
import type { PortraitAssetId } from "../core/types";
import { computeFaceFrame } from "../puppets/anchors";
import { loadPortraitTexture, portraitAssetFor } from "../puppets/assets";
import { bakeFaceTexture, clipRectToShape, faceClipShape } from "./faceTexture";
import { chipPoints, drawInnerVignette, drawLayer, drawShapeInnerGlow, drawShapeOutline } from "./holo";
import { ITEM_FRAME } from "./itemFrame";
import { COLOR, textStyle } from "./theme";

/**
 * 캐릭터 얼굴 액자.
 *
 * **재화·아이템 액자(`addFramedIcon`)와 같은 한 장이다** — 같은 깎임·같은 사방 외곽선·같은
 * 안쪽 비네트·같은 우하단 수량 자리를 `ITEM_FRAME` 한 표에서 읽는다. 담기는 그림이 재화가
 * 아니라 얼굴일 뿐이라, 연구 결과판에서 중복 파편과 재화가 나란히 서도 두 종류의 액자로
 * 보이지 않는다.
 *
 * 카드(`PortraitCard`)처럼 머리가 밖으로 빠져나오는 홈을 두지 않고, **액자를 꽉 채워** 얼굴을
 * 담는다 — 재화 아이콘은 사방 여백이 규격이지만 얼굴은 차야 누구인지 읽힌다. 깎인 두 모서리는
 * 덮지도 마스크로 자르지도 않고 **그림을 구울 때 잘라 낸다**(`faceTexture.ts`). 기여도 그래프처럼
 * 이름만으로는 누구인지 한눈에 읽히지 않는 자리에 쓴다.
 */
export class FaceFrame extends Phaser.GameObjects.Container {
  private disposed = false;

  constructor(scene: Phaser.Scene, x: number, y: number, options: {
    portraitAssetId: PortraitAssetId;
    tint?: number;
    size?: number;
    /** 사방 외곽선 색. 비우면 강조색이다. 등급을 알리는 자리만 넘긴다. */
    color?: number;
    /** 액자 우하단에 겹칠 수. 비우면 수를 적지 않는다. */
    amount?: string;
    /**
     * **유리 조각**처럼 보이게 한다. 렐릭 파편이 서는 자리만 켠다.
     *
     * 파편은 재화가 아니라 "그 개체의 한 조각"이라, 같은 액자에 얼굴만 담으면 기여도 줄의
     * 프로필과 구별되지 않는다. 판을 하나 더 받치는 대신 액자 **안쪽**에서 등급색이 번지고
     * 물낯처럼 일렁이는 띠와 광택 한 줄이 얹혀, 같은 액자 규격을 지키면서 결만 유리로 바꾼다.
     */
    gem?: number;
    /**
     * **액자 없이 그림만** 세운다. 버튼 안처럼 판을 한 겹 더 깔 수 없는 자리만 켠다 —
     * 버튼 판 안에 액자를 넣으면 판이 두 겹으로 보인다(재화 비용 표기와 같은 규칙).
     */
    bare?: boolean;
  }) {
    super(scene, x, y);
    scene.add.existing(this);
    const size = options.size ?? 96;
    const shape = chipPoints(size, size, {
      bevel: { topLeft: size * ITEM_FRAME.bevel, topRight: 0, bottomRight: size * ITEM_FRAME.bevel, bottomLeft: 0 },
    });
    if (!options.bare) this.add(drawLayer(scene, 0, 0, shape, { fill: ITEM_FRAME.fill, alpha: ITEM_FRAME.fillAlpha }));
    void this.loadFace(scene, options, size);
    if (options.bare) {
      this.once(Phaser.GameObjects.Events.DESTROY, () => { this.disposed = true; });
      return;
    }
    // 파편은 **빛을 통과시키는 유리**다. 얼굴 위로 물낯처럼 일렁이는 띠와 광택 한 줄을 얹어,
    // 같은 액자를 쓰면서도 기여도 줄의 프로필과 다른 것으로 읽히게 한다.
    if (options.gem !== undefined) this.add(paintGlassSheen(scene, size, options.gem));
    this.add(drawInnerVignette(scene, 0, 0, shape, { strength: ITEM_FRAME.vignette }));
    this.add(drawShapeOutline(scene, 0, 0, shape, {
      color: options.color ?? COLOR.accent,
      alpha: ITEM_FRAME.outlineAlpha,
      width: ITEM_FRAME.outlineWidth,
    }));
    if (options.amount !== undefined) {
      // 자리·획·크기 모두 재화 액자와 같다. 여기서 옮기면 같은 수가 화면마다 다른 자리에 선다.
      this.add(scene.add
        .text(size / 2 - 8, size / 2 - 6, options.amount, textStyle({ role: "display", size: Math.max(18, Math.round(size * ITEM_FRAME.amountRatio)), color: COLOR.accentText }))
        .setOrigin(1, 1)
        .setStroke("#000000", 6)
        .setShadow(2, 3, "#000000", 2, false, true));
    }
    this.once(Phaser.GameObjects.Events.DESTROY, () => { this.disposed = true; });
  }

  private async loadFace(scene: Phaser.Scene, options: { portraitAssetId: PortraitAssetId; tint?: number }, size: number): Promise<void> {
    const asset = portraitAssetFor(options.portraitAssetId);
    const { key, anchors } = await loadPortraitTexture(scene, asset);
    if (this.disposed) return;
    // 카드 잘라내기가 아니라 **얼굴 전용 정사각 잘라내기**를 쓴다(`computeFaceFrame` 주석 참고).
    // 등신이 낮아 얼굴이 큰 원화는 카드와 같은 기준(`cardZoom`)으로 되돌려, 같은 액자에 나란히
    // 서도 얼굴 크기가 개체마다 튀지 않게 한다.
    const face = computeFaceFrame(asset, anchors.head, {
      size,
      crop: FACE_FRAME.crop / ((asset.cardZoom ?? 1) * (asset.portraitZoom ?? 1)),
      anchorY: FACE_FRAME.anchorY,
    });
    // **액자 한 변을 꽉 채우고, 깎인 두 모서리는 구울 때 지운다.** 덮으면 액자 바깥에 검은 뿔이
    // 남고(v0.105.0까지), 안쪽 정사각에 들이면 얼굴이 작아진다(v0.108.0까지).
    const baked = bakeFaceTexture(scene, key, size, { x: face.cropX, y: face.cropY, side: face.cropWidth });
    const image = scene.add.image(0, 0, baked).setDisplaySize(size, size);
    if (options.tint) image.setTint(options.tint);
    // 액자를 깐 경우 면 바로 위(1번)에, 그림만 세우는 경우 그대로 맨 앞에 놓는다.
    this.addAt(image, this.length > 0 ? 1 : 0);
  }
}

/**
 * 얼굴 액자의 확대 기준.
 *
 * `crop`은 실루엣 폭 대비 잘라내는 정사각 한 변이다. 예전에는 카드와 같은 기준(1에 가까운
 * `fillRatio`)을 써서 인물 **전체 폭**이 액자에 들어왔고, 그러다 보니 66px 칸에서 얼굴이
 * 4분의 1밖에 차지하지 않아 누구인지 이름을 읽어야 알았다. 실루엣의 3분의 1만 남기면 머리
 * 하나가 칸의 3분의 2를 채운다.
 *
 * `anchorY`는 상자 안에서 머리 관절이 서는 자리다. `머리1`은 눈보다 조금 위(이마)에 있으므로
 * 절반보다 살짝 아래에 두면 머리카락이 위로, 턱·어깨가 아래로 들어와 얼굴이 칸 가운데에 온다.
 */
const FACE_FRAME = { crop: 0.34, anchorY: 0.52 } as const;

/**
 * 파편의 결 — **일렁이는 물낯에 든 유리 한 조각**이다.
 *
 * 파편은 재화가 아니라 "그 개체의 한 조각"이라, 얼굴만 담으면 기여도 줄의 프로필과 구별되지
 * 않는다. 예전에는 색유리를 **검은 납선으로 갈라** 성당 창처럼 만들었는데, 조각마다 진하기가
 * 다른 부채꼴 여덟 장과 그 사이의 검은 줄이 작은 액자 안에서 얼굴보다 먼저 읽혔다 — 조각난
 * 무늬가 그림을 덮은 셈이다.
 *
 * 지금은 **가르지 않는다.** 얼굴 위로 등급색이 가로로 눕는 띠 몇 줄이 위아래로 밝기를 달리해
 * 물낯이 일렁이듯 지나가고, 그 위에 유리의 비스듬한 광택 한 줄이 얹힌다. 셋 다 겹쳐 밝아지는
 * 합성이라 얼굴을 덮지 않고 **빛만 더한다**.
 *
 * **반짝임을 tween으로 만들지 않는다.** 파편 액자는 목록에 여럿 설 수 있고, 움직이는 빛은
 * 얼굴보다 먼저 읽히며 매 프레임 비용이 된다(각인 룬에서 같은 이유로 걷어 냈다). 띠마다 다른
 * 밝기가 멈춘 채로도 일렁임을 만든다.
 */
function paintGlassSheen(scene: Phaser.Scene, size: number, color: number): Phaser.GameObjects.Container {
  const glass = scene.add.container(0, 0);
  // 띠와 광택도 얼굴과 **같은 도형 안에서만** 그린다. 액자 한 변까지 네모로 칠하면 깎인 두
  // 모서리로 빛이 새어 액자 밖에 색 조각이 남는다 — 마스크가 아니라 칠할 도형을 잘라 둔다.
  const shape = faceClipShape(size);
  const half = size / 2;
  // 물낯. 가로로 누운 띠가 위아래로 진하기를 달리하며 지나간다 — 경계를 긋지 않으므로 조각난
  // 것이 아니라 한 면이 일렁이는 것으로 읽힌다.
  const ripple = scene.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
  GLASS_SHEEN.ripples.forEach(({ at, height, alpha }) => {
    const band = clipRectToShape({ left: -half, top: -half + size * at, width: size, height: size * height }, shape);
    if (band.length < 6) return;
    ripple.fillStyle(color, alpha);
    ripple.fillPoints(toPoints(band), true);
  });
  glass.add(ripple);
  // 유리의 광택 한 줄. 왼쪽 위에서 오른쪽 아래로 비스듬히 지나가는 좁은 띠다.
  const sheen = scene.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
  sheen.fillStyle(GLASS_SHEEN.sheen, GLASS_SHEEN.sheenAlpha);
  // **빈 점 목록을 넘기지 않는다.** Phaser의 `fillPoints`는 첫 점을 곧바로 읽어 예외를 던지고,
  // 그 예외가 액자를 세우던 창을 그리다 말게 만든다.
  const sheenShape = clipPolygonToShape([
    -half, -half + size * GLASS_SHEEN.sheenAt,
    -half + size * GLASS_SHEEN.sheenWidth, -half,
    half, -half + size * GLASS_SHEEN.sheenAt,
    half - size * GLASS_SHEEN.sheenWidth, half,
  ], shape);
  if (sheenShape.length >= 6) sheen.fillPoints(toPoints(sheenShape), true);
  glass.add(sheen);
  // 유리 안쪽에서 번지는 등급색. 빛이 조각을 통과해 액자 안으로 스며드는 몫이다.
  glass.add(drawShapeInnerGlow(scene, 0, 0, shape, { color, strength: GLASS_SHEEN.glow, depth: GLASS_SHEEN.glowDepth }));
  return glass;
}

/** 평평한 좌표 배열을 Phaser 점 목록으로. */
function toPoints(flat: readonly number[]): Phaser.Geom.Point[] {
  const points: Phaser.Geom.Point[] = [];
  for (let index = 0; index < flat.length; index += 2) points.push(new Phaser.Geom.Point(flat[index], flat[index + 1]));
  return points;
}

/**
 * 볼록한 두 도형의 교집합. 광택 띠(마름모)를 액자 도형 안으로 잘라 낸다.
 *
 * **어느 쪽이 안인지는 도형이 감긴 방향이 정한다.** 화면 좌표는 y가 아래로 가므로 눈에 보이는
 * 시계 방향이 수학의 반시계 방향과 부호가 뒤집힌다 — 부호를 손으로 적어 두었더니 안팎이 반대로
 * 잡혀 **잘라낸 결과가 통째로 비었고**, 빈 점 목록을 받은 `fillPoints`가 예외를 던져 그 액자를
 * 세우던 창이 그리다 말았다(한계 돌파 확정 창이 그랬다). 그래서 감긴 방향을 **재서** 정한다.
 */
function clipPolygonToShape(subject: readonly number[], clip: readonly number[]): number[] {
  let polygon = [...subject];
  const count = clip.length / 2;
  // 신발끈 공식의 부호가 곧 감긴 방향이다. 안쪽은 그 부호와 같은 쪽이다.
  let twiceArea = 0;
  for (let i = 0; i < count; i += 1) {
    const j = (i + 1) % count;
    twiceArea += clip[i * 2] * clip[j * 2 + 1] - clip[j * 2] * clip[i * 2 + 1];
  }
  const sign = twiceArea >= 0 ? 1 : -1;
  for (let edge = 0; edge < count; edge += 1) {
    const ax = clip[edge * 2];
    const ay = clip[edge * 2 + 1];
    const bx = clip[((edge + 1) % count) * 2];
    const by = clip[((edge + 1) % count) * 2 + 1];
    const inside = (x: number, y: number): number => sign * ((bx - ax) * (y - ay) - (by - ay) * (x - ax));
    const next: number[] = [];
    const points = polygon.length / 2;
    for (let i = 0; i < points; i += 1) {
      const px = polygon[i * 2];
      const py = polygon[i * 2 + 1];
      const qx = polygon[((i + 1) % points) * 2];
      const qy = polygon[((i + 1) % points) * 2 + 1];
      const pv = inside(px, py);
      const qv = inside(qx, qy);
      if (pv >= 0) next.push(px, py);
      if ((pv >= 0) !== (qv >= 0)) {
        // 부호가 다르면 그 사이에서 반드시 변을 지난다 — 나누는 값이 0이 될 수 없다.
        const t = pv / (pv - qv);
        next.push(px + (qx - px) * t, py + (qy - py) * t);
      }
    }
    polygon = next;
    if (polygon.length === 0) return polygon;
  }
  return polygon;
}

/**
 * 물결과 광택의 값.
 *
 * 띠의 진하기는 얼굴이 색에 묻히지 않는 선에서 줄마다 달리 잡는다 — 겹쳐 밝아지는 합성이라
 * 한 줄이라도 0.2를 넘으면 그 띠만 하얗게 뜬다. 광택은 색이 아니라 **흰빛**이라 더 옅다.
 */
const GLASS_SHEEN = {
  /** 가로 띠 — `at`·`height`는 액자 한 변 대비 비율이다. */
  ripples: [
    { at: 0.06, height: 0.16, alpha: 0.13 },
    { at: 0.3, height: 0.1, alpha: 0.06 },
    { at: 0.48, height: 0.2, alpha: 0.11 },
    { at: 0.74, height: 0.12, alpha: 0.07 },
  ],
  sheen: 0xffffff,
  sheenAlpha: 0.08,
  /** 광택 띠가 지나는 높이와 폭(액자 한 변 대비). */
  sheenAt: 0.62,
  sheenWidth: 0.34,
  glow: 0.3,
  glowDepth: 0.32,
} as const;
