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
    this.add(drawInnerVignette(scene, 0, 0, shape, { strength: ITEM_FRAME.vignette }));
    if (options.gem !== undefined) this.add(paintGemFacet(scene, size, shape, options.gem));
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
    // `setCrop`은 텍스처 좌표계를 자르고, 배율은 그 상자가 액자 한 변과 정확히 같아지도록
    // 구했으므로 그림은 액자 **안에서만** 그려진다.
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
 * 깨진 보석 조각의 결.
 *
 * 두 겹뿐이다 — 액자 안쪽에서 번지는 등급색 발광 한 겹과, 모서리에서 모서리로 지나가는
 * **대각선 면** 하나다. 조각을 여럿 흩뿌리거나 반짝임 tween을 걸지 않는다: 파편은 목록에
 * 여럿 서는 액자라, 움직이는 빛이 있으면 그것이 얼굴보다 먼저 읽히고 매 프레임 비용이 된다
 * (각인 룬의 금빛 비네트와 같은 판단이다).
 *
 * 면은 마스크가 아니라 **액자 도형 안에서 잘라** 만든다. 기하 마스크는 컨테이너 이동을
 * 물려받지 않아 스크롤하는 목록에서 어긋난다.
 */
function paintGemFacet(scene: Phaser.Scene, size: number, shape: number[], color: number): Phaser.GameObjects.Container {
  const gem = scene.add.container(0, 0);
  gem.add(drawShapeInnerGlow(scene, 0, 0, shape, { color, strength: GEM_FACET.glow, depth: GEM_FACET.depth }));
  // 왼쪽 아래에서 오른쪽 위로 지나가는 띠. 액자가 깎아 둔 두 모서리(왼쪽 위·오른쪽 아래)와
  // 같은 방향이라, 판에 얹은 줄이 아니라 **그 면 자체가 기울어 빛을 받는** 것으로 읽힌다.
  //
  // 띠는 **깎이지 않은 두 모서리**(왼쪽 아래·오른쪽 위) 사이를 지나므로 도형을 벗어나지 않는다.
  // 그래도 변에 딱 붙이지 않고 한 뼘 안으로 들여 세운다 — 경계에 걸친 채움은 외곽선과 겹쳐
  // 그 한 줄만 두껍게 보인다.
  const half = size / 2 - GEM_FACET.inset;
  const band = size * GEM_FACET.band;
  const facet = scene.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
  facet.fillStyle(0xffffff, GEM_FACET.sheen);
  facet.fillPoints([
    new Phaser.Geom.Point(-half, half - band),
    new Phaser.Geom.Point(-half + band, half),
    new Phaser.Geom.Point(half, -half + band),
    new Phaser.Geom.Point(half - band, -half),
  ], true);
  gem.add(facet);
  return gem;
}

/**
 * 보석 결의 값.
 *
 * 발광은 각인 룬(0.42)보다 옅다 — 파편은 완성이 아니라 조각이라 그만큼 덜 빛나야 하고, 얼굴이
 * 그 아래에 있어 진하면 인물이 색에 묻힌다. 띠는 겹쳐 밝아지는 합성이라 0.1을 넘기지 않는다.
 */
const GEM_FACET = { glow: 0.34, depth: 0.34, band: 0.22, sheen: 0.09, inset: 3 } as const;
