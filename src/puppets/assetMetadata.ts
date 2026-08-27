import type { PuppetAsset } from "./assets";

/**
 * 폰투스 ZIP을 정적으로 검사한 렌더링 메타데이터다.
 *
 * 브라우저 전용 Phaser 런타임을 불러오지 않아도 단위 테스트가 원본 크기와 alpha > 16 경계를
 * 검증할 수 있도록 URL과 분리한다. 좌표는 두 ZIP 안 WebP의 원본 픽셀 좌표계다.
 */
export const PONTUS_PORTRAIT_METADATA: Omit<PuppetAsset, "url"> = {
  imageWidth: 1024,
  imageHeight: 1536,
  content: { left: 1, top: 3, right: 1024, bottom: 1481 },
  portraitZoom: 0.82,
  portraitOffsetY: 48,
};

/** 폰투스 SD ZIP의 1254px 정사각 원본과 alpha > 16 경계다. */
export const PONTUS_SD_METADATA: Omit<PuppetAsset, "url"> = {
  imageWidth: 1254,
  imageHeight: 1254,
  content: { left: 32, top: 25, right: 1218, bottom: 1238 },
};
