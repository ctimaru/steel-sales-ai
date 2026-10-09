import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";

import ts from "typescript";

function read(path) {
  return fs.readFileSync(new URL(path, import.meta.url), "utf8");
}

const home = read("../app/page.tsx");
const proxy = read("../lib/supabase/proxy.ts");
const workspace = read("../lib/workspace-context.ts");
const platform = read("../app/(platform)/platform/layout.tsx");

function runProxy({ pathname = "/", cookies = [], user = null, authError = null, claims = null, publicQuery = false, configured = true, refreshCookies = [] } = {}) {
  const calls = { clients: 0, getUser: 0, getClaims: 0 };
  const writtenCookies = [];
  const requestCookies = [...cookies];
  const url = new URL("https://www.smartsteelsales.com" + pathname + (publicQuery ? "?public=1" : ""));
  const request = {
    cookies: {
      getAll: () => requestCookies,
      set: (name, value) => {
        requestCookies.push({ name, value });
      },
    },
    nextUrl: {
      pathname: url.pathname,
      searchParams: url.searchParams,
      clone: () => new URL(url),
    },
  };

  function response(status, target = null) {
    return {
      status,
      url: target?.toString() ?? null,
      headers: new Map(),
      cookies: {
        set(cookie) {
          writtenCookies.push(cookie);
        },
        getAll() {
          return [...writtenCookies];
        },
      },
    };
  }

  const mocks = {
    "@supabase/ssr": {
      createServerClient(_url, _key, options) {
        calls.clients++;
        return {
          auth: {
            async getUser() {
              calls.getUser++;
              if (refreshCookies.length) options.cookies.setAll(refreshCookies);
              return { data: { user }, error: authError };
            },
            async getClaims() {
              calls.getClaims++;
              return { data: { claims } };
            },
          },
        };
      },
    },
    "next/server": {
      NextResponse: {
        next: () => response(200),
        redirect: (target) => response(307, target),
      },
    },
  };
  const code = ts.transpileModule(proxy, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const exports = {};
  vm.runInNewContext(code, {
    exports,
    require: (id) => {
      assert.ok(id in mocks, "Unexpected dependency: " + id);
      return mocks[id];
    },
    process: {
      env: configured
        ? { NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co", NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "public" }
        : {},
    },
  });
  return { output: exports.updateSession(request), calls, writtenCookies };
}

test("PERF1 public homepage is statically rendered without request cookies or Supabase", () => {
  assert.match(home, /export const dynamic = "force-static"/);
  assert.match(home, /export default function PublicHomePage/);
  assert.doesNotMatch(home, /createClient|cookies\s*\(|getUser|getClaims|redirect\s*\(|headers\s*\(/);
  assert.match(home, /<PublicNetworkRoleExplorer \/>/);
  assert.match(home, /<PublicCompanyLookup \/>/);
});

test("PERF1 anonymous homepage avoids all auth initialization", async () => {
  for (const cookies of [[], [{ name: "sss_cookie_consent", value: "yes" }], [{ name: "sb-demo-auth-token-other", value: "noise" }]]) {
    const result = runProxy({ cookies });
    const output = await result.output;
    assert.equal(output.status, 200);
    assert.equal(result.calls.clients, 0);
    assert.equal(result.calls.getUser, 0);
    assert.equal(result.calls.getClaims, 0);
  }
});

test("PERF1 valid auth cookies redirect homepage to dashboard after server user validation", async () => {
  for (const tokenName of ["sb-example-auth-token", "sb-example-auth-token.0", "sb-example-auth-token.1"]) {
    const result = runProxy({
      cookies: [{ name: tokenName, value: "token" }],
      user: { id: "user-one" },
    });
    const output = await result.output;
    assert.equal(output.status, 307);
    assert.equal(output.url, "https://www.smartsteelsales.com/dashboard");
    assert.equal(output.headers.get("Cache-Control"), "private, no-store");
    assert.equal(result.calls.getUser, 1);
    assert.equal(result.calls.getClaims, 0);
  }
});

test("PERF1 cookies never authenticate a user without getUser verification", async () => {
  for (const options of [
    { user: null, authError: null },
    { user: { id: "stale" }, authError: { message: "revoked" } },
  ]) {
    const result = runProxy({
      cookies: [{ name: "sb-example-auth-token", value: "stale" }],
      ...options,
    });
    const output = await result.output;
    assert.equal(output.status, 200);
    assert.equal(result.calls.getUser, 1);
    assert.equal(result.calls.getClaims, 0);
  }
});

test("PERF1 refreshed auth cookies survive a homepage redirect", async () => {
  const fresh = { name: "sb-example-auth-token", value: "refreshed" };
  const result = runProxy({
    cookies: [{ name: "sb-example-auth-token", value: "older" }],
    user: { id: "user" },
    refreshCookies: [fresh],
  });
  const output = await result.output;
  assert.equal(output.status, 307);
  assert.ok(result.writtenCookies.some((cookie) => cookie.name === fresh.name && cookie.value === fresh.value));
});

test("PERF1 authenticated Scuola routing remains claims-based; public=1 still bypasses it", async () => {
  const cookie = [{ name: "sb-example-auth-token", value: "token" }];
  const school = runProxy({ pathname: "/knowledge", cookies: cookie, claims: { sub: "user" } });
  assert.equal((await school.output).url, "https://www.smartsteelsales.com/school/catalogo");
  assert.equal(school.calls.getClaims, 1);
  assert.equal(school.calls.getUser, 0);

  const publicSchool = runProxy({ pathname: "/knowledge", cookies: cookie, claims: { sub: "user" }, publicQuery: true });
  assert.equal((await publicSchool.output).status, 200);

  const anonymousSchool = runProxy({ pathname: "/knowledge/norme", claims: null });
  assert.equal((await anonymousSchool.output).status, 200);
});

test("PERF1 does not add platform or workspace access shortcuts", async () => {
  for (const pathname of ["/dashboard", "/platform", "/login", "/register", "/auth/confirm"]) {
    const result = runProxy({ pathname, claims: { sub: "user" } });
    assert.equal((await result.output).status, 200);
    assert.equal(result.calls.getClaims, 1);
  }
  assert.match(workspace, /getWorkspaceContext = cache/);
  assert.match(workspace, /supabase\.auth\.getUser\(\)/);
  assert.match(workspace, /organization_memberships/);
  assert.match(workspace, /requireWorkspaceRole/);
  assert.match(workspace, /requireWorkspaceWriteRole/);
  assert.match(workspace, /requireWorkspaceAdmin/);
  assert.match(platform, /requirePlatformConsoleContext/);
});

test("PERF1 preserves no-Supabase local/demo behavior", async () => {
  const result = runProxy({ configured: false });
  assert.equal((await result.output).status, 200);
  assert.equal(result.calls.clients, 0);
});
