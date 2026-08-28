import Phaser from "phaser";
import { chipPoints, drawInnerVignette, drawLayer, drawShapeOutline, HOLO } from "./holo";
import { COLOR, textStyle } from "./theme";

/** 로컬 좌표 도형을 지금의 월드 좌표로 옮긴다. 팝업 안에서 마스크가 엉뚱한 자리에 남지 않게 한다. */
function worldPoints(matrix: Phaser.GameObjects.Components.TransformMatrix, flat: readonly number[]): Phaser.Geom.Point[] {
  const points: Phaser.Geom.Point[] = [];
  for (let index = 0; index < flat.length; index += 2) {
    const point = matrix.transformPoint(flat[index], flat[index + 1]);
    points.push(new Phaser.Geom.Point(point.x, point.y));
  }
  return points;
}

/** 로딩 표에 등록된 원정 진입 일러스트 키. 프리팹 밖에서 문자열을 반복하지 않는다. */
const EXPEDITION_ENTRY_ART = "content-expedition-entry";

/** 같은 출격 선택판에서 스토리와 원정이 공유하는 일러스트 버튼의 변경 가능한 내용이다. */
export interface IllustratedSortieButtonOptions {
  width: number;
  height: number;
  status: string;
  onClick: () => void;
  label?: string;
  artKey?: string;
  accentColor?: number;
  accentTextColor?: string;
  /** 한 줄 폭이 좁은 병렬 던전만 제목 크기를 낮춰 같은 버튼 비율을 유지한다. */
  labelSize?: number;
  /**
   * SD가 서는 쪽. 글자는 늘 그 반대쪽 아래 구석에 선다.
   *
   * SD를 세우는 일 자체는 씬이 맡는다 — Puppet은 컨테이너 변환을 물려받지 않으므로 팝업 안
   * 컨테이너에 넣을 수 없다. 버튼은 자리만 알려 주고 글자를 비켜 놓는다.
   */
  sdSide?: "left" | "right";
  /**
   * 한 판을 둘로 나눈 칸 중 어느 쪽인지.
   *
   * 나란히 선 두 콘텐츠를 각각 빗변으로 깎으면 서로 마주 본 두 조각처럼 보인다. 맞닿는
   * 변은 깎지 않고 곧게 두어 **한 장을 `|`로 끊은 것**처럼 읽히게 한다.
   */
  split?: "left" | "right";
}

/**
 * 버튼 안에서 SD가 서는 자리.
 *
 * 카드 그리드의 머리처럼 SD도 버튼 윗변 밖으로 조금 빠져나온다 — 그래서 키를 버튼보다 크게
 * 잡고 발끝은 아래 변 안쪽에 둔다. 씬은 이 값을 화면 좌표로 옮겨 그대로 세운다.
 */
export function sortieEntrySdSpot(width: number, height: number, side: "left" | "right"): SortieSdSpot {
  // 칸 안쪽으로 충분히 들여 세운다. 가장자리에 붙이면 옆 칸이나 판 밖으로 몸이 넘어간다.
  const inset = Math.min(168, width * 0.3);
  return {
    x: side === "left" ? -width / 2 + inset : width / 2 - inset,
    // 발끝을 아래 변 **밖**에 두면 다리가 판에 잘리고 상반신만 남는다. 카드가 얼굴을 크게
    // 채우는 것과 같은 이유로, 작은 칸에서는 전신보다 상반신이 훨씬 잘 읽힌다.
    groundY: height / 2 + Math.round(height * 0.34),
    height: Math.round(height * 1.68),
    // 머리가 지나갈 윗변 밖 띠. 어깨까지 담을 만큼 넓게 열어야 네모로 깎이지 않는다.
    overhang: Math.round(height * 0.42),
    // 어깨와 모자까지 지나가야 한다. 좁으면 머리가 네모로 깎여 카드에서 고쳤던 문제가 되풀이된다.
    bandWidth: Math.round(height * 1.7),
    // 복제 그림자는 칸 가운데를 향한다. 바깥을 향하면 그림자가 판 밖으로 번져 떠 보인다.
    shadowOffsetX: side === "left" ? 16 : -16,
    shadowOffsetY: 14,
  };
}

