/**
 * RELEASE-OPS1 — read-only, fail-closed preflight for a *manual* production release.
 *
 * This checks Vercel's deployment history. It does NOT intercept Git pushes,
 * override Vercel's Git integration, or itself authorize a production deployment.
 * Only production deployments for the fixed project/team are queried.
 *
 * Requires VERCEL_TOKEN (read-only deployment access), VERCEL_PROJECT_ID,
 * and VERCEL_TEAM_ID. Never log credentials.
 */
import { pathToFileURL } from "node:url";

const TIMEZONE = "Europe/Rome";
const BLOCKING_STATES = new Set(["READY", "BUILDING", "QUEUED", "INITIALIZING", "PENDING"]);

export function localDay(timestamp, timezone = TIMEZONE) {
  const dt = new Date(timestamp);
  if (!Number.isFinite(dt.getTime())) throw new TypeError("Invalid timestamp");
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(dt);
  const values = Object.fromEntries(parts.filter(p => p.type !== "literal").map(p => [p.type, p.value]));
  return values.year + "-" + values.month + "-" + values.day;
}

export function assessReleaseDay(deployments, { now = Date.now(), timezone = TIMEZONE } = {}) {
  if (!Array.isArray(deployments)) throw new TypeError("Missing deployments array");
  const date = localDay(now, timezone);
  const seen = new Set();
  const relevant = [];
  for (const item of deployments) {
    if (!item || typeof item !== "object") throw new TypeError("Malformed deployment");
    if (!item.id && !item.uid) throw new TypeError("Deployment without ID");
    const id = String(item.id || item.uid);
    if (seen.has(id)) continue;
    seen.add(id);
    const created = Number(item.created ?? item.createdAt);
    if (!Number.isFinite(created)) throw new TypeError("Deployment missing timestamp");
    if (item.target !== "production") continue;
    if (localDay(created, timezone) !== date) continue;
    const state = String(item.state ?? item.readyState ?? "").toUpperCase();
    if (!state) throw new TypeError("Production deployment missing state");
    if (BLOCKING_STATES.has(state)) {
      relevant.push({ id, state, sha: item.meta?.githubCommitSha ?? null, createdAt: new Date(created).toISOString() });
    }
  }
  relevant.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  return { date, timezone, allowed: relevant.length === 0, blockerCount: relevant.length, deployments: relevant };
}

export async function getProductionDeployments({
  token, projectId, teamId, now = Date.now(), fetchImpl = fetch,
}) {
  if (!token || !projectId || !teamId) throw new Error("Missing Vercel read-only preflight credentials or IDs");
  const date = localDay(now);
  // The previous UTC day safely covers the current Europe/Rome calendar day (DST inclusive).
  const since = Date.parse(date + "T00:00:00.000Z") - 24 * 60 * 60 * 1000;
  if (!Number.isFinite(since)) throw new Error("Invalid preflight date");
  let until = null;
  const seenCursors = new Set();
  const deployments = [];
  for (let page = 0; page < 20; page += 1) {
    const url = new URL("https://api.vercel.com/v6/deployments");
    url.searchParams.set("projectId", projectId);
    url.searchParams.set("teamId", teamId);
    url.searchParams.set("target", "production");
    url.searchParams.set("since", String(since));
    url.searchParams.set("limit", "100");
    if (until !== null) url.searchParams.set("until", String(until));
    const response = await fetchImpl(url, {
      method: "GET",
      headers: { Authorization: "Bearer " + token, Accept: "application/json" },
    });
    if (!response.ok) throw new Error("Vercel preflight API unavailable: HTTP " + response.status);
    const data = await response.json();
    if (!data || !Array.isArray(data.deployments)) throw new Error("Vercel returned invalid deployment data");
    deployments.push(...data.deployments);
    const cursor = data.pagination?.next;
    if (cursor == null || data.deployments.length === 0) return deployments;
    if (!Number.isFinite(Number(cursor)) || seenCursors.has(String(cursor))) {
      throw new Error("Vercel preflight pagination invalid");
    }
    if (Number(cursor) < since) return deployments;
    seenCursors.add(String(cursor));
    until = cursor;
  }
  throw new Error("Vercel deployment history exceeded preflight pagination limit");
}

export async function main(env = process.env) {
  try {
    // Fail closed: never claim that no deployments exist if Vercel could not be queried.
    const found = await getProductionDeployments({
      token: env.VERCEL_TOKEN,
      projectId: env.VERCEL_PROJECT_ID,
      teamId: env.VERCEL_TEAM_ID,
    });
    const audit = assessReleaseDay(found);
    console.log(JSON.stringify({
      releaseGate: "RELEASE-OPS1",
      status: audit.allowed ? "NO_EXISTING_PRODUCTION_DEPLOY" : "BLOCKED",
      day: audit.date,
      timezone: audit.timezone,
      blockers: audit.deployments,
      enforcement: "manual-preflight-only",
    }, null, 2));
    return audit.allowed ? 0 : 2;
  } catch (error) {
    console.error("RELEASE-OPS1 INCONCLUSIVE — production release blocked:", error.message);
    return 3;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = await main();
}
