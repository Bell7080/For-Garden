/** Phaser의 2D affine 계산 행렬에서 Puppet renderer가 필요한 숫자 계약만 분리한다. */
export interface AffineTransform {
  a: number; b: number; c: number; d: number; e: number; f: number;
}

/** Phaser 계산 행렬에 이미지 로컬 원점과 flip을 합쳐 WebGL mat3(column-major)로 펼친다. */
export function puppetAffineUniform(calc: AffineTransform, originX: number, originY: number, flipX = false, flipY = false): Float32Array {
  // 원본 정점 (0, 0)은 Image의 표시 원점이 아니므로 로컬 원점을 뺀 뒤 월드/카메라 행렬을 적용한다.
  const a = calc.a * (flipX ? -1 : 1);
  const b = calc.b * (flipX ? -1 : 1);
  const c = calc.c * (flipY ? -1 : 1);
  const d = calc.d * (flipY ? -1 : 1);
  return new Float32Array([a, b, 0, c, d, 0, calc.e - a * originX - c * originY, calc.f - b * originX - d * originY, 1]);
}

/** Phaser Container가 자식에 누적해 둔 alpha와 마지막 Camera alpha를 shader 값으로 합친다. */
export function puppetShaderAlpha(renderAlpha: number, cameraAlpha: number): number { return renderAlpha * cameraAlpha; }
