/** Actual local HTTP Worker and PostgREST: no mocked retrieval or inference. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

assert.equal(process.env.CI, 'true');
assert.equal(process.env.NEXT_PUBLIC_SUPABASE_URL, 'http://127.0.0.1:54321');
assert.equal(process.env.WORKER_URL, 'http://127.0.0.1:8001');
assert.ok(process.env.WORKER_INTERNAL_TOKEN);
const personas = JSON.parse(readFileSync(path.join(process.env.RUNNER_TEMP, 'demotest23-personas.json'), 'utf8'));
const post = (actor, types, token = process.env.WORKER_INTERNAL_TOKEN) => fetch(process.env.WORKER_URL + '/v1/global-search', {
  method: 'POST', headers: { 'content-type': 'application/json', 'x-worker-token': token },
  body: JSON.stringify({ actor_user_id: actor, query: 'FLOW1 LOCAL STEEL', types, limit: 40 }),
  signal: AbortSignal.timeout(25000),
});
for (const [id, own, foreign] of [['buyer', 'flow1-buyer-synthetic.eml', 'flow1-producer-synthetic.eml'],
  ['producer', 'flow1-producer-synthetic.eml', 'flow1-buyer-synthetic.eml']]) {
  const persona = personas.find(p => p.id === id);
  const auth = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await auth.auth.signInWithPassword({ email: persona.email, password: persona.password });
  assert.equal(error, null, 'Real local GoTrue login must succeed');
  const claims = await auth.auth.getClaims(data.session.access_token);
  assert.equal(claims.error, null);
  assert.equal(claims.data.claims.sub, persona.userId);
  assert.equal((await post(persona.userId, [], 'synthetic-invalid-token')).status, 401);
  const response = await post(claims.data.claims.sub, []);
  assert.equal(response.status, 200, 'Unfiltered real Worker search must retain structured matches without a model');
  const body = await response.json();
  assert.equal(body.model, null, 'Fixture must exercise no-model path');
  assert.ok(body.results.some(row => row.source_filename === own), 'Own structured source is missing');
  assert.ok(!body.results.some(row => row.source_filename === foreign), 'Foreign structured source leaked');
  assert.ok(body.results.some(row => row.result_type === 'product' && Number(row.outer_diameter_mm) === 60.3 && Number(row.thickness_mm) === 3.2),
    'Verified geometry must reach actual Worker response');
  const documentsOnly = await post(persona.userId, ['document']);
  assert.equal(documentsOnly.status, 400, 'Documents-only search must expose missing configuration instead of inventing results');
  console.log('FLOW1 actual Worker/PostgREST PASS', id, 'unfiltered fallback, geometry, isolation, bad-token denial, documents-only error');
}