/** 씬이 SD 두 겹(그림자·본체)을 세우는 데 필요한 자리 값 전부다. */
export interface SortieSdSpot {
  x: number;
  groundY: number;
  height: number;
  overhang: number;
  bandWidth: number;
  shadowOffsetX: number;
  shadowOffsetY: number;
}

/** 원정 일러스트와 출격 계열의 주황 강조를 한 입력면으로 묶는 재사용 진입 버튼이다. */
export class ExpeditionEntryButton extends Phaser.GameObjects.Container {
  /**
   * SD를 칸 안에 가두는 마스크.
   *
   * 카드 그리드와 같은 결이다 — 몸은 판 안에 갇히고 머리만 윗변 밖으로 빠져나온다. Puppet은
   * 컨테이너 변환을 물려받지 않으므로 마스크도 **월드 좌표**로 매 프레임 다시 그린다.
   */
  readonly sdMask?: Phaser.Display.Masks.GeometryMask;

  constructor(scene: Phaser.Scene, x: number, y: number, options: IllustratedSortieButtonOptions) {
    super(scene, x, y);
    scene.add.existing(this);

    const corner = options.height * 0.46;
    // 맞닿는 변은 깎지 않는다. 왼쪽 칸은 오른쪽 아래를, 오른쪽 칸은 왼쪽 위를 곧게 둔다.
    const bevel = {
      topLeft: options.split === "right" ? 0 : corner,
      bottomRight: options.split === "left" ? 0 : corner,
    };
    const shape = chipPoints(options.width, options.height, { bevel });
    // 버튼은 배경 원화와 달리 액자 예외에 해당하므로 닫힌 윤곽과 내부 비네트를 함께 사용한다.
    const accent = options.accentColor ?? COLOR.sortie;
    const accentText = options.accentTextColor ?? COLOR.sortieText;
    this.add(drawLayer(scene, 0, 0, shape, { fill: 0x0d1219, alpha: HOLO.glass, edge: accent, edgeAlpha: 0.95 }));
    const art = scene.add.image(0, 0, options.artKey ?? EXPEDITION_ENTRY_ART);
    art.setScale(Math.max(options.width / art.width, options.height / art.height)).setAlpha(0.68);
    // 원화는 버튼 비율로 cover하므로 반드시 칩 실루엣에 마스킹한다. 그렇지 않으면 확대된
    // 사각 이미지가 크게 깎인 좌상단과 우하단 밖으로 삐져나온다.
    const artMask = scene.make.graphics({});
    // GeometryMask는 팝업 body/container 변환을 상속하지 않는다. 렌더 직전에 버튼의 실제 월드
    // 행렬로 다시 그려야 로비 팝업 안에서도 마스크가 화면 밖 엉뚱한 위치에 남지 않는다.
    const syncMask = (): void => {
      if (!this.active || !artMask.active) return;
      artMask.clear().fillStyle(0xffffff).fillPoints(worldPoints(this.getWorldTransformMatrix(), shape), true);
    };
    scene.events.on(Phaser.Scenes.Events.PRE_RENDER, syncMask);
    syncMask();
    art.setMask(artMask.createGeometryMask());
    this.once(Phaser.GameObjects.Events.DESTROY, () => {
      scene.events.off(Phaser.Scenes.Events.PRE_RENDER, syncMask);
      artMask.destroy();
    });
    // 사각 원화의 가장자리는 비네트와 주황 액자가 눌러 기존 홀로그램 판 안의 이미지로 읽히게 한다.
    this.add(art);
    this.add(drawInnerVignette(scene, 0, 0, shape, { strength: 0.74 }));
    this.add(drawShapeOutline(scene, 0, 0, shape, { color: accent, alpha: 0.92, width: 3 }));
    // 글자는 SD 반대쪽 아래 구석에 모인다. 원화 위에 얹히므로 진한 그림자를 한 겹 깔아
    // 밝은 그림 위에서도 이름과 상태가 먼저 읽히게 한다.
    const sdSide = options.sdSide ?? "left";
    const textRight = sdSide === "left";
    // 오른쪽 아래 모서리는 대각선으로 크게 깎여 있다. 아래로 갈수록 더 안쪽으로 밀지 않으면
    // 부제목이 그 빗변 밖으로 삐져나간다. 왼쪽 아래는 깎지 않으므로 고정 여백만 준다.
    const cornerInset = (fromBottom: number): number => (textRight ? Math.max(36, bevel.bottomRight - fromBottom + 22) : 40);
    const edgeX = (fromBottom: number): number => (textRight ? options.width / 2 - cornerInset(fromBottom) : -options.width / 2 + cornerInset(fromBottom));
    const originX = textRight ? 1 : 0;
    const labelBottom = 56;
    const statusBottom = 16;
    const label = scene.add
      .text(edgeX(labelBottom), options.height / 2 - labelBottom, options.label ?? "원정", textStyle({ role: "display", size: options.labelSize ?? 58, color: accentText }))
      .setOrigin(originX, 1)
      .setShadow(4, 5, "#04060a", 0, true, true);
    const status = scene.add
      .text(edgeX(statusBottom), options.height / 2 - statusBottom, options.status, textStyle({ role: "emphasis", size: 23, color: COLOR.ink }))
      .setOrigin(originX, 1)
      .setShadow(3, 4, "#04060a", 0, true, true);
    this.add([label, status]);

    if (options.sdSide) {
      // 칩 몸통과 머리 띠를 한 장에 채워 SD를 가둔다. 두 도형의 합집합이라 몸은 칸 안에,
      // 머리는 윗변 밖에 남는다.
      const spot = sortieEntrySdSpot(options.width, options.height, options.sdSide);
      // 띠는 윗변 아래로 **깎인 모서리 깊이만큼** 더 내려간다. 그러지 않으면 `/`로 잘린
      // 모서리가 머리 옆을 대각선으로 베어 낸다.
      const bandBottom = -options.height / 2 + Math.max(bevel.topLeft, bevel.bottomRight);
      const band = [
        spot.x - spot.bandWidth / 2, -options.height / 2 - spot.overhang,
        spot.x + spot.bandWidth / 2, -options.height / 2 - spot.overhang,
        spot.x + spot.bandWidth / 2, bandBottom,
        spot.x - spot.bandWidth / 2, bandBottom,
      ];
      const sdMaskGraphics = scene.make.graphics({});
      const syncSdMask = (): void => {
        if (!this.active || !sdMaskGraphics.active) return;
        const matrix = this.getWorldTransformMatrix();
        sdMaskGraphics.clear().fillStyle(0xffffff, 1);
        sdMaskGraphics.fillPoints(worldPoints(matrix, shape), true);
        sdMaskGraphics.fillPoints(worldPoints(matrix, band), true);
      };
      scene.events.on(Phaser.Scenes.Events.PRE_RENDER, syncSdMask);
      syncSdMask();
      this.sdMask = sdMaskGraphics.createGeometryMask();
      this.once(Phaser.GameObjects.Events.DESTROY, () => {
        scene.events.off(Phaser.Scenes.Events.PRE_RENDER, syncSdMask);
        sdMaskGraphics.destroy();
      });
    }

    // 투명 입력면 하나가 그림과 글자를 함께 확대해 공용 Button과 같은 눌림 피드백을 낸다.
    const hit = scene.add.rectangle(0, 0, options.width, options.height, 0xffffff, 0).setInteractive({ useHandCursor: true });
    this.add(hit);
    hit.on("pointerdown", () => this.setScale(1.08));
    hit.on("pointerout", () => this.setScale(1));
    hit.on("pointerup", () => { this.setScale(1); options.onClick(); });
  }
}
