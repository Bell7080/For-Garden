import Phaser from "phaser";

/** 컨테이너가 자를 화면 사각형(씬 좌표). */
export interface ScissorRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

type ContainerRender = (
  renderer: Phaser.Renderer.WebGL.WebGLRenderer,
  src: Phaser.GameObjects.Container,
  camera: Phaser.Cameras.Scene2D.Camera,
  parentMatrix?: Phaser.GameObjects.Components.TransformMatrix,
) => void;

/**
 * 사각 영역으로 **scissor 클립**하는 컨테이너.
 *
 * 스크롤 목록이 뷰포트 사각형으로 잘리는 것뿐이라면 기하 마스크(스텐실)를 쓸 이유가 없다. 스텐실은
 * 마스크를 켜고 끌 때마다 렌더 묶음을 끊고 모바일에서 scissor보다 훨씬 비싸다 — 업계에서도
 * 사각 스크롤 영역은 scissor(Unity의 RectMask2D)로 자르고 스텐실은 비사각 모양에만 남긴다.
 *
 * 클립은 컨테이너 자신이 아니라 **씬 좌표의 고정된 사각형**이다(목록이 움직여도 뷰포트는 그대로).
 * 장면 진입 연출이 카메라를 옮기므로 사각형은 그릴 때마다 카메라를 거쳐 화면 좌표로 옮긴다.
 * 안쪽 카드의 칩 모양 마스크는 그대로 둔다.
 */
export class ScissorContainer extends Phaser.GameObjects.Container {
  private clip?: ScissorRect;

  setClip(rect: ScissorRect | undefined): this {
    this.clip = rect;
    return this;
  }

  renderWebGL(
    renderer: Phaser.Renderer.WebGL.WebGLRenderer,
    src: Phaser.GameObjects.Container,
    camera: Phaser.Cameras.Scene2D.Camera,
    parentMatrix?: Phaser.GameObjects.Components.TransformMatrix,
  ): void {
    const base = (Phaser.GameObjects.Container.prototype as unknown as { renderWebGL: ContainerRender }).renderWebGL;
    const clip = this.clip;
    // 회전한 카메라에서는 축에 맞춘 사각형으로 표현할 수 없다. 이 화면들은 회전하지 않는다.
    if (!clip || (camera as unknown as { rotation?: number }).rotation) {
      base.call(this, renderer, src, camera, parentMatrix);
      return;
    }
    // 장면 좌표 → 화면 좌표(카메라 위치·스크롤·확대). 확대는 카메라 중심 기준이다.
    const zoomX = camera.zoomX;
    const zoomY = camera.zoomY;
    const halfW = camera.width / 2;
    const halfH = camera.height / 2;
    const left = camera.x + halfW + (clip.x - camera.scrollX - halfW) * zoomX;
    const top = camera.y + halfH + (clip.y - camera.scrollY - halfH) * zoomY;
    const x = Math.round(left);
    const y = Math.round(top);
    const width = Math.round(left + clip.width * zoomX) - x;
    const height = Math.round(top + clip.height * zoomY) - y;
    renderer.pipelines.flush();
    renderer.pushScissor(x, y, width, height);
    base.call(this, renderer, src, camera, parentMatrix);
    renderer.pipelines.flush();
    renderer.popScissor();
  }
}
