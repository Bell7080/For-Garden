import Phaser from "phaser";
import type { ExpeditionMapNode } from "../core/expeditionMap";
import { BUTTON_DRAG_CANCEL_DISTANCE } from "./Button";
import { drawGlyph, type GlyphName } from "./glyphs";
import { chipPoints, drawInnerVignette, drawLayer } from "./holo";
import { COLOR } from "./theme";
import {
  clampExpeditionMapOffset,
  EXPEDITION_MAP_LAYOUT,
  expeditionMapWorldHeight,
  expeditionNodePosition,
  focusExpeditionFloor,
} from "./expeditionLayout";

export interface ExpeditionMapViewOptions {
  top: number;
  bottom: number;
  nodes: readonly ExpeditionMapNode[];
  currentNodeId: string | null;
  visitedIds: readonly string[];
  onSelect: (node: ExpeditionMapNode) => void;
}

/** 경로, 노드, 입력면과 스크롤을 한 좌표계에서 소유하는 원정 지도 전용 프리팹이다. */
export class ExpeditionMapView extends Phaser.GameObjects.Container {
  private readonly world: Phaser.GameObjects.Container;
  private readonly viewportHeight: number;
  private offset = 0;
  private pointerId?: number;
  private pressY = 0;
  private lastY = 0;
  private dragged = false;
  private pressedNode?: ExpeditionMapNode;
  private pressedVisual?: { object: Phaser.GameObjects.Container; scale: number };
  private pressedCallback?: (node: ExpeditionMapNode) => void;

  constructor(scene: Phaser.Scene, options: ExpeditionMapViewOptions) {
    super(scene, 0, options.top);
    scene.add.existing(this);
    this.viewportHeight = options.bottom - options.top;
    this.world = scene.add.container(0, 0);
    this.add(this.world);

    // 마스크와 경로/노드 월드는 같은 프리팹에 묶되 마스크 도형 자체는 보이지 않게 둔다.
    const maskShape = scene.make.graphics({ x: 0, y: options.top });
    maskShape.fillStyle(0xffffff).fillRect(0, 0, scene.scale.width, this.viewportHeight);
    this.setMask(maskShape.createGeometryMask());
    this.once(Phaser.GameObjects.Events.DESTROY, () => maskShape.destroy());

    const byId = new Map(options.nodes.map((node) => [node.id, node]));
    const reachable = new Set(options.currentNodeId === null
      ? options.nodes.filter((node) => node.floor === 1).map((node) => node.id)
      : byId.get(options.currentNodeId)?.successorIds ?? []);
    const visited = new Set(options.visitedIds);

    // 모든 선을 노드와 동일한 world에 넣어 컨테이너 이동 중 좌표가 갈라지지 않게 한다.
    const paths = scene.add.graphics().lineStyle(4, COLOR.accent, 0.25);
    options.nodes.forEach((node) => node.successorIds.forEach((id) => {
      const next = byId.get(id);
      if (!next) return;
      const fromPoint = expeditionNodePosition(node.floor, node.column);
      const toPoint = expeditionNodePosition(next.floor, next.column);
      paths.lineBetween(fromPoint.x, fromPoint.y, toPoint.x, toPoint.y);
    }));
    this.world.add(paths);
    options.nodes.forEach((node) => this.addNode(node, reachable.has(node.id), visited.has(node.id), options.onSelect));

    // 빈 지도에서도 드래그를 시작할 수 있는 투명 입력면은 노드보다 먼저(아래에) 둔다.
    const dragSurface = scene.add.zone(scene.scale.width / 2, this.viewportHeight / 2, scene.scale.width, this.viewportHeight).setInteractive();
    this.addAt(dragSurface, 0);
    dragSurface.on("pointerdown", (pointer: Phaser.Input.Pointer) => this.beginDrag(pointer));
    scene.input.on("pointermove", this.moveDrag, this);
    scene.input.on("pointerup", this.endDrag, this);
    scene.input.on("gameout", this.cancelDrag, this);
    scene.input.on("wheel", this.handleWheel, this);
    this.once(Phaser.GameObjects.Events.DESTROY, () => {
      scene.input.off("pointermove", this.moveDrag, this);
      scene.input.off("pointerup", this.endDrag, this);
      scene.input.off("gameout", this.cancelDrag, this);
      scene.input.off("wheel", this.handleWheel, this);
    });

    // 최초 진입과 씬 재생성(노드 완료 뒤) 모두 다음 도달 가능 층을 중앙에 둔다.
    const currentFloor = options.currentNodeId ? (byId.get(options.currentNodeId)?.floor ?? 0) + 1 : 1;
    this.setOffset(focusExpeditionFloor(currentFloor, this.viewportHeight));
  }

