import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import vm from "node:vm";
import ts from "typescript";

const read=path=>readFileSync(new URL(path,import.meta.url),"utf8");
const sql=read("../../../supabase/migrations/20261116210000_home_netpro_public1_network_counts.sql");
const lib=read("../lib/public-network-counts.ts");
const ui=read("../components/public-network-pro.tsx");
const home=read("../app/(italian)/page.tsx");
const hero=read("../components/public-cinematic-hero.tsx");
const explorer=read("../components/public-network-role-explorer.tsx");
const nav=read("../components/public-home-navigation.tsx");

const src=lib.slice(lib.indexOf("export type PublicNetworkCounts"),lib.indexOf("export const getPublicNetworkCounts"));
const out=ts.transpileModule(src,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const box={exports:{},module:{exports:{}}};box.module.exports=box.exports;vm.runInNewContext(out,box);
const {parsePublicNetworkCounts}=box.exports;

test("HOME-NETPRO-PUBLIC1 SQL: aggregate counts only, anon-callable, same rules as coverage",()=>{
  // SEC1: privileged implementation in sec1_public, SECURITY INVOKER facade in public.
  assert.match(sql,/create or replace function sec1_public\.public_network_counts_impl\(\)\s+returns jsonb\s+language sql\s+stable\s+security definer/);
  assert.match(sql,/create or replace function public\.public_network_counts\(\)\s+returns jsonb\s+language sql\s+stable\s+security invoker/);
  assert.match(sql,/c\.publication_status = 'published'\s+and c\.archived_at is null\s+and private\.netpro1b_europe_country\(c\.country_code\)/);
  assert.match(sql,/grant execute on function public\.public_network_counts\(\) to anon, authenticated, service_role;/);
  const output=sql.slice(sql.indexOf("jsonb_build_object("));
  assert.doesNotMatch(output,/legal_name|trading_name|website|email|phone|city|\bid\b'/,"no per-company fields in the output");
});

test("HOME-NETPRO-PUBLIC1 parser rejects anything but a complete, sane payload",()=>{
  const ok={contract:"public-network-counts-v1",total:1384,italy:1150,countries:2,modules:{producers:76,distributors:236,processors:721,end_users:117}};
  assert.deepEqual({...parsePublicNetworkCounts(ok)},{total:1384,italy:1150,countries:2,producers:76,distributors:236,processors:721,endUsers:117});
  assert.equal(parsePublicNetworkCounts(null),null);
  assert.equal(parsePublicNetworkCounts({...ok,contract:"x"}),null);
  assert.equal(parsePublicNetworkCounts({...ok,total:-1}),null);
  assert.equal(parsePublicNetworkCounts({...ok,italy:2000}),null);
  assert.equal(parsePublicNetworkCounts({...ok,modules:{producers:1}}),null);
});

test("HOME-NETPRO-PUBLIC1 page stays static, refreshed hourly; numbers hidden when unavailable",()=>{
  assert.match(home,/export const dynamic = "force-static";/);
  assert.match(home,/export const revalidate = 3600;/);
  assert.match(lib,/^import "server-only";/);
  assert.match(lib,/export const getPublicNetworkCounts = cache\(/);
  assert.match(lib,/createPublicSupabaseClient\(\)/);
  assert.match(ui,/\{counts \? \(\s*<div className="mt-4" data-testid="public-network-pro-counts">/);
});

test("HOME-NETPRO-PUBLIC2 one screen: Network card in the hero next to the headline; no price; CTA to registration",()=>{
  assert.doesNotMatch(ui,/€|NETWORK_PRO_PRICE_BOOK|\/ mese/);
  assert.match(ui,/href="\/register" data-testid="public-network-pro-register"/);
  assert.match(hero,/\{en \? null : <PublicNetworkProHeroCard \/>\}/);
  assert.match(hero,/max-lg:flex-col max-lg:items-start/);
  // The pill and the separate showcase were folded into the hero card.
  assert.doesNotMatch(hero+explorer,/PublicNetworkProPill|PublicNetworkProShowcase/);
  // EN keeps the original illustration; the overlay/aside markup stays in source.
  assert.match(hero,/<aside className=\{styles\.productHint\}/);
  assert.match(nav,/item\.label === "Network" \? <ProBadge \/> : null/);
});
