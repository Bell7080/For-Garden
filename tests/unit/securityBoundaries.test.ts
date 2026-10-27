import { afterEach, describe, expect, it, vi } from "vitest";
import { apiEndpoint } from "../../src/core/appRuntime";
import { applyApiOriginPolicy, qaToolsAllowed } from "../../src/server/httpSecurity";
import { secureRandom } from "../../src/server/secureRandom";
import { contentSecurityPolicy } from "../../src/securityPolicy";
import { findExposedSecrets, forbiddenPublicArtifact, androidManifestRisks, iosPlistRisks } from "../../src/security/releaseAudit";

function response() {
  const headers: Record<string,string> = {};
  return { headers, code: 0, value: undefined as unknown, status(code:number) { this.code=code; return this; }, setHeader(k:string,v:string) { headers[k]=v; }, json(v:unknown) { this.value=v; }, end: vi.fn() };
}
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

describe("인증 API와 네이티브 원점 경계", () => {
  it.each(["capacitor://localhost", "https://localhost"])("허용한 네이티브 %s의 인증 POST preflight를 처리한다", origin => {
    const res=response();
    expect(applyApiOriginPolicy({method:"OPTIONS",headers:{origin,"access-control-request-method":"POST","access-control-request-headers":"Authorization, Content-Type"}},res,origin)).toBe(true);
    expect(res.code).toBe(204); expect(res.headers['access-control-allow-origin']).toBe(origin);
    expect(res.end).toHaveBeenCalledOnce();
  });
  it.each(["null", "https://evil.example", "https://game.example.evil.example"])("%s를 와일드카드나 호스트 접두사로 허용하지 않는다", origin => {
    const res=response();
    expect(applyApiOriginPolicy({method:"POST",headers:{origin,host:"game.example"}},res,"*,null,https://game.example")).toBe(true);
    expect(res.code).toBe(403); expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });
  it("기존 동일 원점 POST와 헤더 없는 서버 호출은 계속 인증 경계로 보낸다", () => {
    expect(applyApiOriginPolicy({method:"POST",headers:{origin:"https://game.example",host:"game.example"}},response(),"")).toBe(false);
    expect(applyApiOriginPolicy({method:"POST",headers:{}},response(),"")).toBe(false);
    const res=response();applyApiOriginPolicy({method:"OPTIONS",headers:{origin:"capacitor://localhost","access-control-request-method":"DELETE"}},res,"capacitor://localhost");expect(res.code).toBe(403);
  });
  it("운영 DB에서는 QA 지급 환경변수만으로 개발 도구가 열리지 않는다", () => {
    expect(qaToolsAllowed("https://udujahnlyhedlrfbaaow.supabase.co","1")).toBe(false);
    expect(qaToolsAllowed("https://rscxzfdnbdmftortrcqt.supabase.co.evil.example","1")).toBe(false);
    expect(qaToolsAllowed("https://rscxzfdnbdmftortrcqt.supabase.co","1")).toBe(true);
    expect(qaToolsAllowed("https://rscxzfdnbdmftortrcqt.supabase.co",undefined)).toBe(false);
  });
  it("Android/iOS에서 상대 API 주소를 로컬 WebView로 보내지 않는다", () => {
    expect(apiEndpoint("/api/game",undefined,"web")).toBe("/api/game");
    expect(()=>apiEndpoint("/api/game",undefined,"android")).toThrow("NATIVE_API_ORIGIN_REQUIRED");
    expect(apiEndpoint("/api/account","https://game.example","ios")).toBe("https://game.example/api/account");
    for(const origin of ["http://game.example","https://user:secret@game.example","https://game.example/path","https://game.example/?target=evil"])
      expect(()=>apiEndpoint("/api/game",origin,"ios")).toThrow();
  });
  it("서버 가챠 난수는 암호학적 난수를 쓰며 정확히 [0,1) 범위다", () => {
    vi.spyOn(Math,"random").mockImplementation(()=>{throw Error("insecure random")});
    vi.stubGlobal("crypto",{getRandomValues:(words:Uint32Array)=>{words.fill(0);return words;}});expect(secureRandom()).toBe(0);
    vi.stubGlobal("crypto",{getRandomValues:(words:Uint32Array)=>{words.fill(0xffffffff);return words;}});expect(secureRandom()).toBeLessThan(1);expect(secureRandom()).toBeGreaterThan(0.99999);
  });
});

describe("공개 산출물과 앱 설정 검사", () => {
  it("publishable/anon과 특권 JWT를 구분하고 비밀값은 결과에 포함하지 않는다", () => {
    const jwt=(role:string)=>[btoa('{"alg":"HS256"}').replace(/=+$/, ""),btoa(JSON.stringify({role})).replace(/=+$/, ""),"signature"].join(".");
    expect(findExposedSecrets("bundle.js",jwt("anon"))).toEqual([]);
    const secret="sb_"+"secret_"+"a".repeat(32);
    const findings=findExposedSecrets("bundle.js",jwt("service_role")+"\n"+secret);
    expect(findings.map(f=>f.code)).toEqual(["supabase-secret","privileged-jwt"]);
    expect(JSON.stringify(findings)).not.toContain(secret);
    expect(findExposedSecrets("config.json",["-----BEGIN ","PRIVATE KEY-----"].join(""))[0].code).toBe("private-key");
  });
  it.each([".env.production","supabase/migrations/a.sql","api/game.js","bundle.js.map","signing.p8"])("%s를 공개 정적 폴더에서 막는다", path => expect(forbiddenPublicArtifact(path)).toBe(true));
  it("디버깅·백업·평문 통신과 불필요하게 공개된 Android 컴포넌트를 감지한다", () => {
    const safe='<manifest><application android:allowBackup="false" android:usesCleartextTraffic="false"><activity android:exported="true"><intent-filter><action android:name="android.intent.action.MAIN"/><category android:name="android.intent.category.LAUNCHER"/></intent-filter></activity></application></manifest>';
    expect(androidManifestRisks(safe)).toEqual([]);
    expect(androidManifestRisks(safe.replace('android:allowBackup="false"','android:allowBackup="true" android:debuggable="true"'))).toContain("debuggable-or-unresolved");
    expect(androidManifestRisks(safe.replace('</application>','<provider android:exported="true"/></application>'))).toContain("exported-component-review");
    expect(androidManifestRisks('<!-- '+safe+' -->')).toEqual(["application-missing"]);
  });
  it("iOS ATS 예외와 개발용 서명 권한을 감지한다", () => {
    expect(iosPlistRisks('<plist><dict><key>NSAllowsArbitraryLoads</key><true/></dict></plist>')).toContain("ats-exception");
    expect(iosPlistRisks('<plist><dict><key>get-task-allow</key><true/></dict></plist>')).toContain("debug-entitlement");
    expect(iosPlistRisks('<plist><dict/></plist>')).toEqual([]);
  });
  it("패키지 HTML 정책은 스크립트 인라인 실행과 외부 프레임을 열지 않는다", () => {
    const csp=contentSecurityPolicy("https://game.example",true);
    expect(csp).toContain("script-src 'self';");expect(csp).not.toContain("unsafe-eval");expect(csp).toContain("frame-src 'none'");
    expect(csp).toContain("https://game.example");expect(csp).not.toContain("frame-ancestors");
  });
});