  /** 테두리 대신 크기, 발광, 명도로 완료/선택 가능/잠김 상태를 구분한다. */
  private addNode(node: ExpeditionMapNode, reachable: boolean, visited: boolean, onSelect: (node: ExpeditionMapNode) => void): void {
    const point = expeditionNodePosition(node.floor, node.column);
    const baseSize = node.type === "boss" ? EXPEDITION_MAP_LAYOUT.bossSize : EXPEDITION_MAP_LAYOUT.nodeSize;
    const scale = reachable ? 1.16 : visited ? 0.92 : 0.78;
    const alpha = reachable ? 1 : visited ? 0.7 : 0.34;
    const visual = this.scene.add.container(point.x, point.y).setScale(scale).setAlpha(alpha);
    const frame = chipPoints(baseSize, baseSize * 0.84, { bevel: { topLeft: 16, bottomRight: 13 } });
    if (reachable) {
      // 확대된 반투명 실루엣을 겹쳐 외곽선이 아닌 부드러운 상태 발광을 만든다.
      [1.34, 1.22, 1.12].forEach((glowScale, index) => visual.add(
        drawLayer(this.scene, 0, 0, frame, { fill: COLOR.sortie, alpha: 0.07 + index * 0.035 }).setScale(glowScale),
      ));
    }
    visual.add(drawLayer(this.scene, 0, 0, frame, { fill: visited ? COLOR.panel : 0x131820, alpha: 0.94 }));
    visual.add(drawInnerVignette(this.scene, 0, 0, frame, { strength: 0.45 }));
    visual.add(drawGlyph(this.scene, `expedition-${node.type}` as GlyphName, 0, 0, baseSize * 0.54, reachable ? COLOR.sortie : COLOR.inkDimHex, 1, 3));
    this.world.add(visual);

    // 손가락 입력면은 축소되는 시각 노드보다 항상 크게 유지한다.
    const hit = this.scene.add.rectangle(point.x, point.y, EXPEDITION_MAP_LAYOUT.hitSize, EXPEDITION_MAP_LAYOUT.hitSize, 0xffffff, 0);
    this.world.add(hit);
    if (!reachable) return;
    hit.setInteractive({ useHandCursor: true });
    hit.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      this.pressedNode = node;
      this.pressedVisual = { object: visual, scale };
      this.pressedCallback = onSelect;
      this.beginDrag(pointer);
      visual.setScale(scale * 1.08);
    });
  }

  /** 버튼과 같은 포인터 ID/누적 이동 거리 방식으로 한 번의 제스처를 시작한다. */
  private beginDrag(pointer: Phaser.Input.Pointer): void {
    if (this.pointerId !== undefined) return;
    this.pointerId = pointer.id;
    this.pressY = pointer.worldY;
    this.lastY = pointer.worldY;
    this.dragged = false;
  }

  /** 세로 변화량만 월드에 적용하고 임계값을 넘긴 순간 노드 탭 후보를 취소한다. */
  private moveDrag(pointer: Phaser.Input.Pointer): void {
    if (pointer.id !== this.pointerId) return;
    const delta = pointer.worldY - this.lastY;
    this.lastY = pointer.worldY;
    if (Math.abs(pointer.worldY - this.pressY) > BUTTON_DRAG_CANCEL_DISTANCE) this.dragged = true;
    this.setOffset(this.offset + delta);
  }

  /** 드래그가 아니었던 같은 포인터만 노드 선택으로 확정한다. */
  private endDrag(pointer: Phaser.Input.Pointer): void {
    if (pointer.id !== this.pointerId) return;
    const node = this.pressedNode;
    const callback = this.pressedCallback;
    this.pressedVisual?.object.setScale(this.pressedVisual.scale);
    this.pointerId = undefined;
    this.pressedNode = undefined;
    this.pressedVisual = undefined;
    this.pressedCallback = undefined;
    if (!this.dragged && node && callback) callback(node);
  }

  /** 캔버스가 포인터를 잃으면 선택 없이 제스처 상태를 폐기한다. */
  private cancelDrag(): void {
    this.pointerId = undefined;
    this.pressedNode = undefined;
    this.pressedVisual?.object.setScale(this.pressedVisual.scale);
    this.pressedVisual = undefined;
    this.pressedCallback = undefined;
    this.dragged = false;
  }

  /** 포인터가 뷰포트 안에 있을 때 휠 변화량을 제한된 세로 월드 이동으로 바꾼다. */
  private handleWheel(pointer: Phaser.Input.Pointer, _objects: unknown[], _deltaX: number, deltaY: number): void {
    if (pointer.worldY < this.y || pointer.worldY > this.y + this.viewportHeight) return;
    this.setOffset(this.offset - deltaY);
  }

  /** 순수 경계 계산 결과만 실제 컨테이너 위치에 반영한다. */
  private setOffset(offset: number): void {
    this.offset = clampExpeditionMapOffset(offset, this.viewportHeight, expeditionMapWorldHeight());
    this.world.setY(this.offset);
  }
}
