import type { PuppetAsset } from "./assets";

/** 도디 전신·SD ZIP의 원본 크기와 alpha > 16인 실제 실루엣 경계다. */
export const DODI_PORTRAIT_METADATA: Omit<PuppetAsset, "url"> = {
  imageWidth: 1086,
  imageHeight: 1448,
  content: { left: 100, top: 76, right: 986, bottom: 1352 },
};

export const DODI_SD_METADATA: Omit<PuppetAsset, "url"> = {
  imageWidth: 1254,
  imageHeight: 1254,
  content: { left: 121, top: 72, right: 1088, bottom: 1207 },
};

/** 메테 전신·SD ZIP의 원본 크기와 alpha > 16인 실제 실루엣 경계다. */
export const METTE_PORTRAIT_METADATA: Omit<PuppetAsset, "url"> = {
  imageWidth: 1054,
  imageHeight: 1492,
  content: { left: 67, top: 43, right: 1003, bottom: 1463 },
};

export const METTE_SD_METADATA: Omit<PuppetAsset, "url"> = {
  imageWidth: 1254,
  imageHeight: 1254,
  content: { left: 106, top: 80, right: 1099, bottom: 1207 },
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
