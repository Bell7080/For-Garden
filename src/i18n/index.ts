/** 화면이 문구를 고르는 공개 진입점. 표의 생김새는 `catalog.ts`가 갖는다. */
export { t, setTextLanguage, loadTextCatalog, languagesWithCatalog, type Catalog, type TextKey } from "./catalog";

/**
 * 정적 콘텐츠(`src/data`)의 문구는 다른 경계를 쓴다 — 한국어는 데이터 파일에 그대로 두고
 * 다른 언어만 개체 ID로 덮어쓴다. 이유는 `dataText.ts`의 머리 주석에 있다.
 */
export { dataText, setDataLanguage, loadDataOverlay, languagesWithDataOverlay, type DataOverlay } from "./dataText";
export { registerDataText, registeredDataTexts } from "./dataFields";
