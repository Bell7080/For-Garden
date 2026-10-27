import packageInfo from "../../package.json";
import { backendAccount } from "../api/backendSession";
import { SupportApi } from "../api/SupportApi";

/**
 * 문의 접수 경계. 서버에 연결된 빌드는 로그인한 계정으로 DB 함수를 부르고, 아닌 빌드는 `unsupported`를 돌려준다
 * (접수된 척하지 않는다). 계정은 부를 때 고른다 — 부트가 연결을 세우기 전에 모듈이 읽혀도 굳지 않는다.
 */
export function supportApi(): SupportApi {
  return new SupportApi(backendAccount(), { version: packageInfo.version, platform: "web" });
}
