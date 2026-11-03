/** 다시 받을 때 브라우저가 실패한 응답을 캐시에서 되돌려주지 않도록 주소 끝에 붙이는 표식. */
export function retryUrl(url: string, round: number): string {
  return `${url}${url.includes("?") ? "&" : "?"}retry=${round}`;
}
