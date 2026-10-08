import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const read = (path) => fs.readFileSync(new URL(path, import.meta.url), "utf8");
const reader = read("../lib/steel-pulse-public.ts");
const preview = read("../components/steel-pulse-preview.tsx");
const login = read("../app/login/page.tsx");
const migration = read("../../../supabase/migrations/20261008182000_sp4_steel_pulse_public_feed.sql");
const hp13 = read("../../../supabase/tests/hp13_permissions_tenant_isolation.sql");

function loadReader({ data = [], error = null, envConfigured = true } = {}) {
  const exports = {};
  const calls = [];
  const compiled = ts.transpileModule(reader, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  vm.runInNewContext(compiled, {
    exports,
    require: (module) => {
      if (module !== "@supabase/supabase-js") throw new Error("Unexpected module: " + module);
      return {
        createClient: (_url, _key, options) => {
          calls.push({ type: "create", options });
          return {
            rpc: async (method, args) => {
              calls.push({ type: "rpc", method, args });
              return { data, error };
            },
          };
        },
      };
    },
    process: {
      env: envConfigured
        ? { NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co", NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "test-public-key" }
        : {},
    },
    URL, Date, Set, AbortSignal,
    fetch: async () => ({ ok: true }),
  });
  return { exports, calls };
}

const valid = {
  headline: "Un aggiornamento verificato sul mercato europeo dell’acciaio",
  summary: "Questa sintesi originale illustra un fatto verificato e contestualizzato per il settore europeo.",
  relevance: "Un segnale utile per valutare domanda e disponibilità nella distribuzione.",
  topic: "market", language_code: "it", source_name: "Eurostat",
  source_url: "https://ec.europa.eu/eurostat/sample", source_published_at: "2026-10-08T10:00:00Z",
};

test("SP4 anonymous reader fails closed when environment or RPC is absent", async () => {
  const noConfig = loadReader({ envConfigured: false });
  assert.equal((await noConfig.exports.listSteelPulsePublicCards()).length, 0);
  assert.equal(noConfig.calls.length, 0);

  const unavailable = loadReader({ data: null, error: { code: "PGRST202" } });
  assert.equal((await unavailable.exports.listSteelPulsePublicCards()).length, 0);
});

test("SP4 source link and editorial copy are validated before display", () => {
  const { exports } = loadReader();
  assert.equal(exports.isSteelPulsePublicCard(valid), true);
  for (const bad of [
    { ...valid, source_url: "javascript:alert(1)" },
    { ...valid, source_url: "http://ec.europa.eu/article" },
    { ...valid, source_url: "https://user:password@ec.europa.eu/" },
    { ...valid, headline: "<script>alert(1)</script>" },
    { ...valid, language_code: "invalid" },
    { ...valid, topic: "unverified" },
  ]) {
    assert.equal(exports.isSteelPulsePublicCard(bad), false);
  }
});

test("SP4 reads at most three public curated articles using an anonymous client", async () => {
  const { exports, calls } = loadReader({ data: [valid, valid, valid, valid, { ...valid, headline: "invalid" }] });
  const cards = await exports.listSteelPulsePublicCards();
  assert.equal(cards.length, 3);
  assert.equal(calls.filter((x) => x.type === "rpc")[0].method, "sp4_public_steel_pulse_feed");
  assert.equal(calls.filter((x) => x.type === "rpc")[0].args.p_limit, 3);
  assert.doesNotMatch(reader, /SERVICE_ROLE_KEY|service_role/);
  assert.match(reader, /cache: "no-store"/);
  assert.match(reader, /AbortSignal\.timeout\(2500\)/);
});

test("SP4 keeps login first and Steel Pulse supplementary and accessible", () => {
  assert.match(login, /safeInternalNext\(next, "\/dashboard"\)/);
  assert.match(login, /<form action=\{login\}/);
  assert.match(login, /role="alert"/);
  assert.match(login, /role="status" aria-live="polite"/);
  assert.match(login, /aria-label="Accesso al workspace"/);
  assert.match(login, /lg:grid-cols-\[minmax\(0,460px\)_minmax\(0,1fr\)\]/);
  assert.match(login, /<Suspense fallback=\{<SteelPulsePreview cards=\{\[\]\} \/>\}>/);
  assert.match(login, /Registra o verifica l’azienda/);
  assert.match(preview, /<aside[\s\S]*aria-labelledby="steel-pulse-heading"/);
  assert.match(preview, /id="steel-pulse"/);
  assert.match(preview, /In preparazione/);
  assert.match(preview, /Esplora la Scuola/);
  assert.match(preview, /Fonte: \{card.source_name\}/);
  assert.match(preview, /rel="noopener noreferrer"/);
  assert.match(preview, /news\.map\(\(card\) =>/);
  assert.doesNotMatch(preview, /innerHTML|dangerouslySetInnerHTML/);
});

test("SP4 requires explicit feature enable and audited limited anonymous function", () => {
  assert.match(migration, /enabled boolean not null default false/);
  assert.match(migration, /insert into steel_pulse_private\.publication_settings\(singleton,enabled\) values\(true,false\)/);
  assert.match(migration, /sp3_currently_eligible_cards/);
  assert.match(migration, /p_limit between 1 and 3/);
  assert.match(migration, /grant execute on function public\.sp4_public_steel_pulse_feed\(integer\)/);
  assert.doesNotMatch(migration, /grant select on steel_pulse_private\.(editorial_cards|publication_settings).*anon/);
  assert.match(hp13, /anonymous SECURITY DEFINER surface must remain exactly the reviewed 11 RPCs/);
  assert.match(hp13, /'sp4_public_steel_pulse_feed'/);
});
