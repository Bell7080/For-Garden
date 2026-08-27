import Phaser from "phaser";
import { chipPoints, drawInnerVignette, drawLayer, drawShapeOutline, HOLO } from "./holo";
import { COLOR, textStyle } from "./theme";

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
}

/** 원정 일러스트와 출격 계열의 주황 강조를 한 입력면으로 묶는 재사용 진입 버튼이다. */
export class ExpeditionEntryButton extends Phaser.GameObjects.Container {
  constructor(scene: Phaser.Scene, x: number, y: number, options: IllustratedSortieButtonOptions) {
    super(scene, x, y);
    scene.add.existing(this);

    const shape = chipPoints(options.width, options.height, {
      bevel: { topLeft: options.height * 0.46, bottomRight: options.height * 0.46 },
    });
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
      const matrix = this.getWorldTransformMatrix();
      const points = shape.reduce<Phaser.Geom.Point[]>((result, value, index) => {
        if (index % 2 !== 0) return result;
        const point = matrix.transformPoint(value, shape[index + 1]);
        result.push(new Phaser.Geom.Point(point.x, point.y));
        return result;
      }, []);
      artMask.clear().fillStyle(0xffffff).fillPoints(points, true);
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
    this.add(scene.add.text(-options.width / 2 + Math.min(78, options.width * 0.12), -18, options.label ?? "원정", textStyle({ role: "display", size: options.labelSize ?? 42, color: accentText })).setOrigin(0, 0.5));
    this.add(scene.add.text(-options.width / 2 + 80, 40, options.status, textStyle({ role: "emphasis", size: 20, color: COLOR.ink })).setOrigin(0, 0.5));

    // 투명 입력면 하나가 그림과 글자를 함께 확대해 공용 Button과 같은 눌림 피드백을 낸다.
    const hit = scene.add.rectangle(0, 0, options.width, options.height, 0xffffff, 0).setInteractive({ useHandCursor: true });
    this.add(hit);
    hit.on("pointerdown", () => this.setScale(1.08));
    hit.on("pointerout", () => this.setScale(1));
    hit.on("pointerup", () => { this.setScale(1); options.onClick(); });
  }
}
