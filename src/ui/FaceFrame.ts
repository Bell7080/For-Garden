import Phaser from "phaser";
import type { PortraitAssetId } from "../core/types";
import { computeFaceFrame } from "../puppets/anchors";
import { loadPortraitTexture, portraitAssetFor } from "../puppets/assets";
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
 * 카드(`PortraitCard`)처럼 머리가 밖으로 빠져나오는 홈을 두지 않고 사각 안에 얼굴을 그대로
 * 꽉 채운다. 기여도 그래프처럼 이름만으로는 누구인지 한눈에 읽히지 않는 자리에 쓴다.
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
     * 깨진 **보석 조각**처럼 보이게 한다. 렐릭 파편이 서는 자리만 켠다.
     *
     * 파편은 재화가 아니라 "그 개체의 한 조각"이라, 같은 액자에 얼굴만 담으면 기여도 줄의
     * 프로필과 구별되지 않는다. 판을 하나 더 받치는 대신 액자 **안쪽**에서 등급색이 번지고
     * 대각선 면 하나가 빛을 받게 해, 같은 액자 규격을 지키면서 결만 보석으로 바꾼다.
     */
    gem?: number;
  }) {
    super(scene, x, y);
    scene.add.existing(this);
    const size = options.size ?? 96;
    const shape = chipPoints(size, size, {
      bevel: { topLeft: size * ITEM_FRAME.bevel, topRight: 0, bottomRight: size * ITEM_FRAME.bevel, bottomLeft: 0 },
    });
    this.add(drawLayer(scene, 0, 0, shape, { fill: ITEM_FRAME.fill, alpha: ITEM_FRAME.fillAlpha }));
    void this.loadFace(scene, options, size);
    // 파편은 **빛을 통과시키는 유리**다. 얼굴 위에 색유리 판과 그것을 가르는 검은 납선을 얹어,
    // 같은 액자를 쓰면서도 기여도 줄의 프로필과 다른 것으로 읽히게 한다.
    if (options.gem !== undefined) this.add(paintStainedGlass(scene, size, options.gem));
    this.add(drawInnerVignette(scene, 0, 0, shape, { strength: ITEM_FRAME.vignette }));
    // **깎인 두 모서리를 되돌려 깎는다.** 얼굴은 `setCrop`으로 자르는데 그것은 텍스처를
    // **네모로** 자르는 것이라, 왼쪽 위·오른쪽 아래의 비스듬히 깎인 자리에서는 그림이 액자
    // 밖으로 삐져나온다(v0.95.1까지 기여도 줄과 파편 액자가 그랬다). 기하 마스크를 쓰지 않는
    // 이유는 컨테이너 이동을 물려받지 않아 스크롤하는 목록에서 어긋나기 때문이다 — 대신 잘려
    // 나간 삼각형 두 개를 판과 **같은 색으로 덮어** 그림을 그 선에서 끊는다.
    this.add(paintBevelCut(scene, size, ITEM_FRAME.fill));
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
    const originX = -size / 2 - face.cropX * face.scale;
    const originY = -size / 2 - face.cropY * face.scale;
    const image = scene.add.image(originX, originY, key).setOrigin(0, 0).setScale(face.scale);
    // `setCrop`은 텍스처 좌표계를 **네모로** 자른다. 배율이 그 상자를 액자 한 변과 같게 맞추므로
    // 네 변은 딱 맞지만, 깎인 두 모서리는 이것만으로 덮이지 않아 `paintBevelCut`이 마무리한다.
    image.setCrop(face.cropX, face.cropY, face.cropWidth, face.cropHeight);
    if (options.tint) image.setTint(options.tint);
    this.addAt(image, 1);
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
 * 깎여 나간 두 모서리를 판과 같은 색으로 덮는다.
 *
 * `chipPoints`가 왼쪽 위와 오른쪽 아래를 비스듬히 깎으므로, 잘려 나간 삼각형은 각각
 * `(-h,-h)·(-h,-h+b)·(-h+b,-h)`와 `(h,h)·(h,h-b)·(h-b,h)`다. 그 둘을 액자 바탕과 같은 색으로
 * 불투명하게 덮으면 안에 무엇을 그렸든 그 선에서 끊긴다 — 마스크와 달리 같은 컨테이너의
 * 그림이라 판이 움직이거나 스크롤해도 함께 따라간다.
 */
function paintBevelCut(scene: Phaser.Scene, size: number, fill: number): Phaser.GameObjects.Graphics {
  const half = size / 2;
  const bevel = size * ITEM_FRAME.bevel;
  const cut = scene.add.graphics();
  cut.fillStyle(fill, 1);
  cut.fillPoints([
    new Phaser.Geom.Point(-half, -half),
    new Phaser.Geom.Point(-half, -half + bevel),
    new Phaser.Geom.Point(-half + bevel, -half),
  ], true);
  cut.fillPoints([
    new Phaser.Geom.Point(half, half),
    new Phaser.Geom.Point(half, half - bevel),
    new Phaser.Geom.Point(half - bevel, half),
  ], true);
  return cut;
}

/**
 * 파편의 결 — **빛이 드는 성당의 스테인드글라스**다.
 *
 * 파편은 재화가 아니라 "그 개체의 한 조각"이라, 얼굴만 담으면 기여도 줄의 프로필과 구별되지
 * 않는다. 그래서 얼굴 위에 **색유리 판**을 얹고 그것을 **검은 납선**으로 가른다 — 유리는
 * 겹쳐 밝아지는 합성으로 빛을 통과시키고, 납선은 그 사이를 검게 끊어 판이 여러 조각이라는
 * 것을 말한다. 가운데에는 장미창처럼 둥근 메달리온 하나가 선다.
 *
 * **반짝임을 tween으로 만들지 않는다.** 파편 액자는 목록에 여럿 설 수 있고, 움직이는 빛은
 * 얼굴보다 먼저 읽히며 매 프레임 비용이 된다(각인 룬에서 같은 이유로 걷어 냈다). 대신 판마다
 * **다른 밝기**를 주어 빛을 받는 각도가 다른 것처럼 보이게 한다 — 멈춰 있어도 유리는 반짝인다.
 */
function paintStainedGlass(scene: Phaser.Scene, size: number, color: number): Phaser.GameObjects.Container {
  const glass = scene.add.container(0, 0);
  const half = size / 2;
  const step = (Math.PI * 2) / STAINED_GLASS.panes;
  // 색유리. 판마다 진하기가 달라 같은 색인데도 조각마다 빛을 다르게 받은 것처럼 보인다.
  const panes = scene.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
  for (let pane = 0; pane < STAINED_GLASS.panes; pane += 1) {
    const from = pane * step - Math.PI / 2;
    panes.fillStyle(color, STAINED_GLASS.paneAlpha[pane % STAINED_GLASS.paneAlpha.length]);
    panes.fillPoints(wedgePoints(half, from, from + step), true);
  }
  glass.add(panes);
  // 납선. 판을 가르는 검은 줄이라 겹쳐 밝아지는 합성을 쓰지 않는다.
  const lead = scene.add.graphics();
  lead.lineStyle(STAINED_GLASS.leadWidth, STAINED_GLASS.lead, STAINED_GLASS.leadAlpha);
  for (let pane = 0; pane < STAINED_GLASS.panes; pane += 1) {
    const angle = pane * step - Math.PI / 2;
    const edge = squareEdgePoint(half, angle);
    lead.lineBetween(0, 0, edge.x, edge.y);
  }
  // 가운데 메달리온. 장미창의 한가운데라 둥글게 둘러 얼굴을 그 안에 담는다.
  lead.strokeCircle(0, 0, half * STAINED_GLASS.medallion);
  glass.add(lead);
  // 유리 안쪽에서 번지는 등급색. 빛이 유리를 통과해 액자 안으로 스며드는 몫이다.
  glass.add(drawShapeInnerGlow(scene, 0, 0, chipPoints(size, size, {
    bevel: { topLeft: size * ITEM_FRAME.bevel, topRight: 0, bottomRight: size * ITEM_FRAME.bevel, bottomLeft: 0 },
  }), { color, strength: STAINED_GLASS.glow, depth: STAINED_GLASS.glowDepth }));
  return glass;
}

/** 부채꼴 한 판. 액자가 네모라 바깥 경계도 네모를 따라가므로 각을 잘게 나눠 그 변에 붙인다. */
function wedgePoints(half: number, from: number, to: number): Phaser.Geom.Point[] {
  const points = [new Phaser.Geom.Point(0, 0)];
  const steps = STAINED_GLASS.wedgeSteps;
  for (let step = 0; step <= steps; step += 1) {
    const edge = squareEdgePoint(half, from + (to - from) * (step / steps));
    points.push(new Phaser.Geom.Point(edge.x, edge.y));
  }
  return points;
}

/** 중심에서 쏜 광선이 한 변 `half`의 정사각 경계와 만나는 점. */
function squareEdgePoint(half: number, angle: number): { x: number; y: number } {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  // 더 빨리 변에 닿는 축이 경계를 정한다. 0으로 나누지 않도록 아주 작은 값으로 막는다.
  const scale = half / Math.max(Math.abs(cos), Math.abs(sin), 1e-6);
  return { x: cos * scale, y: sin * scale };
}

/**
 * 스테인드글라스의 값.
 *
 * 유리 판의 진하기는 얼굴이 색에 묻히지 않는 선에서 판마다 달리 잡는다 — 겹쳐 밝아지는
 * 합성이라 한 판이라도 0.2를 넘으면 그 조각만 하얗게 뜬다. 납선은 판을 가르는 것이 일이라
 * 굵기보다 **검기**가 중요하다.
 */
const STAINED_GLASS = {
  panes: 8,
  paneAlpha: [0.17, 0.07, 0.13, 0.05, 0.15, 0.08, 0.11, 0.06],
  lead: 0x05070a,
  leadWidth: 2.5,
  leadAlpha: 0.8,
  medallion: 0.46,
  wedgeSteps: 4,
  glow: 0.3,
  glowDepth: 0.32,
} as const;

