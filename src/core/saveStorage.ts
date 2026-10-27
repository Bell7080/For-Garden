import { QA_TOOLS_ENABLED } from "./buildFlavor";

/** 저장 출처는 빌드가 결정한다. URL 옵션으로 QA 저장을 운영 저장으로 바꾸지 않는다. */
export type LocalSaveFlavor = "production" | "qa" | "test";
export const LOCAL_SAVE_FLAVOR: LocalSaveFlavor = import.meta.env?.MODE === "test" ? "test" : QA_TOOLS_ENABLED ? "qa" : "production";

/** 구형 공용 키는 출처가 없어 자동 이관하지 않는다. 기존 원문은 이 키에 그대로 보존한다. */
export const LEGACY_SHARED_SAVE_STORAGE_KEY = "eternal-city.local-save";
export const LOCAL_SAVE_STORAGE_KEYS: Readonly<Record<LocalSaveFlavor, string>> = {
  production: "eternal-city.production.local-save",
  qa: "eternal-city.qa.local-save",
  test: "eternal-city.test.local-save",
};
