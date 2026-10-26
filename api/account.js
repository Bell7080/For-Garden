/* 생성물: npm run build:server */

// src/server/httpSecurity.ts
function applyApiOriginPolicy(req, res, configured = process.env.FORGARDEN_APP_ORIGINS ?? "") {
  res.setHeader("cache-control", "no-store");
  res.setHeader("x-content-type-options", "nosniff");
  res.setHeader("referrer-policy", "no-referrer");
  const origin = req.headers.origin;
  if (origin === void 0 && req.method !== "OPTIONS") return false;
  const host = req.headers.host;
  const sameOrigin = typeof host === "string" ? `https://${host}` : "";
  const allowed = new Set(configured.split(",").map((value) => value.trim()).filter((value) => value && value !== "*" && value !== "null"));
  if (typeof origin !== "string" || origin === "null" || !(origin === sameOrigin || allowed.has(origin))) {
    res.status(403);
    res.json({ ok: false, code: "origin_not_allowed" });
    return true;
  }
  res.setHeader("vary", "Origin");
  res.setHeader("access-control-allow-origin", origin);
  if (req.method !== "OPTIONS") return false;
  const method = req.headers["access-control-request-method"];
  const requestedHeaders = req.headers["access-control-request-headers"];
  if (method !== "POST" || Array.isArray(requestedHeaders) || (requestedHeaders ?? "").split(",").some((name) => name.trim() && !["authorization", "content-type"].includes(name.trim().toLowerCase()))) {
    res.status(403);
    res.json({ ok: false, code: "preflight_not_allowed" });
    return true;
  }
  res.setHeader("access-control-allow-methods", "POST");
  res.setHeader("access-control-allow-headers", "authorization, content-type");
  res.setHeader("access-control-max-age", "600");
  res.status(204);
  if (res.end) res.end();
  else res.json(null);
  return true;
}

// src/core/accountCredentials.ts
var ACCOUNT_ID_MIN = 4;
var ACCOUNT_ID_MAX = 20;
var ACCOUNT_PASSWORD_MIN = 8;
var ACCOUNT_PASSWORD_MAX = 64;
var ACCOUNT_ID_DOMAIN = "id.forgarden.app";
function normalizeAccountId(raw) {
  return raw.trim().toLowerCase();
}
function accountIdProblem(raw) {
  const id = normalizeAccountId(raw);
  if (id.length < ACCOUNT_ID_MIN || id.length > ACCOUNT_ID_MAX) return "id-length";
  return /^[a-z][a-z0-9_]*$/.test(id) ? null : "id-chars";
}
function accountPasswordProblem(password, rawId = "") {
  const length = Array.from(password).length;
  if (length < ACCOUNT_PASSWORD_MIN || length > ACCOUNT_PASSWORD_MAX) return "password-length";
  return rawId !== "" && password.toLowerCase() === normalizeAccountId(rawId) ? "password-same-as-id" : null;
}
function accountCredentialProblem(rawId, password) {
  return accountIdProblem(rawId) ?? accountPasswordProblem(password, rawId);
}
function accountIdToAuthEmail(rawId) {
  return `${normalizeAccountId(rawId)}@${ACCOUNT_ID_DOMAIN}`;
}
function authEmailToAccountId(email) {
  if (typeof email !== "string") return null;
  const suffix = `@${ACCOUNT_ID_DOMAIN}`;
  return email.endsWith(suffix) && email.length > suffix.length ? email.slice(0, -suffix.length) : null;
}

