import type { PuppetMesh, PuppetProject, VertexWeight } from "puppetforge";

/**
 * Phaser Mesh는 인덱스를 공유하지 않고 삼각형마다 JS Vertex 객체를 만든다. PuppetForge 편집기의
 * 고밀도 격자를 그대로 넘기면 캐릭터 한 명도 매 프레임 수십만 객체를 순회하므로, 인게임에서는
 * 화면 크기에 충분한 긴 변 48칸으로 줄인다. 애니메이션과 고정 방식은 건드리지 않는다.
 */
export const GAME_MESH_MAX_CELLS = 48;

/** 원본 격자에서 가장 가까운 정점의 Bone 가중치를 복사해 칠한 영향 영역을 보존한다. */
function sampleWeight(mesh: PuppetMesh, xRatio: number, yRatio: number): VertexWeight {
  const sourceX = Math.round(xRatio * mesh.cols);
  const sourceY = Math.round(yRatio * mesh.rows);
  const source = mesh.weights[sourceY * (mesh.cols + 1) + sourceX];

  // 런타임 프로젝트는 빈 칸도 객체지만 방어적으로 처리해 미칠 영역은 고정된 원본 위치로 둔다.
  return source
    ? { boneIds: [...source.boneIds], weights: [...source.weights] }
    : { boneIds: [], weights: [] };
}

/** 긴 변의 셀 수를 기준으로 원본 종횡비와 거의 정사각형인 셀 모양을 유지한다. */
function targetGrid(mesh: PuppetMesh, maxCells: number): { cols: number; rows: number } {
  const scale = maxCells / Math.max(mesh.cols, mesh.rows);
  return {
    cols: Math.max(1, Math.round(mesh.cols * scale)),
    rows: Math.max(1, Math.round(mesh.rows * scale)),
  };
}

/** Phaser용 저밀도 격자와 삼각형 인덱스를 만들고 원본 영향 가중치를 대응시킨다. */
export function optimizePuppetMesh(mesh: PuppetMesh, maxCells = GAME_MESH_MAX_CELLS): PuppetMesh {
  if (Math.max(mesh.cols, mesh.rows) <= maxCells) return mesh;

  const { cols, rows } = targetGrid(mesh, maxCells);
  const width = mesh.vertices[mesh.vertices.length - 2] ?? 0;
  const height = mesh.vertices[mesh.vertices.length - 1] ?? 0;
  const vertices: number[] = [];
  const weights: VertexWeight[] = [];

  for (let y = 0; y <= rows; y += 1) {
    for (let x = 0; x <= cols; x += 1) {
      const xRatio = x / cols;
      const yRatio = y / rows;
      vertices.push(xRatio * width, yRatio * height);
      weights.push(sampleWeight(mesh, xRatio, yRatio));
    }
  }

  const indices: number[] = [];
  const vertexAt = (x: number, y: number): number => y * (cols + 1) + x;
  for (let y = 0; y < rows; y += 1) {
    for (let x = 0; x < cols; x += 1) {
      const topLeft = vertexAt(x, y);
      const topRight = vertexAt(x + 1, y);
      const bottomLeft = vertexAt(x, y + 1);
      const bottomRight = vertexAt(x + 1, y + 1);
      indices.push(topLeft, topRight, bottomLeft, topRight, bottomRight, bottomLeft);
    }
  }

  return { resolution: "normal", cols, rows, vertices, indices, weights };
}

/** PuppetForge 프로젝트의 동작·Bone·deform 설정은 그대로 두고 Phaser가 그릴 Mesh만 교체한다. */
export function optimizePuppetProject(project: PuppetProject): PuppetProject {
  if (!project.mesh) return project;
  const mesh = optimizePuppetMesh(project.mesh);
  return mesh === project.mesh ? project : { ...project, mesh };
}
