export interface SecurityFinding { file: string; line: number; code: string }

/** 값 자체를 출력하지 않는다. 공개 anon/publishable 키와 서버 비밀 키를 구분한다. */
export function findExposedSecrets(file: string, text: string): SecurityFinding[] {
  const matches: Array<{ at: number; code: string }> = [];
  for (const [code, pattern] of [
    ["private-key", /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g],
    ["supabase-secret", /\bsb_secret_[A-Za-z0-9_-]{20,}\b/g],
    ["github-secret", /\b(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{40,})\b/g],
    ["aws-access-key", /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/g],
  ] as const) for (const found of text.matchAll(pattern)) matches.push({ at: found.index!, code });
  for (const found of text.matchAll(/\beyJ[A-Za-z0-9_-]+\.([A-Za-z0-9_-]+)\.[A-Za-z0-9_-]+\b/g)) {
    try {
      const raw = found[1].replace(/-/g, "+").replace(/_/g, "/");
      const claims = JSON.parse(atob(raw));
      if (claims.role === "service_role" || claims.role === "supabase_admin") matches.push({ at: found.index!, code: "privileged-jwt" });
    } catch { /* 서명이 아닌 데이터 조각은 키로 취급하지 않는다. */ }
  }
  return matches.map(({ at, code }) => ({ file, line: text.slice(0, at).split("\n").length, code }));
}

/** JS·SQL·소스맵·설정 파일이 정적 앱 공개 폴더에 섞이는 것을 막는다. */
export function forbiddenPublicArtifact(file: string): boolean {
  return /(?:^|\/)(?:\.env(?:\..*)?|\.git|supabase|node_modules|server)(?:\/|$)/i.test(file)
    || /\.(?:map|sql|pem|p8|p12|jks|keystore|mobileprovision)$/i.test(file)
    || /(?:^|\/)(?:api\/(?:game|account)\.js|service-account[^/]*\.json)$/i.test(file);
}

/** 병합된 텍스트 매니페스트용 검사. APK의 바이너리 XML 검증을 대신하지 않는다. */
export function androidManifestRisks(xml: string): string[] {
  const clean = xml.replace(/<!--[\s\S]*?-->/g, "");
  const application = clean.match(/<application\b([^>]*)>/)?.[1];
  if (!application) return ["application-missing"];
  const problems: string[] = [];
  if (!/android:allowBackup\s*=\s*["']false["']/.test(application)) problems.push("backup-not-disabled");
  if (!/android:usesCleartextTraffic\s*=\s*["']false["']/.test(application)) problems.push("cleartext-not-disabled");
  if (/android:debuggable\s*=\s*["'](?!false["'])/.test(application)) problems.push("debuggable-or-unresolved");
  if (/android:testOnly\s*=\s*["']true["']/.test(application)) problems.push("test-only-app");
  if (/android.permission.(?:READ_SMS|READ_CONTACTS|MANAGE_EXTERNAL_STORAGE|REQUEST_INSTALL_PACKAGES)/.test(clean)) problems.push("unexpected-sensitive-permission");
  for (const component of clean.matchAll(/<(activity|service|receiver|provider)\b([^>]*)(?:\/>|>([\s\S]*?)<\/\1>)/g)) {
    if (!/android:exported\s*=\s*["']true["']/.test(component[2])) continue;
    const launcher = component[1] === "activity" && /android.intent.action.MAIN/.test(component[3] ?? "") && /android.intent.category.LAUNCHER/.test(component[3] ?? "");
    if (!launcher) problems.push("exported-component-review");
  }
  return problems;
}

export function iosPlistRisks(xml: string): string[] {
  const clean = xml.replace(/<!--[\s\S]*?-->/g, "");
  if (!/<plist\b/.test(clean)) return ["plist-not-xml"];
  const problems: string[] = [];
  if (/<key>\s*(?:NSAllowsArbitraryLoads|NSAllowsArbitraryLoadsInWebContent|NSExceptionAllowsInsecureHTTPLoads|NSTemporaryExceptionAllowsInsecureHTTPLoads)\s*<\/key>\s*<true\s*\/>/.test(clean)) problems.push("ats-exception");
  if (/<key>\s*get-task-allow\s*<\/key>\s*<true\s*\/>/.test(clean)) problems.push("debug-entitlement");
  return problems;
}