// src/server/accountEntry.ts
async function handler(req, res) {
  if (applyApiOriginPolicy(req, res)) return;
  if (req.method !== "POST") {
    res.setHeader("allow", "POST");
    res.status(405).json({ code: "method_not_allowed" });
    return;
  }
  const reply = (status, code) => res.status(status).json({ ok: false, code });
  try {
    const raw = typeof req.body === "string" ? req.body : JSON.stringify(req.body ?? null);
    if (new TextEncoder().encode(raw).length > 4096) {
      reply(413, "invalid_request");
      return;
    }
    let body;
    try {
      body = JSON.parse(raw);
    } catch {
      reply(400, "invalid_request");
      return;
    }
    if (!body || typeof body.id !== "string" || typeof body.password !== "string" || accountCredentialProblem(body.id, body.password)) {
      reply(400, "invalid_credentials");
      return;
    }
    const url = process.env.SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      reply(503, "server_not_configured");
      return;
    }
    const deadline = AbortSignal.timeout(25e3);
    const call = (path, init = {}) => fetch(`${url}${path}`, { ...init, headers: { apikey: key, authorization: `Bearer ${key}`, "content-type": "application/json", ...init.headers }, signal: AbortSignal.any([deadline, AbortSignal.timeout(1e4)]) });
    const auth = typeof req.headers.authorization === "string" ? req.headers.authorization : "";
    let current = null;
    const email = accountIdToAuthEmail(body.id);
    const ip = String(req.headers["x-forwarded-for"] ?? "unknown").split(",")[0].trim().slice(0, 128);
    const hashed = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${key}:account:${ip}`));
    const ipKey = [...new Uint8Array(hashed)].map((b) => b.toString(16).padStart(2, "0")).join("");
    const takeBudget = async (subject) => {
      const budget = await call("/rest/v1/rpc/server_take_account_rate", { method: "POST", body: JSON.stringify({ p_key: subject }) });
      if (!budget.ok) {
        reply(503, "rate_store_unavailable");
        return false;
      }
      const rate = await budget.json();
      if (!rate.allowed) {
        res.setHeader("retry-after", String(rate.retryAfter));
        reply(429, "rate_limited");
        return false;
      }
      return true;
    };
    if (!await takeBudget(ipKey)) return;
    if (body.action === "sign-in") {
      if (!await takeBudget(`login-id:${body.id.toLowerCase().trim()}`)) return;
      const found = await call("/rest/v1/rpc/server_id_account", { method: "POST", body: JSON.stringify({ p_email: email }) });
      if (!found.ok) {
        reply(503, "service_unavailable");
        return;
      }
      const account = await found.json();
      if (!account?.id) {
        reply(401, "invalid_credentials");
        return;
      }
      const loginEmail = account.email ?? email;
      const proof = await call("/auth/v1/token?grant_type=password", { method: "POST", body: JSON.stringify({ email: loginEmail, password: body.password }) });
      if (proof.status === 429) {
        const retry = proof.headers.get("retry-after");
        if (retry) res.setHeader("retry-after", retry);
        reply(429, "rate_limited");
        return;
      }
      const value = await proof.json().catch(() => ({}));
      if (!proof.ok && [400, 422].includes(proof.status) && (value.error_code ?? value.code) === "email_not_confirmed" && loginEmail === email) {
        const confirmed = await call(`/auth/v1/admin/users/${encodeURIComponent(account.id)}`, { method: "PUT", body: JSON.stringify({ email, email_confirm: true }) });
        if (!confirmed.ok) {
          reply(503, "confirmation_failed");
          return;
        }
        const retry = await call("/auth/v1/token?grant_type=password", { method: "POST", body: JSON.stringify({ email, password: body.password }) });
        if (retry.status === 429) {
          const wait = retry.headers.get("retry-after");
          if (wait) res.setHeader("retry-after", wait);
          reply(429, "rate_limited");
          return;
        }
        const recovered = await retry.json().catch(() => ({}));
        if (!retry.ok || recovered.user?.id !== account.id) {
          reply(401, "invalid_credentials");
          return;
        }
        res.status(200).json(recovered);
        return;
      }
      if (!proof.ok || value.user?.id !== account.id) {
        reply(proof.status >= 500 ? 503 : 401, "invalid_credentials");
        return;
      }
      res.status(200).json(value);
      return;
    }
    if (body.action === "confirm-existing") {
      if (!await takeBudget(`login-id:${body.id.toLowerCase().trim()}`)) return;
      const proof = await call("/auth/v1/token?grant_type=password", { method: "POST", body: JSON.stringify({ email, password: body.password }) });
      const result = await proof.json().catch(() => ({}));
      if (proof.status === 429) {
        const retry = proof.headers.get("retry-after");
        if (retry) res.setHeader("retry-after", retry);
        reply(429, "rate_limited");
        return;
      }
      if (![400, 422].includes(proof.status) || (result.error_code ?? result.code) !== "email_not_confirmed") {
        reply(proof.status >= 500 ? 503 : 401, "invalid_credentials");
        return;
      }
      const found = await call("/rest/v1/rpc/server_id_account", { method: "POST", body: JSON.stringify({ p_email: email }) });
      if (!found.ok) {
        reply(503, "service_unavailable");
        return;
      }
      const owned = await found.json();
      if (!owned?.id || owned.email && owned.email !== email) {
        reply(401, "invalid_credentials");
        return;
      }
      const confirmed = await call(`/auth/v1/admin/users/${encodeURIComponent(owned.id)}`, { method: "PUT", body: JSON.stringify({ email, email_confirm: true }) });
      if (!confirmed.ok) {
        reply(503, "confirmation_failed");
        return;
      }
      res.status(200).json({ ok: true, userId: owned.id });
      return;
    }
    if (body.action !== void 0 && body.action !== "register") {
      reply(400, "invalid_request");
      return;
    }
    if (auth) {
      if (!/^Bearer \S+$/.test(auth)) {
        reply(401, "not_authenticated");
        return;
      }
      const who = await call("/auth/v1/user", { headers: { authorization: auth } });
      if (!who.ok) {
        reply(who.status === 429 ? 429 : who.status >= 500 ? 503 : 401, who.status >= 500 ? "service_unavailable" : "not_authenticated");
        return;
      }
      current = await who.json();
      if (!current?.id) {
        reply(401, "not_authenticated");
        return;
      }
      const oldId = authEmailToAccountId(current.email);
      if (oldId && current.email !== email) {
        reply(409, "already_linked");
        return;
      }
      if (current.is_anonymous !== true && !oldId && !current.email_confirmed_at) {
        reply(409, "already_linked");
        return;
      }
    }
    if (current && !await takeBudget(`user:${current.id}`)) return;
    if (!current) {
      const existing = await call("/rest/v1/rpc/server_id_account", { method: "POST", body: JSON.stringify({ p_email: email }) });
      if (!existing.ok) {
        reply(503, "identity_store_unavailable");
        return;
      }
      if (await existing.json()) {
        reply(409, "id_taken");
        return;
      }
    }
    const reserve = async (userId) => {
      const result = await call("/rest/v1/rpc/server_set_account_id", { method: "POST", body: JSON.stringify({ p_player: userId, p_id: body.id.trim().toLowerCase() }) });
      if (!result.ok) {
        reply(503, "identity_store_unavailable");
        return false;
      }
      if (await result.json() !== true) {
        reply(409, "id_taken");
        return false;
      }
      return true;
    };
    if (current && !await reserve(current.id)) return;
    const updated = await call(current ? `/auth/v1/admin/users/${encodeURIComponent(current.id)}` : "/auth/v1/admin/users", {
      method: current ? "PUT" : "POST",
      body: JSON.stringify(current && current.is_anonymous !== true && !authEmailToAccountId(current.email) ? { email: current.email, password: body.password } : { email, password: body.password, email_confirm: true })
    });
    if (!updated.ok) {
      const error = await updated.json().catch(() => ({}));
      const code = error.error_code ?? error.code;
      if (code === "email_exists" || code === "user_already_exists" || updated.status === 409) {
        reply(409, "id_taken");
        return;
      }
      if (code === "weak_password") {
        reply(422, "weak_password");
        return;
      }
      if (updated.status === 429) {
        const retry = updated.headers.get("retry-after");
        if (retry) res.setHeader("retry-after", retry);
        reply(429, "rate_limited");
        return;
      }
      reply(503, "registration_failed");
      return;
    }
    const user = await updated.json();
    if (!user.id || current && user.id !== current.id) {
      reply(503, "invalid_auth_response");
      return;
    }
    if (!current && !await reserve(user.id)) return;
    res.status(200).json({ ok: true, userId: user.id, authEmail: current && current.is_anonymous !== true ? current.email : email });
  } catch {
    reply(503, "service_unavailable");
  }
}
export {
  handler as default
};
