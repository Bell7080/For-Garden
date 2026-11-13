/**
 * 그림이 걸친 격자 셀의 삼각형만 고른다 — PuppetForge 런타임(`PuppetCreature`)이 하는 투명 셀
 * 생략을 이 게임의 indexed 렌더러로 옮긴 것이다.
 *
 * 판정은 PuppetForge가 공개한 `alphaVertexMask` → `visibleIndices`를 그대로 부른다(v0.43.0부터
 * 런타임 진입점에서 내보낸다). 편집기가 칠하기와 테두리 채움에 쓰는 마스크와 같은 판정이라
 * 다시 적지 않는다 — 다르게 고르면 칠한 정점과 그리는 셀이 갈린다.
 *
 * 정점 배열·번호·가중치는 그대로다. 그리는 삼각형 목록만 줄어들고, 같은 목록을
 * `Puppet.setDrawIndices`에 넘겨 그리지 않는 정점의 변형 계산도 건너뛴다(`IndexedPuppetCreature`).
 * Phaser를 읽지 않는다 — 원화 디코드와 함께 일꾼에서 돈다(`puppetParseWorker.ts`).
 */
import { alphaVertexMask, visibleIndices } from "puppetforge";
import type { PuppetMesh } from "puppetforge";

/**
 * 꼭짓점 네 개가 모두 "그림이 걸친 셀"의 꼭짓점인 셀만 남긴 인덱스. 격자 모양이 아니거나 정점이
 * 16비트 인덱스를 넘으면 `null`(부르는 쪽이 전체 인덱스를 그대로 그린다).
 */
export function drawableIndices(mesh: PuppetMesh, alpha: ArrayLike<number>, width: number, height: number): Uint16Array | null {
  const { cols, rows, indices } = mesh;
  if (cols <= 0 || rows <= 0 || indices.length !== cols * rows * 6) return null;
  if ((cols + 1) * (rows + 1) > 0x10000 || mesh.vertices.length !== (cols + 1) * (rows + 1) * 2) return null;
  return Uint16Array.from(visibleIndices(mesh, alphaVertexMask(alpha, width, height, mesh)));
}

/**
 * 묶음마다 한 번 고른 인덱스. 키는 텍스처 키와 같은 이름에 원화 파일·격자 크기를 붙인 것이다 —
 * 이름만으로는 다른 묶음이 같은 이름을 쓸 때 다른 원화의 셀을 빌려 올 수 있다.
 * 값이 작아(정점 수 × 2바이트 미만) 거주 규칙과 무관하게 남겨 둔다.
 */
const drawable = new Map<string, Uint16Array>();

export function drawableKey(name: string, texture: string, cols: number, rows: number): string {
  return `${name}|${texture}|${cols}x${rows}`;
}

export function registerDrawableIndices(key: string, indices: Uint16Array): void {
  drawable.set(key, indices);
}

export function lookupDrawableIndices(key: string): Uint16Array | undefined {
  return drawable.get(key);
}
