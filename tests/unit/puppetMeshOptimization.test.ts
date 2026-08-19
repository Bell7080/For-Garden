import { describe, expect, it } from "vitest";
import type { PuppetMesh, PuppetProject } from "puppetforge";
import { optimizePuppetMesh, optimizePuppetProject } from "../../src/puppets/meshOptimization";

/** 테스트용 정규 격자. 실제 내보내기와 동일하게 정점마다 Bone 가중치를 하나씩 둔다. */
function grid(cols: number, rows: number): PuppetMesh {
  const vertices: number[] = [];
  const weights: PuppetMesh["weights"] = [];
  for (let y = 0; y <= rows; y += 1) {
    for (let x = 0; x <= cols; x += 1) {
      vertices.push(x * 10, y * 10);
      // 좌상단과 우하단 표식을 통해 리샘플 뒤에도 위치별 영향 영역이 보존되는지 확인한다.
      const boneId = x === 0 && y === 0 ? "fixed" : x === cols && y === rows ? "pinned" : "soft";
      weights.push({ boneIds: [boneId], weights: [1] });
    }
  }
  return { resolution: "smoothNormal", cols, rows, vertices, indices: [], weights };
}

describe("Puppet Phaser mesh optimization", () => {
  it("긴 변을 제한해 Phaser가 매 프레임 갱신할 삼각형 수를 크게 줄인다", () => {
    const optimized = optimizePuppetMesh(grid(181, 256));

    expect(optimized.cols).toBe(34);
    expect(optimized.rows).toBe(48);
    expect(optimized.weights).toHaveLength((34 + 1) * (48 + 1));
    expect(optimized.indices).toHaveLength(34 * 48 * 6);
  });

  it("완전 고정·위치 고정에 쓰이는 Bone 가중치와 전체 이미지 경계를 보존한다", () => {
    const optimized = optimizePuppetMesh(grid(108, 108));

    expect(optimized.weights[0]).toEqual({ boneIds: ["fixed"], weights: [1] });
    expect(optimized.weights.at(-1)).toEqual({ boneIds: ["pinned"], weights: [1] });
    expect(optimized.vertices.slice(0, 2)).toEqual([0, 0]);
    expect(optimized.vertices.slice(-2)).toEqual([1080, 1080]);
  });

  it("이미 가벼운 격자는 불필요하게 복제하지 않는다", () => {
    const original = grid(24, 24);
    expect(optimizePuppetMesh(original)).toBe(original);
  });

  it("Bone의 완전 고정과 애니메이션별 위치 고정 설정은 원본 객체 그대로 유지한다", () => {
    const fixedBone = {
      id: "foot",
      name: "발",
      parentId: null,
      x: 0,
      y: 0,
      rotation: 0,
      scaleX: 1,
      scaleY: 1,
      tags: ["foot"],
      motionStrength: 1,
      deform: "fixed" as const,
      color: "#ffffff",
    };
    const animations: PuppetProject["animations"] = {
      idle: {
        name: "idle",
        duration: 1,
        loop: true,
        tracks: [],
        // 툴에서 동작별로 지정한 위치 고정 덮어쓰기도 Mesh 최적화 대상이 아니다.
        deform: { foot: "pinnedSoft" },
      },
    };
    const project: PuppetProject = {
      format: "puppetforge",
      version: 14,
      character: { name: "test", texture: "test.png", width: 1080, height: 1080, pixelArt: false },
      bones: [fixedBone],
      mesh: grid(108, 108),
      animations,
    };

    const optimized = optimizePuppetProject(project);
    expect(optimized.bones).toBe(project.bones);
    expect(optimized.bones[0].deform).toBe("fixed");
    expect(optimized.animations).toBe(animations);
    expect(optimized.animations.idle.deform?.foot).toBe("pinnedSoft");
  });
});
