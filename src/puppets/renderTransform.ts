/** Phaser의 2D affine 계산 행렬에서 Puppet renderer가 필요한 숫자 계약만 분리한다. */
export interface AffineTransform {
  a: number; b: number; c: number; d: number; e: number; f: number;
}

/** Phaser 계산 행렬에 이미지 로컬 원점과 flip을 합쳐 WebGL mat3(column-major)로 펼친다. */
export function puppetAffineUniform(calc: AffineTransform, originX: number, originY: number, flipX = false, flipY = false, out = new Float32Array(9)): Float32Array {
  // 원본 정점 (0, 0)은 Image의 표시 원점이 아니므로 로컬 원점을 뺀 뒤 월드/카메라 행렬을 적용한다.
  const a = calc.a * (flipX ? -1 : 1);
  const b = calc.b * (flipX ? -1 : 1);
  const c = calc.c * (flipY ? -1 : 1);
  const d = calc.d * (flipY ? -1 : 1);
  out[0]=a; out[1]=b; out[2]=0; out[3]=c; out[4]=d; out[5]=0;
  out[6]=calc.e-a*originX-c*originY; out[7]=calc.f-b*originX-d*originY; out[8]=1;
  return out;
}

/** 잔상 변위는 개체 scale/flip 이전의 부모·카메라 좌표축을 따른다. */
export function puppetOffsetUniform(base: Float32Array, space: Pick<AffineTransform, "a" | "b" | "c" | "d">, dx: number, dy: number, out = new Float32Array(9)): Float32Array {
  out.set(base);
  out[6]=base[6]+space.a*dx+space.c*dy;
  out[7]=base[7]+space.b*dx+space.d*dy;
  return out;
}

/** Phaser Container가 자식에 누적해 둔 alpha와 마지막 Camera alpha를 shader 값으로 합친다. */
export function puppetShaderAlpha(renderAlpha: number, cameraAlpha: number): number { return renderAlpha * cameraAlpha; }
