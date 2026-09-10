import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

// Phaser는 DOM/WebGL 초기화가 필요한 모듈이므로, 이 단위 검사는 렌더 경계의 소스 계약만 고정한다.
const SOURCE = readFileSync(resolve(process.cwd(), "src/puppets/IndexedPuppetCreature.ts"), "utf8");
const RENDER_WEBGL = SOURCE.slice(SOURCE.indexOf("  renderWebGL("), SOURCE.indexOf("  /** scene 종료 시", SOURCE.indexOf("  renderWebGL(")));
const UPDATE_STEP = SOURCE.slice(SOURCE.indexOf("  private step("), SOURCE.indexOf("  /** 최초 렌더 때", SOURCE.indexOf("  private step(")));
const ENSURE_BUFFERS = SOURCE.slice(SOURCE.indexOf("  private ensureBuffers("), SOURCE.indexOf("  /** Phaser batch 사이에서"));
const RELEASE = SOURCE.slice(SOURCE.indexOf("  private release("));

describe("Indexed Puppet WebGL pipeline 경계", () => {
  it("Phaser의 일반 Image 타입 힌트와 무관하게 매 Puppet draw를 격리한다", () => {
    // Image 상속 때문에 잘못 일치하는 최적화 힌트를 다시 사용하면 이 검사가 회귀를 즉시 알린다.
    expect(RENDER_WEBGL).not.toContain("renderer.newType");
    expect(RENDER_WEBGL).not.toContain("renderer.nextTypeMatch");
    expect(RENDER_WEBGL).toContain("renderer.pipelines.clear();");
  });

  it("frameTexture가 없는 반환과 draw 오류도 finally에서 Phaser pipeline을 복원한다", () => {
    // 조기 return이 try 안에 있고 rebind가 finally 안에 있어야 custom program이 다음 개체로 새지 않는다.
    expect(RENDER_WEBGL).toMatch(/try\s*\{[\s\S]*if \(!frameTexture\) return;[\s\S]*\}\s*finally\s*\{[\s\S]*renderer\.pipelines\.rebind\(\);/);
  });

  it("컨텍스트 복구를 구독한 뒤에야 캐시된 program을 쓴다", () => {
    // 모바일에서 앱을 백그라운드로 보냈다 돌아오면 WebGL 컨텍스트가 날아간다. Phaser는 제가
    // 감싼 자원만 되살리고 여기서 raw gl로 만든 program·buffer는 손대지 않으며, **복구 뒤에도
    // renderer.gl은 같은 객체**라 WeakMap이 죽은 program을 계속 돌려준다. 구독을 지우면
    // 돌아온 화면에서 캐릭터가 통째로 그려지지 않는다.
    expect(RENDER_WEBGL).toMatch(/watchContextRestore\(renderer\);[\s\S]*programs\.get\(gl\)/);
    expect(SOURCE).toContain("Phaser.Renderer.Events.RESTORE_WEBGL");
    // 복구 때 캐시를 비우지 않으면 다시 만들 기회가 영영 오지 않는다.
    expect(SOURCE).toMatch(/RESTORE_WEBGL[\s\S]*gpuGeneration \+= 1;[\s\S]*programs\.delete\(renderer\.gl\)/);
  });

  it("컨텍스트 세대가 바뀐 버퍼는 다시 만들고, 지우지는 않는다", () => {
    // 죽은 컨텍스트의 손잡이를 새 컨텍스트에 지우라고 하면 INVALID_OPERATION이다.
    expect(ENSURE_BUFFERS).toMatch(/this\.buffers && this\.buffersGeneration === gpuGeneration/);
    expect(RELEASE).toMatch(/if \(this\.buffersGeneration === gpuGeneration\)[\s\S]*deleteBuffer/);
  });

  it("씬 전환 중 이미 파괴된 Puppet의 대기 중인 UPDATE 콜백을 건너뛴다", () => {
    // EventEmitter가 이미 만든 순회 목록은 off 이후에도 현재 emit에서 콜백을 부를 수 있으므로
    // scene.game에 닿기 전 active와 scene을 모두 검사하는 순서를 소스 계약으로 고정한다.
    expect(UPDATE_STEP).toMatch(/if \(!this\.active \|\| !this\.scene\) return;[\s\S]*this\.scene\.game\.loop/);
  });
});
