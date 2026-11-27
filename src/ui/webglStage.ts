/**
 * 게임 캔버스 밖에 겹쳐 세우는 three.js 무대(연구 시네마틱·SSR 전조)의 WebGL 컨텍스트 관리.
 *
 * **무대를 내릴 때 컨텍스트를 직접 돌려준다**(`releaseWebglCanvases`). three.js의 `renderer.dispose()`는 자원만
 * 지우고 컨텍스트는 쥐고 있어, 캔버스를 DOM에서 떼도 가비지 컬렉터가 거둘 때까지 살아 있다. 브라우저는 한 페이지의
 * 살아 있는 컨텍스트 수에 상한을 두고(크롬 16개 남짓, iOS WebKit은 더 적다) 넘치면 **가장 오래된 것** — 게임 캔버스 —
 * 를 거둔다. 그래서 연구를 연달아 돌리는 계정만 연구소에서 화면이 까매졌다(client_errors `webgl.contextLost` scene=lab,
 * 직전 이동이 늘 「젬으로 채우기」였다). 한 번 잃은 게임 캔버스는 일꾼이 디코드해 넘긴 원화를 되살리지 못해 그 뒤의
 * 이야기 화면도 검게 남는다.
 *
 * **WebGL2 확인도 한 번만 하고 그 컨텍스트도 곧바로 돌려준다**(`supportsWebgl2`). 예전에는 확인할 때마다 새 캔버스에서
 * 컨텍스트를 하나씩 만들고 버려, 연구 한 번에 두세 개가 상한을 함께 갉아먹었다.
 */

let webgl2Support: boolean | undefined;

/** 이 기기에서 WebGL2 무대를 세울 수 있는가. 처음 한 번만 재고, 잰 컨텍스트는 곧바로 돌려준다. */
export function supportsWebgl2(): boolean {
  if (webgl2Support !== undefined) return webgl2Support;
  try {
    const probe = document.createElement("canvas");
    const gl = probe.getContext("webgl2");
    webgl2Support = Boolean(gl);
    loseContext(gl);
  } catch {
    webgl2Support = false;
  }
  return webgl2Support;
}

/**
 * `root` 아래의 모든 캔버스가 쥔 WebGL 컨텍스트를 돌려준다. 무대의 `destroy`·`dispose`가 캔버스를 DOM에서 떼기 **전에**
 * 캔버스 목록을 받아 두었다가 넘겨도 된다(`collectCanvases`).
 */
export function releaseWebglCanvases(canvases: readonly HTMLCanvasElement[]): void {
  for (const canvas of canvases) {
    try {
      // 이미 만든 컨텍스트와 같은 종류를 물어야 그 컨텍스트가 돌아온다(다른 종류면 null — 그대로 넘어간다).
      loseContext(canvas.getContext("webgl2") ?? canvas.getContext("webgl"));
    } catch {
      /* 이미 죽은 캔버스여도 나머지는 마저 돌려준다. */
    }
  }
}

/** `root` 아래의 캔버스 목록. 무대를 부수기 전에 받아 둔다 — 부수면서 캔버스를 떼어 낸다. */
export function collectCanvases(root: ParentNode): HTMLCanvasElement[] {
  return Array.from(root.querySelectorAll("canvas"));
}

function loseContext(gl: WebGLRenderingContext | WebGL2RenderingContext | null): void {
  if (!gl || gl.isContextLost()) return;
  gl.getExtension("WEBGL_lose_context")?.loseContext();
}
