import { backendAccount } from "../api/backendSession";
import { CouponApi } from "../api/CouponApi";

/**
 * 쿠폰 등록 경계. 서버에 연결된 빌드는 로그인한 계정으로 DB 함수를 부르고, 아닌 빌드는 `unsupported`를 돌려준다.
 * 계정은 부를 때 고른다 — 부트가 연결을 세우기 전에 모듈이 읽혀도 굳지 않는다.
 */
export function couponApi(): CouponApi {
  return new CouponApi(backendAccount());
}
