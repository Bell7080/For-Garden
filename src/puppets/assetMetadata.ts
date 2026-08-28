import type { PuppetAsset } from "./assets";

/** 메테 전용 원화가 오기 전 사용하는 명시적 placeholder 프레임이며 토리카 원화의 정식 소유권을 뜻하지 않는다. */
export const METTE_PLACEHOLDER_METADATA: Omit<PuppetAsset, "url"> = {
  imageWidth: 1054,
  imageHeight: 1492,
  content: { left: 95, top: 69, right: 894, bottom: 1419 },
  cardZoom: 0.62,
};

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
  // 정보창에서 하단에 처지던 전신을 한 단계 키우고 코어 기준점을 위로 되돌린다.
  portraitZoom: 0.88,
  portraitOffsetY: 0,
};

/** 폰투스 SD ZIP의 1254px 정사각 원본과 alpha > 16 경계다. */
export const PONTUS_SD_METADATA: Omit<PuppetAsset, "url"> = {
  imageWidth: 1254,
  imageHeight: 1254,
  content: { left: 32, top: 25, right: 1218, bottom: 1238 },
};
