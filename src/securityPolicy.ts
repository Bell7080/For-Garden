/** 웹과 패키지 HTML이 같은 브라우저 정책을 사용한다. 인라인 스크립트/평가 실행과 외부 프레임은 허용하지 않는다. */
export function contentSecurityPolicy(extraApiOrigin?: string, meta = false, supabaseOrigin?: string): string {
  let api = "";
  if (extraApiOrigin) {
    const url = new URL(extraApiOrigin);
    if (url.protocol !== "https:" || url.username || url.password || url.pathname !== "/" || url.search || url.hash) throw new Error("INVALID_API_ORIGIN");
    api = ` ${url.origin}`;
  }
  const hosts = supabaseOrigin ? [new URL(supabaseOrigin).origin] : ["https://udujahnlyhedlrfbaaow.supabase.co", "https://rscxzfdnbdmftortrcqt.supabase.co"];
  if (hosts.some(host => !host.startsWith("https://"))) throw new Error("INVALID_SUPABASE_ORIGIN");
  const https = hosts.join(" "), wss = hosts.map(host => host.replace("https:", "wss:")).join(" ");
  return `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: ${https}; font-src 'self' data:; connect-src 'self' ${https} ${wss}${api}; worker-src 'self' blob:; media-src 'self' blob:; object-src 'none'; base-uri 'none'; form-action 'self'; frame-src 'none'${meta ? "" : "; frame-ancestors 'none'"}`;
}
