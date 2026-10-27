/** 재화·가챠용 서버 난수. 예측 가능한 Math.random으로 대체하지 않는다. */
export function secureRandom(): number {
  const words = globalThis.crypto.getRandomValues(new Uint32Array(2));
  return ((words[0] >>> 5) * 67_108_864 + (words[1] >>> 6)) / 9_007_199_254_740_992;
}
