import assert from "node:assert/strict";
import test from "node:test";
import { assessReleaseDay, localDay, getProductionDeployments, main } from "../scripts/release-ops1-preflight.mjs";

const now = Date.parse("2026-11-02T13:00:00.000Z");
const entry = (id, created, state = "READY", target = "production") =>
  ({ id, created: Date.parse(created), target, state, meta: { githubCommitSha: "fixture" } });

test("RELEASE-OPS1 uses Europe/Rome days, including midnight boundaries and DST", () => {
  assert.equal(localDay("2026-11-01T23:15:00.000Z"), "2026-11-02");
  assert.equal(localDay("2026-11-01T22:30:00.000Z"), "2026-11-01");
  assert.equal(localDay("2026-07-31T22:15:00.000Z"), "2026-08-01"); // CEST UTC+2
  assert.equal(localDay("2026-10-25T01:45:00.000Z"), "2026-10-25"); // DST fall-back
  assert.throws(() => localDay("yesterday"), /Invalid timestamp/);
});

test("RELEASE-OPS1 blocks any same-day READY or in-flight production, not previews or prior day", () => {
  const all = [
    entry("yesterday", "2026-11-01T22:30:00.000Z"),
    entry("preview", "2026-11-02T11:30:00.000Z", "READY", "preview"),
    entry("canceled", "2026-11-02T10:30:00.000Z", "CANCELED"),
  ];
  assert.equal(assessReleaseDay(all, { now }).allowed, true);
  const today = entry("same-day", "2026-11-01T23:30:00.000Z");
  const audit = assessReleaseDay([...all, today, today], { now });
  assert.equal(audit.allowed, false);
  assert.equal(audit.blockerCount, 1, "deduplicate overlapping pagination");
  assert.equal(audit.deployments[0].id, "same-day");
  for (const status of ["QUEUED", "BUILDING", "INITIALIZING", "PENDING"]) {
    assert.equal(assessReleaseDay([entry(status, "2026-11-02T08:00:00.000Z", status)], { now }).allowed, false);
  }
  assert.equal(assessReleaseDay([entry("error", "2026-11-02T08:00:00.000Z", "ERROR")], { now }).allowed, true);
});

test("RELEASE-OPS1 rejects missing/incomplete deployment evidence", () => {
  assert.throws(() => assessReleaseDay(null), /Missing deployments/);
  assert.throws(() => assessReleaseDay([{}], { now }), /without ID/);
  assert.throws(() => assessReleaseDay([{ id: "x", target: "production", state: "READY" }], { now }), /missing timestamp/);
  assert.throws(() => assessReleaseDay([entry("x", "2026-11-02T12:00:00.000Z", "")], { now }), /missing state/);
});

test("RELEASE-OPS1 REST queries are read-only, scoped, paginated and fail closed", async () => {
  const seen = [];
  const call = async (url, options) => {
    seen.push({ url: new URL(url), options });
    return {
      ok: true,
      json: async () => seen.length === 1
        ? { deployments: [entry("first", "2026-11-02T11:00:00.000Z")], pagination: { next: now - 120000 } }
        : { deployments: [entry("second", "2026-11-02T12:00:00.000Z")], pagination: { next: null } },
    };
  };
  const found = await getProductionDeployments({ token: "fake-token", projectId: "prj_fixture", teamId: "team_fixture", now, fetchImpl: call });
  assert.equal(found.length, 2);
  assert.equal(seen.length, 2);
  for (const c of seen) {
    assert.equal(c.url.origin, "https://api.vercel.com");
    assert.equal(c.url.pathname, "/v6/deployments");
    assert.equal(c.url.searchParams.get("target"), "production");
    assert.equal(c.url.searchParams.get("projectId"), "prj_fixture");
    assert.equal(c.url.searchParams.get("teamId"), "team_fixture");
    assert.equal(c.options.method, "GET");
    assert.equal(c.options.headers.Authorization, "Bearer fake-token");
  }
  assert.ok(seen[1].url.searchParams.has("until"), "second page has cursor");
  await assert.rejects(getProductionDeployments({ token: "", projectId: "a", teamId: "b", now, fetchImpl: call }), /Missing Vercel/);
  await assert.rejects(getProductionDeployments({ token: "fake", projectId: "a", teamId: "b", now,
    fetchImpl: async () => ({ ok: false, status: 403 }),
  }), /HTTP 403/);
  await assert.rejects(getProductionDeployments({ token: "fake", projectId: "a", teamId: "b", now,
    fetchImpl: async () => ({ ok: true, json: async () => ({ deployments: "not-a-list" }) }),
  }), /invalid deployment data/);
  assert.equal(await main({}), 3, "no credentials is inconclusive, never PASS");
});
