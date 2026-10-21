import { describe, expect, it } from "vitest";
import { puppetAffineUniform, puppetOffsetUniform, puppetShaderAlpha, type AffineTransform } from "../../src/puppets/renderTransform";

/** column-major shader 행렬로 Puppet 로컬 정점을 화면 좌표까지 보내는 작은 검증기다. */
function transform(matrix: Float32Array, x: number, y: number): [number, number] {
  return [matrix[0] * x + matrix[3] * y + matrix[6], matrix[1] * x + matrix[4] * y + matrix[7]];
}

describe("Puppet WebGL 부모 변환", () => {
  it('부모 회전·비균등 배율·shear·좌우 반전에서도 잔상 행렬을 다시 합성한 것과 같은 좌표를 재사용 배열에 쓴다',()=>{
    const space={a:1.2,b:.8,c:-.3,d:.7};
    const calc={a:2.4,b:1.6,c:.45,d:-1.05,e:340,f:710};
    const baseBuffer=new Float32Array(9),ghostBuffer=new Float32Array(9);
    const base=puppetAffineUniform(calc,40,80,true,false,baseBuffer);
    const original=[...base];
    expect(base).toBe(baseBuffer);
    for(const [dx,dy] of [[8,0],[-7,6],[0,-10]]){
      const old=puppetAffineUniform({...calc,e:calc.e+space.a*dx+space.c*dy,f:calc.f+space.b*dx+space.d*dy},40,80,true);
      const next=puppetOffsetUniform(base,space,dx,dy,ghostBuffer);
      expect(next).toBe(ghostBuffer);
      for(let i=0;i<9;i++)expect(next[i]).toBeCloseTo(old[i],3);
    }
    expect([...base]).toEqual(original);
  });
  it("부모 이동·축별 배율·회전을 포함한 affine 행렬을 로컬 정점에 적용한다", () => {
    // 자식 (10, 20)을 부모 (이동 100,200 · scale 2,3 · rotation 90°)에 합성한 결과다.
    const calc: AffineTransform = { a: 0, b: 2, c: -3, d: 0, e: 40, f: 220 };
    // 원점 (5, 6)에 놓인 정점은 자식 (10, 20), 이어 부모 회전/배율과 이동을 차례로 통과한다.
    expect(transform(puppetAffineUniform(calc, 5, 6), 5, 6)).toEqual([40, 220]);
    // 원점 오른쪽 한 픽셀은 90도 회전된 부모 X축을 따라 화면 아래로 두 픽셀 이동한다.
    const right = transform(puppetAffineUniform(calc, 5, 6), 6, 6);
    expect(right[0]).toBeCloseTo(40); expect(right[1]).toBeCloseTo(222);
  });

  it("부모에서 누적된 alpha와 카메라 alpha를 최종 shader alpha에 곱한다", () => {
    // Container renderer가 0.5 × 0.4를 자식 alpha에 누적한 상황까지 포함한다.
    expect(puppetShaderAlpha(0.5 * 0.4, 0.75)).toBeCloseTo(0.15);
  });
});
